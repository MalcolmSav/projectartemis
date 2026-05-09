import React, { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow } from '../components';
import { IconPhone } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../state/AppState';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FakeCallIncomingScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { fakeCallCallerName } = useAppState();
  const initial = fakeCallCallerName.trim().charAt(0).toUpperCase() || '?';

  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = withRepeat(withTiming(1, { duration: t.motion.callRing, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [ring, t.motion.callRing]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.4 - ring.value * 0.4,
    transform: [{ scale: 1 + ring.value * 0.4 }],
  }));

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000000', palette.forest900]} style={{ flex: 1, alignItems: 'center', paddingTop: 90 }}>
        <Eyebrow color="rgba(255,255,255,0.6)" style={{ marginBottom: 6 }}>
          INCOMING CALL
        </Eyebrow>
        <Text style={{ fontFamily: t.type.display, fontSize: 36, color: '#fff' }}>{fakeCallCallerName}</Text>
        <Text variant="small" color="rgba(255,255,255,0.6)" style={{ marginTop: 4 }}>
          mobil
        </Text>

        <View style={{ marginTop: 50, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                width: 220,
                height: 220,
                borderRadius: 999,
                backgroundColor: palette.gold500,
              },
              ringStyle,
            ]}
          />
          <LinearGradient
            colors={[palette.gold300, palette.gold500]}
            style={{
              width: 160,
              height: 160,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: t.type.display, fontSize: 64, color: palette.forest900 }}>
              {initial}
            </Text>
          </LinearGradient>
        </View>

        <View
          style={{
            position: 'absolute',
            bottom: 60,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'space-around',
          }}
        >
          <Pressable
            onPress={() => nav.goBack()}
            style={{
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
          <Pressable
            onPress={() => nav.replace('FakeCallOnCall')}
            style={{
              width: 70,
              height: 70,
              borderRadius: 999,
              backgroundColor: '#34C759',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconPhone size={26} color="#fff" />
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}
