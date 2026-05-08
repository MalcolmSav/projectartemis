import React, { useState } from 'react';
import { ScrollView, View, Pressable, TextInput } from 'react-native';
import { TopBar, Text, Eyebrow, Card, BottomSheet, PillButton, SectionTitle, Toggle } from '../components';
import { IconPlus } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useEvents, DBEvent } from '../hooks/useEvents';
import { palette } from '../theme/tokens';

const MONTH_LABEL = 'May 2026';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

function dayOfMonth(iso: string) {
  return parseInt(iso.slice(8, 10), 10);
}

export function CalendarScreen() {
  const t = useTheme();
  const { events, addEvent, removeEvent } = useEvents();
  const [addOpen, setAddOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  const openAddFor = (day: number) => {
    const yyyy = new Date().getFullYear();
    const mm = String(new Date().getMonth() + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setPrefillDate(`${yyyy}-${mm}-${dd}`);
    setAddOpen(true);
  };

  // Group events by day-of-month for grid dot rendering
  const byDay: Record<number, DBEvent[]> = {};
  events.forEach((e) => {
    const d = dayOfMonth(e.date);
    (byDay[d] ||= []).push(e);
  });

  const todayDay = dayOfMonth(TODAY_ISO);
  const monthDays = 31;
  const startWeekday = 1;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <TopBar
        right={
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
          >
            <IconPlus color={t.colors.inkSoft} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: t.spacing.pageH }}>
          <Eyebrow style={{ marginBottom: 6 }}>{MONTH_LABEL.toUpperCase()}</Eyebrow>
          <Text variant="displayH1">
            My{' '}
            <Text variant="displayH1" italic accent>
              calendar
            </Text>
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 8 }}>
            Events with{' '}
            <Text variant="small" weight="semibold" color={t.colors.forest700}>
              check-in
            </Text>{' '}
            trigger an automatic wellness check at end time.
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
              {Array.from({ length: startWeekday }).map((_, i) => (
                <View key={'b' + i} style={{ width: `${100 / 7}%`, aspectRatio: 1 / 1.05 }} />
              ))}
              {Array.from({ length: monthDays }).map((_, i) => {
                const d = i + 1;
                const ev = byDay[d] ?? [];
                const isToday = d === todayDay;
                return (
                  <Pressable
                    key={d}
                    onPress={() => openAddFor(d)}
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
          <SectionTitle>Upcoming</SectionTitle>
          {events.length === 0 ? (
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
                No events yet.
              </Text>
              <PillButton onPress={() => setAddOpen(true)}>+ Add event</PillButton>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {events.map((e) => (
                <Pressable
                  key={e.id}
                  onLongPress={() => removeEvent(e.id)}
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
                          {monthShort(e.date)}
                        </Text>
                        <Text style={{ fontFamily: t.type.display, fontSize: 22, lineHeight: 26, color: t.colors.forest700 }}>
                          {dayOfMonth(e.date)}
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
                          🛡 CHECK-IN
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
              <Text variant="meta" color={t.colors.inkMute} style={{ textAlign: 'center', marginTop: 4 }}>
                Long-press an event to delete
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <AddEventSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setPrefillDate(null);
        }}
        onAdd={addEvent}
        initialDate={prefillDate ?? undefined}
      />
    </View>
  );
}

function monthShort(iso: string) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return months[parseInt(iso.slice(5, 7), 10) - 1];
}

function AddEventSheet({
  open,
  onClose,
  onAdd,
  initialDate,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (e: { date: string; title: string; time?: string; location?: string; notes?: string; checkIn?: boolean }) => Promise<{ error?: string }>;
  initialDate?: string;
}) {
  const t = useTheme();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [checkIn, setCheckIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setDate(initialDate ?? new Date().toISOString().slice(0, 10));
      setTime('');
      setLocation('');
      setNotes('');
      setCheckIn(false);
      setErr(null);
    }
  }, [open, initialDate]);

  const submit = async () => {
    if (!title.trim()) {
      setErr('Title is required');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErr('Date must be YYYY-MM-DD');
      return;
    }
    setBusy(true);
    const res = await onAdd({
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
      <Text style={{ fontFamily: t.type.display, fontSize: 24, marginBottom: 14 }}>New event</Text>

      <Eyebrow style={{ marginBottom: 6 }}>TITLE</Eyebrow>
      <TextInput value={title} onChangeText={setTitle} placeholder="Girls night" placeholderTextColor={t.colors.inkMute} style={input} />

      <Eyebrow style={{ marginBottom: 6 }}>DATE (YYYY-MM-DD)</Eyebrow>
      <TextInput value={date} onChangeText={setDate} placeholder="2026-05-14" placeholderTextColor={t.colors.inkMute} style={input} />

      <Eyebrow style={{ marginBottom: 6 }}>TIME</Eyebrow>
      <TextInput value={time} onChangeText={setTime} placeholder="21:00" placeholderTextColor={t.colors.inkMute} style={input} />

      <Eyebrow style={{ marginBottom: 6 }}>LOCATION</Eyebrow>
      <TextInput value={location} onChangeText={setLocation} placeholder="Stureplan" placeholderTextColor={t.colors.inkMute} style={input} />

      <Eyebrow style={{ marginBottom: 6 }}>NOTES</Eyebrow>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={t.colors.inkMute} multiline style={[input, { minHeight: 70 }]} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 }}>
        <View>
          <Text variant="body" weight="semibold">
            Check-in expected
          </Text>
          <Text variant="meta" color={t.colors.inkMute}>
            Auto wellness check at end of event
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
          Cancel
        </PillButton>
        <PillButton style={{ flex: 1 }} onPress={submit} disabled={busy || !title.trim()}>
          {busy ? 'Saving…' : 'Add'}
        </PillButton>
      </View>
    </BottomSheet>
  );
}
