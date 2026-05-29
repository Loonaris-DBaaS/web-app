import { CreateClusterDto } from '../dto/create-cluster.dto';
import { ProjectStatus } from '../dto/cluster.dto';

export interface ProvisionResult {
  externalId: string;
  status: ProjectStatus;
}

/**
 * Submits a CloudNativePG Cluster manifest to Kubernetes.
*/
export async function provisionCluster(
  clusterId: string,
  dto: CreateClusterDto,
): Promise<ProvisionResult> {
  // TODO: call the Kubernetes API (e.g. @kubernetes/client-node)
  // const k8s = new KubeConfig(); k8s.loadFromDefault();
  // const customApi = k8s.makeApiClient(CustomObjectsApi);
  // await customApi.createNamespacedCustomObject('postgresql.cnpg.io', 'v1', 'default', 'clusters', manifest);

  console.log(`[provisioning] Submitting cluster ${clusterId} (${dto.name}) to CloudNativePG`);

  return {
    externalId: `cnpg-${clusterId}`,
    status: 'provisioning',
  };
}

/**
 * Deletes the CloudNativePG Cluster resource from Kubernetes.
 */
export async function deprovisionCluster(namespace: string): Promise<void> {
  // TODO: call the Kubernetes API to delete the Cluster CR
  console.log(`[provisioning] Deleting cluster in namespace ${namespace} from CloudNativePG`);
}

/**
 * Polls the CloudNativePG Cluster resource and returns its current status.
 */
export async function getClusterStatus(externalId: string): Promise<ProjectStatus> {
  // TODO: read the Cluster CR status from Kubernetes and map to ClusterStatus
  console.log(`[provisioning] Polling status for ${externalId}`);
  return 'running';
}

export interface ClusterMetricsPoint {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
}

/**
 * Placeholder for future Kubernetes-backed metrics retrieval.
 */
export async function getClusterMetrics(_externalId: string): Promise<ClusterMetricsPoint[]> {
  // TODO: query Kubernetes / Prometheus and map the series to the dashboard model.
  return [];
}
