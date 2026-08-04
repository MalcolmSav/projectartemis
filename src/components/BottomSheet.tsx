import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  View,
  ScrollView,
  ViewStyle,
  useWindowDimensions,
  KeyboardAvoidingView,
  Keyboard,
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
  /**
   * Rendered below the scrollable body and OUTSIDE it, so it stays put while the
   * content scrolls. Use it for anything that must remain reachable — above all
   * a message composer, which otherwise sits at the bottom of a long scroll
   * where the keyboard covers it.
   */
  footer?: React.ReactNode;
  /**
   * Fired once the close animation has finished AND the underlying Modal has
   * unmounted. Use this to chain anything that presents another Modal — iOS
   * cannot present a modal while another is still dismissing (it fails
   * silently and can leave an invisible view swallowing all touches).
   */
  onClosed?: () => void;
}

/**
 * How much of the keyboard's height the sheet actually has to dodge on iOS.
 * The sheet already reserves paddingBottom for the home indicator, so lifting by
 * the full keyboard height leaves a visible gap under the composer.
 */
const IOS_KEYBOARD_INSET_SLACK = 12;

/** Keyboard height in points, tracked only where we have to move things ourselves. */
function useKeyboardHeight() {
  const [height, setHeight] = React.useState(0);

  useEffect(() => {
    // Android is configured with softwareKeyboardLayoutMode "resize" (app.json),
    // so the window itself shrinks and there is nothing for us to offset.
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

export function BottomSheet({ visible, onClose, children, maxHeight, footer, onClosed }: Props) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  const lift = keyboard > 0 ? Math.max(0, keyboard - IOS_KEYBOARD_INSET_SLACK) : 0;
  // Cap against the space that is actually left once the keyboard is up.
  // Without this a tall sheet keeps its full height, is pushed up by `lift`, and
  // its footer ends up off the top — or, unlifted, behind the keyboard.
  const cap = Math.min(maxHeight ?? Math.round(height * 0.86), Math.round(height * 0.94) - lift);

  const v = useSharedValue(0);
  const [internalVisible, setInternalVisible] = React.useState(visible);

  // Keep the latest callback without re-running the animation effect.
  const onClosedRef = React.useRef(onClosed);
  onClosedRef.current = onClosed;
  // Guards against firing onClosed on mount when visible starts false.
  const wasOpenRef = React.useRef(visible);

  const finishClose = React.useCallback(() => {
    setInternalVisible(false);
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      onClosedRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (visible) {
      wasOpenRef.current = true;
      setInternalVisible(true);
      v.value = withTiming(1, { duration: t.motion.bottomSheet, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    } else {
      v.value = withTiming(
        0,
        { duration: t.motion.bottomSheet, easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
        (done) => {
          if (done) runOnJS(finishClose)();
        },
      );
    }
  }, [visible, t.motion.bottomSheet, v, finishClose]);

  // Dismissing the sheet must not leave the keyboard hanging over the screen
  // behind it — the next sheet would open into a shrunken viewport.
  const close = React.useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: v.value * 0.5 }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - v.value) * 600 }],
  }));

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView
        // iOS is handled by `lift` below: KeyboardAvoidingView measures its own
        // frame against the window, which it cannot do correctly inside a Modal,
        // and quietly left composers under the keyboard.
        behavior={Platform.OS === 'ios' ? undefined : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable style={{ position: 'absolute', inset: 0 } as ViewStyle} onPress={close}>
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
              marginBottom: lift,
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
          <ScrollView
            style={{ flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={{ flexShrink: 0 }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
