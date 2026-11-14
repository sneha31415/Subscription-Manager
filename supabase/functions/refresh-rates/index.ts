// Edge Function: refresh-rates
// Fetches USD-based exchange rates and stores them in public.exchange_rates so every
// app instance reads the same cached rates. Source: open.er-api.com (free, no API key).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) return new Response("Rate provider error", { status: 502 });
  const data = await res.json();
  if (data.result !== "success" || !data.rates) {
    return new Response("Unexpected provider response", { status: 502 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rateDate = data.time_last_update_utc
    ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("exchange_rates").upsert({
    base_currency: "USD",
    rates: data.rates,
    rate_date: rateDate,
    fetched_at: new Date().toISOString(),
  });
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true, rate_date: rateDate }), {
    headers: { "Content-Type": "application/json" },
  });
});
