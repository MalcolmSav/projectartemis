import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components';
import { IconPhone } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../state/AppState';
import { palette } from '../theme/tokens';
import Svg, { Path, Line } from 'react-native-svg';

function fmt(s: number) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const r = String(s % 60).padStart(2, '0');
  return `${m}:${r}`;
}

function IconMic({ muted, size = 24 }: { muted: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M19 11a7 7 0 0 1-14 0M12 18v4M8 22h8" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
      {muted && <Line x1="4" y1="4" x2="20" y2="20" stroke={palette.crimson} strokeWidth={2} strokeLinecap="round" />}
    </Svg>
  );
}

function IconSpeaker({ on, size = 24 }: { on: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 5L6 9H2v6h4l5 4V5z" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {on ? (
        <>
          <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
        </>
      ) : (
        <Path d="M23 9l-6 6M17 9l6 6" stroke={palette.crimson} strokeWidth={1.6} strokeLinecap="round" />
      )}
    </Svg>
  );
}

export function FakeCallOnCallScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { fakeCallCallerName } = useAppState();
  const initial = fakeCallCallerName.trim().charAt(0).toUpperCase() || '?';
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const controlBtn = (onPress: () => void, active: boolean, children: React.ReactNode, label: string) => (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={onPress}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Pressable>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: t.type.body }}>
        {label}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'space-between',
        paddingTop: insets.top + 44,
        paddingBottom: insets.bottom + 40,
      }}
    >
      {/* Caller info — top */}
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 13,
            letterSpacing: 0.3,
            marginBottom: 4,
          }}
        >
          {fmt(secs)}
        </Text>

        <Text
          style={{
            fontFamily: t.type.display,
            fontSize: 38,
            lineHeight: 46,
            color: '#fff',
            textAlign: 'center',
            paddingHorizontal: 24,
            marginBottom: 32,
          }}
        >
          {fakeCallCallerName}
        </Text>

        <LinearGradient
          colors={[palette.gold300, palette.gold500]}
          style={{
            width: 128,
            height: 128,
            borderRadius: 64,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: t.type.display,
              fontSize: 54,
              lineHeight: 128,
              width: 128,
              height: 128,
              color: palette.forest900,
              textAlign: 'center',
              textAlignVertical: 'center' as any,
              includeFontPadding: false as any,
            }}
          >
            {initial}
          </Text>
        </LinearGradient>
      </View>

      {/* Bottom: controls + end call */}
      <View style={{ alignItems: 'center', gap: 36 }}>
        {/* Control buttons */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 56,
          }}
        >
          {controlBtn(() => setMuted((m) => !m), muted, <IconMic muted={muted} size={22} />, muted ? 'Unmute' : 'Mute')}
          {controlBtn(() => setSpeaker((s) => !s), speaker, <IconSpeaker on={speaker} size={22} />, speaker ? 'Speaker on' : 'Speaker')}
        </View>

        {/* End call button */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: '#FF3B30',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ transform: [{ rotate: '135deg' }] }}>
              <IconPhone size={28} color="#fff" />
            </View>
          </Pressable>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: t.type.body }}>
            End
          </Text>
        </View>
      </View>
    </View>
  );
}
