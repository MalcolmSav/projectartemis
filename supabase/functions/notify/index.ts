// Edge function: notify
// Handles all push notification events for Artemis via Supabase Database Webhooks.
//
// Deploy: npx supabase functions deploy notify --project-ref pbqcsgthnwaqpddsucrx
//
// Webhooks to configure (all pointing to this function, INSERT unless noted):
//   check_ins  — INSERT  (wellness checks, alarms, responses)
//   invites    — INSERT  (new circle invite)
//   invites    — UPDATE  (invite accepted)
//   trips      — INSERT  (trip started → notify buddy)
//   trips      — UPDATE  (trip arrived / cancelled / escalated)
//   messages   — INSERT  (chat messages)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  priority?: 'default' | 'normal' | 'high'
  categoryId?: string // maps to a notification category registered in the app (action buttons)
}

async function sendExpo(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
  })
}

interface Profile {
  push_token: string | null
  notification_prefs: Record<string, boolean> | null
}

// Fetch a profile's push token and notification prefs.
async function getProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Profile> {
  const { data } = await supabase
    .from('profiles')
    .select('push_token, notification_prefs')
    .eq('id', userId)
    .single()
  return (data as any) ?? { push_token: null, notification_prefs: null }
}

// Returns token only if the user has that pref enabled (defaults to true when null/missing)
// and we're not inside their quiet-hours window.
function tokenIfEnabled(profile: Profile, prefKey: string): string | null {
  const prefs = profile.notification_prefs
  if (prefs && prefs[prefKey] === false) return null
  // Quiet hours: prefs.quiet_from / prefs.quiet_to are "HH:MM" strings (24h).
  // Alarms are never silenced by quiet hours.
  if (prefKey !== 'alarm' && prefs?.quiet_from && prefs?.quiet_to) {
    const now = new Date()
    const toMins = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }
    const cur = now.getUTCHours() * 60 + now.getUTCMinutes()
    const from = toMins(prefs.quiet_from as unknown as string)
    const to = toMins(prefs.quiet_to as unknown as string)
    const inWindow = from <= to ? cur >= from && cur < to : cur >= from || cur < to
    if (inWindow) return null
  }
  return profile.push_token
}

// Legacy helper — used where prefs don't apply (e.g. alarm which always fires).
async function getToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const p = await getProfile(supabase, userId)
  return p.push_token
}

// Fetch a profile's display name.
async function getName(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('name, username')
    .eq('id', userId)
    .single()
  return (data as any)?.name || (data as any)?.username || 'Someone'
}

// Fetch a profile by email.
async function getProfileByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string; name: string | null; username: string | null; push_token: string | null; notification_prefs: Record<string, boolean> | null } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, username, push_token, notification_prefs')
    .eq('email', email)
    .single()
  return (data as any) ?? null
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const { type, table, record, old_record } = payload as {
      type: string
      table: string
      record: Record<string, unknown>
      old_record: Record<string, unknown> | null
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (type === 'INSERT') {
      if (table === 'check_ins') await handleCheckIn(supabase, record)
      else if (table === 'invites') await handleInviteInsert(supabase, record)
      else if (table === 'trips') await handleTripInsert(supabase, record)
      else if (table === 'trip_buddies') await handleTripBuddyInsert(supabase, record)
      else if (table === 'messages') await handleMessage(supabase, record)
    } else if (type === 'UPDATE') {
      if (table === 'invites') await handleInviteUpdate(supabase, record)
      else if (table === 'trips') await handleTripUpdate(supabase, record, old_record)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('notify error:', err)
    return new Response('error', { status: 500 })
  }
})

// ─── check_ins INSERT ────────────────────────────────────────────────────────

async function handleCheckIn(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
) {
  const kind = row.kind as string
  const userId = row.user_id as string
  const targetId = row.target_id as string | null
  const note = row.note as string | null

  const senderName = await getName(supabase, userId)

  if (kind === 'wellness_request' && targetId) {
    // Someone sent a wellness check — notify the person being checked on
    const target = await getProfile(supabase, targetId)
    const token = tokenIfEnabled(target, 'wellness')
    if (token) {
      await sendExpo([{
        to: token,
        title: 'Wellness check 🏹',
        // Users don't know action buttons exist behind a long-press — tell them.
        body: `${senderName} is checking in on you. Hold this notification to answer without opening the app.`,
        data: { type: 'wellness_check', fromId: userId, fromName: senderName },
        sound: 'default',
        priority: 'high',
        // Lock-screen action buttons ("I'm OK" / "I need help") — registered
        // client-side via registerNotificationCategories().
        categoryId: 'wellness_check',
      }])
    }

  } else if (kind === 'alarm') {
    // Someone raised an alarm — notify everyone in their circle (alarms always fire, ignore prefs)
    const [{ data: myEdges }, { data: theirEdges }] = await Promise.all([
      supabase.from('circles').select('member_id').eq('owner_id', userId),
      supabase.from('circles').select('owner_id').eq('member_id', userId),
    ])
    const ids = [
      ...((myEdges ?? []) as any[]).map((e) => e.member_id),
      ...((theirEdges ?? []) as any[]).map((e) => e.owner_id),
    ].filter((id, i, arr) => id && arr.indexOf(id) === i) as string[]

    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('push_token')
        .in('id', ids)
      const messages: ExpoMessage[] = ((profiles ?? []) as any[])
        .map((p) => p.push_token as string | null)
        .filter(Boolean)
        .map((token) => ({
          to: token as string,
          title: '🚨 ALARM',
          body: `${senderName} has raised an alarm — check on them now`,
          data: { type: 'alarm', userId },
          sound: 'default' as const,
          priority: 'high' as const,
        }))
      await sendExpo(messages)
    }

  } else if ((kind === 'wellness_response' || kind === 'ok') && targetId) {
    // Response to a wellness check — notify the person who sent it
    const target = await getProfile(supabase, targetId)
    const token = tokenIfEnabled(target, 'wellness')
    if (token) {
      const isNeedHelp = kind === 'wellness_response' && note === 'need_help'
      await sendExpo([{
        to: token,
        title: isNeedHelp ? `⚠️ ${senderName} needs help` : `✅ ${senderName} is OK`,
        body: isNeedHelp
          ? `${senderName} responded to your wellness check — they need help`
          : `${senderName} responded to your wellness check`,
        data: {
          type: isNeedHelp ? 'wellness_need_help' : 'wellness_ok',
          fromId: userId,
          fromName: senderName,
        },
        sound: 'default',
        priority: isNeedHelp ? 'high' : 'default',
      }])
    }
  }
}

// ─── invites INSERT (new invite sent) ────────────────────────────────────────

async function handleInviteInsert(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
) {
  const fromUser = row.from_user as string
  const toEmail = row.to_email as string

  const [senderName, target] = await Promise.all([
    getName(supabase, fromUser),
    getProfileByEmail(supabase, toEmail),
  ])

  if (!target?.push_token) return
  const targetProf: Profile = { push_token: target.push_token, notification_prefs: (target as any).notification_prefs ?? null }
  const token = tokenIfEnabled(targetProf, 'circle')
  if (!token) return

  await sendExpo([{
    to: token,
    title: 'Circle invite',
    body: `${senderName} wants to add you to their circle`,
    data: { type: 'circle_invite', fromId: fromUser, fromName: senderName },
    sound: 'default',
  }])
}

// ─── invites UPDATE (accepted) ────────────────────────────────────────────────

async function handleInviteUpdate(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
) {
  if (row.status !== 'accepted') return

  const fromUser = row.from_user as string
  const toEmail = row.to_email as string

  const [inviterToken, acceptor] = await Promise.all([
    getToken(supabase, fromUser),
    getProfileByEmail(supabase, toEmail),
  ])

  if (!inviterToken) return

  const acceptorName = acceptor?.name || acceptor?.username || 'Someone'
  // Check inviter's circle notification pref
  const inviterProf = await getProfile(supabase, fromUser)
  const circleToken = tokenIfEnabled(inviterProf, 'circle')
  if (!circleToken) return

  await sendExpo([{
    to: circleToken,
    title: `${acceptorName} joined your circle ✓`,
    body: `${acceptorName} accepted your circle invite`,
    data: { type: 'circle_accepted', fromName: acceptorName },
    sound: 'default',
  }])
}

// ─── trips INSERT (trip started) ─────────────────────────────────────────────

async function handleTripInsert(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
) {
  const buddyId = row.buddy_id as string | null
  if (!buddyId) return

  const userId = row.user_id as string
  const tripId = row.id as string
  const destination = row.destination as string
  const eta = row.eta as string | null

  const [tripperName, buddyProf] = await Promise.all([
    getName(supabase, userId),
    getProfile(supabase, buddyId),
  ])

  const buddyToken = tokenIfEnabled(buddyProf, 'trips')
  if (!buddyToken) return

  await sendExpo([{
    to: buddyToken,
    title: `🧭 ${tripperName} started a trip`,
    body: eta
      ? `To ${destination} (ETA ${eta}) — you're following them`
      : `To ${destination} — you're following them`,
    data: { type: 'trip_started', userId, tripId },
    sound: 'default',
  }])
}

// ─── trip_buddies INSERT (an extra follower was added to a trip) ──────────────

async function handleTripBuddyInsert(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
) {
  const tripId = row.trip_id as string
  const followerId = row.buddy_id as string
  const { data: trip } = await supabase
    .from('trips')
    .select('user_id, destination, eta, status')
    .eq('id', tripId)
    .single()
  if (!trip || (trip as any).status !== 'active') return

  const [tripperName, followerProf] = await Promise.all([
    getName(supabase, (trip as any).user_id as string),
    getProfile(supabase, followerId),
  ])
  const token = tokenIfEnabled(followerProf, 'trips')
  if (!token) return

  const eta = (trip as any).eta as string | null
  const destination = (trip as any).destination as string
  await sendExpo([{
    to: token,
    title: `🧭 ${tripperName} started a trip`,
    body: eta
      ? `To ${destination} (ETA ${eta}) — you're following them`
      : `To ${destination} — you're following them`,
    data: { type: 'trip_started', userId: (trip as any).user_id, tripId },
    sound: 'default',
  }])
}

// ─── trips UPDATE (arrived / escalated / cancelled) ───────────────────────────

async function handleTripUpdate(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
  oldRow: Record<string, unknown> | null,
) {
  const buddyId = row.buddy_id as string | null
  if (!buddyId) return

  // Follow receipt: buddy opened the follow screen → tell the traveler.
  if (row.followed_at && !oldRow?.followed_at) {
    const [buddyName, travelerProf] = await Promise.all([
      getName(supabase, buddyId),
      getProfile(supabase, row.user_id as string),
    ])
    const travelerToken = tokenIfEnabled(travelerProf, 'trips')
    if (travelerToken) {
      await sendExpo([{
        to: travelerToken,
        title: `👀 ${buddyName} is following your trip`,
        body: `They can see your live location until you arrive at ${row.destination}`,
        data: { type: 'trip_followed', tripId: row.id },
        sound: 'default',
      }])
    }
    return
  }

  const newStatus = row.status as string
  const oldStatus = oldRow?.status as string | undefined
  if (newStatus === oldStatus) return // no status change

  const userId = row.user_id as string
  const destination = row.destination as string
  const tripId = row.id as string

  const tripperName = await getName(supabase, userId)

  // Fan out to EVERY follower: primary buddy_id + all trip_buddies rows.
  const followerIds = new Set<string>([buddyId])
  const { data: tb } = await supabase.from('trip_buddies').select('buddy_id').eq('trip_id', tripId)
  ;((tb ?? []) as any[]).forEach((r) => followerIds.add(r.buddy_id as string))

  const profs = await Promise.all([...followerIds].map((id) => getProfile(supabase, id)))
  const tokens = profs.map((p) => tokenIfEnabled(p, 'trips')).filter(Boolean) as string[]
  if (tokens.length === 0) return

  const make = (title: string, body: string, dataType: string, priority?: 'high'): ExpoMessage[] =>
    tokens.map((to) => ({
      to, title, body,
      data: { type: dataType, userId, tripId },
      sound: 'default' as const,
      ...(priority ? { priority } : {}),
    }))

  if (newStatus === 'arrived') {
    await sendExpo(make(`✓ ${tripperName} arrived safely`, `Trip to ${destination} completed`, 'trip_arrived'))
  } else if (newStatus === 'escalated') {
    // Covers both auto-escalation (missed ETA) and a manual "Need help" tap.
    await sendExpo(make(`⚠️ ${tripperName} needs help`, `Their trip to ${destination} was escalated — open to see their live location`, 'trip_escalated', 'high'))
  } else if (newStatus === 'cancelled') {
    await sendExpo(make(`${tripperName} cancelled their trip`, `Trip to ${destination} was cancelled`, 'trip_cancelled'))
  }
}

// ─── messages INSERT (chat) ───────────────────────────────────────────────────

async function handleMessage(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
) {
  const senderId = row.sender_id as string
  const recipientId = row.recipient_id as string
  // The messages table stores text in `body` (older deploys used `content`).
  const content = ((row.body ?? row.content) as string | null) ?? ''

  // Skip trip system messages — the trips INSERT webhook already notifies the
  // buddy; without this the trip start produces TWO pushes.
  if (content.startsWith('🧭')) return

  const [senderName, recipientProf] = await Promise.all([
    getName(supabase, senderId),
    getProfile(supabase, recipientId),
  ])

  const recipientToken = tokenIfEnabled(recipientProf, 'messages')
  if (!recipientToken) return

  await sendExpo([{
    to: recipientToken,
    title: senderName,
    body: content.substring(0, 100) || 'Sent you a message',
    data: { type: 'message', fromId: senderId, fromName: senderName },
    sound: 'default',
  }])
}
