import { randomUUID } from 'crypto';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { MatchProfile, MatchFilters, MatchResult, ChatMode } from './types';

const POOL = (mode: ChatMode) => `match:pool:${mode}`;
const PROFILE = (id: string) => `match:profile:${id}`;
const RECENT = (id: string) => `match:recent:${id}`;
const LOCK_KEY = 'match:lock';
const PROFILE_TTL = 120; // seconds a stale waiting profile lives
const RECENT_TTL = 90;   // don't re-pair with same stranger for 90s
const MODES: ChatMode[] = ['VIDEO', 'AUDIO', 'TEXT'];

/* ---------- distributed lock (race-safe pairing) ---------- */
async function acquireLock(ttlMs = 2500, retries = 25): Promise<string | null> {
  const token = randomUUID();
  for (let i = 0; i < retries; i++) {
    const ok = await redis.set(LOCK_KEY, token, 'PX', ttlMs, 'NX');
    if (ok === 'OK') return token;
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 30));
  }
  return null;
}
const RELEASE = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else return 0 end`;
async function releaseLock(token: string) {
  try { await redis.eval(RELEASE, 1, LOCK_KEY, token); } catch { /* lock expired */ }
}

/* ---------- compatibility (mutual) ---------- */
function within<T>(allowed: T[] | undefined, value: T | undefined): boolean {
  if (!allowed || allowed.length === 0) return true; // no constraint
  if (value === undefined) return false;
  return allowed.includes(value);
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Does `seeker`'s filter set accept `cand`'s profile? */
function seekerAccepts(filters: MatchFilters, cand: MatchProfile, seeker: MatchProfile): boolean {
  if (!within(filters.genders, cand.gender)) return false;
  if (!within(filters.countries, cand.countryCode)) return false;
  if (!within(filters.relationship, cand.relationship)) return false;
  if (filters.onlyVerified && !cand.isVerified) return false;
  if (filters.onlyPremium && !cand.isPremium) return false;
  if (filters.newUsersOnly && cand.accountAgeDays > 7) return false;

  if (filters.languages?.length) {
    if (!cand.languages.some((l) => filters.languages!.includes(l))) return false;
  }
  if (filters.interests?.length) {
    if (!cand.interests.some((i) => filters.interests!.includes(i))) return false;
  }
  if (filters.ageMin !== undefined && (cand.age ?? -1) < filters.ageMin) return false;
  if (filters.ageMax !== undefined && (cand.age ?? 999) > filters.ageMax) return false;

  if (filters.distanceKm !== undefined &&
      seeker.lat != null && seeker.lng != null && cand.lat != null && cand.lng != null) {
    if (haversineKm(seeker.lat, seeker.lng, cand.lat, cand.lng) > filters.distanceKm) return false;
  }
  return true;
}

/** Match is valid only if BOTH parties' filters are satisfied. */
function mutuallyCompatible(a: MatchProfile, b: MatchProfile): boolean {
  if (a.mode !== b.mode) return false;
  if (a.userId === b.userId) return false;
  return seekerAccepts(a.filters, b, a) && seekerAccepts(b.filters, a, b);
}

/* ---------- priority score (premium jumps the queue) ---------- */
function score(p: MatchProfile): number {
  const premiumBoost = p.isPremium ? 10 * 60 * 1000 : 0; // act as if waited 10m longer
  return p.joinedAt - premiumBoost;
}

/* ---------- public API ---------- */
export class MatchingEngine {
  /** Remove a user from every pool + their profile/lock residue. */
  async dequeue(userId: string): Promise<void> {
    const pipe = redis.pipeline();
    for (const m of MODES) pipe.zrem(POOL(m), userId);
    pipe.del(PROFILE(userId));
    await pipe.exec();
  }

  async isWaiting(userId: string): Promise<boolean> {
    return (await redis.exists(PROFILE(userId))) === 1;
  }

  /** Note two users met so we don't immediately re-pair them. */
  async rememberPair(a: string, b: string): Promise<void> {
    const pipe = redis.pipeline();
    pipe.sadd(RECENT(a), b); pipe.expire(RECENT(a), RECENT_TTL);
    pipe.sadd(RECENT(b), a); pipe.expire(RECENT(b), RECENT_TTL);
    await pipe.exec();
  }

  /**
   * Try to match `me`. On success returns a MatchResult and BOTH users are
   * removed from the queue. On failure `me` is enqueued (returns null).
   * `blockedIds` = users that either blocked or were blocked by `me`.
   */
  async findMatch(me: MatchProfile, blockedIds: Set<string>): Promise<MatchResult | null> {
    const token = await acquireLock();
    if (!token) {
      // Could not get lock; enqueue without matching, the partner's join will pair us.
      await this.enqueue(me);
      logger.warn('match lock contention; enqueued without scan', { userId: me.userId });
      return null;
    }
    try {
      await this.dequeue(me.userId); // ensure clean state
      const recent = new Set(await redis.smembers(RECENT(me.userId)));
      const candidateIds = await redis.zrange(POOL(me.mode), 0, 60); // ascending score
      if (candidateIds.length) {
        const profilesRaw = await redis.mget(...candidateIds.map((id) => PROFILE(id)));
        for (let i = 0; i < candidateIds.length; i++) {
          const id = candidateIds[i];
          if (id === me.userId || blockedIds.has(id) || recent.has(id)) continue;
          const raw = profilesRaw[i];
          if (!raw) { await redis.zrem(POOL(me.mode), id); continue; } // stale
          const cand = JSON.parse(raw) as MatchProfile;
          // candidate must also not have blocked me
          if (cand.filters && !mutuallyCompatible(me, cand)) continue;

          // matched! remove candidate from pool, build room
          await redis.zrem(POOL(me.mode), id);
          await redis.del(PROFILE(id));
          await this.rememberPair(me.userId, id);
          const roomId = `room_${randomUUID()}`;
          // The user with the lexicographically smaller id is the "polite" peer.
          const mePolite = me.userId < id;
          // Return result FOR `me`; caller emits the mirror to the partner.
          return { roomId, partner: cand, polite: mePolite };
        }
      }
      // no compatible partner: wait
      await this.enqueue(me);
      return null;
    } finally {
      await releaseLock(token);
    }
  }

  private async enqueue(me: MatchProfile): Promise<void> {
    const pipe = redis.pipeline();
    pipe.set(PROFILE(me.userId), JSON.stringify(me), 'EX', PROFILE_TTL);
    pipe.zadd(POOL(me.mode), score(me), me.userId);
    await pipe.exec();
  }

  /** Count of users currently waiting across all modes. */
  async waitingCount(): Promise<number> {
    const pipe = redis.pipeline();
    for (const m of MODES) pipe.zcard(POOL(m));
    const res = await pipe.exec();
    return (res ?? []).reduce((acc, [, n]) => acc + (Number(n) || 0), 0);
  }
}

export const matchingEngine = new MatchingEngine();
