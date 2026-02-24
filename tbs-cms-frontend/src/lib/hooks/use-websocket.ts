'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Configuration for the WebSocket connection.
 */
interface UseWebSocketOptions {
  /** Whether to auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Custom event handlers */
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: any) => void;
}

/**
 * WebSocket connection state.
 */
interface WebSocketState {
  /** Whether the socket is currently connected */
  isConnected: boolean;
  /** Connection error, if any */
  error: string | null;
  /** The Socket.IO client instance */
  socket: Socket | null;
}

/**
 * React hook for managing WebSocket connections to the TBS ERP backend.
 *
 * This is the CMS frontend version. It subscribes to the same WebSocket server
 * but focuses on CMS-relevant events (content updates, blog posts, notifications).
 *
 * Features:
 * - Automatic connection with JWT authentication
 * - Auto-reconnection on disconnect (exponential backoff)
 * - React Query cache invalidation on real-time events
 * - Cleans up on unmount
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true, onConnect, onDisconnect, onError } = options;
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    error: null,
    socket: null,
  });

  const wsUrl = getWsUrl();

  // ─── Connect ───

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    if (!token) {
      setState((prev) => ({ ...prev, error: 'No authentication token' }));
      return;
    }

    const socket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      setState({ isConnected: true, error: null, socket });
      onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      setState((prev) => ({ ...prev, isConnected: false }));
      onDisconnect?.(reason);
    });

    socket.on('connect_error', (err) => {
      setState((prev) => ({ ...prev, error: err.message, isConnected: false }));
      onError?.(err);
    });

    socket.on('error', (err: any) => {
      setState((prev) => ({ ...prev, error: err?.message ?? 'Unknown error' }));
      onError?.(err);
    });

    // ─── CMS-relevant Event Handlers ───

    socket.on('dashboard_update', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    socket.on('notification', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('approval_requested', () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    });
    socket.on('approval_approved', () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    });
    socket.on('approval_rejected', () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    });

    socketRef.current = socket;
  }, [token, wsUrl, queryClient, onConnect, onDisconnect, onError]);

  // ─── Disconnect ───

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setState({ isConnected: false, error: null, socket: null });
    }
  }, []);

  // ─── Subscribe to custom events ───

  const subscribe = useCallback(
    (event: string, handler: (data: any) => void): (() => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      socket.on(event, handler);
      return () => {
        socket.off(event, handler);
      };
    },
    [],
  );

  // ─── Emit events ───

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  // ─── Auto-connect on mount, disconnect on unmount ───

  useEffect(() => {
    if (autoConnect && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, token, connect, disconnect]);

  useEffect(() => {
    if (token && socketRef.current && !socketRef.current.connected) {
      disconnect();
      connect();
    }
  }, [token, connect, disconnect]);

  return {
    isConnected: state.isConnected,
    error: state.error,
    socket: state.socket,
    connect,
    disconnect,
    subscribe,
    emit,
  };
}

function getWsUrl(): string {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'http://localhost:3000';
  }
}
