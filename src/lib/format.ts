import { daysUntil, parseYMD } from './billing';

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(ymd: string | null | undefined, withYear = true): string {
  if (!ymd) return '—';
  const d = parseYMD(ymd);
  try {
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' as const } : {}),
    });
  } catch {
    return ymd;
  }
}

export function formatMonthYear(year: number, month0: number): string {
  try {
    return new Date(year, month0, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch {
    return `${year}-${month0 + 1}`;
  }
}

export function relativeDays(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const n = daysUntil(ymd);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1) return `In ${n} days`;
  return `${Math.abs(n)} days ago`;
}

export function formatHour(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:00 ${suffix}`;
}
