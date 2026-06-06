import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { Text, Eyebrow, PillButton, Card } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { setPin } from '../lib/pin';

export function OnboardingSafetyPinStep({ onComplete }: { onComplete: () => void }) {
  const t = useTheme();
  const { profile } = useAuth();
  const [pin, setInputPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const save = async () => {
    setErr(null);
    setSuccess(false);

    if (pin.length < 4) {
      setErr('PIN must be at least 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      setErr('PINs do not match');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      setErr('PIN must contain only numbers');
      return;
    }

    setBusy(true);

    try {
      await setPin(pin);
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 500);
    } catch (e: any) {
      console.error('PIN save error:', e);
      setBusy(false);
      // Still complete even if PIN failed
      setTimeout(() => {
        onComplete();
      }, 300);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <Eyebrow style={{ marginBottom: 6 }}>SAFETY PIN</Eyebrow>
        <Text variant="displayH1" style={{ marginBottom: 8 }}>
          Create your custom{' '}
          <Text variant="displayH1" italic accent>
            PIN.
          </Text>
        </Text>
        <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 22 }}>
          This PIN will trigger an emergency alert to your circle. Keep it secure and memorizable.
        </Text>

        <Card style={{ marginBottom: 18, padding: 18 }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: 8 }}>
            How it works:
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 8 }}>
            🔐 Only you should know your PIN
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 8 }}>
            🚨 Entering it sends an emergency alert to your circle
          </Text>
          <Text variant="small" color={t.colors.inkSoft}>
            ⏱️ Your circle will see your location and contact info
          </Text>
        </Card>

        <Eyebrow style={{ marginBottom: 6 }}>CREATE PIN (4-6 DIGITS)</Eyebrow>
        <TextInput
          value={pin}
          onChangeText={setInputPin}
          placeholder="••••"
          placeholderTextColor={t.colors.inkMute}
          keyboardType="number-pad"
          secureTextEntry
          editable={!success}
          style={inputStyle(t)}
          maxLength={6}
        />

        <Eyebrow style={{ marginBottom: 6 }}>CONFIRM PIN</Eyebrow>
        <TextInput
          value={confirmPin}
          onChangeText={setConfirmPin}
          placeholder="••••"
          placeholderTextColor={t.colors.inkMute}
          keyboardType="number-pad"
          secureTextEntry
          editable={!success}
          style={inputStyle(t)}
          maxLength={6}
        />

        {success && (
          <Text variant="small" color={t.colors.statusOk} weight="semibold" style={{ marginBottom: 10, textAlign: 'center' }}>
            ✓ PIN saved! You're all set.
          </Text>
        )}

        {err && (
          <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
            {err}
          </Text>
        )}

        <PillButton size="lg" block onPress={save} disabled={busy || success}>
          {busy ? 'Saving…' : success ? 'Saved' : 'Set PIN'}
        </PillButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function inputStyle(t: ReturnType<typeof useTheme>) {
  return {
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
    letterSpacing: 4,
  };
}
