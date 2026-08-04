// Edge function: watchdog
//
// Enforces Artemis's safety deadlines SERVER-SIDE. Every dead-man's switch in
// the app used to live in a setTimeout inside a mounted screen, so a locked
// phone, a swiped-away app or a dead battery meant nobody was ever alerted —
// precisely the situations these features exist for. This function is the thing
// that actually keeps the promise; the in-app timers are now just a fast path.
//
// Two jobs, every minute:
//   1. Trips past their ETA + grace, still active and not yet escalated
//      → stamp escalated_at. The trip deliberately STAYS active so the
//        traveller's background location keeps broadcasting to their followers.
//        The notify webhook turns that stamp into the push.
//   2. Safety timers past expires_at + grace and not yet fired
//      → stamp fired_at and insert an `alarm` check-in, which the existing
//        check_ins webhook fans out — to the people named in the timer's
//        alert_ids, or the whole circle when it's empty.
//
// Both writes are conditional (`.is(<col>, null)`), so overlapping runs — or a
// race with the app's own timer — can never double-alert.
//
// Deploy: npx supabase functions deploy watchdog --project-ref pbqcsgthnwaqpddsucrx
// Schedule: see supabase/safety_watchdog.sql (pg_cron, every minute).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Must match ETA_GRACE_MS in src/screens/TripActiveScreen.tsx.
const ETA_GRACE_MS = 5 * 60 * 1000

// The extra time a "check on me" timer gives the user AFTER its deadline to
// answer before anyone is alerted. Must match TIMER_GRACE_MS in
// src/lib/constants.ts — firing earlier here would alert people while the app is
// still showing the user a "last chance" countdown.
const TIMER_GRACE_MS = 5 * 60 * 1000

// A cap so one bad run can't fan out unbounded work; comfortably above any
// realistic per-minute volume. Anything skipped is picked up 60 s later.
const BATCH = 200

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const [trips, timers] = await Promise.all([
      escalateOverdueTrips(supabase),
      fireExpiredTimers(supabase),
    ])

    return new Response(JSON.stringify({ trips, timers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('watchdog error:', err)
    return new Response('error', { status: 500 })
  }
})

// ─── 1. Missed ETAs ──────────────────────────────────────────────────────────

async function escalateOverdueTrips(
  supabase: ReturnType<typeof createClient>,
): Promise<number> {
  const cutoff = new Date(Date.now() - ETA_GRACE_MS).toISOString()

  const { data: due, error } = await supabase
    .from('trips')
    .select('id')
    .eq('status', 'active')
    .is('escalated_at', null)
    .not('eta_at', 'is', null)
    .lte('eta_at', cutoff)
    .limit(BATCH)
  if (error) {
    console.error('watchdog: trip scan failed', error.message)
    return 0
  }
  if (!due || due.length === 0) return 0

  let escalated = 0
  for (const row of due as { id: string }[]) {
    // Conditional: if the traveller escalated (or the previous run did) between
    // the scan and now, this updates nothing and no second push goes out.
    const { data, error: updErr } = await supabase
      .from('trips')
      .update({ escalated_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('escalated_at', null)
      .eq('status', 'active')
      .select('id')
    if (updErr) {
      console.error('watchdog: escalate failed', row.id, updErr.message)
      continue
    }
    if ((data?.length ?? 0) > 0) escalated++
  }
  return escalated
}

// ─── 2. Expired safety timers ────────────────────────────────────────────────

async function fireExpiredTimers(
  supabase: ReturnType<typeof createClient>,
): Promise<number> {
  const now = new Date().toISOString()
  const cutoff = new Date(Date.now() - TIMER_GRACE_MS).toISOString()

  const { data: due, error } = await supabase
    .from('safety_timers')
    .select('user_id, alert_ids')
    .is('fired_at', null)
    .lte('expires_at', cutoff)
    .limit(BATCH)
  if (error) {
    console.error('watchdog: timer scan failed', error.message)
    return 0
  }
  if (!due || due.length === 0) return 0

  let fired = 0
  for (const row of due as { user_id: string; alert_ids: string[] | null }[]) {
    // Claim first, alarm second. If the app got there (claimExpiry) this returns
    // no rows and we skip — the user's own device already raised it.
    const { data, error: claimErr } = await supabase
      .from('safety_timers')
      .update({ fired_at: now })
      .eq('user_id', row.user_id)
      .is('fired_at', null)
      .select('user_id')
    if (claimErr) {
      console.error('watchdog: timer claim failed', row.user_id, claimErr.message)
      continue
    }
    if ((data?.length ?? 0) === 0) continue

    // The check_ins INSERT webhook already fans an `alarm` out, ignoring
    // notification prefs and quiet hours. Reuse it rather than duplicating the
    // push logic here. alert_ids carries the user's choice of who to alert
    // through to it; null means the whole circle.
    const { error: insErr } = await supabase.from('check_ins').insert({
      user_id: row.user_id,
      kind: 'alarm',
      note: 'Safety timer expired — no response',
      alert_ids: row.alert_ids && row.alert_ids.length > 0 ? row.alert_ids : null,
    })
    if (insErr) {
      console.error('watchdog: alarm insert failed', row.user_id, insErr.message)
      // Release the claim so the next run retries rather than silently dropping
      // someone's alarm on the floor.
      await supabase
        .from('safety_timers')
        .update({ fired_at: null })
        .eq('user_id', row.user_id)
      continue
    }
    fired++
  }
  return fired
}
