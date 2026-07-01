import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifyAccess } from '../utils/jwt';
import { redis } from '../config/redis';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { registerHandlers, userSockets } from './handlers';

const ONLINE_KEY = 'online:count';

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 20_000,
    pingTimeout: 25_000,
  });

  // ---- auth handshake ----
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = verifyAccess(token);
      socket.data = {
        userId: payload.sub,
        premium: payload.premium,
        guest: payload.guest,
      };
      next();
    } catch {
      next(new Error('invalid_token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;

    // single active socket per user (kick the stale one)
    const prev = userSockets.get(userId);
    if (prev && prev !== socket.id) io.sockets.sockets.get(prev)?.disconnect(true);
    userSockets.set(userId, socket.id);

    const count = await redis.incr(ONLINE_KEY);
    io.emit('presence:count', count);
    prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});

    socket.emit('connected', { userId, online: count });
    registerHandlers(io, socket);

    socket.on('disconnect', async () => {
      if (userSockets.get(userId) === socket.id) userSockets.delete(userId);
      const c = await redis.decr(ONLINE_KEY);
      io.emit('presence:count', Math.max(0, c));
      prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});
    });
  });

  // self-heal the counter on boot (clear stale value)
  redis.set(ONLINE_KEY, 0).catch(() => {});
  logger.info('socket.io server ready');
  return io;
}
