import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View, TextInput } from 'react-native';
import { useAppState } from '../state/AppState';
import { USER } from '../data/demo';
import { useTheme } from '../theme/ThemeProvider';
import { Text, Eyebrow } from './Text';
import { PillButton } from './PillButton';
import { IconLock } from './icons';

export function PinModal() {
  const t = useTheme();
  const { pinAsk, clearPinAsk } = useAppState();
  const visible = !!pinAsk;
  const [val, setVal] = useState('');
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (visible) {
      setVal('');
      setErr(false);
    }
  }, [visible]);

  const submit = (next: string) => {
    if (next.length < 4) return;
    if (next === USER.pin) {
      const cb = pinAsk?.onOk;
      clearPinAsk();
      cb?.();
    } else {
      setErr(true);
      setVal('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={clearPinAsk} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <View
          style={[
            {
              width: '100%',
              maxWidth: 360,
              backgroundColor: t.colors.parchment,
              borderRadius: t.radii.lg,
              padding: 22,
            },
            t.shadows.pop,
          ]}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: t.colors.gold100,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <IconLock size={20} gold />
          </View>
          <Eyebrow>Safety PIN</Eyebrow>
          <Text variant="section" style={{ marginBottom: 4 }}>
            {pinAsk?.reason ?? 'Confirm with PIN'}
          </Text>
          <Text variant="bodyS" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
            Demo PIN is 4729. Sensitive actions never happen silently.
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            {[0, 1, 2, 3].map((i) => {
              const filled = val.length > i;
              return (
                <View
                  key={i}
                  style={{
                    width: 56,
                    height: 64,
                    borderRadius: t.radii.sm,
                    borderWidth: 1.5,
                    borderColor: err ? t.colors.crimson : filled ? t.colors.forest700 : t.colors.hairline,
                    backgroundColor: t.colors.moonlight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      backgroundColor: filled ? t.colors.forest700 : 'transparent',
                    }}
                  />
                </View>
              );
            })}
          </View>

          {/* Hidden input drives the dots */}
          <TextInput
            autoFocus
            keyboardType="number-pad"
            maxLength={4}
            value={val}
            onChangeText={(s) => {
              const clean = s.replace(/[^0-9]/g, '');
              setErr(false);
              setVal(clean);
              if (clean.length === 4) submit(clean);
            }}
            style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
          />

          {err && (
            <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 8 }}>
              Wrong PIN. Try again.
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PillButton variant="ghost" block onPress={clearPinAsk} style={{ flex: 1 }}>
              Cancel
            </PillButton>
          </View>
        </View>
        <Pressable onPress={clearPinAsk} style={{ position: 'absolute', inset: 0, zIndex: -1 } as any} />
      </View>
    </Modal>
  );
}
