import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, DeploymentOption } from '../src/generated/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const TENANTS = [
  { email: 'alice@example.com',  username: 'alice',  country: 'FR', password: 'Password123!' },
  { email: 'bob@example.com',    username: 'bob',    country: 'US', password: 'Password456!' },
  { email: 'carol@example.com',  username: 'carol',  country: 'DE', password: 'Password789!' },
  { email: 'dave@example.com',   username: 'dave',   country: 'GB', password: 'PassDave111!' },
  { email: 'eve@example.com',    username: 'eve',    country: 'ES', password: 'PassEve222!'  },
];

const PROJECTS = [
  { name: 'Alice Production DB', namespace: 'alice-prod-ns',    pg: '16', region: 'eu-west-1',    deploy: DeploymentOption.MULTI_AZ_CLUSTER,   est: 120.5, replicas: 3, storage: '100Gi', ram: '8Gi',  cpu: '4'   },
  { name: 'Bob Staging DB',      namespace: 'bob-staging-ns',   pg: '15', region: 'us-east-1',    deploy: DeploymentOption.SINGLE_AZ_INSTANCE, est: 45.0,  replicas: 1, storage: '20Gi',  ram: '2Gi',  cpu: '1'   },
  { name: 'Carol Analytics DB',  namespace: 'carol-analytics',  pg: '16', region: 'eu-central-1', deploy: DeploymentOption.MULTI_AZ_INSTANCE,  est: 80.0,  replicas: 2, storage: '80Gi',  ram: '16Gi', cpu: '8'   },
  { name: 'Dave Dev DB',         namespace: 'dave-dev-ns',      pg: '14', region: 'us-west-2',    deploy: DeploymentOption.SINGLE_AZ_INSTANCE, est: 20.0,  replicas: 1, storage: '10Gi',  ram: '1Gi',  cpu: '0.5' },
  { name: 'Eve Data Warehouse',  namespace: 'eve-warehouse-ns', pg: '16', region: 'ap-southeast-1',deploy: DeploymentOption.MULTI_AZ_CLUSTER,  est: 200.0, replicas: 5, storage: '500Gi', ram: '32Gi', cpu: '16'  },
];

async function main() {
  const tenants = await Promise.all(
    TENANTS.map(async (t) =>
      prisma.tenant.upsert({
        where: { email: t.email },
        update: {},
        create: {
          email: t.email,
          username: t.username,
          country: t.country,
          passwordHash: await bcrypt.hash(t.password, 10),
        },
      }),
    ),
  );
  console.log(`✓ ${tenants.length} tenants`);

  await prisma.refreshToken.createMany({
    skipDuplicates: true,
    data: tenants.map((t) => ({
      token: crypto.randomBytes(40).toString('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      tenantId: t.id,
    })),
  });
  console.log(`✓ ${tenants.length} refresh tokens`);

  const projects = await Promise.all(
    PROJECTS.map((p, i) =>
      prisma.project.upsert({
        where: { k8sNamespace: p.namespace },
        update: {},
        create: {
          name: p.name,
          k8sNamespace: p.namespace,
          pgVersion: p.pg,
          region: p.region,
          deploymentOption: p.deploy,
          estimatedPrice: p.est,
          tenantId: tenants[i].id,
          resourceConfig: {
            create: {
              desiredReplicas: p.replicas,
              enableBackup: true,
              desiredStorage: p.storage,
              desiredRam: p.ram,
              desiredCpu: p.cpu,
            },
          },
          poolers: {
            create: {
              roPoolerLink: `postgres://ro.${p.namespace}.internal:5432/postgres`,
              rwPoolerLink: `postgres://rw.${p.namespace}.internal:5432/postgres`,
            },
          },
          apiKeys: {
            create: {
              keyHash: crypto.createHash('sha256').update(`secret-${p.namespace}`).digest('hex'),
              prefix: `lnr_${TENANTS[i].username}_`,
              duration: 90,
            },
          },
        },
      }),
    ),
  );
  console.log(`✓ ${projects.length} projects`);

  console.log('\nSeed completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
