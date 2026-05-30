import { PgVersion } from './create-cluster.dto';

export interface UpdateClusterDto {
  name?: string;
  region?: string;
  pgVersion?: PgVersion;
  instances?: number;
  cpu?: string;
  ram?: string;
  storage?: string;
  backup?: boolean;
  autoscale?: boolean;
}
