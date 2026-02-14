import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/lib/stores/auth-store';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
  withCredentials: true, // Required to send HttpOnly cookies
});

// ---------------------------------------------------------------------------
// Request interceptor — attach access token
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — 401 handling with token refresh & request queuing
// ---------------------------------------------------------------------------
let isRefreshing = false;
let failedQueue: {
  resolve: (token: string | null) => void;
  reject: (err: unknown) => void;
}[] = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only handle 401s; avoid retry loops
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (typeof window === 'undefined') {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // refreshToken is now in HttpOnly cookie, backend will read it automatically
      // Use a plain axios call to avoid interceptors triggering recursion
      const { data } = await axios.post<{
        success: boolean;
        data: { accessToken: string; expiresIn: number };
      }>(
        `${API_BASE_URL}/auth/refresh`,
        {}, // Empty body - refresh token is in HttpOnly cookie
        {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true, // Send cookies with request
        },
      );

      const newTokens = data.data;
      useAuthStore.getState().setTokens(newTokens.accessToken);

      // Retry all queued requests with the new token
      processQueue(null, newTokens.accessToken);

      // Retry the original request
      originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Clear auth state and redirect to login
      useAuthStore.getState().logout();

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ---------------------------------------------------------------------------
// Helper — extract data from standard API envelope
// ---------------------------------------------------------------------------
export function extractData<T>(response: AxiosResponse<{ data: T }>): T {
  return response.data.data;
}

export default apiClient;
