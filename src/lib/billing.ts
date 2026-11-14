import type { BillingCycle, CustomUnit, Subscription } from '@/types';

/*
 * All dates in SubTrack are plain "YYYY-MM-DD" strings in the user's LOCAL calendar.
 * We never go through UTC, so a payment on the 1st never shifts to the 31st.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayYMD(): string {
  return toYMD(new Date());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addDaysYMD(s: string, n: number): string {
  return toYMD(addDays(parseYMD(s), n));
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Whole days from b to a (a - b), calendar based so DST never matters. */
export function diffDays(a: Date, b: Date): number {
  return Math.round(
    (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
      Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) /
      86400000,
  );
}

export function daysUntil(ymd: string, from: string = todayYMD()): number {
  return diffDays(parseYMD(ymd), parseYMD(from));
}

/**
 * Add whole months but keep the ORIGINAL billing day when possible:
 * a subscription anchored on Jan 31 bills Feb 28 (or 29 in a leap year), then Mar 31 again.
 */
export function addMonthsClamped(d: Date, months: number, anchorDay: number = d.getDate()): Date {
  const total = d.getFullYear() * 12 + d.getMonth() + months;
  const y = Math.floor(total / 12);
  const m = total % 12;
  return new Date(y, m, Math.min(anchorDay, daysInMonth(y, m)));
}

export interface Interval {
  unit: 'day' | 'month';
  count: number;
}

export function intervalOf(
  cycle: BillingCycle,
  customCount?: number | null,
  customUnit?: CustomUnit | null,
): Interval {
  switch (cycle) {
    case 'weekly':
      return { unit: 'day', count: 7 };
    case 'monthly':
      return { unit: 'month', count: 1 };
    case 'quarterly':
      return { unit: 'month', count: 3 };
    case 'half_yearly':
      return { unit: 'month', count: 6 };
    case 'yearly':
      return { unit: 'month', count: 12 };
    case 'custom': {
      const c = Math.max(1, customCount ?? 1);
      switch (customUnit ?? 'month') {
        case 'day':
          return { unit: 'day', count: c };
        case 'week':
          return { unit: 'day', count: c * 7 };
        case 'month':
          return { unit: 'month', count: c };
        case 'year':
          return { unit: 'month', count: c * 12 };
      }
    }
  }
}

export function intervalForSub(s: Pick<Subscription, 'billing_cycle' | 'custom_interval_count' | 'custom_interval_unit'>): Interval {
  return intervalOf(s.billing_cycle, s.custom_interval_count, s.custom_interval_unit);
}

function occurrence(start: Date, iv: Interval, k: number): Date {
  return iv.unit === 'day'
    ? addDays(start, k * iv.count)
    : addMonthsClamped(start, k * iv.count, start.getDate());
}

/** First billing date that is on or after `from`, counting from the anchor (first charge) date. */
export function nextOccurrenceOnOrAfter(anchorYMD: string, iv: Interval, fromYMD: string): string {
  const start = parseYMD(anchorYMD);
  const from = parseYMD(fromYMD);
  if (from.getTime() <= start.getTime()) return anchorYMD;
  let k: number;
  if (iv.unit === 'day') {
    k = Math.ceil(diffDays(from, start) / iv.count);
  } else {
    const months = (from.getFullYear() - start.getFullYear()) * 12 + (from.getMonth() - start.getMonth());
    k = Math.max(0, Math.floor(months / iv.count));
  }
  while (occurrence(start, iv, k).getTime() < from.getTime()) k++;
  return toYMD(occurrence(start, iv, k));
}

/** First billing date strictly after `afterYMD`. */
export function nextOccurrenceAfter(anchorYMD: string, iv: Interval, afterYMD: string): string {
  return nextOccurrenceOnOrAfter(anchorYMD, iv, addDaysYMD(afterYMD, 1));
}

/** All billing dates within [fromYMD, toYMD] inclusive. */
export function occurrencesBetween(anchorYMD: string, iv: Interval, fromYMD: string, toYMD_: string, max = 400): string[] {
  const out: string[] = [];
  let cur = nextOccurrenceOnOrAfter(anchorYMD, iv, fromYMD);
  while (cur <= toYMD_ && out.length < max) {
    out.push(cur);
    cur = nextOccurrenceAfter(anchorYMD, iv, cur);
  }
  return out;
}

/** The date of the first real charge: end of trial if on a trial, otherwise the start date. */
export function anchorOf(s: Pick<Subscription, 'is_trial' | 'trial_end_date' | 'start_date'>): string {
  return s.is_trial && s.trial_end_date ? s.trial_end_date : s.start_date;
}

/** Next billing date (from today) for a subscription that is active or on a trial. */
export function computeNextBilling(
  s: Pick<Subscription, 'is_trial' | 'trial_end_date' | 'start_date' | 'billing_cycle' | 'custom_interval_count' | 'custom_interval_unit'>,
  from: string = todayYMD(),
): string {
  return nextOccurrenceOnOrAfter(anchorOf(s), intervalForSub(s), from);
}

/** Number of charges per year (used for monthly / yearly equivalents). */
export function chargesPerYear(iv: Interval): number {
  return iv.unit === 'day' ? 365 / iv.count : 12 / iv.count;
}

export function yearlyAmount(s: Pick<Subscription, 'amount' | 'billing_cycle' | 'custom_interval_count' | 'custom_interval_unit'>): number {
  return s.amount * chargesPerYear(intervalForSub(s));
}

export function monthlyAmount(s: Pick<Subscription, 'amount' | 'billing_cycle' | 'custom_interval_count' | 'custom_interval_unit'>): number {
  return yearlyAmount(s) / 12;
}

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  yearly: 'Yearly',
  custom: 'Custom',
};

export function cycleLabel(s: Pick<Subscription, 'billing_cycle' | 'custom_interval_count' | 'custom_interval_unit'>): string {
  if (s.billing_cycle !== 'custom') return CYCLE_LABELS[s.billing_cycle];
  const n = s.custom_interval_count ?? 1;
  const u = s.custom_interval_unit ?? 'month';
  return `Every ${n} ${u}${n === 1 ? '' : 's'}`;
}
