import React from 'react';
import { View, ViewProps, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface Props extends ViewProps {
  variant?: 'card' | 'inner' | 'moonlight';
  padding?: number;
  radius?: 'sm' | 'md' | 'lg';
  shadow?: 'soft' | 'card' | 'pop' | 'none';
  style?: ViewStyle | ViewStyle[];
}

export function Card({
  variant = 'card',
  padding,
  radius = 'lg',
  shadow = 'card',
  style,
  children,
  ...rest
}: Props) {
  const t = useTheme();
  const bg =
    variant === 'moonlight' ? t.colors.moonlight : variant === 'inner' ? t.colors.parchment : t.colors.parchment;

  const shadowStyle = shadow === 'none' ? undefined : t.shadows[shadow];

  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: t.radii[radius],
          padding: padding ?? t.spacing.cardPad,
        },
        shadowStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
});
