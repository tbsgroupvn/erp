/**
 * Auth service — quan ly JWT token lifecycle
 *
 * Flow:
 * 1. login() → POST /auth/login → luu access + refresh token
 * 2. Request interceptor trong api.ts tu dong dinh kem token
 * 3. Response interceptor bat 401 → goi refreshToken() → retry
 * 4. logout() → xoa toan bo token khoi AsyncStorage + clear offline queue
 *
 * NOTE: Backend tra refreshToken qua cookie HttpOnly trong web.
 * Voi mobile, server can duoc cau hinh tra refreshToken trong response body
 * hoac dung endpoint rieng POST /auth/mobile/login.
 * Hien tai implementation nay xu ly ca 2 truong hop.
 *
 * SECURITY NOTE:
 * TODO: Chuyen sang react-native-keychain cho token storage production.
 * Hien tai dung AsyncStorage (khong ma hoa) — chi chap nhan cho development.
 */

import {STORAGE_KEYS, setItem, getItem, removeItem, setObject, getObject, clearSession} from '../utils/storage';

// FIX: Tranh circular import (offline-queue → api → auth → offline-queue)
// Thay vi import clearQueue truc tiep, clear queue bang cach ghi mang rong vao storage.
// offline-queue doc/ghi STORAGE_KEYS.OFFLINE_QUEUE qua utils/storage — chung ta co the
// reset key do truc tiep o day ma khong can import offline-queue module.
// Chain: offline-queue imports api, api imports auth, auth se NOT import offline-queue.
async function clearOfflineQueue(): Promise<void> {
  await setObject(STORAGE_KEYS.OFFLINE_QUEUE, [] as unknown[]);
}

// Cau hinh base URL tap trung — dung chung cho ca auth.ts va api.ts
// FIX: Xuat BASE_URL de api.ts co the import thay vi khai bao lai
export const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:3001/api'   // Android emulator: 10.0.2.2 = localhost may host
  : 'https://api.tbs-erp.vn/api';

// Thong tin user luu tren device
export interface UserInfo {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branch?: string;
}

// Response cua POST /auth/login
interface LoginResponse {
  user: UserInfo;
  tokens: {
    accessToken: string;
    refreshToken?: string; // co the trong response body (mobile mode) hoac HttpOnly cookie
    expiresIn: number;     // giay, default 900 (15 phut)
  };
}

// Response cua POST /auth/refresh
interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Thuc hien dang nhap
 * Luu access token, refresh token, user info va thoi gian het han vao AsyncStorage
 */
export async function login(email: string, password: string): Promise<UserInfo> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as {message?: string};
    throw new Error(err?.message ?? 'Dang nhap that bai');
  }

  const data: LoginResponse = await response.json() as LoginResponse;

  // Luu access token
  await setItem(STORAGE_KEYS.ACCESS_TOKEN, data.tokens.accessToken);

  // Luu refresh token neu server tra trong body (mobile mode)
  if (data.tokens.refreshToken) {
    await setItem(STORAGE_KEYS.REFRESH_TOKEN, data.tokens.refreshToken);
  }

  // Luu thoi gian het han (unix ms)
  const expiryMs = Date.now() + data.tokens.expiresIn * 1000;
  await setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiryMs));

  // Luu thong tin user
  await setObject(STORAGE_KEYS.USER_INFO, data.user);

  return data.user;
}

/**
 * Dang xuat — xoa toan bo session data va offline queue
 *
 * FIX: Them clearQueue() khi logout.
 * Tranh truong hop offline queue cua user nay bi xu ly khi user khac login.
 */
export async function logout(): Promise<void> {
  // Goi API logout de huy session tren server (best effort — khong block)
  const token = await getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    }).catch(() => {
      // ignore network error khi logout
    });
  }

  // FIX: Xoa session va offline queue dong thoi
  // Dung clearOfflineQueue() local thay vi import clearQueue() tu offline-queue.ts
  // de tranh circular dependency: offline-queue → api → auth → offline-queue
  await Promise.all([
    clearSession(),
    clearOfflineQueue(),
  ]);
}

/**
 * Lay access token hien tai tu AsyncStorage
 */
export async function getToken(): Promise<string | null> {
  return getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Lay refresh token hien tai tu AsyncStorage
 */
export async function getRefreshToken(): Promise<string | null> {
  return getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Lay thong tin user dang dang nhap
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
  return getObject<UserInfo>(STORAGE_KEYS.USER_INFO);
}

/**
 * Goi API refresh token va cap nhat token moi vao AsyncStorage
 * Tra ve access token moi, throw neu that bai
 */
export async function refreshToken(): Promise<string> {
  const currentRefreshToken = await getItem(STORAGE_KEYS.REFRESH_TOKEN);

  if (!currentRefreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentRefreshToken}`,
    },
  });

  if (!response.ok) {
    // Refresh that bai — xoa session, bat user login lai
    await clearSession();
    throw new Error('Session expired, please login again');
  }

  const data: RefreshResponse = await response.json() as RefreshResponse;

  await setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);

  if (data.refreshToken) {
    await setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
  }

  const expiryMs = Date.now() + data.expiresIn * 1000;
  await setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiryMs));

  return data.accessToken;
}

/**
 * Kiem tra xem user da dang nhap va token con han hay chua
 * Tra ve true neu co token va chua het han (con > 60 giay)
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (!token) {
    return false;
  }

  const expiryRaw = await getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  if (!expiryRaw) {
    // Khong biet thoi han → assume da het han
    return false;
  }

  const expiryMs = parseInt(expiryRaw, 10);
  if (isNaN(expiryMs)) {
    return false;
  }

  // Con it nhat 60 giay nua moi het han
  return Date.now() < expiryMs - 60_000;
}

/**
 * Xoa chi access token (giu refresh token)
 * Dung khi access token het han va can refresh
 */
export async function clearAccessToken(): Promise<void> {
  await removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  await removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
}
