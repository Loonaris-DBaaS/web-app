export type PgVersion = '16' | '17' | '18';
export type ClusterSize = 'starter' | 'standard' | 'pro';

export interface CreateClusterDto {
  name: string;
  region: string;
  pgVersion: PgVersion;
  size: ClusterSize;
  instances: number;
  backup?: boolean;
}

export const SIZE_SPECS: Record<ClusterSize, { storage: string }> = {
  starter: { storage: '5Gi' },
  standard: { storage: '10Gi' },
  pro: { storage: '20Gi' },
};
