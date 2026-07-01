import { env } from '../config/env';

export interface IceServer { urls: string | string[]; username?: string; credential?: string }

export function buildIceServers(): IceServer[] {
  const servers: IceServer[] = [
    { urls: env.STUN_URLS.split(',').map((s) => s.trim()) },
  ];
  if (env.TURN_URL) {
    servers.push({
      urls: env.TURN_URL.split(',').map((s) => s.trim()),
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL,
    });
  }
  return servers;
}
