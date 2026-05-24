import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '@/db';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-prod';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-prod';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export async function signup(data: {
  username: string;
  email: string;
  password: string;
  country?: string;
}) {
  const existing = await prisma.tenant.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] },
  });
  if (existing) {
    if (existing.email === data.email) throw new Error('Email already in use');
    throw new Error('Username already in use');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const tenant = await prisma.tenant.create({
    data: {
      username: data.username,
      email: data.email,
      passwordHash,
      country: data.country ?? null,
    },
  });

  const { accessToken, refreshToken } = generateTokens(tenant.id);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return {
    id: tenant.id,
    username: tenant.username,
    email: tenant.email,
    country: tenant.country,
    photoUrl: tenant.photoUrl,
    accessToken,
    refreshToken,
  };
}
