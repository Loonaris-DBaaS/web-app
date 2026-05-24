import { randomUUID } from 'crypto';
import prisma from '@/db';
import { CreateClusterDto, SIZE_SPECS, DeploymentOption } from '../dto/create-cluster.dto';
import { ClusterDto } from '../dto/cluster.dto';
import { provisionCluster, deprovisionCluster } from '../provisioning/provisioning';
import type { Project } from '@/generated/prisma/client';

function toDto(p: Project): ClusterDto {
  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    k8sNamespace: p.k8sNamespace,
    region: p.region,
    pgVersion: p.pgVersion as ClusterDto['pgVersion'],
    deploymentOption: p.deploymentOption as DeploymentOption,
    status: p.status as ClusterDto['status'],
    estimatedPrice: p.estimatedPrice,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function listClusters(tenantId: string): Promise<ClusterDto[]> {
  const rows = await prisma.project.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toDto);
}

export async function getCluster(tenantId: string, clusterId: string): Promise<ClusterDto | null> {
  const row = await prisma.project.findFirst({ where: { id: clusterId, tenantId } });
  return row ? toDto(row) : null;
}

export async function createCluster(tenantId: string, dto: CreateClusterDto): Promise<ClusterDto> {
  const clusterId = randomUUID();
  const namespace = `tenant-${tenantId.slice(0, 8)}-${clusterId.slice(0, 8)}`;
  const specs = SIZE_SPECS[dto.size];
  const replicas = dto.readReplicas ?? 1;
  const multiplier =
    dto.deploymentOption === 'MULTI_AZ_CLUSTER' ? 1 + replicas
    : dto.deploymentOption === 'MULTI_AZ_INSTANCE' ? 2
    : 1;
  const estimatedPrice = specs.price * multiplier + (dto.backup ? 5 : 0);

  const { status } = await provisionCluster(clusterId, dto);

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
      status,
      resourceConfig: {
        create: {
          desiredReplicas: replicas,
          enableBackup: dto.backup ?? true,
          desiredStorage: specs.storage,
          desiredRam: specs.ram,
          desiredCpu: specs.cpu,
        },
      },
    },
  });

  return toDto(row);
}

export async function deleteCluster(tenantId: string, clusterId: string): Promise<boolean> {
  const row = await prisma.project.findFirst({ where: { id: clusterId, tenantId } });
  if (!row) return false;

  await deprovisionCluster(row.k8sNamespace);
  await prisma.project.update({ where: { id: clusterId }, data: { status: 'deleting' } });

  return true;
}
