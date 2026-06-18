import React, { useEffect } from 'react';
import { View, Pressable, Vibration } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components';
import { IconPhone } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../state/AppState';
import { useT } from '../i18n';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FakeCallIncomingScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { fakeCallCallerName } = useAppState();
  const callerName = fakeCallCallerName.trim() || tr('Mom');
  const initial = callerName.charAt(0).toUpperCase() || '?';

  // Subtle pulse on the avatar ring like iOS
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 800, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.35 + (pulse.value - 1) * 2,
  }));

  // Ring with a repeating vibration pattern (vibrate 800ms, pause 1200ms)
  useEffect(() => {
    Vibration.vibrate([0, 800, 1200], true);
    return () => Vibration.cancel();
  }, []);

  const decline = () => {
    Vibration.cancel();
    nav.goBack();
  };

  const accept = () => {
    Vibration.cancel();
    nav.replace('FakeCallOnCall');
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'space-between',
        paddingTop: insets.top + 48,
        paddingBottom: insets.bottom + 40,
      }}
    >
      {/* Caller info — top portion */}
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 13,
            letterSpacing: 0.3,
            marginBottom: 20,
          }}
        >
          {tr('incoming call · mobil')}
        </Text>

        {/* Avatar with pulse ring */}
        <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                width: 148,
                height: 148,
                borderRadius: 74,
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.25)',
              },
              pulseStyle,
            ]}
          />
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

        {/* Name */}
        <Text
          style={{
            fontFamily: t.type.display,
            fontSize: 38,
            lineHeight: 46,
            color: '#fff',
            textAlign: 'center',
            paddingHorizontal: 24,
          }}
        >
          {callerName}
        </Text>
      </View>

      {/* Bottom action buttons */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingHorizontal: 40,
        }}
      >
        {/* Decline */}
        <View style={{ alignItems: 'center', gap: 16 }}>
          <Pressable
            onPress={decline}
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
            {tr('Decline')}
          </Text>
        </View>

        {/* Accept */}
        <View style={{ alignItems: 'center', gap: 16 }}>
          <Pressable
            onPress={accept}
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: '#34C759',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconPhone size={28} color="#fff" />
          </Pressable>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: t.type.body }}>
            {tr('Accept')}
          </Text>
        </View>
      </View>
    </View>
  );
}
