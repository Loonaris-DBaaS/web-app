const { PrismaClient, DeploymentOption } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

const TENANTS = [
  { email: 'alice@example.com',   username: 'alice',   country: 'FR', password: 'Password123!' },
  { email: 'bob@example.com',     username: 'bob',     country: 'US', password: 'Password456!' },
  { email: 'carol@example.com',   username: 'carol',   country: 'DE', password: 'Password789!' },
  { email: 'dave@example.com',    username: 'dave',    country: 'GB', password: 'PassDave111!' },
  { email: 'eve@example.com',     username: 'eve',     country: 'ES', password: 'PassEve222!' },
  { email: 'frank@example.com',   username: 'frank',   country: 'IT', password: 'PassFrank33!' },
  { email: 'grace@example.com',   username: 'grace',   country: 'CA', password: 'PassGrace44!' },
  { email: 'henry@example.com',   username: 'henry',   country: 'AU', password: 'PassHenry55!' },
  { email: 'iris@example.com',    username: 'iris',    country: 'NL', password: 'PassIris666!' },
  { email: 'jack@example.com',    username: 'jack',    country: 'BR', password: 'PassJack777!' },
  { email: 'karen@example.com',   username: 'karen',   country: 'JP', password: 'PassKaren88!' },
  { email: 'leo@example.com',     username: 'leo',     country: 'KR', password: 'PassLeo9999!' },
  { email: 'mia@example.com',     username: 'mia',     country: 'SE', password: 'PassMia1010!' },
  { email: 'noah@example.com',    username: 'noah',    country: 'NO', password: 'PassNoah111!' },
  { email: 'olivia@example.com',  username: 'olivia',  country: 'DK', password: 'PassOliv222!' },
  { email: 'paul@example.com',    username: 'paul',    country: 'PL', password: 'PassPaul333!' },
  { email: 'quinn@example.com',   username: 'quinn',   country: 'PT', password: 'PassQuin444!' },
  { email: 'rachel@example.com',  username: 'rachel',  country: 'CH', password: 'PassRach555!' },
  { email: 'sam@example.com',     username: 'sam',     country: 'BE', password: 'PassSam6666!' },
  { email: 'tina@example.com',    username: 'tina',    country: 'AT', password: 'PassTina777!' },
];

const PROJECTS = [
  { name: 'Alice Production DB',    namespace: 'alice-prod-ns',    pg: '16', region: 'eu-west-1',      deploy: 'MULTI_AZ_CLUSTER',   est: 120.5, price: 115.0, cpu: 34.5, ram: 52.3, storage: 18.7 },
  { name: 'Bob Staging DB',         namespace: 'bob-staging-ns',   pg: '15', region: 'us-east-1',      deploy: 'SINGLE_AZ_INSTANCE', est: 45.0,  price: 42.0,  cpu: 12.1, ram: 28.9, storage: 5.4  },
  { name: 'Carol Analytics DB',     namespace: 'carol-analytics',  pg: '16', region: 'eu-central-1',   deploy: 'MULTI_AZ_INSTANCE',  est: 80.0,  price: 76.5,  cpu: 55.0, ram: 70.1, storage: 40.2 },
  { name: 'Dave Dev DB',            namespace: 'dave-dev-ns',      pg: '14', region: 'us-west-2',      deploy: 'SINGLE_AZ_INSTANCE', est: 20.0,  price: 18.0,  cpu: 8.0,  ram: 15.0, storage: 3.0  },
  { name: 'Eve Data Warehouse',     namespace: 'eve-warehouse-ns', pg: '16', region: 'ap-southeast-1', deploy: 'MULTI_AZ_CLUSTER',   est: 200.0, price: 195.0, cpu: 78.0, ram: 85.0, storage: 95.0 },
  { name: 'Frank CRM DB',           namespace: 'frank-crm-ns',     pg: '15', region: 'eu-west-2',      deploy: 'MULTI_AZ_INSTANCE',  est: 65.0,  price: 60.0,  cpu: 30.0, ram: 45.0, storage: 22.0 },
  { name: 'Grace HR DB',            namespace: 'grace-hr-ns',      pg: '16', region: 'ca-central-1',   deploy: 'SINGLE_AZ_INSTANCE', est: 35.0,  price: 32.0,  cpu: 10.5, ram: 20.0, storage: 8.0  },
  { name: 'Henry Reporting DB',     namespace: 'henry-report-ns',  pg: '15', region: 'ap-southeast-2', deploy: 'MULTI_AZ_CLUSTER',   est: 150.0, price: 145.0, cpu: 60.0, ram: 75.0, storage: 60.0 },
  { name: 'Iris IoT DB',            namespace: 'iris-iot-ns',      pg: '16', region: 'eu-north-1',     deploy: 'MULTI_AZ_INSTANCE',  est: 90.0,  price: 87.0,  cpu: 42.0, ram: 58.0, storage: 35.0 },
  { name: 'Jack E-Commerce DB',     namespace: 'jack-ecom-ns',     pg: '14', region: 'sa-east-1',      deploy: 'MULTI_AZ_CLUSTER',   est: 175.0, price: 170.0, cpu: 68.0, ram: 80.0, storage: 75.0 },
  { name: 'Karen Finance DB',       namespace: 'karen-finance-ns', pg: '16', region: 'ap-northeast-1', deploy: 'MULTI_AZ_CLUSTER',   est: 220.0, price: 210.0, cpu: 82.0, ram: 90.0, storage: 110.0},
  { name: 'Leo Game DB',            namespace: 'leo-game-ns',      pg: '15', region: 'ap-northeast-2', deploy: 'SINGLE_AZ_INSTANCE', est: 28.0,  price: 25.0,  cpu: 9.0,  ram: 18.0, storage: 4.5  },
  { name: 'Mia Marketing DB',       namespace: 'mia-marketing-ns', pg: '16', region: 'eu-west-3',      deploy: 'MULTI_AZ_INSTANCE',  est: 72.0,  price: 68.0,  cpu: 35.0, ram: 48.0, storage: 25.0 },
  { name: 'Noah Logistics DB',      namespace: 'noah-logistics-ns',pg: '15', region: 'eu-west-1',      deploy: 'MULTI_AZ_CLUSTER',   est: 140.0, price: 135.0, cpu: 57.0, ram: 72.0, storage: 55.0 },
  { name: 'Olivia Research DB',     namespace: 'olivia-research',  pg: '16', region: 'eu-north-1',     deploy: 'MULTI_AZ_INSTANCE',  est: 85.0,  price: 80.0,  cpu: 40.0, ram: 55.0, storage: 30.0 },
  { name: 'Paul Support DB',        namespace: 'paul-support-ns',  pg: '14', region: 'us-east-2',      deploy: 'SINGLE_AZ_INSTANCE', est: 22.0,  price: 20.0,  cpu: 7.5,  ram: 12.0, storage: 2.5  },
  { name: 'Quinn Audit DB',         namespace: 'quinn-audit-ns',   pg: '16', region: 'eu-central-1',   deploy: 'MULTI_AZ_INSTANCE',  est: 95.0,  price: 90.0,  cpu: 45.0, ram: 60.0, storage: 38.0 },
  { name: 'Rachel BI DB',           namespace: 'rachel-bi-ns',     pg: '15', region: 'eu-west-2',      deploy: 'MULTI_AZ_CLUSTER',   est: 160.0, price: 155.0, cpu: 65.0, ram: 78.0, storage: 70.0 },
  { name: 'Sam DevOps DB',          namespace: 'sam-devops-ns',    pg: '16', region: 'us-west-1',      deploy: 'SINGLE_AZ_INSTANCE', est: 18.0,  price: 16.0,  cpu: 6.0,  ram: 10.0, storage: 2.0  },
  { name: 'Tina Compliance DB',     namespace: 'tina-compliance',  pg: '16', region: 'eu-west-3',      deploy: 'MULTI_AZ_CLUSTER',   est: 190.0, price: 185.0, cpu: 74.0, ram: 88.0, storage: 90.0 },
];

const RESOURCE_CONFIGS = [
  { replicas: 3, backup: true,  autoscale: true,  pitr: true,  storage: '100Gi', ram: '8Gi',  cpu: '4'   },
  { replicas: 1, backup: false, autoscale: false, pitr: false, storage: '20Gi',  ram: '2Gi',  cpu: '1'   },
  { replicas: 2, backup: true,  autoscale: true,  pitr: false, storage: '80Gi',  ram: '16Gi', cpu: '8'   },
  { replicas: 1, backup: false, autoscale: false, pitr: false, storage: '10Gi',  ram: '1Gi',  cpu: '0.5' },
  { replicas: 5, backup: true,  autoscale: true,  pitr: true,  storage: '500Gi', ram: '32Gi', cpu: '16'  },
  { replicas: 2, backup: true,  autoscale: false, pitr: true,  storage: '60Gi',  ram: '8Gi',  cpu: '4'   },
  { replicas: 1, backup: false, autoscale: false, pitr: false, storage: '15Gi',  ram: '2Gi',  cpu: '1'   },
  { replicas: 3, backup: true,  autoscale: true,  pitr: true,  storage: '200Gi', ram: '16Gi', cpu: '8'   },
  { replicas: 2, backup: true,  autoscale: true,  pitr: false, storage: '120Gi', ram: '8Gi',  cpu: '4'   },
  { replicas: 4, backup: true,  autoscale: true,  pitr: true,  storage: '300Gi', ram: '32Gi', cpu: '16'  },
  { replicas: 5, backup: true,  autoscale: true,  pitr: true,  storage: '600Gi', ram: '64Gi', cpu: '32'  },
  { replicas: 1, backup: false, autoscale: false, pitr: false, storage: '12Gi',  ram: '1Gi',  cpu: '0.5' },
  { replicas: 2, backup: true,  autoscale: false, pitr: false, storage: '70Gi',  ram: '8Gi',  cpu: '4'   },
  { replicas: 3, backup: true,  autoscale: true,  pitr: true,  storage: '180Gi', ram: '16Gi', cpu: '8'   },
  { replicas: 2, backup: true,  autoscale: true,  pitr: false, storage: '100Gi', ram: '8Gi',  cpu: '4'   },
  { replicas: 1, backup: false, autoscale: false, pitr: false, storage: '8Gi',   ram: '1Gi',  cpu: '0.5' },
  { replicas: 2, backup: true,  autoscale: false, pitr: true,  storage: '130Gi', ram: '8Gi',  cpu: '4'   },
  { replicas: 4, backup: true,  autoscale: true,  pitr: true,  storage: '250Gi', ram: '32Gi', cpu: '16'  },
  { replicas: 1, backup: false, autoscale: false, pitr: false, storage: '5Gi',   ram: '1Gi',  cpu: '0.5' },
  { replicas: 5, backup: true,  autoscale: true,  pitr: true,  storage: '400Gi', ram: '64Gi', cpu: '32'  },
];

async function main() {
  const passwordHash = async (pw) => bcrypt.hash(pw, 10);
  const keyHash = (val) => crypto.createHash('sha256').update(val).digest('hex');

  // 1. Tenants
  const tenants = await Promise.all(
    TENANTS.map(async (t) =>
      prisma.tenant.upsert({
        where: { email: t.email },
        update: {},
        create: {
          email: t.email,
          username: t.username,
          country: t.country,
          password_hash: await passwordHash(t.password),
        },
      })
    )
  );
  console.log(`✓ ${tenants.length} tenants`);

  // 2. Refresh tokens (one per tenant)
  await prisma.refreshToken.createMany({
    skipDuplicates: true,
    data: tenants.map((t) => ({
      token: crypto.randomBytes(40).toString('hex'),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      tenant_id: t.id,
    })),
  });
  console.log(`✓ ${tenants.length} refresh tokens`);

  // 3. Projects (one per tenant)
  const projects = await Promise.all(
    PROJECTS.map((p, i) =>
      prisma.project.upsert({
        where: { k8s_namespace: p.namespace },
        update: {},
        create: {
          name: p.name,
          k8s_namespace: p.namespace,
          pg_version: p.pg,
          region: p.region,
          deployment_option: DeploymentOption[p.deploy],
          estimated_price: p.est,
          price: p.price,
          cpu_usage: p.cpu,
          ram_usage: p.ram,
          storage_usage: p.storage,
          tenant_id: tenants[i].id,
        },
      })
    )
  );
  console.log(`✓ ${projects.length} projects`);

  // 4. Resource configs
  await Promise.all(
    projects.map((proj, i) => {
      const rc = RESOURCE_CONFIGS[i];
      return prisma.resourceConfig.upsert({
        where: { project_id: proj.id },
        update: {},
        create: {
          desired_replicas: rc.replicas,
          enable_backup: rc.backup,
          enable_autoscale: rc.autoscale,
          enable_pitr: rc.pitr,
          desired_storage: rc.storage,
          desired_ram: rc.ram,
          desired_cpu: rc.cpu,
          project_id: proj.id,
        },
      });
    })
  );
  console.log(`✓ ${projects.length} resource configs`);

  // 5. Poolers
  await prisma.pooler.createMany({
    skipDuplicates: true,
    data: projects.map((proj) => ({
      ro_pooler_link: `postgres://ro.${proj.k8s_namespace}.internal:5432/postgres`,
      rw_pooler_link: `postgres://rw.${proj.k8s_namespace}.internal:5432/postgres`,
      project_id: proj.id,
    })),
  });
  console.log(`✓ ${projects.length} poolers`);

  // 6. API keys
  await prisma.apiKey.createMany({
    skipDuplicates: true,
    data: projects.map((proj, i) => ({
      key_hash: keyHash(`secret-key-${proj.k8s_namespace}-${i}`),
      prefix: `lnr_${TENANTS[i].username}_`,
      duration: [30, 60, 90, 180, 365][i % 5],
      project_id: proj.id,
    })),
  });
  console.log(`✓ ${projects.length} api keys`);

  console.log('\nSeed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
