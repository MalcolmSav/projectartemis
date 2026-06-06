import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, Eyebrow, PillButton, Card, Divider } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { supabase } from '../lib/supabase';

type CheckInSchedule = {
  day: string;
  time: string;
  enabled: boolean;
};

export function OnboardingCheckInsStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [schedules, setSchedules] = useState<CheckInSchedule[]>([
    { day: 'Monday', time: '08:00', enabled: false },
    { day: 'Tuesday', time: '08:00', enabled: false },
    { day: 'Wednesday', time: '08:00', enabled: false },
    { day: 'Thursday', time: '08:00', enabled: false },
    { day: 'Friday', time: '08:00', enabled: false },
    { day: 'Saturday', time: '10:00', enabled: false },
    { day: 'Sunday', time: '10:00', enabled: false },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleDay = (index: number) => {
    const updated = [...schedules];
    updated[index].enabled = !updated[index].enabled;
    setSchedules(updated);
  };

  const save = async () => {
    if (!profile) return;
    setBusy(true);
    setErr(null);

    try {
      // Save enabled schedules
      const enabledSchedules = schedules.filter(s => s.enabled);
      
      if (enabledSchedules.length > 0) {
        const { error } = await supabase
          .from('check_in_schedules')
          .insert(
            enabledSchedules.map(s => ({
              user_id: profile.id,
              day_of_week: s.day.toLowerCase(),
              time: s.time,
            }))
          );

        if (error) {
          console.error('Check-in schedule error:', error);
        } else {
          await refreshProfile();
        }
      }
    } catch (e: any) {
      console.error('Save error:', e);
    }

    setBusy(false);
    onComplete();
  };

  const enabledCount = schedules.filter(s => s.enabled).length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <Eyebrow style={{ marginBottom: 6 }}>REGULAR CHECK-INS</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8 }}>
          Schedule automatic{' '}
          <Text variant="displayH1" italic accent>
            check-ins.
          </Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 22 }}>
          Set days and times when you want to check in with your circle. They'll know you're safe automatically.
        </Text>

        {enabledCount > 0 && (
          <Text variant="small" color={t.colors.statusOk} weight="semibold" style={{ marginBottom: 12 }}>
            ✓ {enabledCount} check-in{enabledCount !== 1 ? 's' : ''} scheduled
          </Text>
        )}

        <Card>
          {schedules.map((schedule, i) => (
            <View key={schedule.day}>
              <Pressable
                onPress={() => toggleDay(i)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold">
                    {schedule.day}
                  </Text>
                  <Text variant="small" color={t.colors.inkMute}>
                    {schedule.time}
                  </Text>
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: schedule.enabled ? t.colors.statusOk : t.colors.hairline,
                    backgroundColor: schedule.enabled ? t.colors.statusOk : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {schedule.enabled && (
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                  )}
                </View>
              </Pressable>
              {i < schedules.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        <Text variant="small" color={t.colors.inkMute} style={{ marginTop: 16, marginBottom: 22 }}>
          Tap any day to add or remove it from your check-in schedule. You can customize times in Settings later.
        </Text>

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block onPress={save} disabled={busy}>
          {busy ? 'Saving…' : enabledCount > 0 ? 'Enable Check-Ins' : 'Skip for Now'}
        </PillButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
