import { useState, useEffect, useCallback } from 'react';
import type { MessageResponse } from '../../background/messages';

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface UseAuthReturn {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth state on mount
  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: 'GET_AUTH_STATE' })
      .then((response: MessageResponse<{ isAuthenticated: boolean; user: AuthUser | null }>) => {
        if (response.success && response.data) {
          setIsAuthenticated(response.data.isAuthenticated);
          setUser(response.data.user);
        }
      })
      .catch(() => {
        // Extension context lost
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response: MessageResponse<AuthUser> = await chrome.runtime.sendMessage({
      type: 'LOGIN',
      payload: { email, password },
    });

    if (response.success && response.data) {
      setIsAuthenticated(true);
      setUser(response.data);
      return { success: true };
    }

    return { success: false, error: response.error || 'Đăng nhập thất bại' };
  }, []);

  const logout = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return { isAuthenticated, user, isLoading, login, logout };
}
