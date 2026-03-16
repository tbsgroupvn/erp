/**
 * Background service worker for TBS ERP Chrome Extension.
 *
 * Responsibilities:
 * - Manage authentication tokens (login, logout, auto-refresh)
 * - Manage the product cart (chrome.storage.local)
 * - Proxy all API requests to the ERP backend (avoids CORS from content scripts)
 * - Update badge with cart count
 */

import type { AuthState, CartItem, ScrapedProduct } from '../types';
import type { LoginResponse } from '../types/api';
import type { ExtensionMessage, MessageResponse } from './messages';

// ──────────────── Configuration ────────────────

const API_BASE_URL = 'http://localhost:3000/api/v1';

// ──────────────── Storage helpers ────────────────

async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get('auth');
  return (
    result.auth || {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      user: null,
    }
  );
}

async function setAuthState(state: AuthState): Promise<void> {
  await chrome.storage.local.set({ auth: state });
}

async function getCart(): Promise<CartItem[]> {
  const result = await chrome.storage.local.get('cart');
  return result.cart || [];
}

async function setCart(cart: CartItem[]): Promise<void> {
  await chrome.storage.local.set({ cart });
  // Update badge
  const count = cart.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
}

// ──────────────── API helpers ────────────────

async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const auth = await getAuthState();

  // Check if token needs refresh
  if (auth.accessToken && auth.expiresAt && Date.now() > auth.expiresAt - 60000) {
    await refreshToken();
  }

  const freshAuth = await getAuthState();
  const url = new URL(`${API_BASE_URL}${path}`);

  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (freshAuth.accessToken) {
    headers['Authorization'] = `Bearer ${freshAuth.accessToken}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle 401: attempt token refresh once
  if (response.status === 401 && freshAuth.refreshToken) {
    const refreshed = await refreshToken();
    if (refreshed) {
      // Retry the request
      const retryAuth = await getAuthState();
      headers['Authorization'] = `Bearer ${retryAuth.accessToken}`;

      const retryResponse = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const retryData = await retryResponse.json().catch(() => null);
      return { ok: retryResponse.ok, status: retryResponse.status, data: retryData };
    }
  }

  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

async function refreshToken(): Promise<boolean> {
  const auth = await getAuthState();
  if (!auth.refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed — log out
      await setAuthState({
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        user: null,
      });
      return false;
    }

    const data: LoginResponse = await response.json();
    await setAuthState({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
      user: data.user,
    });
    return true;
  } catch {
    return false;
  }
}

// ──────────────── Message handler ────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // Keep channel open for async response
  },
);

async function handleMessage(
  message: ExtensionMessage,
): Promise<MessageResponse> {
  try {
    switch (message.type) {
      case 'LOGIN': {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.payload),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return {
            success: false,
            error: error.message || 'Đăng nhập thất bại',
          };
        }

        const data: LoginResponse = await response.json();
        await setAuthState({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + data.expiresIn * 1000,
          user: data.user,
        });

        return { success: true, data: data.user };
      }

      case 'LOGOUT': {
        await setAuthState({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          user: null,
        });
        return { success: true };
      }

      case 'GET_AUTH_STATE': {
        const auth = await getAuthState();
        return {
          success: true,
          data: {
            isAuthenticated: !!auth.accessToken,
            user: auth.user,
          },
        };
      }

      case 'ADD_TO_CART': {
        const cart = await getCart();
        const product: ScrapedProduct = message.payload;

        const newItem: CartItem = {
          ...product,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          quantity: 1,
          note: '',
        };

        cart.push(newItem);
        await setCart(cart);
        return { success: true, data: newItem };
      }

      case 'REMOVE_FROM_CART': {
        const cart = await getCart();
        const filtered = cart.filter((item) => item.id !== message.payload.id);
        await setCart(filtered);
        return { success: true };
      }

      case 'GET_CART': {
        const cart = await getCart();
        return { success: true, data: cart };
      }

      case 'CLEAR_CART': {
        await setCart([]);
        return { success: true };
      }

      case 'UPDATE_CART_ITEM': {
        const cart = await getCart();
        const idx = cart.findIndex((item) => item.id === message.payload.id);
        if (idx === -1) {
          return { success: false, error: 'Sản phẩm không tồn tại trong giỏ' };
        }
        cart[idx] = { ...cart[idx], ...message.payload.updates };
        await setCart(cart);
        return { success: true, data: cart[idx] };
      }

      case 'SEARCH_CUSTOMERS': {
        const result = await apiRequest('GET', '/customers', undefined, {
          search: message.payload.search,
          limit: String(message.payload.limit || 10),
        });

        if (!result.ok) {
          return {
            success: false,
            error: 'Không thể tìm khách hàng',
          };
        }

        return { success: true, data: result.data };
      }

      case 'CREATE_ORDER': {
        const result = await apiRequest(
          'POST',
          '/master-orders',
          message.payload,
        );

        if (!result.ok) {
          const errorData = result.data as { message?: string } | null;
          return {
            success: false,
            error: errorData?.message || 'Lỗi tạo đơn hàng',
          };
        }

        return { success: true, data: result.data };
      }

      case 'API_REQUEST': {
        const { method, path, body, params } = message.payload;
        const result = await apiRequest(method, path, body, params);

        if (!result.ok) {
          return {
            success: false,
            error: `API error: ${result.status}`,
          };
        }

        return { success: true, data: result.data };
      }

      default:
        return { success: false, error: 'Unknown message type' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ──────────────── Initialize badge on install ────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const cart = await getCart();
  const count = cart.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
});
