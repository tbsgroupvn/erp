/**
 * Axios instance trung tam cho TBS ERP Mobile
 *
 * Chuc nang:
 * - Request interceptor: tu dong gan Authorization header tu AsyncStorage
 * - Response interceptor: xu ly 401 → goi refreshToken() → retry request goc
 * - Timeout 15s de tranh request treo vo han
 * - Base URL tu file auth.ts (nguon duy nhat — tranh hardcode trung lap)
 *
 * SECURITY NOTE:
 * TODO: Neu dung certificate pinning (khuyen nghi cho production):
 *   - iOS: dung NSURLSession pinning hoac TrustKit
 *   - Android: dung OkHttp CertificatePinner
 *   - React Native: dung react-native-ssl-pinning thay axios cho cac API nhay cam
 */
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import {getToken, refreshToken, logout, API_BASE_URL} from './auth';

// ============================================================
// Tao Axios instance voi config mac dinh
// FIX: Dung API_BASE_URL tu auth.ts — khong khai bao lai BASE_URL
// ============================================================
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000, // 15 giay
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ============================================================
// Request interceptor — gan JWT token vao moi request
// ============================================================
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const token = await getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ============================================================
// Response interceptor — tu dong refresh token khi bi 401
// ============================================================

// Flag de tranh goi refresh nhieu lan cung luc (race condition)
let isRefreshing = false;

// Queue cac request dang cho khi refresh dang dien ra
type RequestQueueItem = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};
let pendingRequestsQueue: RequestQueueItem[] = [];

/**
 * Giai quyet tat ca request dang cho trong queue sau khi refresh xong
 */
function resolveQueue(token: string): void {
  pendingRequestsQueue.forEach(p => p.resolve(token));
  pendingRequestsQueue = [];
}

/**
 * Tu choi tat ca request dang cho trong queue
 */
function rejectQueue(error: unknown): void {
  pendingRequestsQueue.forEach(p => p.reject(error));
  pendingRequestsQueue = [];
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: unknown) => {
    // FIX: Khai bao ro rang kieu de tranh any
    const axiosError = error as {
      response?: {status: number};
      config: AxiosRequestConfig & {_retry?: boolean};
    };

    const originalRequest = axiosError.config;

    // Chi xu ly 401 va chua retry lan nao
    if (axiosError.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Neu dang trong qua trinh refresh, them request nay vao queue
    if (isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        pendingRequestsQueue.push({
          resolve: (token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    // Bat dau qua trinh refresh
    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newToken = await refreshToken();

      // FIX: Reset flag truoc khi resolve queue de tranh state khong nhat quan
      isRefreshing = false;
      resolveQueue(newToken);

      // Retry request goc voi token moi
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
      }
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh that bai → dang xuat user
      isRefreshing = false;
      rejectQueue(refreshError);
      await logout();
      return Promise.reject(refreshError);
    }
  },
);

export default api;

// ============================================================
// Helper functions cho cac module dung
// ============================================================

/**
 * GET request voi type safety
 */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<T>(url, {params});
  return response.data;
}

/**
 * POST request voi type safety
 */
export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.post<T>(url, data);
  return response.data;
}

/**
 * PATCH request voi type safety
 */
export async function apiPatch<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.patch<T>(url, data);
  return response.data;
}

/**
 * Upload file (multipart/form-data) — dung cho anh giao hang (POD)
 */
export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const response = await api.post<T>(url, formData, {
    headers: {'Content-Type': 'multipart/form-data'},
    timeout: 30_000, // 30 giay cho upload
  });
  return response.data;
}
