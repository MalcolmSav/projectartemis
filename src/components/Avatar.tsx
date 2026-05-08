import React from 'react';
import { View, Image, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { StatusDot, Status } from './StatusDot';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';

interface Props {
  name: string;
  size?: number;
  status?: Status;
  photoUri?: string | null;
  ring?: boolean;
  style?: ViewStyle;
}

export function Avatar({ name, size = 48, status, photoUri, ring, style }: Props) {
  const t = useTheme();
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const dotSize = Math.max(8, Math.round(size * 0.22));

  const ringWrap: ViewStyle = ring
    ? { padding: 4, borderRadius: 999, backgroundColor: palette.gold500 }
    : {};
  const innerRing: ViewStyle = ring
    ? { padding: 3, borderRadius: 999, backgroundColor: t.colors.parchment }
    : {};

  const inner = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.gold500,
      }}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: size, height: size }} />
      ) : (
        <LinearGradient
          colors={[palette.gold300, palette.gold500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={{
              fontFamily: t.type.display,
              fontSize: size * 0.42,
              lineHeight: size * 0.42 * 1.1,
              color: palette.forest900,
              textAlign: 'center',
              includeFontPadding: false as any,
            }}
          >
            {initial}
          </Text>
        </LinearGradient>
      )}
    </View>
  );

  const outerSize = ring ? size + 14 : size;
  return (
    <View style={[{ width: outerSize, height: outerSize, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={ringWrap}>
        <View style={innerRing}>{inner}</View>
      </View>
      {status && (
        <StatusDot
          status={status}
          size={dotSize}
          ringColor={t.colors.parchment}
          style={{ position: 'absolute', right: 0, bottom: 0 }}
        />
      )}
    </View>
  );
}
