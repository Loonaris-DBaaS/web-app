import { DeploymentOption, PgVersion } from './create-cluster.dto';

export type ProjectStatus = 'provisioning' | 'running' | 'stopped' | 'error' | 'deleting';

export interface ClusterDto {
  id: string;
  tenantId: string;
  name: string;
  k8sNamespace: string;
  region: string;
  pgVersion: PgVersion;
  deploymentOption: DeploymentOption;
  status: ProjectStatus;
  estimatedPrice: number;
  createdAt: string;
}
