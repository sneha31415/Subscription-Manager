# SubTrack

A personal subscription manager for Android, built with **React Native + Expo SDK 58 (TypeScript)** and a **Supabase** backend (auth, PostgreSQL, Row Level Security, Edge Functions).

Track recurring expenses, see monthly/yearly spend in your own currency, get reminded before renewals and free-trial endings.

---

## What's included

| Area | What it does |
|---|---|
| **Auth** | Splash, welcome, sign up with email verification, login, logout, forgot/reset password (deep-link back into the app), persistent sessions, protected screens, account deletion |
| **Home** | Monthly + yearly spend, active count, trials, "due in 30 days", upcoming payments, recent activity |
| **Subscriptions** | List with search, status/category filters and sorting; add, edit, pause, resume, cancel, expire, reactivate, delete; custom categories |
| **Billing engine** | Weekly, monthly, quarterly, half-yearly, yearly and custom intervals (every N days/weeks/months/years); month-end and leap-year safe (a Jan 31 plan bills Feb 28/29, then Mar 31 again) |
| **Free trials** | Trial start/end, first charge date, trial-ending reminders, convert-to-paid |
| **Payments** | Payment history per subscription. Due payments are recorded automatically; manual payments can be added; every payment stores its original amount, currency and the exchange rate used |
| **Multi-currency** | 35 currencies, preferred display currency, rates date shown, works offline with last known rates, history is never rewritten when rates move |
| **Calendar** | Month grid with renewal dots, day detail, next-30-days list |
| **Analytics** | Monthly/yearly toggle, category donut chart, 6/12-month spending trend, biggest subscriptions |
| **Reminders** | On-device scheduled notifications **or** cloud push (one at a time, so never duplicated); per-subscription override; rebuilt automatically whenever dates change |
| **Backend** | 6 tables, RLS on all of them, signup trigger, account-deletion function, 2 Edge Functions |

---

## 1. Prerequisites

Install these on your computer:

- **Node.js 20 or newer** (22 LTS recommended) — https://nodejs.org
- **Git** — https://git-scm.com
- **VS Code** — https://code.visualstudio.com
- An **Android phone** (and a USB cable, or the same Wi-Fi as your computer)

Create these free accounts:

- **Supabase** — https://supabase.com
- **Expo** — https://expo.dev (needed for EAS builds)
- **GitHub** — https://github.com (optional but recommended)
- **Google Play Console** — only when you're ready to publish (one-time US$25 fee)

---

## 2. Set up the backend (Supabase) — about 10 minutes

### 2.1 Create the project
1. Supabase Dashboard → **New project**. Pick a name, a strong database password (save it somewhere) and the region nearest you.
2. Wait until the project finishes provisioning.

### 2.2 Create the database
1. Left sidebar → **SQL Editor** → **New query**.
2. Open `supabase/migrations/001_schema.sql` from this project, copy **everything**, paste, click **Run**.
3. You should see "Success". Check **Table Editor**: `profiles`, `categories`, `subscriptions`, `payments`, `exchange_rates`, `reminders` should exist, and `categories` should contain 12 built-in categories.

### 2.3 Configure authentication
Dashboard → **Authentication**:

1. **Sign In / Providers → Email**: keep *Email* enabled and keep **Confirm email** ON (this is the email-verification step).
   - *Tip for fast local testing:* you can switch Confirm email OFF while developing. Switch it back on before launch.
2. **URL Configuration**:
   - **Site URL**: `subtrack://auth-callback`
   - **Redirect URLs** → add all of these:
     - `subtrack://**`
     - `exp://**` (only needed if you test in Expo Go)
3. *(Recommended before launch)* **Project Settings → Authentication → SMTP**: set up your own email provider. Supabase's built-in sender has a very low hourly limit and is meant for testing only.

### 2.4 Get your keys
Dashboard → **Project Settings → API**:
- **Project URL** (looks like `https://abcdxyz.supabase.co`)
- **anon / public key**

> ⚠️ Never put the **service_role** key in the app, in `.env`, or in GitHub. The app only ever uses the anon key. Security comes from Row Level Security in the database.

---

## 3. Run the app on your phone

```bash
# 1. unzip the project and open a terminal inside the folder
cd subtrack

# 2. install dependencies
npm install

# 3. create your settings file
cp .env.example .env          # Windows (cmd):  copy .env.example .env
```

Open `.env` and paste your values:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Then start it:

```bash
npx expo start -c
```

If you skip the `.env` step the app shows a friendly "setup required" screen instead of crashing.

### How to open it on your phone — two options

**Option A — Expo Go (fastest, good for UI testing).** Install *Expo Go* from the Play Store, scan the QR code. SDK 58 is new, so Expo Go only works if the Play Store version supports SDK 58 — if it says the project is incompatible, use Option B. In Expo Go, remote push is not available (on-device reminders work).

**Option B — Development build (recommended; needed for cloud push).**

```bash
npm install -g eas-cli
eas login
eas init                                   # links the project to your Expo account
eas build --profile development --platform android
```

When the build finishes, open the link on your phone, install the APK, then run `npx expo start --dev-client` and open the installed app.

> **EAS note:** `.env` is not uploaded to EAS builds (it's git-ignored). Add your two values as EAS environment variables once:
> ```bash
> eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT_REF.supabase.co" --environment development --environment preview --environment production --visibility plaintext
> eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --environment development --environment preview --environment production --visibility plaintext
> ```
> (The anon key is designed to be public. Never do this with the service_role key.)

---

## 4. Test it properly

Work through this list once everything runs:

**Accounts and security**
- [ ] Sign up → verification email arrives → tapping the link on the phone opens SubTrack and signs you in
- [ ] Log out, log in, kill the app and reopen it (session should persist)
- [ ] Forgot password → email → link opens the app on the "Choose a new password" screen
- [ ] **Two-account isolation test:** create two accounts, add a subscription in each, confirm neither can see the other's data. (RLS also blocks direct database access — you can try in the Supabase SQL editor with `set role authenticated` and different `request.jwt.claims`.)

**Subscriptions and dates**
- [ ] Add a monthly subscription starting on the **31st** → next payment moves to the last day of shorter months
- [ ] Add a yearly subscription starting **29 Feb**
- [ ] Add a weekly one and a custom one ("every 45 days")
- [ ] Add a **free trial** ending in 3 days → trial banner shows, "Free trial ends" appears on the calendar
- [ ] Add a subscription with a start date a few days ago on a daily-ish custom cycle and check that payments appear automatically
- [ ] Pause, resume, cancel, reactivate, delete

**Currency**
- [ ] Set preferred currency to e.g. INR, add a USD subscription → "≈" converted amount appears, totals update
- [ ] Switch the preferred currency → past payments keep their stored conversion
- [ ] Turn on airplane mode → app still opens with saved data and a "No internet" banner

**Reminders**
- [ ] Settings → set "On the day" and an hour a few minutes from now (or add a subscription due today) → notification arrives
- [ ] Change a subscription's date → old reminder disappears, new one is scheduled (reminders are rebuilt from scratch each time, so there are no duplicates)

---

## 5. Optional: cloud push reminders

On-device reminders already work without this. Cloud push adds server-sent notifications (useful if you want reminders independent of the app being opened for months). It needs a **development or production build** (not Expo Go) and Firebase.

1. **Firebase (Android push):**
   - https://console.firebase.google.com → create a project → add an Android app with your package name (see §7).
   - Download `google-services.json` into the project root and add to `app.json` under `expo.android`: `"googleServicesFile": "./google-services.json"`.
   - Firebase → Project settings → Service accounts → generate a private key (JSON). Upload it to EAS: `eas credentials` → Android → *Google Service Account Key for Push Notifications (FCM V1)*.
   - Rebuild the app with EAS.
2. **Deploy the Edge Functions** (Supabase CLI via `npx`):
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase secrets set CRON_SECRET="choose-a-long-random-string"
   npx supabase functions deploy send-reminders --no-verify-jwt
   npx supabase functions deploy refresh-rates  --no-verify-jwt
   ```
   (`--no-verify-jwt` is correct here: these functions are protected by the `x-cron-secret` header instead, and the service-role key stays inside Supabase.)
3. **Schedule them:** open `supabase/migrations/002_cron_optional.sql`, replace `<PROJECT_REF>` and `<CRON_SECRET>`, and run it in the SQL Editor.
4. In the app: **Settings → Reminders → Delivery → Cloud push**.

`refresh-rates` (every 6 hours) keeps a shared rates table fresh. Without it, the app fetches rates itself from the free provider (open.er-api.com) and caches them, so you can skip this function if you like.

---

## 6. How the important parts work

**Data model** — `profiles` (settings), `categories` (built-in + yours), `subscriptions`, `payments`, `exchange_rates` (shared cache, written only by the Edge Function), `reminders` (server-side "already sent" log). Every table has RLS: you can only read/write rows where `user_id = auth.uid()`, and inserts are checked so a subscription's category and a payment's subscription must also be yours.

**Automatic payments** — whenever the app loads, any billing date that has passed is recorded as a payment (using the exchange rate at that moment) and the next billing date moves forward. Trials whose end date has passed convert to paid subscriptions the same way. A unique index (`subscription_id, paid_on`) makes this safe across devices. If you cancel a subscription with the provider, mark it **cancelled** in the app (or delete any wrongly auto-recorded payment from its history).

**Spending totals** — only *active* subscriptions count. Each is converted to a monthly equivalent (weekly × 365/7 ÷ 12, yearly ÷ 12, custom by its interval) and then to your preferred currency. Paused, cancelled, expired and trial subscriptions are excluded until they're active.

**Exchange rates** — lookup order: fresh local cache → shared database cache → live provider → last known rates. The rate date is shown in Settings.

**Reminders** — *On this device*: the app schedules up to 60 notifications for the next 90 days and rebuilds them whenever subscriptions or settings change. *Cloud push*: the hourly Edge Function sends a push when the user's local time matches their reminder hour, and the `reminders` table's unique constraint guarantees each reminder is sent once.

---

## 7. Publish to Google Play

1. **Make it yours** — in `app.json` change `android.package` from `com.yourname.subtrack` to a unique id you own (e.g. `com.janedoe.subtrack`). This can't be changed after you publish. Also check name, version, icon (`assets/`), splash.
2. **Replace the placeholder icons** in `assets/` (`icon.png` 1024×1024, `adaptive-icon.png`, `splash-icon.png`, `notification-icon.png` white-on-transparent). The included ones are simple generated placeholders.
3. **Production Supabase** — either keep one project or create a separate one for production (run `001_schema.sql` there). Set the EAS production env vars as shown in §3 and re-check Auth URL settings and SMTP.
4. **Build the release bundle:**
   ```bash
   eas build --profile production --platform android     # produces an .aab
   ```
   Test a `preview` build (an installable APK) on a real phone before you submit.
5. **Play Console** — create the app, upload the `.aab` (EAS can do this: `eas submit --platform android` after creating a service account, or upload manually), fill in the store listing, screenshots, content rating, and the **Data safety** form (you collect: email, name, financial info the user types in; data is encrypted in transit; users can delete their account in-app via Settings).
6. **Privacy policy and terms** — you need a public privacy-policy URL. Include: what you collect (email, name, subscription entries), that it's stored on Supabase, how to delete the account (Settings → Delete account), and contact details.
7. **Testing requirements** — Google currently requires new personal developer accounts to run a closed test with a minimum number of testers for a minimum period before production access. These rules change, so check Play Console's current policy page before you plan your launch date.

---

## 8. Project structure

```
app/                         Screens (Expo Router, file-based)
  (auth)/                    welcome, login, signup, forgot-password
  (tabs)/                    home, subscriptions, calendar, analytics, settings
  subscription/[id].tsx      details, status actions, payment history
  subscription/form.tsx      add / edit
  reset-password.tsx         set new password after tapping the email link
  auth-callback.tsx          landing screen for email deep links
src/
  context/                   AuthContext (session), DataContext (all data + actions)
  lib/                       billing.ts (date maths), currency.ts, notifications.ts, stats.ts, supabase.ts
  components/                shared UI, charts, pickers
supabase/
  migrations/001_schema.sql  tables, RLS, triggers, seed categories, delete_my_account()
  migrations/002_cron_optional.sql  schedules for the Edge Functions
  functions/send-reminders   cloud push
  functions/refresh-rates    shared exchange-rate cache
```

Useful commands: `npm run typecheck`, `npx expo start -c` (clear cache), `npx expo-doctor`.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| "Setup required" screen | `.env` missing/incorrect. Re-copy values, then restart with `npx expo start -c` |
| Verification / reset link opens a browser error | Add `subtrack://**` (and `exp://**` for Expo Go) to Supabase → Auth → URL Configuration → Redirect URLs |
| Signup works but no email | Built-in Supabase email is rate-limited; wait, or configure custom SMTP |
| "Email not confirmed" on login | Tap the link in the verification email, or use *Resend* on the login screen |
| Everything is empty after login | Run `001_schema.sql` in the SQL editor; check the Table Editor |
| Amounts in other currencies missing | Exchange rates couldn't be fetched; check internet and pull to refresh |
| No reminders | Settings → Reminders must be on, notification permission allowed in Android settings, and the reminder time must be in the future |
| Cloud push: "Missing EAS project id" | Run `eas init` once |
| Cloud push never arrives | Needs a dev/production build, FCM credentials uploaded to EAS, Edge Functions deployed, cron SQL run |
| Expo Go says project is incompatible | Use a development build (§3, option B) |

---

## 10. Honest notes

- This was type-checked, bundle-tested for Android, and the billing/date logic was verified with automated assertions — but I could not run it on a physical phone or against your Supabase project, so do the §4 checklist before trusting it.
- Android-first: iOS isn't configured or tested.
- Supabase free projects pause after about a week of inactivity; upgrade before launch if you need always-on.
- Auto-recorded payments for past dates use *today's* exchange rate (the historical rate isn't known), then stay frozen.
- Package versions are pinned to the Expo SDK 58 set. To upgrade later, use `npx expo install --fix`.
