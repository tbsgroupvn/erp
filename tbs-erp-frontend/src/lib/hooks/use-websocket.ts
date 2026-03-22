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
  onError?: (error: Error) => void;
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
 * Features:
 * - Automatic connection with JWT authentication
 * - Auto-reconnection on disconnect (exponential backoff)
 * - React Query cache invalidation on real-time events
 * - Subscribes to dashboard, notification, and domain events
 * - Cleans up on unmount
 *
 * Usage:
 * ```tsx
 * const { isConnected, subscribe, emit } = useWebSocket();
 *
 * useEffect(() => {
 *   const unsub = subscribe('order_update', (data) => {
 *     console.log('Order updated:', data);
 *   });
 *   return unsub;
 * }, [subscribe]);
 * ```
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

  // Build the WebSocket URL from the API URL
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
      // Expose globally so chat hooks (useChatWebSocket) can access the socket
      (globalThis as any).__wsSocket = socket;
      onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      setState((prev) => ({ ...prev, isConnected: false }));
      (globalThis as any).__wsSocket = null;
      onDisconnect?.(reason);
    });

    socket.on('connect_error', (err) => {
      setState((prev) => ({ ...prev, error: err.message, isConnected: false }));
      onError?.(err);
    });

    socket.on('error', (err: Error) => {
      setState((prev) => ({ ...prev, error: err?.message ?? 'Unknown error' }));
      onError?.(err);
    });

    // ─── Domain Event Handlers (invalidate React Query cache) ───

    // Dashboard updates
    socket.on('dashboard_update', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    // Notification events
    socket.on('notification', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    // Order updates
    socket.on('order_update', (data: { orderId?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (data?.orderId) {
        queryClient.invalidateQueries({ queryKey: ['orders', 'detail', data.orderId] });
      }
    });

    // Finance updates
    socket.on('finance_update', () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    // Warehouse updates
    socket.on('package_received', () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] });
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
    });

    // Approval events
    socket.on('approval_requested', () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    });
    socket.on('approval_approved', () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    });
    socket.on('approval_rejected', () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    });

    // Voucher events
    socket.on('voucher_approved', () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    });
    socket.on('voucher_rejected', () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
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
    (event: string, handler: (data: unknown) => void): (() => void) => {
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

  const emit = useCallback((event: string, data?: unknown) => {
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

  // ─── Reconnect when token changes ───

  useEffect(() => {
    if (token && socketRef.current && !socketRef.current.connected) {
      disconnect();
      connect();
    }
  }, [token, connect, disconnect]);

  // ─── Reconnect when browser comes back online ───

  useEffect(() => {
    const handleOnline = () => {
      const socket = socketRef.current;
      if (socket && !socket.connected) {
        socket.connect();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

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

/**
 * Derive the WebSocket URL from NEXT_PUBLIC_API_URL.
 * Strips the /api/v1 suffix and uses the base origin.
 */
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
