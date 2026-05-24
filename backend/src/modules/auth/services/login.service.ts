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

export async function login(email: string, password: string) {
  const tenant = await prisma.tenant.findUnique({ where: { email } });
  if (!tenant) throw new Error('Invalid email or password');

  const valid = await bcrypt.compare(password, tenant.passwordHash);
  if (!valid) throw new Error('Invalid email or password');

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

export async function refreshAccessToken(refreshToken: string) {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as jwt.JwtPayload;
  } catch {
    throw new Error('Invalid refresh token');
  }

  const record = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!record || record.revokedAt) throw new Error('Refresh token is invalid or revoked');
  if (new Date() > record.expiresAt) throw new Error('Refresh token has expired');

  const accessToken = jwt.sign({ id: decoded['id'] }, JWT_SECRET, { expiresIn: '15m' });
  return { accessToken };
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.update({
    where: { token: refreshToken },
    data: { revokedAt: new Date() },
  });
}
