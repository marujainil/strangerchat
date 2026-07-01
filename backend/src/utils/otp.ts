import crypto from 'crypto';

export function generateOtp(): string {
  // 6-digit numeric, cryptographically random
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export const OTP_TTL_MS = 10 * 60 * 1000;   // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
