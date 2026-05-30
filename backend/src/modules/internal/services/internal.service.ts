import prisma from '@/lib/prisma';

export interface TenantRoute {
  tenant_id: string;
  pgbouncer_rw_host: string;
  pgbouncer_rw_port: number;
  pgbouncer_ro_host: string;
  pgbouncer_ro_port: number;
  status: string;
}

function mapStatus(dbStatus: string): string {
  if (dbStatus === 'running') return 'active';
  return dbStatus;
}

export async function lookupRoute(keyHash: string): Promise<TenantRoute | null> {
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      project: {
        include: { poolers: true },
      },
    },
  });

  if (!apiKey || apiKey.revokedAt) return null;

  const project = apiKey.project;
  if (!project) return null;

  const pooler = project.poolers[0];
  if (!pooler) return null;

  return {
    tenant_id: project.k8sNamespace,
    pgbouncer_rw_host: pooler.rwHost,
    pgbouncer_rw_port: pooler.rwPort,
    pgbouncer_ro_host: pooler.roHost,
    pgbouncer_ro_port: pooler.roPort,
    status: mapStatus(project.status),
  };
}
