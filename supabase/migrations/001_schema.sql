-- =====================================================================
-- SubTrack — database schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query
-- Safe to read top to bottom; every table has Row Level Security (RLS).
-- =====================================================================

-- ---------- Helper: updated_at trigger ------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles -------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text,
  preferred_currency    char(3) not null default 'USD' check (preferred_currency ~ '^[A-Z]{3}$'),
  notifications_enabled boolean not null default true,
  reminder_days_before  int     not null default 3  check (reminder_days_before between 0 and 30),
  reminder_hour         int     not null default 9  check (reminder_hour between 0 and 23),
  -- 'local'  = notifications scheduled on the phone (works offline)
  -- 'cloud'  = push notifications sent by the send-reminders Edge Function
  -- Only one mode is active at a time, so reminders are never duplicated.
  reminder_mode         text    not null default 'local' check (reminder_mode in ('local', 'cloud')),
  push_token            text,
  timezone              text    not null default 'UTC',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- categories ----------------------------------------------
-- user_id NULL  => built-in category visible to everyone (read-only)
-- user_id set   => custom category owned by that user
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  icon       text not null default 'apps',
  color      text not null default '#6C5CE7',
  created_at timestamptz not null default now()
);

create unique index if not exists categories_unique_name
  on public.categories (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

insert into public.categories (user_id, name, icon, color) values
  (null, 'Entertainment',    'film',            '#E5484D'),
  (null, 'Music',            'musical-notes',   '#D6409F'),
  (null, 'Productivity',     'briefcase',       '#3E63DD'),
  (null, 'Cloud Storage',    'cloud',           '#0091FF'),
  (null, 'Education',        'school',          '#12A594'),
  (null, 'Health & Fitness', 'fitness',         '#30A46C'),
  (null, 'News & Reading',   'newspaper',       '#8E8E93'),
  (null, 'Gaming',           'game-controller', '#8E4EC6'),
  (null, 'Utilities',        'flash',           '#F5A524'),
  (null, 'Finance',          'card',            '#0B7285'),
  (null, 'Shopping',         'cart',            '#F76B15'),
  (null, 'Other',            'apps',            '#6C5CE7')
on conflict do nothing;

-- ---------- subscriptions -------------------------------------------
create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                  text not null check (char_length(name) between 1 and 80),
  category_id           uuid references public.categories(id) on delete set null,

  -- Original amount and currency are ALWAYS preserved as entered.
  amount                numeric(12,2) not null check (amount >= 0),
  currency              char(3) not null check (currency ~ '^[A-Z]{3}$'),

  billing_cycle         text not null check (billing_cycle in ('weekly','monthly','quarterly','half_yearly','yearly','custom')),
  custom_interval_count int  check (custom_interval_count is null or custom_interval_count between 1 and 1000),
  custom_interval_unit  text check (custom_interval_unit is null or custom_interval_unit in ('day','week','month','year')),

  status                text not null default 'active' check (status in ('active','trial','paused','cancelled','expired')),
  start_date            date not null,
  next_billing_date     date,               -- null while paused / cancelled / expired

  is_trial              boolean not null default false,
  trial_start_date      date,
  trial_end_date        date,

  payment_method        text,
  website_url           text,
  notes                 text,
  reminder_days_before  int check (reminder_days_before is null or reminder_days_before between 0 and 30),

  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint custom_cycle_fields check (
    billing_cycle <> 'custom' or (custom_interval_count is not null and custom_interval_unit is not null)
  ),
  constraint trial_dates check (
    not is_trial or (trial_end_date is not null and (trial_start_date is null or trial_end_date >= trial_start_date))
  )
);

create index if not exists subscriptions_user_idx   on public.subscriptions (user_id);
create index if not exists subscriptions_next_idx   on public.subscriptions (user_id, next_billing_date);

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------- payments -------------------------------------------------
-- Each payment stores the amount in its ORIGINAL currency plus the exchange
-- rate that was used at the time, so history never changes when rates move.
create table if not exists public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subscription_id  uuid not null references public.subscriptions(id) on delete cascade,
  amount           numeric(12,2) not null check (amount >= 0),
  currency         char(3) not null check (currency ~ '^[A-Z]{3}$'),
  paid_on          date not null,
  display_currency char(3) not null check (display_currency ~ '^[A-Z]{3}$'),
  exchange_rate    numeric(18,8) not null default 1 check (exchange_rate > 0),   -- 1 {currency} = x {display_currency}
  converted_amount numeric(12,2) not null,
  note             text,
  auto_recorded    boolean not null default false,
  created_at       timestamptz not null default now()
);

-- One payment per subscription per day (also makes auto-recording idempotent)
create unique index if not exists payments_sub_date_unique on public.payments (subscription_id, paid_on);
create index if not exists payments_user_date_idx on public.payments (user_id, paid_on desc);

-- ---------- exchange_rates (shared cache, written only by Edge Function) ----
create table if not exists public.exchange_rates (
  base_currency char(3) primary key,
  rates         jsonb not null,
  rate_date     date,
  fetched_at    timestamptz not null default now()
);

-- ---------- reminders (server-side dedupe log for cloud push) ----------
create table if not exists public.reminders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  kind            text not null check (kind in ('renewal','trial_end')),
  due_on          date not null,
  sent_at         timestamptz not null default now(),
  unique (subscription_id, kind, due_on)
);

-- =====================================================================
-- Row Level Security — users can only ever touch their own rows
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.payments       enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.reminders      enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- categories: built-ins readable by all signed-in users, custom ones by owner only
create policy "categories_select" on public.categories for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy "categories_insert_own" on public.categories for insert to authenticated with check (user_id = auth.uid());
create policy "categories_update_own" on public.categories for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "categories_delete_own" on public.categories for delete to authenticated using (user_id = auth.uid());

-- subscriptions (category must be a built-in or the user's own)
create policy "subs_select_own" on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy "subs_insert_own" on public.subscriptions for insert to authenticated
  with check (
    user_id = auth.uid()
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and (c.user_id is null or c.user_id = auth.uid())
    ))
  );
create policy "subs_update_own" on public.subscriptions for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and (c.user_id is null or c.user_id = auth.uid())
    ))
  );
create policy "subs_delete_own" on public.subscriptions for delete to authenticated using (user_id = auth.uid());

-- payments (the subscription must also belong to the user)
create policy "payments_select_own" on public.payments for select to authenticated using (user_id = auth.uid());
create policy "payments_insert_own" on public.payments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.subscriptions s where s.id = subscription_id and s.user_id = auth.uid())
  );
create policy "payments_update_own" on public.payments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "payments_delete_own" on public.payments for delete to authenticated using (user_id = auth.uid());

-- exchange rates: any signed-in user may read; nobody can write from the app
create policy "rates_read_all" on public.exchange_rates for select to authenticated using (true);

-- reminders: users may read their own log; only the service role writes
create policy "reminders_select_own" on public.reminders for select to authenticated using (user_id = auth.uid());

-- =====================================================================
-- Account deletion (required by Google Play): lets a user delete themselves
-- =====================================================================
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();   -- cascades to every table above
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
