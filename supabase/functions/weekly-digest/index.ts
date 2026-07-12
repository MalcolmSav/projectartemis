// Edge function: weekly-digest
// Sends a weekly safety summary push to every user who has a push token.
// Schedule via Supabase Dashboard → Edge Functions → Schedules: 0 17 * * 0 (5 pm UTC Sunday)
//
// Deploy: npx supabase functions deploy weekly-digest --project-ref pbqcsgthnwaqpddsucrx

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all profiles with a push token.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, push_token, notification_prefs')
    .not('push_token', 'is', null)

  if (!profiles?.length) return new Response('no recipients', { status: 200 })

  const messages = []

  for (const profile of profiles as any[]) {
    // Respect wellness pref (using it as a proxy for digest opt-in; alarms always fire separately).
    const prefs = profile.notification_prefs
    if (prefs?.wellness === false) continue

    const userId = profile.id
    const token = profile.push_token as string

    // Fetch this week's stats in parallel.
    const [{ count: checkIns }, { count: trips }, { count: alarms }] = await Promise.all([
      supabase.from('check_ins').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('kind', 'ok').gte('created_at', weekAgo),
      supabase.from('trips').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).gte('created_at', weekAgo),
      supabase.from('check_ins').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('kind', 'alarm').gte('created_at', weekAgo),
    ])

    // Only send if there was any activity this week.
    if (!checkIns && !trips && !alarms) continue

    const parts: string[] = []
    if (checkIns) parts.push(`${checkIns} check-in${checkIns !== 1 ? 's' : ''}`)
    if (trips) parts.push(`${trips} trip${trips !== 1 ? 's' : ''}`)
    if (alarms) parts.push(`${alarms} alarm${alarms !== 1 ? 's' : ''}`)

    messages.push({
      to: token,
      title: 'Your Artemis week 🌙',
      body: parts.join(' · ') + ' — you kept your circle close.',
      data: { type: 'weekly_digest' },
      sound: 'default',
    })
  }

  if (messages.length === 0) return new Response('nothing to send', { status: 200 })

  // Expo batch limit is 100.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    })
  }

  return new Response(`sent ${messages.length}`, { status: 200 })
})
