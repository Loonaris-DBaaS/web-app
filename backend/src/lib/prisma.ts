import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// RDS enforces TLS. Enable it in prod with DATABASE_SSL=true; local docker
// Postgres has no certificate, so SSL stays off unless explicitly requested.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });
export default prisma;
