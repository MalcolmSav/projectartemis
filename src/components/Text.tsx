import React from 'react';
import { Text as RNText, TextProps, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Variant = 'displayH1' | 'displayH2' | 'section' | 'large' | 'body' | 'bodyS' | 'small' | 'meta' | 'eyebrow';

interface Props extends TextProps {
  variant?: Variant;
  italic?: boolean;
  accent?: boolean; // gold on night, forest-700 on light — used for italic emphasis runs
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  style?: TextStyle | TextStyle[];
}

export function Text({ variant = 'body', italic, accent, color, weight, style, children, ...rest }: Props) {
  const t = useTheme();

  const fontFamily = (() => {
    if (variant === 'displayH1' || variant === 'displayH2' || variant === 'section') {
      return italic ? t.type.displayItalic : t.type.display;
    }
    switch (weight) {
      case 'medium':
        return t.type.bodyMedium;
      case 'semibold':
        return t.type.bodySemibold;
      case 'bold':
        return t.type.bodyBold;
      default:
        return t.type.body;
    }
  })();

  const base: TextStyle = {
    fontFamily,
    color: color ?? (accent ? (t.mode === 'night' ? t.colors.gold300 : t.colors.forest700) : t.colors.ink),
  };

  return (
    <RNText {...rest} style={[styles[variant], base, style]}>
      {children}
    </RNText>
  );
}

export function Eyebrow({ style, children, color, ...rest }: Omit<Props, 'variant'>) {
  const t = useTheme();
  return (
    <Text
      variant="eyebrow"
      weight="semibold"
      color={color ?? t.colors.inkMute}
      style={style}
      {...rest}
    >
      {String(children).toUpperCase()}
    </Text>
  );
}

// Display variants need extra line-height + a tiny top pad — Fraunces has tall
// ascenders that get cut off in fixed-line text containers without it.
const styles = StyleSheet.create({
  displayH1: { fontSize: 32, lineHeight: 40, letterSpacing: -0.4, paddingTop: 2, includeFontPadding: false as any },
  displayH2: { fontSize: 24, lineHeight: 32, paddingTop: 2, includeFontPadding: false as any },
  section: { fontSize: 22, lineHeight: 30, paddingTop: 2, includeFontPadding: false as any },
  large: { fontSize: 17, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  bodyS: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 13, lineHeight: 19 },
  meta: { fontSize: 12, lineHeight: 17 },
  eyebrow: { fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
});
