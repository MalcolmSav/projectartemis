import React, { useState } from 'react';
import { ScrollView, View, Pressable, TextInput, RefreshControl, Alert } from 'react-native';
import { TopBar, Text, Eyebrow, Card, BottomSheet, PillButton, SectionTitle, Toggle, Avatar } from '../components';
import { IconChevron, IconPlus, IconShare } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useT } from '../i18n';
import { useEvents, DBEvent } from '../hooks/useEvents';
import { useCircle } from '../hooks/useCircle';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';
import { palette } from '../theme/tokens';
import { personName } from '../lib/person';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ymd(year: number, month0: number, day: number) {
  const mm = String(month0 + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}

// Mon=0, Sun=6
function startWeekday(year: number, month0: number) {
  const js = new Date(year, month0, 1).getDay(); // Sun=0..Sat=6
  return (js + 6) % 7;
}

export function CalendarScreen() {
  const t = useTheme();
  const tr = useT();
  const { user } = useAuth();
  const { events, friendEvents, error: eventsError, addEvent, removeEvent, refresh } = useEvents();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DBEvent | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());

  const openAddFor = (day: number) => {
    setPrefillDate(ymd(year, month0, day));
    setAddOpen(true);
  };

  const monthKey = `${year}-${String(month0 + 1).padStart(2, '0')}`;
  // Only today and future — a calendar of past events isn't useful here, and
  // check-in reminders only matter going forward. YYYY-MM-DD compares lexically.
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());
  const eventsThisMonth = events.filter((e) => e.date.slice(0, 7) === monthKey && e.date >= todayStr);
  const friendEventsThisMonth = friendEvents.filter((e) => e.date.slice(0, 7) === monthKey && e.date >= todayStr);
  const byDay: Record<number, DBEvent[]> = {};
  eventsThisMonth.forEach((e) => {
    const d = parseInt(e.date.slice(8, 10), 10);
    (byDay[d] ||= []).push(e);
  });

  const isCurrentMonth = year === today.getFullYear() && month0 === today.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : -1;
  const monthDays = daysInMonth(year, month0);
  const startWd = startWeekday(year, month0);

  const goPrev = () => {
    if (month0 === 0) {
      setMonth0(11);
      setYear((y) => y - 1);
    } else setMonth0((m) => m - 1);
  };
  const goNext = () => {
    if (month0 === 11) {
      setMonth0(0);
      setYear((y) => y + 1);
    } else setMonth0((m) => m + 1);
  };

  const onPullRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <TopBar
        right={
          <>
            <Pressable
              onPress={() => setShareOpen(true)}
              style={[
                {
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  backgroundColor: t.colors.parchment,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                t.shadows.soft,
              ]}
              accessibilityLabel="Manage calendar sharing"
            >
              <IconShare color={t.colors.inkSoft} />
            </Pressable>
            <Pressable
              onPress={() => setAddOpen(true)}
              style={[
                {
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  backgroundColor: t.colors.parchment,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                t.shadows.soft,
              ]}
              accessibilityLabel="Add event"
            >
              <IconPlus color={t.colors.inkSoft} />
            </Pressable>
          </>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={t.colors.forest700} />}
      >
        <View style={{ paddingHorizontal: t.spacing.pageH }}>
          {eventsError && (
            <Pressable
              onPress={refresh}
              style={{
                backgroundColor: 'rgba(192,57,43,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(192,57,43,0.25)',
                borderRadius: t.radii.md,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <Text variant="small" weight="semibold" color={palette.crimson}>
                {tr("Couldn't load your calendar")}
              </Text>
              <Text variant="meta" color={t.colors.inkSoft} style={{ marginTop: 2 }}>
                {eventsError} · {tr('Tap to retry')}
              </Text>
            </Pressable>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Pressable
              onPress={goPrev}
              style={{ width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}
              accessibilityLabel="Previous month"
            >
              <IconChevron dir="left" color={t.colors.inkSoft} />
            </Pressable>
            <Text variant="eyebrow" color={t.colors.inkMute}>
              {MONTHS_LONG[month0].toUpperCase()} {year}
            </Text>
            <Pressable
              onPress={goNext}
              style={{ width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}
              accessibilityLabel="Next month"
            >
              <IconChevron dir="right" color={t.colors.inkSoft} />
            </Pressable>
          </View>
          <Text variant="displayH1">
            My{' '}
            <Text variant="displayH1" italic accent>
              calendar
            </Text>
          </Text>
        </View>

        <View style={{ paddingHorizontal: t.spacing.pageH, marginTop: 14 }}>
          <Card padding={14}>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text variant="eyebrow" color={t.colors.inkMute}>
                    {d}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: startWd }).map((_, i) => (
                <View key={'b' + i} style={{ width: `${100 / 7}%`, aspectRatio: 1 / 1.05 }} />
              ))}
              {Array.from({ length: monthDays }).map((_, i) => {
                const d = i + 1;
                const ev = byDay[d] ?? [];
                const isToday = d === todayDay;
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      // open Add prefilled with that date
                      setEditing(null);
                      setAddOpen(true);
                      setPrefillDate(ymd(year, month0, d));
                    }}
                    style={{ width: `${100 / 7}%`, aspectRatio: 1 / 1.05, padding: 2 }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 12,
                        backgroundColor: isToday ? t.colors.forest700 : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        variant="small"
                        weight={isToday ? 'semibold' : 'medium'}
                        color={isToday ? palette.gold300 : t.colors.ink}
                      >
                        {d}
                      </Text>
                      {ev.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 2, position: 'absolute', bottom: 4 }}>
                          {ev.map((_, j) => (
                            <View
                              key={j}
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: 999,
                                backgroundColor: isToday ? palette.gold300 : palette.gold500,
                              }}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: t.spacing.pageH, paddingTop: 24 }}>
          <SectionTitle>{tr('Upcoming this month')}</SectionTitle>
          {eventsThisMonth.length === 0 ? (
            <View
              style={{
                padding: 28,
                borderRadius: t.radii.lg,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: t.colors.hairline,
                alignItems: 'center',
              }}
            >
              <Text variant="body" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 14 }}>
                {tr('No events for {month}.', { month: MONTHS_LONG[month0] })}
              </Text>
              <PillButton onPress={() => setAddOpen(true)}>{tr('+ Add event')}</PillButton>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {eventsThisMonth.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    setEditing(e);
                    setAddOpen(true);
                  }}
                  onLongPress={() => {
                    Alert.alert('Delete event?', e.title, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => removeEvent(e.id) },
                    ]);
                  }}
                  style={[{ backgroundColor: t.colors.parchment, borderRadius: t.radii.lg, padding: 14 }, t.shadows.card]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
                      <View
                        style={{
                          width: 46,
                          paddingVertical: 6,
                          borderRadius: 12,
                          backgroundColor: t.colors.moonlight,
                          alignItems: 'center',
                        }}
                      >
                        <Text variant="eyebrow" color={t.colors.inkMute}>
                          {MONTHS[parseInt(e.date.slice(5, 7), 10) - 1]}
                        </Text>
                        <Text style={{ fontFamily: t.type.display, fontSize: 22, lineHeight: 26, color: t.colors.forest700 }}>
                          {parseInt(e.date.slice(8, 10), 10)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: t.type.display, fontSize: 18, lineHeight: 24 }}>{e.title}</Text>
                        <Text variant="small" color={t.colors.inkMute} style={{ marginTop: 2 }}>
                          {e.time ? `${e.time}` : ''}
                          {e.location ? ` · ${e.location}` : ''}
                        </Text>
                        {e.notes ? (
                          <Text variant="meta" color={t.colors.inkSoft} style={{ marginTop: 6 }}>
                            {e.notes}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {e.check_in && (
                      <View
                        style={{
                          backgroundColor: t.colors.gold100,
                          paddingVertical: 4,
                          paddingHorizontal: 9,
                          borderRadius: 999,
                        }}
                      >
                        <Text variant="eyebrow" weight="semibold" color={t.colors.gold700}>
                          {tr('🛡 CHECK-IN')}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
              <Text variant="meta" color={t.colors.inkMute} style={{ textAlign: 'center', marginTop: 4 }}>
                {tr('Tap to edit · long-press to delete')}
              </Text>
            </View>
          )}

          {friendEventsThisMonth.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <SectionTitle>{tr('Shared with you')}</SectionTitle>
              <View style={{ gap: 10 }}>
                {friendEventsThisMonth.map((e) => (
                  <View
                    key={e.id}
                    style={[{ backgroundColor: t.colors.moonlight, borderRadius: t.radii.lg, padding: 14 }, t.shadows.soft]}
                  >
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Avatar
                        name={e.owner?.name ?? '?'}
                        size={40}
                        photoUri={e.owner?.avatar_url ?? undefined}
                      />
                      <View style={{ flex: 1 }}>
                        <Text variant="meta" color={t.colors.gold700} weight="semibold">
                          {(e.owner?.name ?? e.owner?.email ?? '').toUpperCase()} · {MONTHS[parseInt(e.date.slice(5, 7), 10) - 1]} {parseInt(e.date.slice(8, 10), 10)}
                        </Text>
                        <Text style={{ fontFamily: t.type.display, fontSize: 18, lineHeight: 24, marginTop: 2 }}>
                          {e.title}
                        </Text>
                        {(e.time || e.location) && (
                          <Text variant="small" color={t.colors.inkMute} style={{ marginTop: 2 }}>
                            {e.time ?? ''}
                            {e.location ? ` · ${e.location}` : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <EventSheet
        open={addOpen}
        prefillDate={prefillDate}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
          setPrefillDate(null);
        }}
        editing={editing}
        defaultDate={prefillDate ?? ymd(year, month0, today.getDate())}
        onSave={async (payload) => {
          if (editing) {
            await supabase
              .from('events')
              .update({
                date: payload.date,
                title: payload.title,
                time: payload.time ?? null,
                location: payload.location ?? null,
                notes: payload.notes ?? null,
                check_in: !!payload.checkIn,
              })
              .eq('id', editing.id);
            await refresh();
            return {};
          }
          return addEvent(payload);
        }}
      />

      <CalendarShareSheet open={shareOpen} onClose={() => { setShareOpen(false); refresh(); }} />
    </View>
  );
}

function EventSheet({
  open,
  onClose,
  onSave,
  editing,
  defaultDate,
  prefillDate,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (e: { date: string; title: string; time?: string; location?: string; notes?: string; checkIn?: boolean }) => Promise<{ error?: string }>;
  editing: DBEvent | null;
  defaultDate: string;
  prefillDate?: string | null;
}) {
  const t = useTheme();
  const tr = useT();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [checkIn, setCheckIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      if (editing) {
        setTitle(editing.title);
        setDate(editing.date);
        setTime(editing.time ?? '');
        setLocation(editing.location ?? '');
        setNotes(editing.notes ?? '');
        setCheckIn(editing.check_in);
      } else {
        setTitle('');
        setDate(prefillDate ?? defaultDate);
        setTime('');
        setLocation('');
        setNotes('');
        setCheckIn(false);
      }
      setErr(null);
    }
  }, [open, editing, defaultDate, prefillDate]);

  // The numeric keypad has no ":" or "-" keys, so users can't type separators —
  // insert them automatically as digits come in.
  const onTimeChange = (raw: string) => {
    let d = raw.replace(/\D/g, '').slice(0, 4);
    if (d.length >= 1 && parseInt(d[0], 10) > 2) d = '0' + d;        // "9…"  → "09…"
    if (d.length >= 3 && parseInt(d[2], 10) > 5) d = d.slice(0, 2) + '0' + d[2]; // "21:7" → "21:07"
    d = d.slice(0, 4);
    setTime(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
  };
  const onDateChange = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 8);
    let out = d;
    if (d.length > 6) out = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
    else if (d.length > 4) out = `${d.slice(0, 4)}-${d.slice(4)}`;
    setDate(out);
  };

  const submit = async () => {
    if (!title.trim()) return setErr(tr('Title is required'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr(tr('Date must be YYYY-MM-DD'));
    if (time.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim()))
      return setErr(tr('Time must be HH:MM (e.g. 21:00)'));
    setBusy(true);
    const res = await onSave({
      date,
      title: title.trim(),
      time: time.trim() || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      checkIn,
    });
    setBusy(false);
    if (res.error) setErr(res.error);
    else onClose();
  };

  const input = {
    backgroundColor: t.colors.moonlight,
    borderRadius: t.radii.md,
    padding: 14,
    fontFamily: t.type.body,
    color: t.colors.ink,
    marginBottom: 12,
  };

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 14 }}>
        {editing ? tr('Edit event') : tr('New event')}
      </Text>
      <Eyebrow style={{ marginBottom: 6 }}>{tr('TITLE')}</Eyebrow>
      <TextInput value={title} onChangeText={setTitle} style={input} placeholderTextColor={t.colors.inkMute} placeholder="Girls night" />
      <Eyebrow style={{ marginBottom: 6 }}>{tr('DATE')}</Eyebrow>
      <TextInput value={date} onChangeText={onDateChange} style={input} placeholderTextColor={t.colors.inkMute} placeholder="YYYY-MM-DD" keyboardType="numeric" maxLength={10} />
      <Eyebrow style={{ marginBottom: 6 }}>{tr('TIME')}</Eyebrow>
      <TextInput value={time} onChangeText={onTimeChange} style={input} placeholderTextColor={t.colors.inkMute} placeholder={tr('e.g. 2130 → 21:30 (optional)')} keyboardType="numeric" maxLength={5} />
      <Eyebrow style={{ marginBottom: 6 }}>{tr('LOCATION')}</Eyebrow>
      <TextInput value={location} onChangeText={setLocation} style={input} placeholderTextColor={t.colors.inkMute} placeholder="Stureplan" />
      <Eyebrow style={{ marginBottom: 6 }}>{tr('NOTES')}</Eyebrow>
      <TextInput value={notes} onChangeText={setNotes} multiline style={[input, { minHeight: 70 }]} placeholderTextColor={t.colors.inkMute} placeholder="Optional" />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 }}>
        <View>
          <Text variant="body" weight="semibold">
            {tr('Check-in expected')}
          </Text>
          <Text variant="meta" color={t.colors.inkMute}>
            {tr('Auto wellness check at end of event')}
          </Text>
        </View>
        <Toggle on={checkIn} onChange={setCheckIn} />
      </View>

      {err && (
        <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 8 }}>
          {err}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PillButton variant="ghost" style={{ flex: 1 }} onPress={onClose}>
          {tr('Cancel')}
        </PillButton>
        <PillButton style={{ flex: 1 }} onPress={submit} disabled={busy || !title.trim()}>
          {busy ? tr('Saving…') : editing ? tr('Save changes') : tr('Add')}
        </PillButton>
      </View>
    </BottomSheet>
  );
}

function CalendarShareSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const tr = useT();
  const { user } = useAuth();
  const { members } = useCircle();
  const [shares, setShares] = useState<Record<string, 'none' | 'checkin' | 'full'>>({});
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from('calendar_shares').select('*').eq('owner_id', user.id);
      const map: Record<string, 'none' | 'checkin' | 'full'> = {};
      (data ?? []).forEach((r: any) => {
        map[r.viewer_id] = r.level;
      });
      setShares(map);
      setLoading(false);
    })();
  }, [open, user]);

  const update = async (viewerId: string, level: 'none' | 'checkin' | 'full') => {
    if (!user) return;
    setShares((s) => ({ ...s, [viewerId]: level }));
    await supabase
      .from('calendar_shares')
      .upsert({ owner_id: user.id, viewer_id: viewerId, level }, { onConflict: 'owner_id,viewer_id' });
  };

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 6 }}>
        {tr('Share calendar')}
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 18 }}>
        {tr('Choose who sees your calendar — and how much. You can change this anytime.')}
      </Text>

      {members.length === 0 ? (
        <Text variant="body" color={t.colors.inkSoft}>
          {tr('Add friends first to share your calendar with them.')}
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {members.map((m) => {
            const level = shares[m.profile.id] ?? 'none';
            return (
              <View
                key={m.edgeId}
                style={{ backgroundColor: t.colors.moonlight, borderRadius: t.radii.md, padding: 14 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Avatar
                    name={personName(m.profile)}
                    size={40}
                    photoUri={m.profile.avatar_url ?? undefined}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold">
                      {personName(m.profile)}
                    </Text>
                    <Eyebrow color={t.colors.inkMute}>{m.relation ?? tr('Friend')}</Eyebrow>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(['none', 'checkin', 'full'] as const).map((lvl) => {
                    const active = level === lvl;
                    const label = lvl === 'none' ? tr('None') : lvl === 'checkin' ? tr('Check-ins') : tr('Full');
                    const sub = lvl === 'none' ? tr('Hidden') : lvl === 'checkin' ? tr('Time only') : tr('All details');
                    return (
                      <Pressable
                        key={lvl}
                        onPress={() => update(m.profile.id, lvl)}
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 12,
                          backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                          alignItems: 'center',
                        }}
                      >
                        <Text variant="small" weight="semibold" color={active ? palette.gold300 : t.colors.ink}>
                          {label}
                        </Text>
                        <Text variant="meta" color={active ? 'rgba(242,226,187,0.7)' : t.colors.inkMute}>
                          {sub}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <PillButton block style={{ marginTop: 16 }} onPress={onClose}>
        {tr('Done')}
      </PillButton>
    </BottomSheet>
  );
}
