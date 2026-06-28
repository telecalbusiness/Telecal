import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? '';

let globalSocket: Socket | null = null;

export const useSocket = (
  onNotification?: () => void,
) => {
  const handlerRef = useRef(onNotification);
  handlerRef.current = onNotification;

  const connect = useCallback(() => {
    if (globalSocket?.connected) return;

    globalSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    globalSocket.on('notification:new', () => {
      handlerRef.current?.();
    });
  }, []);

  const disconnect = useCallback(() => {
    globalSocket?.disconnect();
    globalSocket = null;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      // Don't disconnect on unmount — keep connection alive
      // across route changes. Disconnect only on logout.
    };
  }, [connect]);

  return { disconnect };
};
