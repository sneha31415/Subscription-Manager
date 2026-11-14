import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  anchorOf,
  computeNextBilling,
  intervalForSub,
  nextOccurrenceAfter,
  todayYMD,
} from '@/lib/billing';
import { convert, loadRates } from '@/lib/currency';
import { friendlyError } from '@/lib/errors';
import { cancelAllLocalReminders, syncLocalReminders } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { Category, Payment, Profile, Rates, SubStatus, Subscription, SubscriptionInput } from '@/types';
import { useAuth } from './AuthContext';

interface DataValue {
  profile: Profile | null;
  categories: Category[];
  subscriptions: Subscription[];
  payments: Payment[];
  rates: Rates | null;
  displayCurrency: string;
  loading: boolean;
  refreshing: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  refreshRates: () => Promise<boolean>;
  /** Convert into the preferred currency. null when no exchange rate is available. */
  toDisplay: (amount: number, currency: string) => number | null;
  updateProfile: (patch: Partial<Omit<Profile, 'id'>>) => Promise<string | null>;
  addSubscription: (input: SubscriptionInput) => Promise<{ error?: string; id?: string }>;
  updateSubscription: (id: string, input: SubscriptionInput) => Promise<string | null>;
  setStatus: (id: string, status: SubStatus) => Promise<string | null>;
  convertTrial: (id: string) => Promise<string | null>;
  deleteSubscription: (id: string) => Promise<string | null>;
  recordPayment: (sub: Subscription, paidOn?: string, amount?: number) => Promise<string | null>;
  deletePayment: (id: string) => Promise<string | null>;
  addCategory: (name: string, color: string) => Promise<{ error?: string; category?: Category }>;
}

const DataContext = createContext<DataValue | null>(null);

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Snapshot {
  profile: Profile | null;
  categories: Category[];
  subscriptions: Subscription[];
  payments: Payment[];
}

async function fetchAll(userId: string, displayName: string | undefined): Promise<Snapshot> {
  const [p, c, s, pay] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('categories').select('*').order('name'),
    supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
    supabase.from('payments').select('*').order('paid_on', { ascending: false }).limit(2000),
  ]);
  const err = p.error ?? c.error ?? s.error ?? pay.error;
  if (err) throw err;

  let profile = p.data as Profile | null;
  if (!profile) {
    // Safety net: the sign-up trigger normally creates this row
    const ins = await supabase
      .from('profiles')
      .insert({ id: userId, display_name: displayName ?? null })
      .select('*')
      .single();
    if (ins.error) throw ins.error;
    profile = ins.data as Profile;
  }
  return {
    profile,
    categories: (c.data ?? []) as Category[],
    subscriptions: (s.data ?? []) as Subscription[],
    payments: (pay.data ?? []) as Payment[],
  };
}

/**
 * Brings the books up to date:
 *  - trials whose end date has passed become normal paid subscriptions
 *  - every billing date that has now passed is recorded as a payment (using today's rate)
 *    and next_billing_date moves forward
 * Payments are inserted with "ignore duplicates", so running this on two devices is safe.
 */
async function processDue(userId: string, subs: Subscription[], profile: Profile, rates: Rates | null): Promise<boolean> {
  const today = todayYMD();
  let changed = false;

  for (const s of subs) {
    if (s.status === 'trial' && s.trial_end_date && s.trial_end_date <= today) {
      const patch = {
        is_trial: false,
        status: 'active' as SubStatus,
        start_date: s.trial_end_date,
        next_billing_date: s.trial_end_date,
      };
      const { error } = await supabase.from('subscriptions').update(patch).eq('id', s.id);
      if (error) continue;
      Object.assign(s, patch);
      changed = true;
    }
    if (s.status !== 'active') continue;

    const iv = intervalForSub(s);
    const anchor = anchorOf(s);
    let due = s.next_billing_date ?? computeNextBilling(s);
    const dueDates: string[] = [];
    let guard = 0;
    while (due <= today && guard++ < 36) {
      dueDates.push(due);
      due = nextOccurrenceAfter(anchor, iv, due);
    }
    if (dueDates.length === 0) {
      if (!s.next_billing_date) {
        await supabase.from('subscriptions').update({ next_billing_date: due }).eq('id', s.id);
        changed = true;
      }
      continue;
    }

    const rate = convert(1, s.currency, profile.preferred_currency, rates);
    if (rate === null) continue; // no exchange rate yet — try again next time
    const rows = dueDates.map((d) => ({
      user_id: userId,
      subscription_id: s.id,
      amount: s.amount,
      currency: s.currency,
      paid_on: d,
      display_currency: profile.preferred_currency,
      exchange_rate: rate,
      converted_amount: round2(s.amount * rate),
      auto_recorded: true,
    }));
    const { error: payErr } = await supabase
      .from('payments')
      .upsert(rows, { onConflict: 'subscription_id,paid_on', ignoreDuplicates: true });
    if (payErr) continue;
    const { error: subErr } = await supabase.from('subscriptions').update({ next_billing_date: due }).eq('id', s.id);
    if (!subErr) changed = true;
  }
  return changed;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rates, setRates] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const ratesRef = useRef<Rates | null>(null);
  ratesRef.current = rates;

  const apply = useCallback((snap: Snapshot) => {
    setProfile(snap.profile);
    setCategories(snap.categories);
    setSubscriptions(snap.subscriptions);
    setPayments(snap.payments);
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'silent' | 'pull') => {
      if (!user) return;
      const cacheKey = `subtrack.cache.${user.id}`;
      if (mode === 'initial') setLoading(true);
      if (mode === 'pull') setRefreshing(true);
      try {
        const name = (user.user_metadata?.display_name as string | undefined) ?? undefined;
        let snap = await fetchAll(user.id, name);
        const r = await loadRates();
        setRates(r);
        if (snap.profile && (await processDue(user.id, snap.subscriptions, snap.profile, r))) {
          snap = await fetchAll(user.id, name);
        }
        apply(snap);
        setLoadError(null);
        AsyncStorage.setItem(cacheKey, JSON.stringify(snap)).catch(() => undefined);
      } catch (e) {
        setLoadError(friendlyError(e));
        // Show the last known data (read-only) when offline
        try {
          const raw = await AsyncStorage.getItem(cacheKey);
          if (raw && !ratesRef.current) setRates(await loadRates());
          if (raw) apply(JSON.parse(raw) as Snapshot);
        } catch {
          /* nothing cached */
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, apply],
  );

  // Load when a person signs in; clear everything when they sign out
  useEffect(() => {
    if (user) {
      load('initial');
    } else {
      setProfile(null);
      setCategories([]);
      setSubscriptions([]);
      setPayments([]);
      setLoadError(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Keep device timezone on the profile (used by cloud reminders)
  useEffect(() => {
    if (!profile) return;
    let tz = 'UTC';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      /* keep UTC */
    }
    if (tz !== profile.timezone) {
      supabase.from('profiles').update({ timezone: tz }).eq('id', profile.id).then(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Re-plan on-device reminders whenever anything that affects them changes
  const reminderKey = useMemo(() => {
    if (!profile) return '';
    return JSON.stringify([
      profile.notifications_enabled,
      profile.reminder_days_before,
      profile.reminder_hour,
      profile.reminder_mode,
      subscriptions.map((s) => [s.id, s.name, s.amount, s.currency, s.status, s.next_billing_date, s.trial_end_date, s.reminder_days_before]),
    ]);
  }, [profile, subscriptions]);

  useEffect(() => {
    if (!profile || loading) return;
    if (profile.notifications_enabled && profile.reminder_mode === 'local') {
      syncLocalReminders(subscriptions, profile).catch(() => undefined);
    } else {
      cancelAllLocalReminders().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderKey, loading]);

  const displayCurrency = profile?.preferred_currency ?? 'USD';

  const toDisplay = useCallback(
    (amount: number, currency: string) => convert(amount, currency, displayCurrency, rates),
    [displayCurrency, rates],
  );

  const refresh = useCallback(() => load('pull'), [load]);

  const refreshRates = useCallback(async () => {
    const r = await loadRates(true);
    if (r) setRates(r);
    return !!r;
  }, []);

  const updateProfile: DataValue['updateProfile'] = useCallback(
    async (patch) => {
      if (!user) return 'Not signed in.';
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select('*').single();
      if (error) return friendlyError(error);
      setProfile(data as Profile);
      return null;
    },
    [user],
  );

  const addSubscription: DataValue['addSubscription'] = useCallback(
    async (input) => {
      if (!user) return { error: 'Not signed in.' };
      const status: SubStatus = input.is_trial ? 'trial' : 'active';
      const { data, error } = await supabase
        .from('subscriptions')
        .insert({ ...input, user_id: user.id, status, next_billing_date: computeNextBilling(input) })
        .select('id')
        .single();
      if (error) return { error: friendlyError(error) };
      await load('silent');
      return { id: (data as { id: string }).id };
    },
    [user, load],
  );

  const updateSubscription: DataValue['updateSubscription'] = useCallback(
    async (id, input) => {
      const existing = subscriptions.find((s) => s.id === id);
      if (!existing) return 'Subscription not found.';
      let status: SubStatus = existing.status;
      if (status === 'active' || status === 'trial') status = input.is_trial ? 'trial' : 'active';
      const running = status === 'active' || status === 'trial';
      const { error } = await supabase
        .from('subscriptions')
        .update({ ...input, status, next_billing_date: running ? computeNextBilling(input) : null })
        .eq('id', id);
      if (error) return friendlyError(error);
      await load('silent');
      return null;
    },
    [subscriptions, load],
  );

  const setStatus: DataValue['setStatus'] = useCallback(
    async (id, status) => {
      const sub = subscriptions.find((s) => s.id === id);
      if (!sub) return 'Subscription not found.';
      const today = todayYMD();
      let patch: Record<string, unknown>;
      if (status === 'active') {
        // Resume (or re-activate): work out the next charge from today
        const trialing = sub.is_trial && !!sub.trial_end_date && sub.trial_end_date > today;
        const start = sub.is_trial && !trialing ? sub.trial_end_date ?? sub.start_date : sub.start_date;
        const merged = { ...sub, is_trial: trialing, start_date: start };
        patch = {
          status: trialing ? 'trial' : 'active',
          is_trial: trialing,
          start_date: start,
          cancelled_at: null,
          next_billing_date: computeNextBilling(merged),
        };
      } else {
        patch = {
          status,
          next_billing_date: null,
          cancelled_at: status === 'cancelled' ? new Date().toISOString() : sub.cancelled_at,
        };
      }
      const { error } = await supabase.from('subscriptions').update(patch).eq('id', id);
      if (error) return friendlyError(error);
      await load('silent');
      return null;
    },
    [subscriptions, load],
  );

  const convertTrial: DataValue['convertTrial'] = useCallback(
    async (id) => {
      const sub = subscriptions.find((s) => s.id === id);
      if (!sub) return 'Subscription not found.';
      const today = todayYMD();
      const start = sub.trial_end_date ?? today;
      const merged = { ...sub, is_trial: false, start_date: start };
      const { error } = await supabase
        .from('subscriptions')
        .update({ is_trial: false, status: 'active', start_date: start, next_billing_date: computeNextBilling(merged) })
        .eq('id', id);
      if (error) return friendlyError(error);
      await load('silent');
      return null;
    },
    [subscriptions, load],
  );

  const deleteSubscription: DataValue['deleteSubscription'] = useCallback(
    async (id) => {
      const { error } = await supabase.from('subscriptions').delete().eq('id', id);
      if (error) return friendlyError(error);
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      setPayments((prev) => prev.filter((p) => p.subscription_id !== id));
      return null;
    },
    [],
  );

  const recordPayment: DataValue['recordPayment'] = useCallback(
    async (sub, paidOn = todayYMD(), amount = sub.amount) => {
      if (!user) return 'Not signed in.';
      const rate = convert(1, sub.currency, displayCurrency, rates);
      if (rate === null) return 'Exchange rates are unavailable right now. Connect to the internet and try again.';
      const { error } = await supabase.from('payments').insert({
        user_id: user.id,
        subscription_id: sub.id,
        amount,
        currency: sub.currency,
        paid_on: paidOn,
        display_currency: displayCurrency,
        exchange_rate: rate,
        converted_amount: round2(amount * rate),
        auto_recorded: false,
      });
      if (error) return friendlyError(error);
      await load('silent');
      return null;
    },
    [user, displayCurrency, rates, load],
  );

  const deletePayment: DataValue['deletePayment'] = useCallback(async (id) => {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) return friendlyError(error);
    setPayments((prev) => prev.filter((p) => p.id !== id));
    return null;
  }, []);

  const addCategory: DataValue['addCategory'] = useCallback(
    async (name, color) => {
      if (!user) return { error: 'Not signed in.' };
      const trimmed = name.trim();
      if (!trimmed) return { error: 'Enter a category name.' };
      const { data, error } = await supabase
        .from('categories')
        .insert({ user_id: user.id, name: trimmed, color, icon: 'pricetag' })
        .select('*')
        .single();
      if (error) {
        return { error: /duplicate/i.test(error.message) ? 'That category already exists.' : friendlyError(error) };
      }
      const category = data as Category;
      setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
      return { category };
    },
    [user],
  );

  const value = useMemo<DataValue>(
    () => ({
      profile,
      categories,
      subscriptions,
      payments,
      rates,
      displayCurrency,
      loading,
      refreshing,
      loadError,
      refresh,
      refreshRates,
      toDisplay,
      updateProfile,
      addSubscription,
      updateSubscription,
      setStatus,
      convertTrial,
      deleteSubscription,
      recordPayment,
      deletePayment,
      addCategory,
    }),
    [
      profile, categories, subscriptions, payments, rates, displayCurrency, loading, refreshing, loadError,
      refresh, refreshRates, toDisplay, updateProfile, addSubscription, updateSubscription, setStatus,
      convertTrial, deleteSubscription, recordPayment, deletePayment, addCategory,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
