'use client';

import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '@/lib/api';

/**
 * Live online-user counter. Seeds from the REST endpoint, then keeps in sync
 * via the `presence:count` socket broadcast.
 */
export function useOnlineCount(socket: Socket | null) {
  const [online, setOnline] = useState<number>(0);
  const [waiting, setWaiting] = useState<number>(0);

  useEffect(() => {
    let active = true;
    api
      .get('/users/online')
      .then(({ data }) => {
        if (!active) return;
        setOnline(data.online ?? 0);
        setWaiting(data.waiting ?? 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    // The backend broadcasts `presence:count` as a RAW number
    // (`io.emit('presence:count', count)`). We still tolerate an object
    // shape defensively in case the contract evolves.
    const onCount = (payload: number | { online?: number; waiting?: number }) => {
      if (typeof payload === 'number') {
        setOnline(Math.max(0, payload));
        return;
      }
      if (payload && typeof payload.online === 'number') setOnline(payload.online);
      if (payload && typeof payload.waiting === 'number') setWaiting(payload.waiting);
    };
    socket.on('presence:count', onCount);
    return () => {
      socket.off('presence:count', onCount);
    };
  }, [socket]);

  return { online, waiting };
}
