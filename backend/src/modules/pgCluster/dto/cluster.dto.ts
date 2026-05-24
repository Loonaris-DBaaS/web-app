import { ClusterSize, DeploymentOption, PgVersion } from './create-cluster.dto';

export type ClusterStatus = 'provisioning' | 'running' | 'stopped' | 'error' | 'deleting';

export interface ClusterDto {
  id: string;
  tenantId: string;
  name: string;
  region: string;
  pgVersion: PgVersion;
  size: ClusterSize;
  deploymentOption: DeploymentOption;
  readReplicas: number;
  backup: boolean;
  status: ClusterStatus;
  createdAt: string;
}
