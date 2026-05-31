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

// Plans differ only by storage (the real PVC size) and price. CPU/RAM are NOT
// per-plan: every CNPG pod gets the same fixed resource limit (see provisioning).
export const SIZE_SPECS: Record<ClusterSize, { storage: string; price: number }> = {
  starter: { storage: '10Gi',  price: 29  },
  pro:     { storage: '50Gi',  price: 79  },
  scale:   { storage: '200Gi', price: 199 },
};
