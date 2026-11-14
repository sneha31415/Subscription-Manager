// Edge Function: send-reminders
// Runs hourly (see 002_cron_optional.sql). For every user in "cloud" reminder mode
// whose local time matches their chosen reminder hour, sends an Expo push for each
// subscription renewing / trial ending N days from now. The `reminders` table has a
// unique constraint, so the same reminder can never be sent twice.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function localParts(tz: string, now: Date) {
  let zone = tz;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zone = "UTC";
  }
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hour: "numeric", hour12: false,
  }).format(now);
  return { date, hour: parseInt(hourStr, 10) % 24 };
}

function dayDiff(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

function when(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // only ever used here, server-side
  );

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, push_token, timezone, reminder_days_before, reminder_hour")
    .eq("reminder_mode", "cloud")
    .eq("notifications_enabled", true)
    .not("push_token", "is", null);

  if (error) return new Response(error.message, { status: 500 });

  const now = new Date();
  let sent = 0;

  for (const p of profiles ?? []) {
    const local = localParts(p.timezone || "UTC", now);
    if (local.hour !== p.reminder_hour) continue;

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, name, amount, currency, status, next_billing_date, trial_end_date, reminder_days_before")
      .eq("user_id", p.id)
      .in("status", ["active", "trial"]);

    const messages: Record<string, unknown>[] = [];

    for (const s of subs ?? []) {
      const kind = s.status === "trial" ? "trial_end" : "renewal";
      const dueOn = kind === "trial_end" ? s.trial_end_date : s.next_billing_date;
      if (!dueOn) continue;
      const lead = s.reminder_days_before ?? p.reminder_days_before;
      const days = dayDiff(dueOn, local.date);
      if (days !== lead) continue;

      // Insert-or-ignore: returns a row only the FIRST time (dedupe)
      const { data: inserted } = await supabase
        .from("reminders")
        .upsert(
          { user_id: p.id, subscription_id: s.id, kind, due_on: dueOn },
          { onConflict: "subscription_id,kind,due_on", ignoreDuplicates: true },
        )
        .select("id");
      if (!inserted || inserted.length === 0) continue;

      messages.push({
        to: p.push_token,
        sound: "default",
        channelId: "renewals",
        title: kind === "trial_end" ? "Free trial ending soon" : "Upcoming renewal",
        body: kind === "trial_end"
          ? `${s.name} free trial ends ${when(days)}. Cancel now if you don't want to be charged.`
          : `${s.name} renews ${when(days)} (${s.amount} ${s.currency}).`,
        data: { subscriptionId: s.id },
      });
    }

    if (messages.length === 0) continue;

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => null);
    sent += messages.length;

    // Token no longer valid → clear it so we stop trying
    const tickets: { status: string; details?: { error?: string } }[] = json?.data ?? [];
    if (tickets.some((t) => t.status === "error" && t.details?.error === "DeviceNotRegistered")) {
      await supabase.from("profiles").update({ push_token: null }).eq("id", p.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
