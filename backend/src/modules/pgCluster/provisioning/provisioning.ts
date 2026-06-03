import * as k8s from '@kubernetes/client-node';
import aws4 from 'aws4';
import { CreateClusterDto, SIZE_SPECS } from '../dto/create-cluster.dto';
import { ProjectStatus } from '../dto/cluster.dto';

function parseCpuToMillis(cpu: string): number {
  // metrics-server reports usage in nanocores ("49038340n") or microcores ("123u");
  // limits/requests use millicores ("100m") or whole cores ("2").
  if (cpu.endsWith('n')) return parseInt(cpu, 10) / 1_000_000;
  if (cpu.endsWith('u')) return parseInt(cpu, 10) / 1_000;
  if (cpu.endsWith('m')) return parseInt(cpu, 10);
  return Math.round(parseFloat(cpu) * 1000);
}

function parseMemoryToBytes(memory: string): number {
  const kiB = 1024,
    miB = kiB * 1024,
    giB = miB * 1024;
  if (memory.endsWith('Ki')) return parseInt(memory) * kiB;
  if (memory.endsWith('Mi')) return parseInt(memory) * miB;
  if (memory.endsWith('Gi')) return parseInt(memory) * giB;
  if (memory.endsWith('k')) return parseInt(memory) * 1000;
  if (memory.endsWith('M')) return parseInt(memory) * 1_000_000;
  if (memory.endsWith('G')) return parseInt(memory) * 1_000_000_000;
  return parseInt(memory, 10);
}

function parseSizeBytesToGb(size: string): number {
  return parseMemoryToBytes(size) / 1024 ** 3;
}

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

export function getK8sClient(): {
  coreApi: k8s.CoreV1Api;
  appsApi: k8s.AppsV1Api;
  customApi: k8s.CustomObjectsApi;
  metricsClient: k8s.Metrics;
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
    metricsClient: new k8s.Metrics(kc),
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
      // Strict pod limits to maximise tenant density per node.  A c5.xlarge has
      // 4 vCPU / 8 GiB RAM — at 150m / 300Mi per CNPG pod we can schedule ~20+
      // data-plane pods per node (leaving headroom for poolers and system daemons).
      resources: { limits: { cpu: '150m', memory: '300Mi' } },
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

export interface InstanceMetric {
  name: string;
  role: 'primary' | 'replica' | 'unknown';
  ready: boolean;
  node: string;
  cpuMillis: number | null;
  memoryBytes: number | null;
}

export interface ClusterLiveMetrics {
  phase: string;
  instances: number;
  readyInstances: number;
  pods: InstanceMetric[];
  provisionedStorageGb: number;
  planStorageGb: number | null;
  usedStorageGb: number | null;
  timestamp: string;
}

/**
 * Sums PVC-backed disk usage (GiB) for a CNPG cluster by reading the kubelet
 * Summary API on every node that hosts a cluster pod. Volume stats for a PVC are
 * only reported by the kubelet on the node where that pod runs, so a multi-instance
 * cluster requires querying each distinct node and summing the results.
 *
 * Returns `null` only when usage is genuinely undeterminable (no scheduled pods, or
 * every node read failed) — distinct from a real `0`.
 */
export async function getClusterUsedStorageGb(
  namespace: string,
  pods?: k8s.V1Pod[],
): Promise<number | null> {
  const { coreApi } = getK8sClient();

  let clusterPods = pods;
  if (!clusterPods) {
    try {
      const podList = await coreApi.listNamespacedPod({
        namespace,
        labelSelector: 'cnpg.io/cluster=instance-db',
      });
      clusterPods = podList.items ?? [];
    } catch (err) {
      console.warn(`[metrics] Failed to list pods in ${namespace}:`, err);
      return null;
    }
  }

  const nodeNames = [
    ...new Set(clusterPods.map((p) => p.spec?.nodeName).filter((n): n is string => !!n)),
  ];
  if (nodeNames.length === 0) return null;

  type KubeletSummary = {
    pods?: Array<{
      podRef: { name: string; namespace: string };
      volume?: Array<{ pvcRef?: object; usedBytes?: number }>;
    }>;
  };

  const perNodeBytes = await Promise.all(
    nodeNames.map(async (node): Promise<number | null> => {
      try {
        const raw = await coreApi.connectGetNodeProxyWithPath({
          name: node,
          path: 'stats/summary',
        });
        const stats = (typeof raw === 'string' ? JSON.parse(raw) : raw) as KubeletSummary;
        let bytes = 0;
        for (const podStat of stats.pods ?? []) {
          if (podStat.podRef.namespace !== namespace) continue;
          for (const vol of podStat.volume ?? []) {
            if (vol.pvcRef) bytes += vol.usedBytes ?? 0;
          }
        }
        return bytes;
      } catch (err) {
        console.warn(`[metrics] kubelet stats unavailable on node ${node} for ${namespace}:`, err);
        return null;
      }
    }),
  );

  const readable = perNodeBytes.filter((b): b is number => b !== null);
  if (readable.length === 0) return null;
  return readable.reduce((sum, b) => sum + b, 0) / 1024 ** 3;
}

export async function getClusterLiveMetrics(namespace: string): Promise<ClusterLiveMetrics | null> {
  const { coreApi, customApi, metricsClient } = getK8sClient();

  // Query CNPG Cluster CR status (phase, instance counts)
  let phase = 'Unknown';
  let totalInstances = 0;
  let readyInstances = 0;
  let planStorageGb: number | null = null;
  try {
    const clusterResp = await customApi.getNamespacedCustomObject({
      group: 'postgresql.cnpg.io',
      version: 'v1',
      namespace,
      plural: 'clusters',
      name: 'instance-db',
    });
    const clusterBody = ((clusterResp as any).body ?? clusterResp) as any;
    phase = clusterBody?.status?.phase ?? 'Unknown';
    totalInstances = clusterBody?.status?.instances ?? 0;
    readyInstances = clusterBody?.status?.readyInstances ?? 0;
    const storageSpec = clusterBody?.spec?.storage?.size;
    if (storageSpec) {
      planStorageGb = parseSizeBytesToGb(storageSpec);
    }
  } catch (err) {
    console.error(`[metrics] Failed to query CNPG cluster in ${namespace}:`, err);
    return null;
  }

  // List pods by CNPG cluster label
  let pods: k8s.V1Pod[] = [];
  try {
    const podList = await coreApi.listNamespacedPod({
      namespace,
      labelSelector: 'cnpg.io/cluster=instance-db',
    });
    pods = podList.items ?? [];
  } catch (err) {
    console.warn(`[metrics] Failed to list pods in ${namespace}:`, err);
  }

  // Pod CPU/memory from metrics-server (best-effort)
  let podMetricItems: k8s.PodMetric[] = [];
  try {
    const metricsList = await metricsClient.getPodMetrics(namespace);
    podMetricItems = metricsList.items;
  } catch (err) {
    console.warn(`[metrics] metrics-server unavailable for ${namespace}:`, err);
  }

  // Build per-instance metrics array
  const instanceMetrics: InstanceMetric[] = pods.map((pod) => {
    const name = pod.metadata?.name ?? 'unknown';
    const labelRole = pod.metadata?.labels?.['cnpg.io/instanceRole'];
    const role: InstanceMetric['role'] =
      labelRole === 'primary' ? 'primary' : labelRole === 'replica' ? 'replica' : 'unknown';
    const ready = (pod.status?.conditions ?? []).some(
      (c) => c.type === 'Ready' && c.status === 'True',
    );
    const node = pod.spec?.nodeName ?? 'unknown';

    const podMetric = podMetricItems.find((m) => m.metadata.name === name);
    const cpuMillis = podMetric
      ? podMetric.containers.reduce((sum, c) => sum + parseCpuToMillis(c.usage.cpu), 0)
      : null;
    const memoryBytes = podMetric
      ? podMetric.containers.reduce((sum, c) => sum + parseMemoryToBytes(c.usage.memory), 0)
      : null;

    return { name, role, ready, node, cpuMillis, memoryBytes };
  });

  // Provisioned storage from PVC capacity (sum across all PVCs in namespace)
  let provisionedStorageGb = 0;
  try {
    const pvcList = await coreApi.listNamespacedPersistentVolumeClaim({ namespace });
    for (const pvc of pvcList.items) {
      const capacity =
        pvc.status?.capacity?.['storage'] ?? pvc.spec?.resources?.requests?.['storage'];
      if (capacity) {
        provisionedStorageGb += parseSizeBytesToGb(capacity);
      }
    }
  } catch (err) {
    console.warn(`[metrics] Failed to list PVCs in ${namespace}:`, err);
  }

  // Used storage via kubelet Summary API across every node hosting a cluster pod
  // (best-effort; replica PVCs are only reported on their own node's summary).
  const usedStorageGb = await getClusterUsedStorageGb(namespace, pods);

  return {
    phase,
    instances: totalInstances,
    readyInstances,
    pods: instanceMetrics,
    provisionedStorageGb,
    planStorageGb,
    usedStorageGb,
    timestamp: new Date().toISOString(),
  };
}
