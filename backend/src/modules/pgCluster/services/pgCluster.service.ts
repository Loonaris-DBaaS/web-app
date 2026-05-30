import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { generateBaseKey, sha256Hex, formatApiKey } from '@/lib/crypto';
import { CreateClusterDto, SIZE_SPECS, DeploymentOption, type ClusterSize } from '../dto/create-cluster.dto';
import { ClusterDto } from '../dto/cluster.dto';
import { UpdateClusterDto } from '../dto/update-cluster.dto';
import { provisionCluster, deprovisionCluster } from '../provisioning/provisioning';
import type { Project, ResourceConfig } from '@/generated/prisma/client';

type ProjectWithResourceConfig = Project & {
  resourceConfig?: ResourceConfig | null;
};

function parseStorageToGb(storage: string | null | undefined): number {
  if (!storage) {
    return 0;
  }

  const match = storage.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function inferClusterSize(resourceConfig: ResourceConfig | null | undefined): ClusterSize {
  const cpu = resourceConfig?.desiredCpu;
  return (
    (Object.entries(SIZE_SPECS).find(([, s]) => s.cpu === cpu)?.[0] as ClusterSize | undefined) ?? 'pro'
  );
}

function toDeploymentMultiplier(deploymentOption: DeploymentOption, readReplicas: number): number {
  if (deploymentOption === 'MULTI_AZ_CLUSTER') {
    return 1 + readReplicas;
  }

  if (deploymentOption === 'MULTI_AZ_INSTANCE') {
    return 2;
  }

  return 1;
}

function toDto(p: ProjectWithResourceConfig): ClusterDto {
  const resourceConfig = p.resourceConfig;
  const readReplicas = resourceConfig?.desiredReplicas ?? 1;
  const size = inferClusterSize(resourceConfig);

  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    k8sNamespace: p.k8sNamespace,
    region: p.region,
    pgVersion: p.pgVersion as ClusterDto['pgVersion'],
    size,
    deploymentOption: p.deploymentOption as DeploymentOption,
    status: p.status as ClusterDto['status'],
    cpu: resourceConfig?.desiredCpu ?? '',
    ram: resourceConfig?.desiredRam ?? '',
    storage: resourceConfig?.desiredStorage ?? '',
    readReplicas,
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
  const replicas = dto.readReplicas ?? 1;
  const multiplier =
    dto.deploymentOption === 'MULTI_AZ_CLUSTER'
      ? 1 + replicas
      : dto.deploymentOption === 'MULTI_AZ_INSTANCE'
        ? 2
        : 1;
  const estimatedPrice = specs.price * multiplier + (dto.backup ? 5 : 0);

  const baseKey = generateBaseKey();
  const keyHash = sha256Hex(baseKey);
  const apiKey = formatApiKey(baseKey, 'rw');

  const rwHost = `pooler-rw-svc.${namespace}.svc.cluster.local`;
  const roHost = `pooler-ro-svc.${namespace}.svc.cluster.local`;

  const { status: provStatus } = await provisionCluster(clusterId, namespace, dto);

  const row = await prisma.project.create({
    data: {
      id: clusterId,
      tenantId,
      name: dto.name,
      k8sNamespace: namespace,
      region: dto.region,
      pgVersion: dto.pgVersion,
      deploymentOption: dto.deploymentOption,
      estimatedPrice,
      status: 'provisioning': provStatus,
      resourceConfig: {
        create: {
          desiredReplicas: replicas,
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

  return { ...toDto(row), apiKey };
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

  if (!row) {
    return null;
  }

  const nextDeploymentOption = dto.deploymentOption ?? (row.deploymentOption as DeploymentOption);
  const nextReadReplicas = dto.readReplicas ?? row.resourceConfig?.desiredReplicas ?? 1;
  const nextBackup = dto.backup ?? row.resourceConfig?.enableBackup ?? false;
  const nextCpu = dto.cpu ?? row.resourceConfig?.desiredCpu ?? '2';
  const estimatedPrice =
    SIZE_SPECS[inferClusterSize({ ...row.resourceConfig, desiredCpu: nextCpu } as any)].price *
      toDeploymentMultiplier(nextDeploymentOption, nextReadReplicas) +
    (nextBackup ? 5 : 0);

  const shouldReconcile =
    dto.cpu !== undefined ||
    dto.ram !== undefined ||
    dto.storage !== undefined ||
    dto.pgVersion !== undefined ||
    dto.deploymentOption !== undefined ||
    dto.readReplicas !== undefined;

  const updated = await prisma.project.update({
    where: { id: clusterId },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.region !== undefined ? { region: dto.region } : {}),
      ...(dto.pgVersion !== undefined ? { pgVersion: dto.pgVersion } : {}),
      ...(dto.deploymentOption !== undefined ? { deploymentOption: dto.deploymentOption } : {}),
      estimatedPrice,
      ...(shouldReconcile ? { status: 'provisioning' } : {}),
      resourceConfig: row.resourceConfig
        ? {
            update: {
              ...(dto.cpu !== undefined ? { desiredCpu: dto.cpu } : {}),
              ...(dto.ram !== undefined ? { desiredRam: dto.ram } : {}),
              ...(dto.storage !== undefined ? { desiredStorage: dto.storage } : {}),
              ...(dto.readReplicas !== undefined ? { desiredReplicas: nextReadReplicas } : {}),
              ...(dto.backup !== undefined ? { enableBackup: nextBackup } : {}),
            },
          }
        : {
            create: {
              desiredCpu: nextCpu,
              desiredRam: dto.ram ?? '4Gi',
              desiredStorage: dto.storage ?? '50Gi',
              desiredReplicas: nextReadReplicas,
              enableBackup: nextBackup,
              enableAutoscale: false,
            },
          },
    },
    include: { resourceConfig: true },
  });

  return toDto(updated);
}

export async function deleteCluster(tenantId: string, clusterId: string): Promise<boolean> {
  const row = await prisma.project.findFirst({ where: { id: clusterId, tenantId } });
  if (!row) return false;

  await prisma.project.update({ where: { id: clusterId }, data: { status: 'deleting' } });
  deprovisionCluster(row.k8sNamespace).catch(async () => {
    await prisma.project.update({ where: { id: clusterId }, data: { status: 'error' } });
  });

  return true;
}
