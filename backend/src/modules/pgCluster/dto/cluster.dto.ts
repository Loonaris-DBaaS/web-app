import { ClusterSize, DeploymentOption, PgVersion } from './create-cluster.dto';

export type ProjectStatus = 'provisioning' | 'running' | 'stopped' | 'error' | 'deleting';

export interface ClusterDto {
  id: string;
  tenantId: string;
  name: string;
  k8sNamespace: string;
  region: string;
  pgVersion: PgVersion;
  size: ClusterSize;
  deploymentOption: DeploymentOption;
  status: ProjectStatus;
  readReplicas: number;
  backup: boolean;
  storageUsedGb: number;
  provisionedStorageGb: number;
  estimatedPrice: number;
  createdAt: string;
}
