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
  cpu: string;
  ram: string;
  storage: string;
  readReplicas: number;
  backup: boolean;
  autoscale: boolean;
  storageUsedGb: number;
  provisionedStorageGb: number;
  estimatedPrice: number;
  createdAt: string;
}
