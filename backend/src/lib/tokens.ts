import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-prod';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-prod';

export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateTokens(userId: string, isAdmin = false) {
  // tenantId === userId in this schema (Tenant is both user and tenant)
  const accessToken = jwt.sign({ id: userId, tenantId: userId, isAdmin }, JWT_SECRET, {
    expiresIn: '15m',
  });
  // jti makes every refresh token unique even when issued in the same second
  const refreshToken = jwt.sign({ id: userId, jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as jwt.JwtPayload;
}

export function verifyAccessToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
}
