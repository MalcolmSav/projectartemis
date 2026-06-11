import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text, Eyebrow, PillButton, Card } from '../components';
import { useTheme } from '../theme/ThemeProvider';

export function OnboardingWellnessStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }}>
        <Eyebrow style={{ marginBottom: 6 }}>WELLNESS CHECKS</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8 }}>
          A quick way to ask,{' '}
          <Text variant="displayH1" italic accent>
            are you okay?
          </Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 22 }}>
          People in your circle can send a wellness check when they are worried about you. It is meant for moments when
          you are late, unusually quiet, or somewhere that feels uncertain.
        </Text>

        <Card style={{ marginBottom: 16, paddingVertical: 20, paddingHorizontal: 16 }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 12 }}>
            How it works:
          </Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>1.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                A circle member sends you a check when they want to make sure you are safe.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>2.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                You can answer that you are okay, ask for help, or escalate if something is wrong.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text variant="body" color={t.colors.gold700} style={{ minWidth: 24 }}>3.</Text>
              <Text variant="body" color={t.colors.inkSoft} style={{ flex: 1 }}>
                If you do not respond, Artemis can treat that as a reason to follow up more urgently.
              </Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 24, paddingVertical: 20, paddingHorizontal: 16 }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 8 }}>
            Circle versus emergency contacts
          </Text>
          <Text variant="small" color={t.colors.inkSoft}>
            Your circle uses Artemis features with you. Emergency contacts are outside contacts others can reach when
            you are unavailable.
          </Text>
        </Card>

        <PillButton size="lg" block onPress={onComplete}>
          Got it
        </PillButton>
      </ScrollView>
    </View>
  );
}
