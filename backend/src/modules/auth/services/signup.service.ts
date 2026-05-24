import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateTokens, REFRESH_TTL_MS } from '@/lib/tokens';

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
