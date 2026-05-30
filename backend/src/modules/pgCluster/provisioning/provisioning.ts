import * as k8s from '@kubernetes/client-node';
import { CreateClusterDto, SIZE_SPECS } from '../dto/create-cluster.dto';
import { ProjectStatus } from '../dto/cluster.dto';

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
  kc.loadFromDefault();

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
  const pgImage = `ghcr.io/cloudnativepg/postgresql:${dto.pgVersion}`;

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
      tolerations: [{ key: 'dedicated', operator: 'Equal', value: 'tenant', effect: 'NoSchedule' }],
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
          tolerations: [
            { key: 'dedicated', operator: 'Equal', value: 'tenant', effect: 'NoSchedule' },
          ],
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
          tolerations: [
            { key: 'dedicated', operator: 'Equal', value: 'tenant', effect: 'NoSchedule' },
          ],
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
