export type PgVersion = '16' | '17' | '18';
export type ClusterSize = 'starter' | 'pro' | 'scale';

export interface CreateClusterDto {
  name: string;
  region: string;
  pgVersion: PgVersion;
  size: ClusterSize;
  instances: number;
  backup?: boolean;
}

export const SIZE_SPECS: Record<ClusterSize, { cpu: string; ram: string; storage: string; price: number }> = {
  starter: { cpu: '1',  ram: '2Gi',  storage: '10Gi',  price: 29  },
  pro:     { cpu: '2',  ram: '4Gi',  storage: '50Gi',  price: 79  },
  scale:   { cpu: '4',  ram: '16Gi', storage: '200Gi', price: 199 },
};
