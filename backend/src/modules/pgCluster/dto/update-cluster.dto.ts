import { PgVersion, ClusterSize } from './create-cluster.dto';

export interface UpdateClusterDto {
  name?: string;
  region?: string;
  pgVersion?: PgVersion;
  instances?: number;
  cpu?: string;
  ram?: string;
  storage?: string;
  size?: ClusterSize;
  backup?: boolean;
  autoscale?: boolean;
}
