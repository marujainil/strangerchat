import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';

const store = () =>
  new RedisStore({
    // ioredis call signature
    sendCommand: (...args: string[]) => (redis as any).call(...args),
  });

export const globalLimiter = rateLimit({
  store: store(),
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

export const authLimiter = rateLimit({
  store: store(),
  windowMs: 15 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_auth_attempts' },
});

export const otpLimiter = rateLimit({
  store: store(),
  windowMs: 60 * 60_000,
  max: 8,
  message: { error: 'otp_rate_limited' },
});

export const paymentLimiter = rateLimit({
  store: store(),
  windowMs: 60_000,
  max: 20,
  message: { error: 'payment_rate_limited' },
});
