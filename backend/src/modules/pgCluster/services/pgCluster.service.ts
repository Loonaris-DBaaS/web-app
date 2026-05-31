import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { generateBaseKey, sha256Hex, formatApiKey } from '@/lib/crypto';
import { CreateClusterDto, SIZE_SPECS, type ClusterSize } from '../dto/create-cluster.dto';
import { ClusterDto, ClusterCreatedDto, ApiKeyRotatedDto } from '../dto/cluster.dto';
import { UpdateClusterDto } from '../dto/update-cluster.dto';
import { provisionCluster, deprovisionCluster, getClusterLiveMetrics, ClusterLiveMetrics } from '../provisioning/provisioning';
import type { Project, ResourceConfig } from '@/generated/prisma/client';

type ProjectWithResourceConfig = Project & {
  resourceConfig?: ResourceConfig | null;
};

// Public db-gateway endpoint (NLB). Tenants connect here with their sk_live key
// as the username; the database is always `app` and the gateway rejects TLS.
// Mirrors the frontend's VITE_GATEWAY_HOST default.
const GATEWAY_HOST =
  process.env.GATEWAY_HOST ||
  'ab571a35c49414eaab905fc43405b7fb-9f85c871b90b857f.elb.eu-west-3.amazonaws.com';

function buildConnectionString(apiKey: string): string {
  return `postgresql://${apiKey}@${GATEWAY_HOST}:5432/app?sslmode=disable`;
}

function toGiSuffix(value: string | number): string {
  const s = String(value);
  return s.endsWith('Gi') ? s : `${s}Gi`;
}

function parseStorageToGb(storage: string | null | undefined): number {
  if (!storage) return 0;
  const match = storage.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function inferClusterSize(resourceConfig: { desiredStorage?: string | null } | null | undefined): ClusterSize {
  const storage = resourceConfig?.desiredStorage;
  return (
    (Object.entries(SIZE_SPECS).find(([, s]) => s.storage === storage)?.[0] as ClusterSize | undefined) ?? 'pro'
  );
}

function toDto(p: ProjectWithResourceConfig): ClusterDto {
  const resourceConfig = p.resourceConfig;
  const size = inferClusterSize(resourceConfig);

  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    k8sNamespace: p.k8sNamespace,
    region: p.region,
    pgVersion: p.pgVersion as ClusterDto['pgVersion'],
    size,
    instances: resourceConfig?.instances ?? 1,
    status: p.status as ClusterDto['status'],
    storage: resourceConfig?.desiredStorage ?? '',
    backup: resourceConfig?.enableBackup ?? false,
    autoscale: resourceConfig?.enableAutoscale ?? false,
    storageUsedGb: Number(p.storageUsage ?? 0),
    provisionedStorageGb: parseStorageToGb(resourceConfig?.desiredStorage),
    estimatedPrice: p.estimatedPrice,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function listClusters(tenantId: string): Promise<ClusterDto[]> {
  const rows = await prisma.project.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { resourceConfig: true },
  });
  return rows.map(toDto);
}

export async function getCluster(tenantId: string, clusterId: string): Promise<ClusterDto | null> {
  const row = await prisma.project.findFirst({
    where: { id: clusterId, tenantId },
    include: { resourceConfig: true },
  });
  return row ? toDto(row) : null;
}

export async function createCluster(
  tenantId: string,
  dto: CreateClusterDto,
): Promise<ClusterCreatedDto> {
  const clusterId = randomUUID();
  const namespace = `project-${clusterId}`;
  const specs = SIZE_SPECS[dto.size];
  const instances = dto.instances ?? 1;
  const estimatedPrice = specs.price * instances + (dto.backup ? 5 : 0);

  const baseKey = generateBaseKey();
  const keyHash = sha256Hex(baseKey);
  // The same base key routes both modes through the gateway; the rw/ro suffix
  // selects the upstream pooler. `apiKey` (rw) is returned for the one-time key
  // display; both full connection strings are persisted below.
  const apiKey = formatApiKey(baseKey, 'rw');
  const rwConnectionString = buildConnectionString(apiKey);
  const roConnectionString = buildConnectionString(formatApiKey(baseKey, 'ro'));

  // CNPG creates a ClusterIP Service named after each Pooler resource.
  const rwHost = `pooler-rw.${namespace}.svc.cluster.local`;
  const roHost = `pooler-ro.${namespace}.svc.cluster.local`;

  // Provisioning (CNPG health polling) can take minutes, so we don't block the
  // HTTP request. The project starts in `provisioning` and is updated once the
  // background provision finishes (see fire-and-forget call below).
  const provStatus = 'provisioning' as const;

  const row = await prisma.project.create({
    data: {
      id: clusterId,
      tenantId,
      name: dto.name,
      k8sNamespace: namespace,
      region: dto.region,
      pgVersion: dto.pgVersion,
      estimatedPrice,
      status: provStatus,
      resourceConfig: {
        create: {
          instances,
          enableBackup: dto.backup ?? true,
          // Autoscale isn't wired to anything yet — don't fake it (was a hidden
          // auto-set from size === 'scale').
          enableAutoscale: false,
          desiredStorage: specs.storage,
        },
      },
      poolers: {
        create: {
          rwHost,
          rwPort: 5432,
          roHost,
          roPort: 5432,
        },
      },
      apiKeys: {
        create: {
          keyHash,
          prefix: 'sk_live_',
          duration: 90,
        },
      },
    },
  });

  const created = await prisma.project.findFirstOrThrow({
    where: { id: row.id },
    include: { resourceConfig: true },
  });

  // Fire-and-forget: provision in EKS in the background and persist the final
  // status (running / error) once CNPG health polling completes.
  void provisionCluster(clusterId, namespace, dto)
    .then(({ status }) =>
      prisma.project.update({ where: { id: clusterId }, data: { status } }),
    )
    .catch(async (err) => {
      console.error(`[provisioning] background provision failed for ${clusterId}:`, err);
      await prisma.project
        .update({ where: { id: clusterId }, data: { status: 'error' } })
        .catch(() => undefined);
    });

  // Connection strings are returned here ONCE for the user to copy. They embed
  // the plaintext key and are never persisted — only `keyHash` is stored.
  return { ...toDto(created), apiKey, rwConnectionString, roConnectionString };
}

// Rotates the cluster's API key: mints a fresh base key, replaces the stored
// hash (so the gateway immediately stops accepting the old key, modulo its
// ~60s route cache), and returns the new one-time secrets. Connection strings
// are never persisted, so this is the only way to recover access after the
// create-time display.
export async function regenerateApiKey(
  tenantId: string,
  clusterId: string,
): Promise<ApiKeyRotatedDto | null> {
  const project = await prisma.project.findFirst({
    where: { id: clusterId, tenantId },
    include: { apiKeys: true },
  });
  if (!project) return null;

  const baseKey = generateBaseKey();
  const keyHash = sha256Hex(baseKey);
  const apiKey = formatApiKey(baseKey, 'rw');
  const rwConnectionString = buildConnectionString(apiKey);
  const roConnectionString = buildConnectionString(formatApiKey(baseKey, 'ro'));

  const existing = project.apiKeys[0];
  if (existing) {
    await prisma.apiKey.update({
      where: { id: existing.id },
      data: { keyHash, revokedAt: null, createdAt: new Date() },
    });
  } else {
    await prisma.apiKey.create({
      data: { projectId: clusterId, keyHash, prefix: 'sk_live_', duration: 90 },
    });
  }

  return { apiKey, rwConnectionString, roConnectionString };
}

export async function updateCluster(
  tenantId: string,
  clusterId: string,
  dto: UpdateClusterDto,
): Promise<ClusterDto | null> {
  const row = await prisma.project.findFirst({
    where: { id: clusterId, tenantId },
    include: { resourceConfig: true },
  });

  if (!row) return null;

  const nextInstances = dto.instances ?? row.resourceConfig?.instances ?? 1;
  const nextBackup = dto.backup ?? row.resourceConfig?.enableBackup ?? false;
  const nextStorage = dto.storage ? toGiSuffix(dto.storage) : (row.resourceConfig?.desiredStorage ?? '50Gi');
  const estimatedPrice =
    SIZE_SPECS[inferClusterSize({ desiredStorage: nextStorage })].price * nextInstances +
    (nextBackup ? 5 : 0);

  const shouldReconcile =
    dto.storage !== undefined ||
    dto.pgVersion !== undefined ||
    dto.instances !== undefined;

  const updated = await prisma.project.update({
    where: { id: clusterId },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.region !== undefined ? { region: dto.region } : {}),
      ...(dto.pgVersion !== undefined ? { pgVersion: dto.pgVersion } : {}),
      estimatedPrice,
      ...(shouldReconcile ? { status: 'provisioning' } : {}),
      resourceConfig: row.resourceConfig
        ? {
            update: {
              ...(dto.instances !== undefined ? { instances: nextInstances } : {}),
              ...(dto.storage !== undefined ? { desiredStorage: toGiSuffix(dto.storage) } : {}),
              ...(dto.backup !== undefined ? { enableBackup: nextBackup } : {}),
              ...(dto.autoscale !== undefined ? { enableAutoscale: dto.autoscale } : {}),
            },
          }
        : {
            create: {
              instances: nextInstances,
              desiredStorage: nextStorage,
              enableBackup: nextBackup,
              enableAutoscale: false,
            },
          },
    },
    include: { resourceConfig: true },
  });

  return toDto(updated);
}

export async function getClusterMetrics(
  tenantId: string,
  clusterId: string,
): Promise<ClusterLiveMetrics | null> {
  const project = await prisma.project.findFirst({ where: { id: clusterId, tenantId } });
  if (!project) return null;

  const metrics = await getClusterLiveMetrics(project.k8sNamespace);

  if (metrics?.usedStorageGb !== null && metrics?.usedStorageGb !== undefined) {
    prisma.project
      .update({ where: { id: clusterId }, data: { storageUsage: metrics.usedStorageGb } })
      .catch((err) => console.warn('[metrics] Failed to persist storageUsage:', err));
  }

  return metrics;
}

// --- Admin (cross-tenant) helpers ---------------------------------------

export async function listAllClusters(): Promise<(ClusterDto & {
  tenant: { id: string; email: string; username: string };
})[]> {
  const rows = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      resourceConfig: true,
      tenant: { select: { id: true, email: true, username: true } },
    },
  });
  return rows.map((r) => ({ ...toDto(r), tenant: r.tenant }));
}

// Shared teardown: mark deleting, deprovision K8s in the background, then DELETE
// the Project row (cascades to Pooler/ApiKey/ResourceConfig) so it disappears
// from the dashboard/admin list. On failure, leave it in `error` (visible + retryable).
async function teardownCluster(clusterId: string, k8sNamespace: string): Promise<void> {
  await prisma.project.update({ where: { id: clusterId }, data: { status: 'deleting' } });
  deprovisionCluster(k8sNamespace)
    .then(() => prisma.project.delete({ where: { id: clusterId } }))
    .catch(async (err) => {
      console.error(`[delete] deprovision/delete failed for ${clusterId}:`, err);
      await prisma.project
        .update({ where: { id: clusterId }, data: { status: 'error' } })
        .catch(() => undefined);
    });
}

export async function deleteAnyCluster(clusterId: string): Promise<boolean> {
  const row = await prisma.project.findUnique({ where: { id: clusterId } });
  if (!row) return false;
  await teardownCluster(clusterId, row.k8sNamespace);
  return true;
}

export async function deleteCluster(tenantId: string, clusterId: string): Promise<boolean> {
  const row = await prisma.project.findFirst({ where: { id: clusterId, tenantId } });
  if (!row) return false;
  await teardownCluster(clusterId, row.k8sNamespace);
  return true;
}
