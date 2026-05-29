import { ClusterSize, DeploymentOption, PgVersion } from './create-cluster.dto';

export interface UpdateClusterDto {
  name?: string;
  region?: string;
  pgVersion?: PgVersion;
  size?: ClusterSize;
  deploymentOption?: DeploymentOption;
  readReplicas?: number;
  backup?: boolean;
}