import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { generateTokens, verifyRefreshToken, REFRESH_TTL_MS } from '@/lib/tokens';

export async function login(email: string, password: string) {
  const tenant = await prisma.tenant.findUnique({ where: { email } });
  if (!tenant) throw new Error('Invalid email or password');

  const valid = await bcrypt.compare(password, tenant.passwordHash);
  if (!valid) throw new Error('Invalid email or password');

  const { accessToken, refreshToken } = generateTokens(tenant.id, tenant.isAdmin);

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
    isAdmin: tenant.isAdmin,
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  let decoded: jwt.JwtPayload;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error('Invalid refresh token');
  }

  const record = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!record || record.revokedAt) throw new Error('Refresh token is invalid or revoked');
  if (new Date() > record.expiresAt) throw new Error('Refresh token has expired');

  const tenant = await prisma.tenant.findUnique({ where: { id: decoded['id'] as string } });
  const { accessToken } = generateTokens(decoded['id'], tenant?.isAdmin ?? false);
  return { accessToken };
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.update({
    where: { token: refreshToken },
    data: { revokedAt: new Date() },
  });
}
