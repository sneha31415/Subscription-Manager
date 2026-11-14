import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { friendlyError } from '@/lib/errors';
import { cancelAllLocalReminders } from '@/lib/notifications';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True while the person is setting a new password after tapping the reset link in their email. */
  recovering: boolean;
  signUp: (name: string, email: string, password: string) => Promise<{ error?: string; needsVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  setNewPassword: (password: string) => Promise<{ error?: string }>;
  resendVerification: (email: string) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const redirectUrl = () => Linking.createURL('auth-callback');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  // Session persistence: restore on launch, then keep in sync
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Deep links from email: verification and password-reset links open the app with tokens in the URL
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const handle = async (url: string | null) => {
      if (!url) return;
      const frag = url.includes('#') ? url.split('#')[1] : '';
      const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const params = new URLSearchParams(frag || query);
      const access = params.get('access_token');
      const refresh = params.get('refresh_token');
      const code = params.get('code');
      const type = params.get('type');
      try {
        if (access && refresh) {
          await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
          if (type === 'recovery') setRecovering(true);
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          if (type === 'recovery') setRecovering(true);
        }
      } catch {
        /* an expired or reused link just leaves the person on the login screen */
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  const signUp: AuthValue['signUp'] = useCallback(async (name, email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: redirectUrl() },
      });
      if (error) return { error: friendlyError(error) };
      // Supabase returns an empty identities list (and no error) when the email is already registered
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { error: 'An account with this email already exists. Try logging in.' };
      }
      return { needsVerification: !data.session };
    } catch (e) {
      return { error: friendlyError(e) };
    }
  }, []);

  const signIn: AuthValue['signIn'] = useCallback(async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      return error ? { error: friendlyError(error) } : {};
    } catch (e) {
      return { error: friendlyError(e) };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await cancelAllLocalReminders();
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('subtrack.cache.')));
    } catch {
      /* best effort */
    }
    await supabase.auth.signOut();
    setRecovering(false);
  }, []);

  const sendPasswordReset: AuthValue['sendPasswordReset'] = useCallback(async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: redirectUrl() });
      return error ? { error: friendlyError(error) } : {};
    } catch (e) {
      return { error: friendlyError(e) };
    }
  }, []);

  const setNewPassword: AuthValue['setNewPassword'] = useCallback(async (password) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: friendlyError(error) };
      setRecovering(false);
      return {};
    } catch (e) {
      return { error: friendlyError(e) };
    }
  }, []);

  const resendVerification: AuthValue['resendVerification'] = useCallback(async (email) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirectUrl() },
      });
      return error ? { error: friendlyError(error) } : {};
    } catch (e) {
      return { error: friendlyError(e) };
    }
  }, []);

  const deleteAccount: AuthValue['deleteAccount'] = useCallback(async () => {
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return { error: friendlyError(error) };
      await signOut();
      return {};
    } catch (e) {
      return { error: friendlyError(e) };
    }
  }, [signOut]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recovering,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      setNewPassword,
      resendVerification,
      deleteAccount,
    }),
    [session, loading, recovering, signUp, signIn, signOut, sendPasswordReset, setNewPassword, resendVerification, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
