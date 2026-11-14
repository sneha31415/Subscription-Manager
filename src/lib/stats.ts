import type { Category, Payment, Subscription } from '@/types';
import {
  anchorOf,
  intervalForSub,
  monthlyAmount,
  occurrencesBetween,
  parseYMD,
  toYMD,
} from './billing';

type ToDisplay = (amount: number, currency: string) => number | null;

/** Monthly / yearly equivalent of everything that is currently being paid for (active subscriptions only). */
export function spendTotals(subs: Subscription[], toDisplay: ToDisplay) {
  let monthly = 0;
  let missing = 0;
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const m = toDisplay(monthlyAmount(s), s.currency);
    if (m === null) missing++;
    else monthly += m;
  }
  return { monthly, yearly: monthly * 12, missing };
}

export interface UpcomingItem {
  sub: Subscription;
  date: string;
  kind: 'renewal' | 'trial_end';
}

export function upcomingBetween(subs: Subscription[], from: string, to: string): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const s of subs) {
    if (s.status === 'trial' && s.trial_end_date) {
      if (s.trial_end_date >= from && s.trial_end_date <= to) items.push({ sub: s, date: s.trial_end_date, kind: 'trial_end' });
    } else if (s.status === 'active') {
      for (const d of occurrencesBetween(anchorOf(s), intervalForSub(s), from, to)) {
        items.push({ sub: s, date: d, kind: 'renewal' });
      }
    }
  }
  return items.sort((a, b) => (a.date === b.date ? a.sub.name.localeCompare(b.sub.name) : a.date < b.date ? -1 : 1));
}

export interface CategorySlice {
  key: string;
  label: string;
  color: string;
  value: number;
}

export function categoryBreakdown(
  subs: Subscription[],
  categories: Category[],
  toDisplay: ToDisplay,
  factor: number, // 1 = monthly, 12 = yearly
): CategorySlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const acc = new Map<string, CategorySlice>();
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const v = toDisplay(monthlyAmount(s), s.currency);
    if (v === null) continue;
    const cat = s.category_id ? byId.get(s.category_id) : undefined;
    const key = cat?.id ?? 'none';
    const cur = acc.get(key) ?? { key, label: cat?.name ?? 'Uncategorised', color: cat?.color ?? '#A5A9BA', value: 0 };
    cur.value += v * factor;
    acc.set(key, cur);
  }
  return [...acc.values()].sort((a, b) => b.value - a.value);
}

export interface MonthBar {
  key: string; // YYYY-MM
  label: string;
  value: number;
  isCurrent: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Actual money paid per month. Each payment keeps the exchange rate from the day it was recorded;
 * only if the person later changed their display currency do we convert the stored figure again.
 */
export function paymentHistoryByMonth(
  payments: Payment[],
  months: number,
  displayCurrency: string,
  toDisplay: ToDisplay,
  now: Date = new Date(),
): MonthBar[] {
  const bars: MonthBar[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toYMD(d).slice(0, 7);
    bars.push({ key, label: MONTHS[d.getMonth()], value: 0, isCurrent: i === 0 });
  }
  const index = new Map(bars.map((b) => [b.key, b]));
  for (const p of payments) {
    const bar = index.get(p.paid_on.slice(0, 7));
    if (!bar) continue;
    const v = p.display_currency === displayCurrency ? p.converted_amount : toDisplay(p.converted_amount, p.display_currency);
    if (v !== null) bar.value += v;
  }
  return bars;
}

export function monthRange(year: number, month0: number): { from: string; to: string } {
  return { from: toYMD(new Date(year, month0, 1)), to: toYMD(new Date(year, month0 + 1, 0)) };
}

export { parseYMD };
