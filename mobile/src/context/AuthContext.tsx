import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  apiClient,
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  setStoredTokens,
} from '../api/client';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { seedDemoSessionData, DEMO_USER_ID, DEMO_USER_NAME, DEMO_USER_EMAIL } from '../services/demoService';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isDemo?: boolean;
}

const USER_CACHE_KEY = '@auth_user';

/**
 * The shared demo account. The server treats this exact email as the demo user
 * (lib/captcha.ts) and, while DEMO_MODE is on, skips the IP, rate-limit and bot
 * gates for it. The password is the one app/(auth)/login/actions.ts provisions.
 */
const DEMO_EMAIL = 'demo@careerpilot.com';
const DEMO_PASSWORD = 'demo1234';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemo: boolean;
  redirectPath: string | null;
  setRedirectPath: (path: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUser: (updated: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  isDemo: false,
  redirectPath: null,
  setRedirectPath: () => {},
  login: async () => {},
  loginAsDemo: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
  updateUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  const restoreSession = async () => {
    try {
      const stored = await getStoredToken();
      if (!stored) {
        setIsLoading(false);
        return;
      }

      setToken(stored);

      // Pre-load cached user for instant responsiveness and offline survival
      let cachedUser: AuthUser | null = null;
      try {
        const cachedUserStr = await AsyncStorage.getItem(USER_CACHE_KEY);
        if (cachedUserStr) {
          cachedUser = JSON.parse(cachedUserStr);
          setUser(cachedUser);
        }
      } catch {
        // Ignore cache parse errors
      }

      // If user is already a demo user, preserve demo session even if backend is offline
      if (cachedUser?.isDemo) {
        return;
      }

      // Verify token with server session endpoint
      try {
        const response = await apiClient<{ user: AuthUser }>('/api/auth/mobile/session');
        if (response && response.user) {
          setUser(response.user);
          await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(response.user));
        } else {
          await clearStoredToken();
          await AsyncStorage.removeItem(USER_CACHE_KEY);
          setToken(null);
          setUser(null);
        }
      } catch (verifyError: any) {
        // Only clear credentials if server explicitly rejected with 401 or 403
        if (verifyError?.status === 401 || verifyError?.status === 403) {
          await clearStoredToken();
          await AsyncStorage.removeItem(USER_CACHE_KEY);
          setToken(null);
          setUser(null);
        } else {
          // Network failure or timeout: keep existing token and cached user for offline usage
          console.warn('[auth] Session verification reached offline/server issue, retaining cached session:', verifyError.message);
        }
      }
    } catch {
      await clearStoredToken();
      await AsyncStorage.removeItem(USER_CACHE_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient<{
        accessToken: string;
        refreshToken?: string;
        user: AuthUser;
      }>('/api/auth/mobile/token', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          deviceLabel: `${Platform.OS} app`,
        }),
      });

      if (!res.accessToken || !res.user) {
        throw new Error('Invalid response from authentication server');
      }

      await setStoredTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(res.user));
      setToken(res.accessToken);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsDemo = async () => {
    setIsLoading(true);
    try {
      let demoUserId = DEMO_USER_ID;
      let demoName = DEMO_USER_NAME;
      let demoEmail = DEMO_USER_EMAIL;
      let demoToken = 'careerpilot_demo_session_token';
      let demoRefreshToken: string | undefined;

      // The dedicated /api/auth/mobile/demo endpoint is gone. The demo account is
      // now reached through the normal token endpoint: the server recognises the
      // demo email and, while DEMO_MODE is on, skips the captcha and IP gates.
      try {
        const res = await apiClient<{
          accessToken: string;
          refreshToken?: string;
          user: AuthUser;
        }>('/api/auth/mobile/token', {
          method: 'POST',
          body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
          timeoutMs: 3500,
        });
        if (res?.accessToken && res?.user) {
          demoToken = res.accessToken;
          demoRefreshToken = res.refreshToken;
          demoUserId = res.user.id;
          demoName = res.user.name || demoName;
          demoEmail = res.user.email || demoEmail;
        }
      } catch (err: any) {
        // Offline, or DEMO_MODE is off on the server. Fall back to the local
        // resilient session so the app still opens with seeded sample data.
        console.log('[auth] Using local resilient demo session:', err?.message);
      }

      const demoUser: AuthUser = {
        id: demoUserId,
        name: demoName,
        email: demoEmail,
        isDemo: true,
      };

      // Populate rich sample data across all app modules
      await seedDemoSessionData(demoUserId);

      // Store credentials & set state
      await setStoredTokens({ accessToken: demoToken, refreshToken: demoRefreshToken });
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(demoUser));
      setToken(demoToken);
      setUser(demoUser);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (updatedFields: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Best-effort: revoke this device's refresh family server-side so the
      // token cannot be replayed. Never block sign-out on it.
      try {
        const refreshToken = await getStoredRefreshToken();
        if (refreshToken && refreshToken !== 'careerpilot_demo_session_token') {
          await apiClient('/api/auth/mobile/revoke', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
            timeoutMs: 4000,
          });
        }
      } catch {
        // Offline or already revoked — the local wipe below is what matters.
      }

      await clearStoredToken();
      // Clear all user credentials, drafts, caches, and local sensitive data
      // Preserve only the device-level appearance theme mode
      const allKeys = await AsyncStorage.getAllKeys();
      const preserveKeys = ['@careerpilot_theme_mode'];
      const keysToRemove = allKeys.filter((k) => !preserveKeys.includes(k));
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
      setToken(null);
      setUser(null);
      setRedirectPath(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        isDemo: Boolean(user?.isDemo),
        redirectPath,
        setRedirectPath,
        login,
        loginAsDemo,
        logout,
        refreshSession: restoreSession,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
