import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  restoreSession,
  signIn as performSignIn,
  signInAsDemo as performSignInAsDemo,
  signOut as performSignOut,
  type SignInResult,
} from './session';

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface AuthState {
  /** null while the stored credential is being checked on cold start */
  status: 'loading' | 'signedOut' | 'signedIn';
  user: SessionUser | null;
  error: string | null;
  busy: boolean;
  signIn(email: string, password: string, captchaToken?: string): Promise<SignInResult>;
  signInAsDemo(): Promise<SignInResult>;
  signOut(): Promise<void>;
  /** true once the first-run screens have been completed on this device */
  hasOnboarded: boolean;
  completeOnboarding(): void;
}

const AuthContext = createContext<AuthState | null>(null);

const ONBOARDED_KEY = 'careerpilot.onboarded';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [session, onboarded] = await Promise.all([
        restoreSession(),
        readOnboarded(),
      ]);
      if (cancelled) return;
      setUser(session);
      setHasOnboarded(onboarded);
      setStatus(session ? 'signedIn' : 'signedOut');
    })().catch(() => {
      // A storage failure must not hang the app on the splash screen.
      if (!cancelled) setStatus('signedOut');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await performSignIn(email, password, captchaToken);
      if (!result.ok) {
        // A captcha prompt is not a failure to report — the caller opens the
        // captcha sheet and retries. Showing it as an error too doubles up.
        if (!result.needsCaptcha) setError(result.error);
        return result;
      }
      const session = await restoreSession();
      setUser(session);
      setStatus(session ? 'signedIn' : 'signedOut');
      if (!session) {
        const failed = { ok: false as const, error: 'Signed in, but the session could not be restored.' };
        setError(failed.error);
        return failed;
      }
      return result;
    } catch (err) {
      // A rejecting SecureStore call (corrupt keystore entry, restored backup)
      // used to escape before setBusy(false), leaving the sign-in button
      // spinning until the app was restarted.
      const message = err instanceof Error ? err.message : 'Could not sign in. Try again.';
      setError(message);
      return { ok: false as const, error: message };
    } finally {
      setBusy(false);
    }
  }, []);

  const signInAsDemo = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await performSignInAsDemo();
      const session = await restoreSession();
      setUser(session);
      setStatus(session ? 'signedIn' : 'signedOut');
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not enter demo mode.';
      setError(message);
      return { ok: false as const, error: message };
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await performSignOut();
    } catch {
      // Storage can fail; the user asked to leave either way, and a permanently
      // spinning Sign out button is worse than a credential cleaned up next launch.
    } finally {
      setUser(null);
      setError(null);
      setStatus('signedOut');
      setBusy(false);
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    setHasOnboarded(true);
    void writeOnboarded();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, error, busy, signIn, signInAsDemo, signOut, hasOnboarded, completeOnboarding }),
    [status, user, error, busy, signIn, signInAsDemo, signOut, hasOnboarded, completeOnboarding],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/* Onboarding flag lives in SecureStore alongside the credentials, so there is
   only one storage dependency in the app. */
async function readOnboarded(): Promise<boolean> {
  const { default: SecureStore } = await import('expo-secure-store');
  try {
    return (await SecureStore.getItemAsync(ONBOARDED_KEY)) === '1';
  } catch {
    return false;
  }
}

async function writeOnboarded(): Promise<void> {
  const { default: SecureStore } = await import('expo-secure-store');
  try {
    await SecureStore.setItemAsync(ONBOARDED_KEY, '1');
  } catch {
    /* non-fatal */
  }
}
