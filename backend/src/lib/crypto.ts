import crypto from 'crypto';

const KEY_PREFIX = 'sk_live_';
const BASE_KEY_LENGTH = 64;

export function generateBaseKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function formatApiKey(baseKey: string, mode: 'rw' | 'ro'): string {
  return `${KEY_PREFIX}${baseKey}_${mode}`;
}

export function isValidBaseKey(key: string): boolean {
  return /^[a-f0-9]{64}$/.test(key);
}
