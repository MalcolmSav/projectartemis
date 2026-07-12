import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { ArtemisMark } from './icons';
import { Text } from './Text';
import { PillButton } from './PillButton';

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({ title, subtitle, actionLabel, onAction, style }: Props) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.08, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 }, style]}>
      <Animated.View style={[animStyle, { marginBottom: 20 }]}>
        <ArtemisMark size={48} moonColor={t.colors.forest700} />
      </Animated.View>
      <Text variant="body" weight="semibold" style={{ textAlign: 'center', marginBottom: 6 }}>
        {title}
      </Text>
      {subtitle && (
        <Text variant="small" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 20 }}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <PillButton size="md" onPress={onAction}>
          {actionLabel}
        </PillButton>
      )}
    </View>
  );
}
