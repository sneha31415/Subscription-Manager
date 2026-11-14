import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Rates } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';

export interface CurrencyInfo {
  code: string;
  name: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'RUB', name: 'Russian Ruble' },
];

/** Convert using USD-based rates. Returns null when a rate is missing (caller decides what to show). */
export function convert(amount: number, from: string, to: string, rates: Rates | null): number | null {
  if (from === to) return amount;
  if (!rates) return null;
  const rf = rates.rates[from];
  const rt = rates.rates[to];
  if (!rf || !rt) return null;
  return (amount / rf) * rt;
}

const CACHE_KEY = 'subtrack.rates.v1';
const FRESH_MS = 12 * 60 * 60 * 1000;

function isFresh(r: Rates | null, ms = FRESH_MS): boolean {
  return !!r && Date.now() - new Date(r.fetchedAt).getTime() < ms;
}

async function readCache(): Promise<Rates | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Rates) : null;
  } catch {
    return null;
  }
}

async function writeCache(r: Rates) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(r));
  } catch {
    /* cache is best-effort */
  }
}

async function fromDatabase(): Promise<Rates | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('rates, rate_date, fetched_at')
    .eq('base_currency', 'USD')
    .maybeSingle();
  if (error || !data) return null;
  return {
    base: 'USD',
    rates: data.rates as Record<string, number>,
    date: (data.rate_date as string | null) ?? (data.fetched_at as string).slice(0, 10),
    fetchedAt: data.fetched_at as string,
  };
}

async function fromProvider(): Promise<Rates | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.result !== 'success' || !json.rates) return null;
    const date = json.time_last_update_utc
      ? new Date(json.time_last_update_utc).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return { base: 'USD', rates: json.rates, date, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rates are looked up in this order: fresh local cache → shared database cache (kept up to
 * date by the refresh-rates Edge Function) → the free provider directly → stale cache.
 * That means conversion keeps working offline using the last known rates.
 */
export async function loadRates(force = false): Promise<Rates | null> {
  const cached = await readCache();
  if (!force && isFresh(cached)) return cached;

  const db = await fromDatabase();
  if (!force && isFresh(db, 24 * 60 * 60 * 1000) && db) {
    await writeCache(db);
    return db;
  }

  const live = await fromProvider();
  if (live) {
    await writeCache(live);
    return live;
  }

  const best = db ?? cached;
  if (best) await writeCache(best);
  return best;
}
