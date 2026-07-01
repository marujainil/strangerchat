'use client';

import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

let socket: Socket | null = null;

/**
 * Returns a singleton socket. The access token is passed via the handshake
 * `auth` payload (the backend verifies it in io.use()). Call connectSocket()
 * again with a fresh token after a refresh to reconnect authenticated.
 */
export function getSocket(token: string | null): Socket {
  if (socket) {
    // Update auth on the existing instance for the next (re)connect.
    (socket.auth as Record<string, unknown>) = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 12000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function currentSocket(): Socket | null {
  return socket;
}
