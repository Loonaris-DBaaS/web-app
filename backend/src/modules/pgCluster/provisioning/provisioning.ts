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

function buildManifests(namespace: string, dto: CreateClusterDto, password: string): object[] {
  const specs = SIZE_SPECS[dto.size];
  const pgImage = `ghcr.io/cloudnative-pg/postgresql:${dto.pgVersion}`;
  // Honor the requested instance count; default to 2 for HA when unset/invalid.
  const instances = dto.instances && dto.instances > 0 ? dto.instances : 2;

  const namespaceManifest = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: namespace,
      labels: { 'platform.loonaris.tech/tenant': 'true' },
    },
  };

  // CNPG bootstrap.initdb.secret expects a basic-auth secret carrying BOTH the
  // owner username and password; a password-only secret fails with
  // CreateContainerConfigError ("couldn't find key username").
  const secretManifest = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: 'app-db-credentials', namespace },
    type: 'kubernetes.io/basic-auth',
    stringData: { username: 'cloud_user', password },
  };

  const cnpgManifest = {
    apiVersion: 'postgresql.cnpg.io/v1',
    kind: 'Cluster',
    metadata: { name: 'instance-db', namespace },
    spec: {
      // Instance count comes from the request (`dto.instances`), defaulting to
      // 2 for HA. The tenant node group (c5.xlarge with VPC CNI prefix
      // delegation) reports max-pods=110, so multiple instances schedule
      // reliably. Topology spread stays ScheduleAnyway so a single-instance
      // plan is never blocked.
      instances,
      imageName: pgImage,
      storage: { size: specs.storage, storageClass: 'gp3' },
      nodeSelector: { role: 'tenant' },
      topologySpreadConstraints: [
        {
          maxSkew: 1,
          topologyKey: 'topology.kubernetes.io/zone',
          whenUnsatisfiable: 'ScheduleAnyway',
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

  // CNPG-native Poolers. Omitting `pgbouncer.authQuery` triggers automatic CNPG
  // auth integration (CNPG wires up auth_query against the cluster and manages
  // the pgbouncer auth user), which is what makes scram-authenticated clients
  // work — unlike the hand-rolled edoburu pgbouncer. CNPG creates a ClusterIP
  // Service named after each Pooler (pooler-rw / pooler-ro).
  //
  // spec.template pins the pgbouncer pods to the tenant node group (the same
  // `role: tenant` selector the Cluster uses); otherwise the default scheduler
  // is free to place them on the system node group. The CRD requires a
  // `containers` field whenever a template is given, so we pass an empty array
  // and let CNPG inject its generated pgbouncer container.
  const poolerTemplate = {
    spec: {
      containers: [],
      nodeSelector: { role: 'tenant' },
    },
  };

  const poolerRw = {
    apiVersion: 'postgresql.cnpg.io/v1',
    kind: 'Pooler',
    metadata: { name: 'pooler-rw', namespace },
    spec: {
      cluster: { name: 'instance-db' },
      instances: 1,
      type: 'rw',
      pgbouncer: { poolMode: 'transaction' },
      template: poolerTemplate,
    },
  };

  const poolerRo = {
    apiVersion: 'postgresql.cnpg.io/v1',
    kind: 'Pooler',
    metadata: { name: 'pooler-ro', namespace },
    spec: {
      cluster: { name: 'instance-db' },
      instances: 1,
      type: 'ro',
      pgbouncer: { poolMode: 'transaction' },
      template: poolerTemplate,
    },
  };

  return [namespaceManifest, secretManifest, cnpgManifest, poolerRw, poolerRo];
}

async function applyManifests(namespace: string, dto: CreateClusterDto): Promise<string> {
  // Single system-internal password shared by every tenant's cloud_user role.
  // Tenants never receive it; the db-gateway holds it and authenticates to the
  // pooler on their behalf after validating the sk_live API key.
  const password = process.env.PROVISION_DB_PASSWORD;
  if (!password) {
    throw new Error('PROVISION_DB_PASSWORD is not set');
  }
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

  // CNPG Pooler custom resources (pooler-rw, pooler-ro). CNPG reconciles each
  // into a pgbouncer Deployment + ClusterIP Service named after the Pooler.
  const poolerManifests = [manifests[3], manifests[4]];
  for (const manifest of poolerManifests) {
    const name = (manifest as { metadata: { name: string } }).metadata.name;
    try {
      await customApi.createNamespacedCustomObject({
        group: 'postgresql.cnpg.io',
        version: 'v1',
        namespace,
        plural: 'poolers',
        body: manifest,
      });
      console.log(`[provisioning] Created Pooler ${name} in ${namespace}`);
    } catch (err: any) {
      if (err?.response?.statusCode === 409) {
        console.log(`[provisioning] Pooler ${name} already exists`);
      } else {
        throw err;
      }
    }
  }

  return password;
}

// CNPG reports this exact string in .status.phase when a cluster is healthy
// (operator constant PhaseHealthy) — NOT the literal "Healthy".
const CNPG_PHASE_HEALTHY = 'Cluster in healthy state';

const POLL_INTERVAL_MS = 5000;
// Cold provisioning on the small tenant nodes (image pull + EBS + initdb) can
// take ~5 min to reach "Cluster in healthy state"; 5 min was too tight and
// flipped healthy clusters to error. 10 min gives comfortable headroom.
const POLL_TIMEOUT_MS = 600000;
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
      // @kubernetes/client-node v1.x returns the object directly (no .body
      // wrapper); fall back to .body for older shapes.
      const body = ((resp as any).body ?? resp) as any;
      const phase = body?.status?.phase;

      if (phase === CNPG_PHASE_HEALTHY) {
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

    return phase === CNPG_PHASE_HEALTHY ? 'running' : 'provisioning';
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
