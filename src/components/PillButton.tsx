import React from 'react';
import { Pressable, View, ViewStyle, GestureResponderEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

function isTextish(n: React.ReactNode): boolean {
  if (n == null || typeof n === 'boolean') return false;
  if (typeof n === 'string' || typeof n === 'number') return true;
  if (Array.isArray(n)) return n.every((c) => c == null || typeof c === 'boolean' || typeof c === 'string' || typeof c === 'number');
  return false;
}

interface Props {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: ViewStyle;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}

export function PillButton({
  variant = 'primary',
  size = 'md',
  block,
  onPress,
  disabled,
  style,
  iconLeft,
  iconRight,
  children,
  accessibilityLabel,
}: Props) {
  const t = useTheme();
  const scale = useSharedValue(1);

  const padV = size === 'lg' ? t.layout.pillButtonLgPadV : t.layout.pillButtonPadV;
  const padH = size === 'lg' ? t.layout.pillButtonLgPadH : t.layout.pillButtonPadH;

  const onPressIn = () => {
    scale.value = withTiming(0.97, { duration: t.motion.buttonPress, easing: Easing.out(Easing.ease) });
  };
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: t.motion.buttonPress, easing: Easing.out(Easing.ease) });
  };

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const textColor =
    variant === 'primary'
      ? palette.gold300
      : variant === 'danger'
        ? '#FFFFFF'
        : variant === 'secondary'
          ? t.mode === 'night'
            ? t.colors.gold300
            : t.colors.forest700
          : t.colors.inkSoft;

  const innerLayout: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: padV,
    paddingHorizontal: padH,
    borderRadius: 999,
    width: block ? '100%' : undefined,
  };

  const wrapShadow: ViewStyle =
    variant === 'primary'
      ? { ...t.shadows.primaryBtn }
      : variant === 'danger'
        ? { ...t.shadows.dangerBtn }
        : variant === 'secondary'
          ? { ...t.shadows.soft }
          : {};

  const inner = (
    <>
      {iconLeft}
      {isTextish(children) ? (
        <Text weight="semibold" style={{ color: textColor, fontSize: size === 'lg' ? 16 : 15 }}>
          {children}
        </Text>
      ) : (
        children
      )}
      {iconRight}
    </>
  );

  let body: React.ReactNode;
  switch (variant) {
    case 'primary':
      body = (
        <LinearGradient
          colors={[t.colors.forest700, t.colors.forest900]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={innerLayout}
        >
          {inner}
        </LinearGradient>
      );
      break;
    case 'danger':
      body = <View style={[innerLayout, { backgroundColor: t.colors.crimson }]}>{inner}</View>;
      break;
    case 'secondary':
      body = (
        <View
          style={[
            innerLayout,
            { backgroundColor: t.colors.parchment, borderWidth: 1, borderColor: t.colors.hairline },
          ]}
        >
          {inner}
        </View>
      );
      break;
    case 'ghost':
    default:
      body = <View style={[innerLayout, { backgroundColor: 'transparent' }]}>{inner}</View>;
  }

  return (
    <Animated.View
      style={[
        { width: block ? '100%' : undefined, borderRadius: 999 },
        wrapShadow,
        animStyle,
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={{ borderRadius: 999, opacity: disabled ? 0.6 : 1 }}
      >
        {body}
      </Pressable>
    </Animated.View>
  );
}
