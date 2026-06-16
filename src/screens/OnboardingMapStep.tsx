import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text, Eyebrow, PillButton, Card } from '../components';
import { useTheme } from '../theme/ThemeProvider';

export function OnboardingMapStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70, paddingBottom: 40 }}>
        <Eyebrow style={{ marginBottom: 6 }}>THE MAP</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8 }}>
          Let your circle know{' '}
          <Text variant="displayH1" italic accent>where you're at.</Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 28 }}>
          Turn on location sharing and your circle sees you in real time. No need to text "I'm here" — they already know.
        </Text>

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <Text style={{ fontSize: 26 }}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold" style={{ marginBottom: 4 }}>Share your location</Text>
              <Text variant="small" color={t.colors.inkSoft}>
                Toggle it on when you're heading out. Your circle sees you live on the map. Toggle off whenever — you're always in control.
              </Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <Text style={{ fontSize: 26 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold" style={{ marginBottom: 4 }}>Flag sketchy spots</Text>
              <Text variant="small" color={t.colors.inkSoft}>
                Somewhere that felt off? Tap the map and drop a report — bad lighting, uncomfortable situation, anything. Other users see flagged areas so they can stay aware.
              </Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <Text style={{ fontSize: 26 }}>👁️</Text>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold" style={{ marginBottom: 4 }}>You choose who sees you</Text>
              <Text variant="small" color={t.colors.inkSoft}>
                Only people in your circle can see your location — and only when you've turned sharing on.
              </Text>
            </View>
          </View>
        </Card>

        <PillButton size="lg" block onPress={onComplete}>Got it</PillButton>
      </ScrollView>
    </View>
  );
}
