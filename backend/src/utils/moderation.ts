/**
 * Pluggable moderation / anti-abuse hooks.
 *
 * These are REAL interfaces with safe no-op defaults. Wire them to your
 * provider of choice (AWS Rekognition / Hive / Sightengine for NSFW,
 * IPQualityScore / ipinfo for VPN, an internal heuristic/ML service for bots).
 * Returning a deterministic "allow" by default keeps the platform functional
 * out of the box without pretending an ML model exists.
 */
import { env } from '../config/env';
import { logger } from './logger';

export interface VpnResult { isVpn: boolean; provider?: string; score?: number }
export interface NsfwResult { flagged: boolean; score: number }
export interface BotResult { isBot: boolean; reason?: string }

let vpnImpl: (ip: string) => Promise<VpnResult> = async () => ({ isVpn: false });
let nsfwImpl: (imageDataUrl: string) => Promise<NsfwResult> = async () => ({ flagged: false, score: 0 });
let botImpl: (signals: Record<string, unknown>) => Promise<BotResult> = async () => ({ isBot: false });

export const moderation = {
  /** Override at boot, e.g. moderation.useVpnProvider(myFn) */
  useVpnProvider(fn: typeof vpnImpl) { vpnImpl = fn; },
  useNsfwProvider(fn: typeof nsfwImpl) { nsfwImpl = fn; },
  useBotDetector(fn: typeof botImpl) { botImpl = fn; },

  async checkVpn(ip: string): Promise<VpnResult> {
    try { return await vpnImpl(ip); }
    catch (e) { logger.warn('vpn check failed', { e: (e as Error).message }); return { isVpn: false }; }
  },
  async checkNsfw(imageDataUrl: string): Promise<NsfwResult> {
    try { return await nsfwImpl(imageDataUrl); }
    catch (e) { logger.warn('nsfw check failed', { e: (e as Error).message }); return { flagged: false, score: 0 }; }
  },
  async checkBot(signals: Record<string, unknown>): Promise<BotResult> {
    try { return await botImpl(signals); }
    catch { return { isBot: false }; }
  },
};

// Example wiring point (disabled unless creds exist):
if (process.env.IPQS_API_KEY) {
  logger.info('moderation: IPQS VPN provider available (wire fetch in moderation.useVpnProvider)');
}
void env;
