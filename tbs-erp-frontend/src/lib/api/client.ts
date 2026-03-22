import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/lib/stores/auth-store';
import { addMutation } from '@/lib/offline/mutation-queue';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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
      // refreshToken is in HttpOnly cookie, backend will read it automatically
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
// Response interceptor — offline mutation queueing
// ---------------------------------------------------------------------------
// Mutating methods that should be queued when offline
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const config = error.config;

    // Only intercept network errors for mutating requests (not 4xx/5xx from server)
    if (
      !config ||
      error.response || // Has a server response → not a network error
      typeof window === 'undefined' ||
      !MUTATING_METHODS.has((config.method ?? '').toLowerCase())
    ) {
      return Promise.reject(error);
    }

    // This is a network error on a mutating request — queue it for offline sync
    const fullUrl = config.baseURL
      ? `${config.baseURL}${config.url ?? ''}`
      : config.url ?? '';

    const method = (config.method ?? 'POST').toUpperCase() as
      | 'POST'
      | 'PUT'
      | 'PATCH'
      | 'DELETE';

    // Parse the request body (Axios may have stringified it)
    let body: unknown = config.data;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    // Extract relevant headers (Authorization for replay)
    const headers: Record<string, string> = {};
    if (config.headers?.Authorization) {
      headers['Authorization'] = String(config.headers.Authorization);
    }

    try {
      const mutationId = await addMutation(method, fullUrl, body, headers);

      // Show a user-friendly toast when offline
      if (!navigator.onLine) {
        toast.info(
          'Ban dang offline. Thao tac da duoc luu va se tu dong gui khi co mang.',
          { id: `offline-queued-${mutationId}`, duration: 5000 },
        );
      }

      // Return a synthetic successful response so the UI can proceed optimistically
      return {
        data: {
          success: true,
          queued: true,
          mutationId,
          message: 'Thao tac da duoc luu va se dong bo khi co ket noi mang.',
        },
        status: 202,
        statusText: 'Accepted (Queued)',
        headers: { 'x-offline-queued': 'true' },
        config,
      } as AxiosResponse;
    } catch {
      // If queueing itself fails, reject with the original error
      return Promise.reject(error);
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
