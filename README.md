# SubTrack

A personal subscription tracker for Android — know exactly where your money goes every month.

Built with **React Native**, **Expo SDK 58**, **TypeScript**, and **Supabase**.

<!-- Add a screenshot or demo GIF here -->
<!-- ![SubTrack screenshot](docs/screenshot.png) -->

## Features

- **Dashboard** — monthly & yearly spend at a glance, upcoming renewals, recent activity
- **Subscription management** — add, edit, pause, resume, cancel, and delete subscriptions
- **Flexible billing** — weekly, monthly, quarterly, half-yearly, yearly, or custom intervals
- **Free trial tracking** — trial countdowns with automatic conversion to paid
- **Multi-currency** — 35 currencies with automatic exchange rate conversion
- **Calendar view** — month grid with renewal markers and 30-day lookahead
- **Analytics** — category breakdown, spending trends, and top subscriptions
- **Reminders** — on-device scheduled notifications or server-sent push via Firebase
- **Secure by default** — email auth, row-level security on every table, no secrets in the client

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React Native + Expo SDK 58 |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| Backend | Supabase (Auth, PostgreSQL, RLS, Edge Functions) |
| Notifications | expo-notifications + optional FCM push |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Expo Go](https://expo.dev/go) on your Android device, **or** Android Studio with an emulator
- A free [Supabase](https://supabase.com) account

### 1. Set up Supabase

1. Create a new project on the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/migrations/001_schema.sql`](supabase/migrations/001_schema.sql), and run it.
3. Go to **Authentication → URL Configuration**:
   - Set **Site URL** to `subtrack://auth-callback`
   - Add `subtrack://**` and `exp://**` to **Redirect URLs**
4. Copy your **Project URL** and **anon key** from **Project Settings → API**.

### 2. Configure & run

```bash
# Install dependencies
npm install

# Create your env file
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Start the dev server:

```bash
npx expo start -c
```

Scan the QR code with Expo Go, or press `a` to open in an Android emulator.

## Project Structure

```
app/
  (auth)/              Auth screens — welcome, login, signup, forgot password
  (tabs)/              Main tabs — home, subscriptions, calendar, analytics, settings
  subscription/        Subscription detail & add/edit form
  reset-password.tsx   New password screen (from email deep link)
  auth-callback.tsx    Landing screen for email verification links
src/
  context/             AuthContext (session) & DataContext (data + actions)
  lib/                 Billing engine, currency, notifications, stats, Supabase client
  components/          Shared UI components, charts, pickers
supabase/
  migrations/          SQL schema & optional cron setup
  functions/           Edge Functions (push reminders, exchange rate refresh)
```

## Useful Commands

| Command | Description |
| --- | --- |
| `npx expo start -c` | Start dev server (clear cache) |
| `npm run typecheck` | Run TypeScript type checking |
| `npx expo-doctor` | Diagnose common Expo issues |

## Cloud Push Reminders (Optional)

On-device reminders work out of the box. For server-sent push notifications:

1. Set up a Firebase project and add your Android app.
2. Download `google-services.json` to the project root.
3. Deploy the Edge Functions with the Supabase CLI.
4. Run `supabase/migrations/002_cron_optional.sql` in the SQL Editor.

See the inline comments in those files for detailed instructions.

## Building for Production

```bash
npm install -g eas-cli
eas login
eas init
eas build --platform android --profile production
```

Upload the generated `.aab` to the [Google Play Console](https://play.google.com/console).

## License

This project is for personal use. See [LICENSE](LICENSE) for details.
