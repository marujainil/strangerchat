import { Server, Socket } from 'socket.io';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { sanitize } from '../utils/profanity';
import { matchingEngine } from '../matching/queue';
import { MatchProfile, MatchFilters, ChatMode, Gender } from '../matching/types';
import { buildIceServers } from './ice';
import { env } from '../config/env';

/** In-memory registry (single instance). For multi-node, add @socket.io/redis-adapter. */
export const userSockets = new Map<string, string>(); // userId -> socketId

interface JoinPayload {
  mode: ChatMode;
  filters?: MatchFilters;
  lat?: number;
  lng?: number;
}

interface SocketState {
  userId: string;
  premium: boolean;
  guest: boolean;
  roomId?: string;
  partnerId?: string;
  partnerSocketId?: string;
  filteredStart?: number;     // for free-tier filter time accounting
  lastJoin?: JoinPayload;
}

function dayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}${d.getUTCMonth() + 1}${d.getUTCDate()}`;
}
const usageKey = (uid: string) => `filter:usage:${uid}:${dayKey()}`;

async function filterRemainingSec(userId: string): Promise<number> {
  const used = Number((await redis.get(usageKey(userId))) ?? 0);
  return Math.max(0, env.FREE_FILTER_SECONDS - used);
}
async function accrueFilterUsage(userId: string, seconds: number) {
  if (seconds <= 0) return;
  const k = usageKey(userId);
  await redis.incrby(k, Math.round(seconds));
  // expire at end of UTC day
  const now = new Date();
  const eod = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
  await redis.pexpire(k, eod);
}

function hasFilters(f?: MatchFilters): boolean {
  if (!f) return false;
  return Boolean(
    f.genders?.length || f.countries?.length || f.languages?.length || f.interests?.length ||
    f.relationship?.length || f.onlyVerified || f.onlyPremium || f.newUsersOnly ||
    f.ageMin !== undefined || f.ageMax !== undefined || f.distanceKm !== undefined,
  );
}

function publicPartner(p: MatchProfile) {
  return {
    gender: p.gender,
    countryCode: p.countryCode,
    languages: p.languages,
    interests: p.interests,
    age: p.age,
    isPremium: p.isPremium,
    isVerified: p.isVerified,
    relationship: p.relationship,
  };
}

async function buildProfile(state: SocketState, socketId: string, payload: JoinPayload): Promise<MatchProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: state.userId },
    include: { interests: { include: { interest: true } } },
  });
  if (!user || user.isBanned) return null;

  const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);
  return {
    userId: user.id,
    socketId,
    mode: payload.mode,
    isPremium: user.isPremium,
    isVerified: user.isVerified,
    gender: (user.gender as Gender) ?? 'UNKNOWN',
    age: user.age ?? undefined,
    countryCode: user.countryCode ?? undefined,
    languages: user.languages ?? [],
    interests: user.interests.map((ui) => ui.interest.slug),
    relationship: user.relationship,
    accountAgeDays,
    lat: payload.lat,
    lng: payload.lng,
    filters: payload.filters ?? {},
    joinedAt: Date.now(),
  };
}

async function blockedSet(userId: string): Promise<Set<string>> {
  const rows = await prisma.blockedUser.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const set = new Set<string>();
  for (const r of rows) set.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  return set;
}

async function endConnection(io: Server, socket: Socket, endedBy: string, notify = true) {
  const st = socket.data as SocketState;
  if (!st.roomId) return;
  const { roomId, partnerId, partnerSocketId } = st;

  // accrue free-tier filter usage for the elapsed filtered session
  if (st.filteredStart && !st.premium) {
    await accrueFilterUsage(st.userId, (Date.now() - st.filteredStart) / 1000);
    st.filteredStart = undefined;
  }

  try {
    const conn = await prisma.connection.findUnique({ where: { roomId } });
    if (conn && !conn.endedAt) {
      await prisma.connection.update({
        where: { roomId },
        data: {
          endedAt: new Date(),
          endedBy,
          durationSec: Math.round((Date.now() - conn.startedAt.getTime()) / 1000),
        },
      });
    }
  } catch (e) { logger.warn('endConnection db error', { e: (e as Error).message }); }

  if (notify && partnerSocketId) io.to(partnerSocketId).emit('partner:left');
  socket.leave(roomId);
  if (partnerSocketId) io.sockets.sockets.get(partnerSocketId)?.leave(roomId);

  // clear partner's state too
  if (partnerSocketId) {
    const ps = io.sockets.sockets.get(partnerSocketId);
    if (ps) { const pst = ps.data as SocketState; pst.roomId = undefined; pst.partnerId = undefined; pst.partnerSocketId = undefined; }
  }
  st.roomId = undefined; st.partnerId = undefined; st.partnerSocketId = undefined;
  void partnerId;
}

async function tryMatch(io: Server, socket: Socket, payload: JoinPayload) {
  const st = socket.data as SocketState;
  st.lastJoin = payload;

  // free-tier filter gating: 3 min/day
  let effective = payload;
  let strippedFilters = false;
  if (!st.premium && hasFilters(payload.filters)) {
    const remaining = await filterRemainingSec(st.userId);
    if (remaining <= 0) {
      effective = { ...payload, filters: {} };
      strippedFilters = true;
    }
  }

  const me = await buildProfile(st, socket.id, effective);
  if (!me) { socket.emit('banned'); return; }

  const blocked = await blockedSet(st.userId);
  const result = await matchingEngine.findMatch(me, blocked);

  if (strippedFilters) socket.emit('premium:required', { reason: 'filter_quota_exhausted' });

  if (!result) { socket.emit('queue:waiting'); return; }

  // create the connection record
  const conn = await prisma.connection.create({
    data: {
      roomId: result.roomId,
      userAId: me.userId,
      userBId: result.partner.userId,
      mode: payload.mode as any,
    },
  }).catch((e) => { logger.error('connection create failed', { e: (e as Error).message }); return null; });
  if (!conn) { socket.emit('queue:waiting'); return; }

  const partnerSocket = io.sockets.sockets.get(result.partner.socketId);

  // wire both sockets into the room
  socket.join(result.roomId);
  st.roomId = result.roomId; st.partnerId = result.partner.userId; st.partnerSocketId = result.partner.socketId;
  if (!st.premium && hasFilters(effective.filters)) st.filteredStart = Date.now();

  if (partnerSocket) {
    partnerSocket.join(result.roomId);
    const pst = partnerSocket.data as SocketState;
    pst.roomId = result.roomId; pst.partnerId = me.userId; pst.partnerSocketId = socket.id;
    if (!pst.premium && hasFilters((pst.lastJoin?.filters))) pst.filteredStart = Date.now();
  }

  const ice = buildIceServers();
  // emit mirrored payloads. polite is per-peer (smaller userId is polite).
  socket.emit('match:found', {
    roomId: result.roomId,
    polite: result.polite,
    mode: payload.mode,
    partner: publicPartner(result.partner),
    iceServers: ice,
  });
  if (partnerSocket) {
    partnerSocket.emit('match:found', {
      roomId: result.roomId,
      polite: !result.polite,
      mode: payload.mode,
      partner: publicPartner(me),
      iceServers: ice,
    });
  }

  logger.info('match', { room: result.roomId, a: me.userId, b: result.partner.userId, mode: payload.mode });
}

export function registerHandlers(io: Server, socket: Socket) {
  const st = socket.data as SocketState;

  socket.on('queue:join', (payload: JoinPayload) => {
    if (!payload?.mode) return;
    tryMatch(io, socket, payload).catch((e) => {
      logger.error('queue:join error', { e: (e as Error).message });
      socket.emit('error:queue', { error: 'match_failed' });
    });
  });

  socket.on('queue:leave', async () => {
    await matchingEngine.dequeue(st.userId);
    socket.emit('queue:left');
  });

  // WebRTC perfect-negotiation relay (description / candidate)
  socket.on('signal', (data: unknown) => {
    if (st.roomId) socket.to(st.roomId).emit('signal', data);
  });

  // peer mute/camera state so the UI can show indicators
  socket.on('peer:state', (state: { audio: boolean; video: boolean }) => {
    if (st.roomId) socket.to(st.roomId).emit('peer:state', state);
  });

  socket.on('chat:message', (msg: { text?: string }) => {
    const text = (msg?.text ?? '').toString().slice(0, 1000).trim();
    if (!text || !st.roomId) return;
    socket.to(st.roomId).emit('chat:message', { text: sanitize(text), ts: Date.now() });
  });

  socket.on('chat:typing', (typing: boolean) => {
    if (st.roomId) socket.to(st.roomId).emit('chat:typing', Boolean(typing));
  });

  const requeue = async () => {
    await endConnection(io, socket, st.userId, true);
    if (st.lastJoin) await tryMatch(io, socket, st.lastJoin);
  };

  socket.on('skip', async () => { await endConnection(io, socket, st.userId, true); socket.emit('skip:done'); });
  socket.on('next', () => { requeue().catch((e) => logger.error('next error', { e: (e as Error).message })); });

  socket.on('report', async (payload: { reason?: string; details?: string }) => {
    if (!st.partnerId) return;
    try {
      await prisma.$transaction([
        prisma.report.create({
          data: {
            reporterId: st.userId,
            reportedId: st.partnerId,
            reason: (payload?.reason as any) ?? 'OTHER',
            details: payload?.details?.slice(0, 1000),
            connectionId: (await prisma.connection.findUnique({ where: { roomId: st.roomId! } }))?.id,
          },
        }),
        prisma.user.update({ where: { id: st.partnerId }, data: { reportCount: { increment: 1 } } }),
      ]);
      socket.emit('report:received');
    } catch (e) { logger.warn('report failed', { e: (e as Error).message }); }
  });

  socket.on('block', async () => {
    if (!st.partnerId) return;
    try {
      await prisma.blockedUser.upsert({
        where: { blockerId_blockedId: { blockerId: st.userId, blockedId: st.partnerId } },
        create: { blockerId: st.userId, blockedId: st.partnerId },
        update: {},
      });
      await endConnection(io, socket, st.userId, true);
      socket.emit('block:done');
    } catch (e) { logger.warn('block failed', { e: (e as Error).message }); }
  });

  socket.on('disconnect', async () => {
    await endConnection(io, socket, st.userId, true);
    await matchingEngine.dequeue(st.userId);
  });
}
