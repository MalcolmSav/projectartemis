import React, { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, TextInput, Alert, RefreshControl, Linking } from 'react-native';
import { TopBar, Text, Eyebrow, Avatar, Card, Divider, PillButton, BottomSheet, Toggle } from '../components';
import { ArtemisMark } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { useEvents } from '../hooks/useEvents';
import { useEmergencyContacts } from '../hooks/useEmergencyContacts';
import { useHomePlace } from '../hooks/useHomePlace';
import { useCircle } from '../hooks/useCircle';
import { useGuardianship } from '../hooks/useGuardianship';
import { useT, useLang } from '../i18n';
import { supabase, Profile } from '../lib/supabase';
import { personName } from '../lib/person';
import { pickAndUploadAvatar } from '../lib/avatar';
import { palette } from '../theme/tokens';

/** The device's IANA timezone (e.g. "Europe/Stockholm"), or null if unavailable. */
function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function ProfileScreen() {
  const t = useTheme();
  const tr = useT();
  const { lang, setLang } = useLang();
  const { profile, signOut, refreshProfile } = useAuth();
  const { events } = useEvents();
  const { contacts } = useEmergencyContacts(profile?.id);
  const { home, setFromCurrentLocation, clearHome } = useHomePlace();
  const { members: circleMembers } = useCircle();
  const [homeBusy, setHomeBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const onSetHome = async () => {
    setHomeBusy(true);
    const res = await setFromCurrentLocation();
    setHomeBusy(false);
    if (res.error) Alert.alert(tr('Could not set home'), res.error);
  };

  const display = profile?.name?.trim() || profile?.email?.split('@')[0] || '—';
  const [uploading, setUploading] = useState(false);

  type NotifPrefs = {
    wellness: boolean; circle: boolean; alarm: boolean; trips: boolean; messages: boolean;
    quiet_from?: string; quiet_to?: string; // "HH:MM" 24h, LOCAL wall-clock time
    tz?: string; // IANA name — without it the server can't tell when "22:00" is
  };
  const DEFAULT_PREFS: NotifPrefs = { wellness: true, circle: true, alarm: true, trips: true, messages: true };
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => {
        if (!data?.notification_prefs) return;
        const saved = { ...DEFAULT_PREFS, ...(data.notification_prefs as Partial<NotifPrefs>) };
        setNotifPrefs(saved);
        // Backfill for profiles saved before tz was stored — otherwise their
        // quiet hours stay stuck on UTC until they happen to change a setting.
        const tz = deviceTimeZone();
        if (tz && saved.tz !== tz) {
          const next = { ...saved, tz };
          setNotifPrefs(next);
          supabase.from('profiles').update({ notification_prefs: next }).eq('id', profile.id).then(() => {});
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const updatePref = async (patch: Partial<NotifPrefs>) => {
    // Always stamp the current timezone: quiet hours are stored as local
    // wall-clock strings, so the push server needs to know which clock. Refreshed
    // on every write so it follows the user when they travel.
    const tz = deviceTimeZone();
    const next = { ...notifPrefs, ...patch, ...(tz ? { tz } : {}) };
    setNotifPrefs(next);
    if (!profile?.id) return;
    await supabase.from('profiles').update({ notification_prefs: next }).eq('id', profile.id);
  };

  const togglePref = (key: keyof Pick<NotifPrefs, 'wellness' | 'circle' | 'alarm' | 'trips' | 'messages'>, value: boolean) =>
    updatePref({ [key]: value });

  const onPickAvatar = async () => {
    if (!profile) return;
    setUploading(true);
    const res = await pickAndUploadAvatar(profile.id);
    setUploading(false);
    if (res.error) {
      Alert.alert(tr("Couldn't update photo"), res.error);
      return;
    }
    refreshProfile();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <TopBar />
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 120 }}>
        <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 22 }}>
          <Pressable onPress={onPickAvatar} disabled={uploading} accessibilityLabel="Change photo">
            <Avatar name={display} size={92} ring photoUri={profile?.avatar_url ?? undefined} />
          </Pressable>
          <Text variant="small" weight="semibold" color={t.colors.gold700} style={{ marginTop: 12 }}>
            {uploading ? tr('Uploading…') : profile?.avatar_url ? tr('Change photo') : tr('Add photo')}
          </Text>
          <Text
            style={{
              fontFamily: t.type.display,
              fontSize: 28,
              lineHeight: 40,
              marginTop: 18,
              textAlign: 'center',
              paddingHorizontal: 8,
            }}
            numberOfLines={2}
          >
            {display}
          </Text>
          {profile?.username && (
            <Text variant="small" color={t.colors.inkMute} style={{ marginTop: 2 }}>
              @{profile.username}
            </Text>
          )}
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4, textAlign: 'center' }}>
            {profile?.bio?.trim() || profile?.email}
          </Text>
          <Pressable onPress={() => setEditOpen(true)} style={{ marginTop: 10 }}>
            <Text variant="small" weight="semibold" color={t.colors.gold700}>
              {tr('Edit profile')}
            </Text>
          </Pressable>
        </View>

        <ProfileCompleteness
          hasName={!!profile?.name?.trim()}
          hasPhoto={!!profile?.avatar_url}
          hasPhone={!!profile?.phone?.trim()}
          hasContacts={contacts.length > 0}
          hasCircle={circleMembers.length > 0}
          hasHome={!!home}
        />

        <Eyebrow style={{ marginBottom: 8 }}>{tr('ACCOUNT')}</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text variant="meta" color={t.colors.inkMute}>
                {tr('EMAIL')}
              </Text>
              <Text variant="body">{profile?.email}</Text>
            </View>
          </View>
          {profile?.phone ? (
            <>
              <Divider style={{ marginVertical: 10 }} />
              <View>
                <Text variant="meta" color={t.colors.inkMute}>
                  {tr('PHONE')}
                </Text>
                <Text variant="body">{profile.phone}</Text>
              </View>
            </>
          ) : null}
        </Card>

        <Eyebrow style={{ marginBottom: 8 }}>{tr('HOME')}</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 10 }}>
            {tr('Saved so you can pick "My Home" as a destination in one tap when starting a trip.')}
          </Text>
          {home ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">🏡 {home.label}</Text>
                <Text variant="meta" color={t.colors.inkMute}>
                  {home.lat.toFixed(4)}, {home.lng.toFixed(4)}
                </Text>
              </View>
              <Pressable onPress={onSetHome} disabled={homeBusy} hitSlop={8}>
                <Text variant="small" weight="semibold" color={t.colors.gold700}>
                  {homeBusy ? tr('Updating…') : tr('Update')}
                </Text>
              </Pressable>
              <Pressable onPress={clearHome} hitSlop={8}>
                <Text variant="small" weight="semibold" color={t.colors.crimson}>
                  {tr('Clear')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <PillButton variant="secondary" block disabled={homeBusy} onPress={onSetHome}>
              {homeBusy ? tr('Getting location…') : tr('Set home to my current location')}
            </PillButton>
          )}
        </Card>

        {contacts.length > 0 && (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('EMERGENCY CONTACTS')}</Eyebrow>
            <Card style={{ marginBottom: 18 }}>
              {contacts.map((contact, i) => (
                <View key={contact.id}>
                  <View>
                    <Text variant="meta" color={t.colors.inkMute}>
                      {contact.priority === 1 ? '🚨 CALL FIRST' : `CONTACT ${contact.priority}`}
                    </Text>
                    <Text variant="body" weight="semibold" style={{ marginTop: 4 }}>
                      {contact.name}
                    </Text>
                    <Pressable onPress={() => Linking.openURL(`tel:${contact.contact_info}`)}>
                      <Text variant="small" color={t.colors.gold700}>
                        {contact.contact_info}
                      </Text>
                    </Pressable>
                  </View>
                  {i < contacts.length - 1 && <Divider style={{ marginVertical: 10 }} />}
                </View>
              ))}
            </Card>
          </>
        )}

        {events.length > 0 && (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('MY UPCOMING')}</Eyebrow>
            <Card style={{ marginBottom: 18 }}>
              {events.slice(0, 3).map((e, i) => (
                <View key={e.id}>
                  <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
                    <View style={{ width: 3, backgroundColor: palette.gold500, borderRadius: 2, marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold">
                        {e.title}
                      </Text>
                      <Text variant="meta" color={t.colors.inkMute}>
                        {e.date}
                        {e.time ? ` · ${e.time}` : ''}
                        {e.location ? ` · ${e.location}` : ''}
                      </Text>
                    </View>
                  </View>
                  {i < Math.min(events.length, 3) - 1 && <Divider />}
                </View>
              ))}
            </Card>
          </>
        )}

        <FamilySection />

        <Eyebrow style={{ marginBottom: 8 }}>{tr('NOTIFICATIONS')}</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          {(
            [
              { key: 'wellness' as const, label: tr('Wellness checks') },
              { key: 'circle' as const, label: tr('Circle invites & joins') },
              { key: 'alarm' as const, label: tr('Alarms') },
              { key: 'trips' as const, label: tr('Trip updates') },
              { key: 'messages' as const, label: tr('Chat messages') },
            ]
          ).map(({ key, label }, i, arr) => (
            <View key={key}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                <Text variant="body">{label}</Text>
                <Toggle on={!!notifPrefs[key]} onChange={(v) => togglePref(key, v)} />
              </View>
              {i < arr.length - 1 && <Divider />}
            </View>
          ))}
          <Divider style={{ marginVertical: 4 }} />
          <View style={{ paddingTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View>
                <Text variant="body">{tr('Quiet hours')}</Text>
                <Text variant="meta" color={t.colors.inkMute}>{tr('No push notifications in this window')}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['quiet_from', 'quiet_to'] as const).map((field) => {
                const current = notifPrefs[field] ?? (field === 'quiet_from' ? '22:00' : '07:00');
                const [hStr, mStr] = current.split(':');
                const h = parseInt(hStr, 10);
                const m = parseInt(mStr, 10);
                const bump = (dh: number, dm: number) => {
                  const nh = ((h + dh) + 24) % 24;
                  const nm = ((m + dm) + 60) % 60;
                  updatePref({ [field]: `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}` });
                };
                return (
                  <View key={field} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <Text variant="meta" color={t.colors.inkMute}>{field === 'quiet_from' ? tr('From') : tr('To')}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Pressable onPress={() => bump(1, 0)} style={{ padding: 4 }}><Text variant="small">▲</Text></Pressable>
                        <View style={{ backgroundColor: t.colors.forest700, borderRadius: t.radii.sm, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: '#fff' }}>{String(h).padStart(2, '0')}</Text>
                        </View>
                        <Pressable onPress={() => bump(-1, 0)} style={{ padding: 4 }}><Text variant="small">▼</Text></Pressable>
                      </View>
                      <Text style={{ fontFamily: t.type.bodyBold, fontSize: 20, alignSelf: 'center', color: t.colors.ink }}>:</Text>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <Pressable onPress={() => bump(0, 5)} style={{ padding: 4 }}><Text variant="small">▲</Text></Pressable>
                        <View style={{ backgroundColor: t.colors.forest700, borderRadius: t.radii.sm, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: '#fff' }}>{String(m).padStart(2, '0')}</Text>
                        </View>
                        <Pressable onPress={() => bump(0, -5)} style={{ padding: 4 }}><Text variant="small">▼</Text></Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Card>

        <Eyebrow style={{ marginBottom: 8 }}>{tr('APPEARANCE')}</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="body">{tr('Mode')}</Text>
            <View style={{ flexDirection: 'row', backgroundColor: t.colors.moonlight, borderRadius: 999, padding: 3 }}>
              {(['light', 'night'] as const).map((m) => {
                const active = t.mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => t.setMode(m)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      backgroundColor: active ? t.colors.forest700 : 'transparent',
                    }}
                  >
                    <Text variant="small" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft}>
                      {m === 'light' ? tr('Day') : tr('Night')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Divider style={{ marginVertical: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="body">{tr('Language')}</Text>
            <View style={{ flexDirection: 'row', backgroundColor: t.colors.moonlight, borderRadius: 999, padding: 3 }}>
              {(['en', 'sv'] as const).map((l) => {
                const active = lang === l;
                return (
                  <Pressable
                    key={l}
                    onPress={() => setLang(l)}
                    accessibilityRole="button"
                    accessibilityLabel={l === 'en' ? 'English' : 'Svenska'}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      backgroundColor: active ? t.colors.forest700 : 'transparent',
                    }}
                  >
                    <Text variant="small" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft}>
                      {l === 'en' ? 'English' : 'Svenska'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        <PillButton
          variant="secondary"
          block
          onPress={() => {
            Alert.alert(tr('Sign out?'), tr('You can sign back in anytime.'), [
              { text: tr('Cancel'), style: 'cancel' },
              { text: tr('Sign out'), style: 'destructive', onPress: () => signOut() },
            ]);
          }}
        >
          {tr('Sign out')}
        </PillButton>

        <PillButton
          variant="ghost"
          block
          style={{ marginTop: 8 }}
          onPress={() => {
            Alert.alert(
              tr('Delete account?'),
              tr('This permanently removes your profile, circle, events and check-ins. This cannot be undone.'),
              [
                { text: tr('Cancel'), style: 'cancel' },
                {
                  text: tr('Delete'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { error } = await supabase.rpc('delete_my_account');
                      if (error) {
                        Alert.alert(tr('Delete failed'), error.message);
                        return;
                      }
                      await signOut();
                    } catch (err: any) {
                      Alert.alert(tr('Delete failed'), err?.message ?? String(err));
                    }
                  },
                },
              ],
            );
          }}
        >
          <Text variant="small" weight="semibold" color={t.colors.crimson}>
            {tr('Delete account')}
          </Text>
        </PillButton>

        <View style={{ alignItems: 'center', opacity: 0.4, marginTop: 24 }}>
          <ArtemisMark size={36} moonColor={t.colors.forest700} />
          <Text style={{ fontFamily: t.type.displayItalic, fontSize: 12, marginTop: 6, color: t.colors.inkMute }}>
            {tr('Artemis · she who watches')}
          </Text>
        </View>
      </ScrollView>

      <EditProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          refreshProfile();
          setEditOpen(false);
        }}
      />
    </View>
  );
}

/**
 * Family — linking a child account to a guardian, and the guardian's view of the
 * accounts they manage.
 *
 * A managed account's circle is locked to its guardians, which is a real loss of
 * control, so every screen here says plainly who holds it and what accepting
 * costs. The lock itself lives in the database; this is only the way in and out.
 */
function FamilySection() {
  const t = useTheme();
  const tr = useT();
  const {
    guardians,
    children,
    incoming,
    outgoing,
    isChild,
    requestGuardianship,
    respondGuardianship,
    endGuardianship,
  } = useGuardianship();
  const [linkOpen, setLinkOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const respond = async (requestId: string, accept: boolean) => {
    setBusyId(requestId);
    const res = await respondGuardianship(requestId, accept);
    setBusyId(null);
    if (res.error) Alert.alert(tr("That didn't work"), res.error);
  };

  const confirmEnd = (childId: string, name: string) => {
    Alert.alert(
      tr('Stop managing {name}?', { name }),
      tr('Their circle unlocks and you are removed from it. You can link again later.'),
      [
        { text: tr('Cancel'), style: 'cancel' },
        {
          text: tr('Stop managing'),
          style: 'destructive',
          onPress: async () => {
            const res = await endGuardianship(childId);
            if (res.error) Alert.alert(tr("That didn't work"), res.error);
          },
        },
      ],
    );
  };

  // Nothing to show, nothing to offer? Only true for a brand-new account that
  // has no link and no request — keep the entry point visible in that case too.
  return (
    <>
      <Eyebrow style={{ marginBottom: 8 }}>{tr('FAMILY')}</Eyebrow>
      <Card style={{ marginBottom: 18 }}>
        {isChild ? (
          <>
            <Text variant="body" weight="semibold">
              {tr('This account is managed')}
            </Text>
            <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4 }}>
              {tr('Your circle is locked to your guardian(s). Everything else — check-ins, alarms, trips, calling for help — works exactly as normal.')}
            </Text>
            <View style={{ gap: 10, marginTop: 12 }}>
              {guardians.map((g) => (
                <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={personName(g)} size={38} photoUri={g.avatar_url ?? undefined} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold">{personName(g)}</Text>
                    <Text variant="meta" color={t.colors.inkMute}>{tr('Guardian')}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text variant="meta" color={t.colors.inkMute} style={{ marginTop: 12 }}>
              {tr('Only a guardian can end this. Ask them if something is wrong.')}
            </Text>
          </>
        ) : (
          <>
            {children.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
              <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 12 }}>
                {tr("Link a child's account to manage who is in their circle. They keep every safety feature — you decide who watches over them.")}
              </Text>
            )}

            {children.length > 0 && (
              <View style={{ gap: 10, marginBottom: 12 }}>
                {children.map((c, i) => (
                  <View key={c.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Avatar name={personName(c)} size={38} photoUri={c.avatar_url ?? undefined} />
                      <View style={{ flex: 1 }}>
                        <Text variant="body" weight="semibold">{personName(c)}</Text>
                        <Text variant="meta" color={t.colors.inkMute}>{tr('Managed account')}</Text>
                      </View>
                      <Pressable onPress={() => confirmEnd(c.id, personName(c))} hitSlop={8}>
                        <Text variant="small" weight="semibold" color={t.colors.crimson}>
                          {tr('Unlink')}
                        </Text>
                      </Pressable>
                    </View>
                    {i < children.length - 1 && <Divider style={{ marginTop: 10 }} />}
                  </View>
                ))}
              </View>
            )}

            {outgoing.map((r) => (
              <View key={r.id} style={{ marginBottom: 10 }}>
                <Text variant="small" color={t.colors.inkSoft}>
                  {tr('Waiting for {name} to accept you as their guardian.', {
                    name: personName(r.child),
                  })}
                </Text>
              </View>
            ))}

            <PillButton variant="secondary" block onPress={() => setLinkOpen(true)}>
              {tr('Link a child account')}
            </PillButton>
          </>
        )}

        {/* Requests waiting on me: to accept my own guardian, or to approve a
            second guardian for a child I already manage. */}
        {incoming.map((r) => {
          const aboutMe = !children.some((c) => c.id === r.childId);
          return (
            <View
              key={r.id}
              style={{
                marginTop: 14,
                backgroundColor: t.colors.gold100,
                borderRadius: t.radii.md,
                padding: 12,
              }}
            >
              <Text variant="body" weight="semibold">
                {aboutMe
                  ? tr('{name} wants to manage your account', { name: personName(r.guardian) })
                  : tr('{name} wants to become a guardian for {child}', {
                      name: personName(r.guardian),
                      child: personName(r.child),
                    })}
              </Text>
              <Text variant="meta" color={t.colors.inkSoft} style={{ marginTop: 4 }}>
                {aboutMe
                  ? tr('Accepting empties your circle and locks it to your guardian. Only they can undo it.')
                  : tr('They will be added to their circle and can manage it too.')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <PillButton
                  style={{ flex: 1 }}
                  disabled={busyId === r.id}
                  onPress={() => respond(r.id, true)}
                >
                  {tr('Accept')}
                </PillButton>
                <PillButton
                  variant="ghost"
                  style={{ flex: 1 }}
                  disabled={busyId === r.id}
                  onPress={() => respond(r.id, false)}
                >
                  {tr('Decline')}
                </PillButton>
              </View>
            </View>
          );
        })}
      </Card>

      <LinkChildSheet
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onSubmit={requestGuardianship}
      />
    </>
  );
}

function LinkChildSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (childId: string) => Promise<{ error?: string }>;
}) {
  const t = useTheme();
  const tr = useT();
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const search = async (q: string) => {
    const trimmed = q.trim().toLowerCase().replace(/^@/, '');
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
      .neq('id', profile?.id ?? '')
      .limit(8);
    setResults((data ?? []) as Profile[]);
  };

  const close = () => {
    setQuery('');
    setResults([]);
    setSelected(null);
    setErr(null);
    setSent(false);
    onClose();
  };

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    const res = await onSubmit(selected.id);
    setBusy(false);
    if (res.error) setErr(res.error);
    else {
      setSent(true);
      setTimeout(close, 1600);
    }
  };

  const inputStyle = {
    backgroundColor: t.colors.moonlight,
    borderRadius: t.radii.md,
    padding: 14,
    fontFamily: t.type.body,
    color: t.colors.ink,
    marginBottom: 12,
  };

  return (
    <BottomSheet visible={open} onClose={close}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, marginBottom: 4 }}>
        {tr('Link a child account')}
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
        {tr('Find their account, then they accept on their own phone. Once linked, their circle holds only their guardians and only you can change it.')}
      </Text>

      {selected ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: t.colors.moonlight,
            borderRadius: t.radii.md,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <Avatar name={personName(selected)} size={40} photoUri={selected.avatar_url ?? undefined} />
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="semibold">{personName(selected)}</Text>
            {selected.username && (
              <Text variant="meta" color={t.colors.inkMute}>@{selected.username}</Text>
            )}
          </View>
          <Pressable onPress={() => setSelected(null)} hitSlop={10}>
            <Text variant="small" color={t.colors.crimson} weight="semibold">✕</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Eyebrow style={{ marginBottom: 6 }}>{tr('FIND BY USERNAME')}</Eyebrow>
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              search(v);
            }}
            placeholder="@username or name"
            placeholderTextColor={t.colors.inkMute}
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
          {results.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              {results.map((p, i) => (
                <View key={p.id}>
                  <Pressable
                    onPress={() => {
                      setSelected(p);
                      setQuery('');
                      setResults([]);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
                  >
                    <Avatar name={personName(p)} size={38} photoUri={p.avatar_url ?? undefined} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold">{personName(p)}</Text>
                      {p.username && (
                        <Text variant="meta" color={t.colors.inkMute}>@{p.username}</Text>
                      )}
                    </View>
                  </Pressable>
                  {i < results.length - 1 && <Divider />}
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      {err && (
        <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
          {err}
        </Text>
      )}
      {sent && (
        <Text variant="small" color={t.colors.statusOk} style={{ marginBottom: 10 }}>
          {tr('Sent — they need to accept it on their phone ✓')}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PillButton variant="ghost" style={{ flex: 1 }} onPress={close} disabled={busy}>
          {tr('Cancel')}
        </PillButton>
        <PillButton style={{ flex: 1 }} onPress={submit} disabled={busy || !selected}>
          {busy ? tr('Sending…') : tr('Send request')}
        </PillButton>
      </View>
    </BottomSheet>
  );
}

function ProfileCompleteness({
  hasName, hasPhoto, hasPhone, hasContacts, hasCircle, hasHome,
}: {
  hasName: boolean; hasPhoto: boolean; hasPhone: boolean; hasContacts: boolean; hasCircle: boolean; hasHome: boolean;
}) {
  const t = useTheme();
  const tr = useT();
  const steps = [
    { label: tr('Add your name'), done: hasName },
    { label: tr('Add a profile photo'), done: hasPhoto },
    // Without a phone, circle members' "Call" buttons dead-end on this user.
    { label: tr('Add your phone number'), done: hasPhone },
    { label: tr('Add someone to your circle'), done: hasCircle },
    { label: tr('Add emergency contacts'), done: hasContacts },
    { label: tr('Set your home location'), done: hasHome },
  ];
  const pct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  if (pct === 100) return null;
  const nextMissing = steps.find((s) => !s.done);

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Eyebrow>{tr('Complete your profile')}</Eyebrow>
        <Text variant="meta" color={t.colors.gold700} weight="semibold">{pct}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: t.colors.hairline, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
        <View style={{ height: 6, width: `${pct}%` as any, backgroundColor: t.colors.forest700, borderRadius: 999 }} />
      </View>
      {nextMissing && (
        <Text variant="meta" color={t.colors.inkSoft}>Next: {nextMissing.label}</Text>
      )}
    </View>
  );
}

function EditProfileSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useTheme();
  const tr = useT();
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName(profile?.name ?? '');
      setPhone(profile?.phone ?? '');
      setBio(profile?.bio ?? '');
      setErr(null);
    }
  }, [open, profile]);

  const save = async () => {
    if (!profile) return;
    if (!name.trim()) {
      setErr(tr('Name is required'));
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), phone: phone.trim() || null, bio: bio.trim() || null })
      .eq('id', profile.id);
    setBusy(false);
    if (error) setErr(error.message);
    else onSaved();
  };

  const inputStyle = {
    backgroundColor: t.colors.moonlight,
    borderRadius: t.radii.md,
    padding: 14,
    fontFamily: t.type.body,
    color: t.colors.ink,
    marginBottom: 12,
  };

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, marginBottom: 16 }}>{tr('Edit profile')}</Text>
      <Eyebrow style={{ marginBottom: 6 }}>{tr('NAME')}</Eyebrow>
      <TextInput value={name} onChangeText={setName} style={inputStyle} placeholderTextColor={t.colors.inkMute} />
      <Eyebrow style={{ marginBottom: 6 }}>{tr('PHONE')}</Eyebrow>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={inputStyle}
        placeholderTextColor={t.colors.inkMute}
      />
      <Eyebrow style={{ marginBottom: 6 }}>{tr('BIO')}</Eyebrow>
      <TextInput
        value={bio}
        onChangeText={setBio}
        multiline
        style={[inputStyle, { minHeight: 80 }]}
        placeholderTextColor={t.colors.inkMute}
      />
      {err && (
        <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 8 }}>
          {err}
        </Text>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PillButton variant="ghost" style={{ flex: 1 }} onPress={onClose}>
          {tr('Cancel')}
        </PillButton>
        <PillButton style={{ flex: 1 }} onPress={save} disabled={busy || !name.trim()}>
          {busy ? tr('Saving…') : tr('Save')}
        </PillButton>
      </View>
    </BottomSheet>
  );
}
