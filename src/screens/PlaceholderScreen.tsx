import React from 'react';
import { View } from 'react-native';
import { TopBar, Text } from '../components';
import { useTheme } from '../theme/ThemeProvider';

export function PlaceholderScreen({ title }: { title: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <TopBar />
      <View style={{ paddingHorizontal: t.spacing.pageH, paddingTop: 8 }}>
        <Text variant="displayH1">
          My{' '}
          <Text variant="displayH1" italic accent>
            {title.toLowerCase()}
          </Text>
        </Text>
      </View>
    </View>
  );
}
