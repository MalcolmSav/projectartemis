/** A check-in older than this is considered stale (shown as "warn") */
export const CHECKIN_STALE_MS = 6 * 3600_000;

/**
 * "Check on me" (safety timer) escalation shape.
 *
 * The timer used to alarm the instant it hit zero, with no warning — a phone in
 * a pocket during the last stretch of a walk home turned into a false alarm sent
 * to real people, which is the fastest way to teach a circle to ignore alerts.
 *
 * So: a heads-up before the deadline, then a grace window after it where the
 * app is shouting but nobody has been alerted yet.
 *
 * TIMER_GRACE_MS is also enforced by the server watchdog
 * (supabase/functions/watchdog/index.ts) — keep the two in step.
 */
export const TIMER_WARN_MS = 5 * 60 * 1000;
export const TIMER_GRACE_MS = 5 * 60 * 1000;

/** How much longer "give me more time" buys, from the moment it's tapped. */
export const TIMER_EXTEND_MS = 15 * 60 * 1000;

/**
 * The full-screen "someone is checking on you" takeover, which used to give a
 * flat 30 s and then simply vanish mid-thought. Same shape as the safety timer:
 * warn before the window closes, then a grace stretch, plus a way to buy time.
 *
 * Letting it close is not a failure — the check stays answerable from the app
 * for WELLNESS_TIMEOUT_MS. This is only about how long the takeover holds the
 * screen hostage.
 */
export const WELLNESS_ANSWER_MS = 30 * 1000;
export const WELLNESS_ANSWER_WARN_MS = 10 * 1000;
export const WELLNESS_ANSWER_GRACE_MS = 20 * 1000;
export const WELLNESS_ANSWER_EXTEND_MS = 60 * 1000;
