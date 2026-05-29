import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// pg parses `sslmode=require` from the connection string and overwrites any
// explicit `ssl` option we pass to the Pool constructor. We strip SSL-related
// query params so DATABASE_SSL remains the single source of truth for SSL config.
let connectionString = process.env.DATABASE_URL || '';
if (connectionString) {
  const dbUrl = new URL(connectionString);
  dbUrl.searchParams.delete('sslmode');
  dbUrl.searchParams.delete('ssl');
  dbUrl.searchParams.delete('sslcert');
  dbUrl.searchParams.delete('sslkey');
  dbUrl.searchParams.delete('sslrootcert');
  connectionString = dbUrl.toString();
}

// RDS enforces TLS. Enable it in prod with DATABASE_SSL=true; local docker
// Postgres has no certificate, so SSL stays off unless explicitly requested.
const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });
export default prisma;
