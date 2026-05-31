import * as k8s from '@kubernetes/client-node';
import aws4 from 'aws4';
import { CreateClusterDto, SIZE_SPECS } from '../dto/create-cluster.dto';
import { ProjectStatus } from '../dto/cluster.dto';

/**
 * Mints a short-lived EKS bearer token (the same scheme `aws eks get-token`
 * produces): a presigned STS GetCallerIdentity URL, base64url-encoded behind
 * the `k8s-aws-v1.` prefix. Needed because @kubernetes/client-node v1.x removed
 * the built-in `aws` authProvider, so we sign the request ourselves.
 */
function getEksBearerToken(clusterName: string, region: string): string {
  const opts = aws4.sign(
    {
      service: 'sts',
      region,
      method: 'GET',
      host: `sts.${region}.amazonaws.com`,
      path: '/?Action=GetCallerIdentity&Version=2011-06-15&X-Amz-Expires=60',
      headers: { 'X-K8s-Aws-Id': clusterName },
      signQuery: true,
    },
    {
      accessKeyId: process.env.K8S_AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.K8S_AWS_SECRET_ACCESS_KEY as string,
    },
  );
  const url = `https://${opts.host as string}${opts.path as string}`;
  return `k8s-aws-v1.${Buffer.from(url).toString('base64url')}`;
}

export interface ProvisionResult {
  externalId: string;
  status: ProjectStatus;
}

function getK8sClient(): {
  coreApi: k8s.CoreV1Api;
  appsApi: k8s.AppsV1Api;
  customApi: k8s.CustomObjectsApi;
} {
  const kc = new k8s.KubeConfig();

  const clusterEndpoint = process.env.K8S_CLUSTER_ENDPOINT;
  const clusterCa = process.env.K8S_CLUSTER_CA;
  const clusterName = process.env.K8S_CLUSTER_NAME;
  const awsRegion = process.env.K8S_AWS_REGION;

  if (clusterEndpoint && clusterCa && clusterName && awsRegion) {
    kc.loadFromOptions({
      clusters: [
        {
          name: clusterName,
          caData: clusterCa,
          server: clusterEndpoint,
        },
      ],
      users: [
        {
          name: 'eks-token-user',
          token: getEksBearerToken(clusterName, awsRegion),
        },
      ],
      contexts: [
        {
          name: 'eks-context',
          cluster: clusterName,
          user: 'eks-token-user',
        },
      ],
      currentContext: 'eks-context',
    });
  } else {
    kc.loadFromDefault();
  }

  return {
    coreApi: kc.makeApiClient(k8s.CoreV1Api),
    appsApi: kc.makeApiClient(k8s.AppsV1Api),
    customApi: kc.makeApiClient(k8s.CustomObjectsApi),
  };
}

function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function buildManifests(namespace: string, dto: CreateClusterDto, password: string): object[] {
  const specs = SIZE_SPECS[dto.size];
  const pgImage = `ghcr.io/cloudnative-pg/postgresql:${dto.pgVersion}`;

  const namespaceManifest = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: namespace,
      labels: { 'platform.loonaris.tech/tenant': 'true' },
    },
  };

  const secretManifest = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: 'app-db-credentials', namespace },
    type: 'Opaque',
    stringData: { password },
  };

  const cnpgManifest = {
    apiVersion: 'postgresql.cnpg.io/v1',
    kind: 'Cluster',
    metadata: { name: 'instance-db', namespace },
    spec: {
      instances: 2,
      imageName: pgImage,
      storage: { size: specs.storage, storageClass: 'gp3' },
      nodeSelector: { role: 'tenant' },
      topologySpreadConstraints: [
        {
          maxSkew: 1,
          topologyKey: 'topology.kubernetes.io/zone',
          whenUnsatisfiable: 'DoNotSchedule',
          labelSelector: { matchLabels: { 'cnpg.io/cluster': 'instance-db' } },
        },
      ],
      bootstrap: {
        initdb: {
          database: 'app',
          owner: 'cloud_user',
          secret: { name: 'app-db-credentials' },
        },
      },
    },
  };

  const pgbouncerRwDeployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'pgbouncer-rw', namespace },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: 'pgbouncer-rw' } },
      template: {
        metadata: { labels: { app: 'pgbouncer-rw' } },
        spec: {
          nodeSelector: { role: 'tenant' },
          containers: [
            {
              name: 'pgbouncer',
              image: 'edoburu/pgbouncer:latest',
              ports: [{ containerPort: 5432 }],
              env: [
                { name: 'DB_HOST', value: `instance-db-rw.${namespace}.svc.cluster.local` },
                { name: 'DB_PORT', value: '5432' },
                { name: 'DB_USER', value: 'cloud_user' },
                { name: 'DB_PASSWORD', value: password },
                { name: 'POOL_MODE', value: 'transaction' },
              ],
            },
          ],
        },
      },
    },
  };

  const pgbouncerRwService = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'pooler-rw-svc', namespace },
    spec: {
      ports: [{ port: 5432, targetPort: 5432 }],
      selector: { app: 'pgbouncer-rw' },
    },
  };

  const pgbouncerRoDeployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'pgbouncer-ro', namespace },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: 'pgbouncer-ro' } },
      template: {
        metadata: { labels: { app: 'pgbouncer-ro' } },
        spec: {
          nodeSelector: { role: 'tenant' },
          containers: [
            {
              name: 'pgbouncer',
              image: 'edoburu/pgbouncer:latest',
              ports: [{ containerPort: 5432 }],
              env: [
                { name: 'DB_HOST', value: `instance-db-ro.${namespace}.svc.cluster.local` },
                { name: 'DB_PORT', value: '5432' },
                { name: 'DB_USER', value: 'cloud_user' },
                { name: 'DB_PASSWORD', value: password },
                { name: 'POOL_MODE', value: 'transaction' },
              ],
            },
          ],
        },
      },
    },
  };

  const pgbouncerRoService = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'pooler-ro-svc', namespace },
    spec: {
      ports: [{ port: 5432, targetPort: 5432 }],
      selector: { app: 'pgbouncer-ro' },
    },
  };

  return [
    namespaceManifest,
    secretManifest,
    cnpgManifest,
    pgbouncerRwDeployment,
    pgbouncerRwService,
    pgbouncerRoDeployment,
    pgbouncerRoService,
  ];
}

async function applyManifests(namespace: string, dto: CreateClusterDto): Promise<string> {
  const password = generatePassword();
  const manifests = buildManifests(namespace, dto, password);
  const { coreApi, appsApi, customApi } = getK8sClient();

  const nsManifest = manifests[0] as k8s.V1Namespace;
  try {
    await coreApi.createNamespace({ body: nsManifest });
    console.log(`[provisioning] Created namespace ${namespace}`);
  } catch (err: any) {
    if (err?.response?.statusCode === 409) {
      console.log(`[provisioning] Namespace ${namespace} already exists`);
    } else {
      throw err;
    }
  }

  const secretManifest = manifests[1] as k8s.V1Secret;
  try {
    await coreApi.createNamespacedSecret({ namespace, body: secretManifest });
    console.log(`[provisioning] Created secret app-db-credentials in ${namespace}`);
  } catch (err: any) {
    if (err?.response?.statusCode === 409) {
      console.log(`[provisioning] Secret already exists, replacing`);
      await coreApi.replaceNamespacedSecret({
        name: 'app-db-credentials',
        namespace,
        body: secretManifest,
      });
    } else {
      throw err;
    }
  }

  const cnpgManifest = manifests[2];
  try {
    await customApi.createNamespacedCustomObject({
      group: 'postgresql.cnpg.io',
      version: 'v1',
      namespace,
      plural: 'clusters',
      body: cnpgManifest,
    });
    console.log(`[provisioning] Created CNPG Cluster instance-db in ${namespace}`);
  } catch (err: any) {
    if (err?.response?.statusCode === 409) {
      console.log(`[provisioning] CNPG Cluster already exists, replacing`);
      await customApi.replaceNamespacedCustomObject({
        group: 'postgresql.cnpg.io',
        version: 'v1',
        namespace,
        plural: 'clusters',
        name: 'instance-db',
        body: cnpgManifest,
      });
    } else {
      throw err;
    }
  }

  const deployManifests = [manifests[3], manifests[5]] as k8s.V1Deployment[];
  const serviceManifests = [manifests[4], manifests[6]] as k8s.V1Service[];

  for (const manifest of deployManifests) {
    try {
      await appsApi.createNamespacedDeployment({ namespace, body: manifest });
      console.log(`[provisioning] Created Deployment ${manifest.metadata?.name} in ${namespace}`);
    } catch (err: any) {
      if (err?.response?.statusCode === 409) {
        console.log(`[provisioning] Deployment ${manifest.metadata?.name} already exists`);
      } else {
        throw err;
      }
    }
  }

  for (const manifest of serviceManifests) {
    try {
      await coreApi.createNamespacedService({ namespace, body: manifest });
      console.log(`[provisioning] Created Service ${manifest.metadata?.name} in ${namespace}`);
    } catch (err: any) {
      if (err?.response?.statusCode === 409) {
        console.log(`[provisioning] Service ${manifest.metadata?.name} already exists`);
      } else {
        throw err;
      }
    }
  }

  return password;
}

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300000;
const MAX_POLLS = Math.floor(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

async function pollClusterHealth(namespace: string): Promise<ProjectStatus> {
  const { customApi } = getK8sClient();

  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    try {
      const resp = await customApi.getNamespacedCustomObject({
        group: 'postgresql.cnpg.io',
        version: 'v1',
        namespace,
        plural: 'clusters',
        name: 'instance-db',
      });
      const body = resp.body as any;
      const phase = body?.status?.phase;

      if (phase === 'Healthy') {
        console.log(`[provisioning] Cluster in ${namespace} is Healthy`);
        return 'running';
      }

      console.log(`[provisioning] Cluster in ${namespace} phase=${phase ?? 'unknown'}, waiting...`);
    } catch (err) {
      console.error(`[provisioning] Error polling cluster status in ${namespace}:`, err);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.error(
    `[provisioning] Cluster in ${namespace} did not become Healthy within ${POLL_TIMEOUT_MS / 1000}s`,
  );
  return 'error';
}

export async function provisionCluster(
  clusterId: string,
  namespace: string,
  dto: CreateClusterDto,
): Promise<ProvisionResult> {
  try {
    await applyManifests(namespace, dto);

    const status = await pollClusterHealth(namespace);

    return {
      externalId: `cnpg-${clusterId}`,
      status,
    };
  } catch (err) {
    console.error(`[provisioning] Failed to provision cluster ${clusterId}:`, err);
    return {
      externalId: `cnpg-${clusterId}`,
      status: 'error',
    };
  }
}

export async function deprovisionCluster(namespace: string): Promise<void> {
  const { coreApi, customApi } = getK8sClient();

  try {
    await customApi.deleteNamespacedCustomObject({
      group: 'postgresql.cnpg.io',
      version: 'v1',
      namespace,
      plural: 'clusters',
      name: 'instance-db',
    });
    console.log(`[provisioning] Deleted CNPG Cluster instance-db in ${namespace}`);
  } catch (err: any) {
    if (err?.response?.statusCode !== 404) {
      console.error(`[provisioning] Error deleting CNPG Cluster:`, err);
    }
  }

  try {
    await coreApi.deleteNamespace({ name: namespace });
    console.log(`[provisioning] Deleted namespace ${namespace}`);
  } catch (err: any) {
    if (err?.response?.statusCode !== 404) {
      console.error(`[provisioning] Error deleting namespace:`, err);
    }
  }
}

export async function getClusterStatus(namespace: string): Promise<ProjectStatus> {
  const { customApi } = getK8sClient();

  try {
    const resp = await customApi.getNamespacedCustomObject({
      group: 'postgresql.cnpg.io',
      version: 'v1',
      namespace,
      plural: 'clusters',
      name: 'instance-db',
    });
    const body = resp.body as any;
    const phase = body?.status?.phase;

    return phase === 'Healthy' ? 'running' : 'provisioning';
  } catch {
    return 'error';
  }
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
