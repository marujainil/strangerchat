import Redis from 'ioredis';
import { env } from './env';

/**
 * Two connections: a general client and a dedicated pub/sub client.
 * Socket.io adapter (optional, for horizontal scaling) uses its own pair.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export const redisSub = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on('error', (e) => console.error('[redis] error', e.message));
redis.on('connect', () => console.log('[redis] connected'));
