'use client';

import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { getAccessToken, onAccessTokenChange } from '@/lib/api';

/**
 * Connects the singleton Socket.io client using the in-memory access token,
 * and reconnects automatically whenever the token changes (e.g. after a
 * silent refresh). Returns the socket plus a live connected flag.
 */
export function useSocket(enabled: boolean = true) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const tokenRef = useRef<string | null>(getAccessToken());

  useEffect(() => {
    if (!enabled) return;

    const s = getSocket(getAccessToken());
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) setConnected(true);

    // Reconnect with a fresh token after refresh.
    const off = onAccessTokenChange((t) => {
      if (t !== tokenRef.current) {
        tokenRef.current = t;
        const next = getSocket(t);
        next.disconnect().connect();
      }
    });

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      off();
    };
  }, [enabled]);

  // Tear the socket down fully on full unmount of the consuming tree.
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  return { socket, connected };
}
