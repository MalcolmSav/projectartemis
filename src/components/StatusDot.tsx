import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

export type Status = 'ok' | 'warn' | 'alarm';

interface Props {
  status: Status;
  size?: number;
  ringColor?: string;
  style?: ViewStyle;
}

export function StatusDot({ status, size = 10, ringColor, style }: Props) {
  const t = useTheme();
  const color =
    status === 'ok' ? t.colors.statusOk : status === 'warn' ? t.colors.statusWarn : t.colors.statusAlarm;
  const ring = ringColor ?? t.colors.parchment;

  const halo = useSharedValue(0);

  useEffect(() => {
    if (status !== 'alarm') return;
    halo.value = withRepeat(
      withTiming(1, { duration: t.motion.alarmPulse, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(halo);
  }, [status, halo, t.motion.alarmPulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.55 - halo.value * 0.55,
    transform: [{ scale: 1 + halo.value * 0.9 }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          // ring approximates "0 0 0 3px parchment"
          borderWidth: 3,
          borderColor: ring,
        },
        style,
      ]}
    >
      {status === 'alarm' && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: -size / 2,
              top: -size / 2,
              width: size * 2,
              height: size * 2,
              borderRadius: size,
              backgroundColor: color,
            },
            haloStyle,
          ]}
        />
      )}
    </Animated.View>
  );
}
