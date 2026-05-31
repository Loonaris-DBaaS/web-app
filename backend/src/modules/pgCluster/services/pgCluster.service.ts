import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { generateBaseKey, sha256Hex, formatApiKey } from '@/lib/crypto';
import { CreateClusterDto, SIZE_SPECS, type ClusterSize } from '../dto/create-cluster.dto';
import { ClusterDto } from '../dto/cluster.dto';
import { UpdateClusterDto } from '../dto/update-cluster.dto';
import { provisionCluster, deprovisionCluster } from '../provisioning/provisioning';
import type { Project, ResourceConfig } from '@/generated/prisma/client';

type ProjectWithResourceConfig = Project & {
  resourceConfig?: ResourceConfig | null;
};

function toGiSuffix(value: string | number): string {
  const s = String(value);
  return s.endsWith('Gi') ? s : `${s}Gi`;
}

function parseStorageToGb(storage: string | null | undefined): number {
  if (!storage) return 0;
  const match = storage.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function inferClusterSize(resourceConfig: ResourceConfig | null | undefined): ClusterSize {
  const cpu = resourceConfig?.desiredCpu;
  return (
    (Object.entries(SIZE_SPECS).find(([, s]) => s.cpu === cpu)?.[0] as ClusterSize | undefined) ?? 'pro'
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
    cpu: resourceConfig?.desiredCpu ?? '',
    ram: resourceConfig?.desiredRam ?? '',
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
): Promise<ClusterDto & { apiKey: string }> {
  const clusterId = randomUUID();
  const namespace = `project-${clusterId}`;
  const specs = SIZE_SPECS[dto.size];
  const instances = dto.instances ?? 1;
  const estimatedPrice = specs.price * instances + (dto.backup ? 5 : 0);

  const baseKey = generateBaseKey();
  const keyHash = sha256Hex(baseKey);
  const apiKey = formatApiKey(baseKey, 'rw');

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
          enableAutoscale: dto.size === 'scale',
          desiredStorage: specs.storage,
          desiredRam: specs.ram,
          desiredCpu: specs.cpu,
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

  return { ...toDto(created), apiKey };
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
  const nextCpu = dto.cpu ?? row.resourceConfig?.desiredCpu ?? '2';
  const estimatedPrice =
    SIZE_SPECS[inferClusterSize({ ...row.resourceConfig, desiredCpu: nextCpu } as any)].price * nextInstances +
    (nextBackup ? 5 : 0);

  const shouldReconcile =
    dto.cpu !== undefined ||
    dto.ram !== undefined ||
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
              ...(dto.cpu !== undefined ? { desiredCpu: String(dto.cpu) } : {}),
              ...(dto.ram !== undefined ? { desiredRam: toGiSuffix(dto.ram) } : {}),
              ...(dto.storage !== undefined ? { desiredStorage: toGiSuffix(dto.storage) } : {}),
              ...(dto.backup !== undefined ? { enableBackup: nextBackup } : {}),
              ...(dto.autoscale !== undefined ? { enableAutoscale: dto.autoscale } : {}),
            },
          }
        : {
            create: {
              instances: nextInstances,
              desiredCpu: nextCpu,
              desiredRam: dto.ram ? toGiSuffix(dto.ram) : '4Gi',
              desiredStorage: dto.storage ? toGiSuffix(dto.storage) : '50Gi',
              enableBackup: nextBackup,
              enableAutoscale: false,
            },
          },
    },
    include: { resourceConfig: true },
  });

  return toDto(updated);
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
