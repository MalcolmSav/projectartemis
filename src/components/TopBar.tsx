import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtemisMark } from './icons';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export function TopBar({ left, right, style }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const moonColor = t.mode === 'night' ? t.colors.gold300 : t.colors.forest700;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: t.spacing.pageH,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 8,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {left ?? (
          <>
            <ArtemisMark size={26} moonColor={moonColor} />
            <Text variant="large" weight="semibold" style={{ color: t.colors.ink }}>
              Artemis
            </Text>
          </>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{right}</View>
    </View>
  );
}
