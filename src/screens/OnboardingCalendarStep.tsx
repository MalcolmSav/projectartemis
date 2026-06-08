import React, { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Text, Eyebrow, PillButton, Card } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useEvents } from '../hooks/useEvents';

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function OnboardingCalendarStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  const { addEvent } = useEvents();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) {
      onComplete();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setErr('Date must be YYYY-MM-DD');
      return;
    }

    setBusy(true);
    setErr(null);
    const res = await addEvent({
      title: title.trim(),
      date: date.trim(),
      time: time.trim() || undefined,
      location: location.trim() || undefined,
      notes: 'Added during onboarding as a hard-to-reach event.',
      checkIn: true,
    });
    setBusy(false);

    if (res.error) setErr(res.error);
    else onComplete();
  };

  const input = {
    backgroundColor: t.colors.parchment,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    fontFamily: t.type.body,
    color: t.colors.ink,
    borderWidth: 1,
    borderColor: t.colors.hairline,
    marginBottom: 14,
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <Eyebrow style={{ marginBottom: 6 }}>CALENDAR</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8 }}>
          Add hard-to-reach{' '}
          <Text variant="displayH1" italic accent>
            moments.
          </Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 22 }}>
          Artemis calendar is for situations where your circle should know you may not answer, like a concert, cinema,
          exam, shift, flight, or appointment. You do not need to add your normal everyday calendar.
        </Text>

        <Card style={{ marginBottom: 22 }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 8 }}>
            Optional first event
          </Text>
          <Text variant="small" color={t.colors.inkSoft}>
            Leave the title empty to skip this for now. Events added here automatically expect a check-in.
          </Text>
        </Card>

        <Eyebrow style={{ marginBottom: 6 }}>TITLE</Eyebrow>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={input}
          placeholder="Concert, cinema, late shift..."
          placeholderTextColor={t.colors.inkMute}
        />

        <Eyebrow style={{ marginBottom: 6 }}>DATE</Eyebrow>
        <TextInput
          value={date}
          onChangeText={setDate}
          style={input}
          placeholder="2026-06-08"
          placeholderTextColor={t.colors.inkMute}
        />

        <Eyebrow style={{ marginBottom: 6 }}>TIME</Eyebrow>
        <TextInput
          value={time}
          onChangeText={setTime}
          style={input}
          placeholder="20:00"
          placeholderTextColor={t.colors.inkMute}
        />

        <Eyebrow style={{ marginBottom: 6 }}>LOCATION</Eyebrow>
        <TextInput
          value={location}
          onChangeText={setLocation}
          style={input}
          placeholder="Venue or area"
          placeholderTextColor={t.colors.inkMute}
        />

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block onPress={save} disabled={busy}>
          {busy ? 'Saving...' : title.trim() ? 'Add and continue' : 'Skip for now'}
        </PillButton>
      </ScrollView>
    </View>
  );
}
