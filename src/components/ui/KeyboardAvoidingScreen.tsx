import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KeyboardAvoidingScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps a screen's scrollable content so whatever's below the keyboard
 * (e.g. a Save button) stays reachable. On iOS, KeyboardAvoidingView's
 * "padding" behavior reliably pushes content up. Its Android "height"
 * behavior is a long-standing pain point — unreliable inside a ScrollView
 * in practice — so on Android this renders a plain View instead and relies
 * on generous scroll padding (see useKeyboardBottomPadding below) so the
 * user can always scroll the rest of the content above the keyboard.
 */
export function KeyboardAvoidingScreen({ children, style }: KeyboardAvoidingScreenProps) {
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={[styles.container, style]} behavior="padding">
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <View style={[styles.container, style]}>{children}</View>;
}

/**
 * Bottom padding for a form's scrollable content so its last field/button
 * can always be scrolled above the on-screen keyboard. `base` is the
 * padding wanted with no keyboard open (e.g. matching a screen's normal
 * bottom spacing); a large fixed buffer is added on Android to cover a
 * typical keyboard height, since (per KeyboardAvoidingScreen above)
 * Android doesn't get automatic keyboard-aware resizing here.
 */
export function useKeyboardBottomPadding(base: number): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'android' ? base + 260 : base + insets.bottom;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
