export type PgVersion = '16' | '17' | '18';
export type ClusterSize = 'starter' | 'pro' | 'scale';
export type DeploymentOption = 'multi-az-cluster' | 'multi-az-instance' | 'single-az-instance';

export interface CreateClusterDto {
  name: string;
  region: string;
  pgVersion: PgVersion;
  size: ClusterSize;
  deploymentOption: DeploymentOption;
  readReplicas?: number;
  backup?: boolean;
}
