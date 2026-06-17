import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Text } from './Text';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { palette } from '../theme/tokens';

/**
 * Thin banner pinned to the top of the screen when the device is offline.
 * Rendered once globally above the navigator.
 */
export function OfflineBanner() {
  const online = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const v = useSharedValue(0);

  React.useEffect(() => {
    v.value = withTiming(online ? 0 : 1, { duration: 220 });
  }, [online, v]);

  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * -8 }],
  }));

  if (online) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 6,
          paddingBottom: 8,
          alignItems: 'center',
          backgroundColor: palette.crimson,
          zIndex: 9999,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: '#fff', fontSize: 13 }}>⚠️</Text>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
          No connection — live updates paused
        </Text>
      </View>
    </Animated.View>
  );
}
