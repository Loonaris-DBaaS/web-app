import { ClusterSize, PgVersion } from './create-cluster.dto';

export type ProjectStatus = 'provisioning' | 'running' | 'stopped' | 'error' | 'deleting';

export interface ClusterDto {
  id: string;
  tenantId: string;
  name: string;
  k8sNamespace: string;
  region: string;
  pgVersion: PgVersion;
  size: ClusterSize;
  instances: number;
  status: ProjectStatus;
  cpu: string;
  ram: string;
  storage: string;
  backup: boolean;
  autoscale: boolean;
  storageUsedGb: number;
  provisionedStorageGb: number;
  estimatedPrice: number;
  createdAt: string;
}

// The one-time secrets handed to the user at creation or after a regenerate:
// the rw API key plus both client-facing connection strings (rw/ro). Only the
// key hash is stored server-side, so these cannot be retrieved again later.
export interface ApiKeyRotatedDto {
  apiKey: string;
  rwConnectionString: string;
  roConnectionString: string;
}

// Returned ONLY from createCluster (HTTP 202): the full cluster plus the
// one-time secrets above.
export interface ClusterCreatedDto extends ClusterDto, ApiKeyRotatedDto {}
