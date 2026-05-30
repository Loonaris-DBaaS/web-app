import { DeploymentOption, PgVersion } from './create-cluster.dto';

export interface UpdateClusterDto {
  name?: string;
  region?: string;
  pgVersion?: PgVersion;
  deploymentOption?: DeploymentOption;
  cpu?: string;
  ram?: string;
  storage?: string;
  readReplicas?: number;
  backup?: boolean;
  autoscale?: boolean;
}