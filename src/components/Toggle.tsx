import React, { useEffect } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';

interface Props {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

const W = 46;
const H = 28;
const KNOB = 22;
const TRAVEL = W - KNOB - 6; // 18

export function Toggle({ on, onChange, disabled, style }: Props) {
  const t = useTheme();
  const v = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    v.value = withTiming(on ? 1 : 0, {
      duration: t.motion.toggle,
      easing: Easing.bezier(0.4, 0.2, 0.2, 1),
    });
  }, [on, v, t.motion.toggle]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [t.colors.forest100, t.colors.forest700]),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: v.value * TRAVEL }],
    backgroundColor: v.value > 0.5 ? palette.gold300 : t.colors.parchment,
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync().catch(() => {});
        onChange(!on);
      }}
      style={[{ width: W, height: H, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Animated.View
        style={[
          {
            width: W,
            height: H,
            borderRadius: 999,
          },
          trackStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 3,
            left: 3,
            width: KNOB,
            height: KNOB,
            borderRadius: 999,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: 1 },
            shadowRadius: 3,
            elevation: 2,
          },
          knobStyle,
        ]}
      />
    </Pressable>
  );
}
