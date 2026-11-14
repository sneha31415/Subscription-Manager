export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';
export type SubStatus = 'active' | 'trial' | 'paused' | 'cancelled' | 'expired';
export type CustomUnit = 'day' | 'week' | 'month' | 'year';
export type ReminderMode = 'local' | 'cloud';

export interface Profile {
  id: string;
  display_name: string | null;
  preferred_currency: string;
  notifications_enabled: boolean;
  reminder_days_before: number;
  reminder_hour: number;
  reminder_mode: ReminderMode;
  push_token: string | null;
  timezone: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  category_id: string | null;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  custom_interval_count: number | null;
  custom_interval_unit: CustomUnit | null;
  status: SubStatus;
  start_date: string; // YYYY-MM-DD
  next_billing_date: string | null;
  is_trial: boolean;
  trial_start_date: string | null;
  trial_end_date: string | null;
  payment_method: string | null;
  website_url: string | null;
  notes: string | null;
  reminder_days_before: number | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionInput = Omit<
  Subscription,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'cancelled_at' | 'next_billing_date' | 'status'
>;

export interface Payment {
  id: string;
  user_id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  paid_on: string;
  display_currency: string;
  exchange_rate: number;
  converted_amount: number;
  note: string | null;
  auto_recorded: boolean;
  created_at: string;
}

export interface Rates {
  base: 'USD';
  rates: Record<string, number>;
  date: string; // YYYY-MM-DD the provider published them
  fetchedAt: string; // ISO
}
