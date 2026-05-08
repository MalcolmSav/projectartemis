import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Text, Eyebrow } from '../components';
import { IconPhone } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';

function fmt(s: number) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const r = String(s % 60).padStart(2, '0');
  return `${m}:${r}`;
}

export function FakeCallOnCallScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <LinearGradient colors={['#000000', palette.forest900]} style={{ flex: 1, alignItems: 'center', paddingTop: 90 }}>
      <Eyebrow color={palette.gold300} style={{ marginBottom: 6 }}>
        ON CALL
      </Eyebrow>
      <Text style={{ fontFamily: t.type.display, fontSize: 36, color: '#fff' }}>Mamma</Text>
      <Text variant="small" color="rgba(255,255,255,0.7)" style={{ marginTop: 4 }}>
        {fmt(secs)}
      </Text>

      <LinearGradient
        colors={[palette.gold300, palette.gold500]}
        style={{
          width: 160,
          height: 160,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 50,
        }}
      >
        <Text style={{ fontFamily: t.type.display, fontSize: 64, color: palette.forest900 }}>M</Text>
      </LinearGradient>

      <View
        style={{
          marginTop: 28,
          backgroundColor: 'rgba(255,255,255,0.08)',
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 14,
          marginHorizontal: 22,
        }}
      >
        <Text variant="small" color="rgba(255,255,255,0.85)" style={{ textAlign: 'center' }}>
          🌙  This is a fake call. Pretend to talk for as long as you need.
        </Text>
      </View>

      <Pressable
        onPress={() => nav.goBack()}
        style={{
          position: 'absolute',
          bottom: 60,
          width: 70,
          height: 70,
          borderRadius: 999,
          backgroundColor: palette.crimson,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ transform: [{ rotate: '135deg' }] }}>
          <IconPhone size={26} color="#fff" />
        </View>
      </Pressable>
    </LinearGradient>
  );
}
