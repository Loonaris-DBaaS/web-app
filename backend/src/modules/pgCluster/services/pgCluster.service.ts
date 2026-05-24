import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { CreateClusterDto } from '../dto/create-cluster.dto';
import { ClusterDto } from '../dto/cluster.dto';
import { provisionCluster, deprovisionCluster } from '../provisioning/provisioning';
import type { Cluster } from '@/generated/prisma/client';

function toDto(c: Cluster): ClusterDto {
  return {
    id: c.id,
    tenantId: c.tenantId,
    name: c.name,
    region: c.region,
    pgVersion: c.pgVersion as ClusterDto['pgVersion'],
    size: c.size as ClusterDto['size'],
    deploymentOption: c.deploymentOption as ClusterDto['deploymentOption'],
    readReplicas: c.readReplicas,
    backup: c.backup,
    status: c.status as ClusterDto['status'],
    createdAt: c.createdAt.toISOString(),
  };
}

export async function listClusters(tenantId: string): Promise<ClusterDto[]> {
  const rows = await prisma.cluster.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toDto);
}

export async function getCluster(tenantId: string, clusterId: string): Promise<ClusterDto | null> {
  const row = await prisma.cluster.findFirst({ where: { id: clusterId, tenantId } });
  return row ? toDto(row) : null;
}

export async function createCluster(tenantId: string, dto: CreateClusterDto): Promise<ClusterDto> {
  const clusterId = randomUUID();
  const { externalId, status } = await provisionCluster(clusterId, dto);

  const row = await prisma.cluster.create({
    data: {
      id: clusterId,
      tenantId,
      name: dto.name,
      region: dto.region,
      pgVersion: dto.pgVersion,
      size: dto.size,
      deploymentOption: dto.deploymentOption,
      readReplicas: dto.readReplicas ?? 1,
      backup: dto.backup ?? true,
      status,
      externalId,
    },
  });

  return toDto(row);
}

export async function deleteCluster(tenantId: string, clusterId: string): Promise<boolean> {
  const row = await prisma.cluster.findFirst({ where: { id: clusterId, tenantId } });
  if (!row) return false;

  await deprovisionCluster(row.externalId ?? clusterId);
  await prisma.cluster.update({ where: { id: clusterId }, data: { status: 'deleting' } });

  return true;
}
