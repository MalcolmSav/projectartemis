import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  View,
  ScrollView,
  ViewStyle,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
}

export function BottomSheet({ visible, onClose, children, maxHeight }: Props) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  const cap = maxHeight ?? Math.round(height * 0.86);

  const v = useSharedValue(0);
  const [internalVisible, setInternalVisible] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      v.value = withTiming(1, { duration: t.motion.bottomSheet, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    } else {
      v.value = withTiming(
        0,
        { duration: t.motion.bottomSheet, easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
        (done) => {
          if (done) runOnJS(setInternalVisible)(false);
        },
      );
    }
  }, [visible, t.motion.bottomSheet, v]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: v.value * 0.5 }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - v.value) * 600 }],
  }));

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable style={{ position: 'absolute', inset: 0 } as ViewStyle} onPress={onClose}>
          <Animated.View
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' }, overlayStyle]}
          />
        </Pressable>
        <Animated.View
          style={[
            {
              backgroundColor: t.colors.parchment,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 8,
              paddingHorizontal: t.spacing.pageH,
              paddingBottom: 24,
              maxHeight: cap,
            },
            t.shadows.pop,
            sheetStyle,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: t.colors.hairline,
              marginVertical: 8,
            }}
          />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
