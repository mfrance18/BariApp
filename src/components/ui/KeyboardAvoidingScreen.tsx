import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface KeyboardAvoidingScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps a screen's scrollable content so the keyboard shrinks the visible
 * area instead of just overlaying it, keeping whatever's below an input
 * (e.g. a Save button) reachable by scrolling while the keyboard is open.
 */
export function KeyboardAvoidingScreen({ children, style }: KeyboardAvoidingScreenProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
