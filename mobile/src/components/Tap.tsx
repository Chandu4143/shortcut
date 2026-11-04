import React, { useRef } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TapProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: 'selection' | 'light' | 'medium' | 'none';
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'radio';
  accessibilityState?: { selected?: boolean; disabled?: boolean; busy?: boolean };
}

/** Pressable with a subtle spring and optional haptic — used across the app. */
export function Tap({
  children,
  onPress,
  style,
  disabled,
  haptic = 'selection',
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: TapProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, ...accessibilityState }}
      disabled={disabled}
      onPress={() => {
        if (haptic !== 'none') {
          const promise =
            haptic === 'medium'
              ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              : haptic === 'light'
                ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                : Haptics.selectionAsync();
          promise.catch(() => undefined);
        }
        onPress?.();
      }}
      onPressIn={() => spring(0.97)}
      onPressOut={() => spring(1)}
      style={[style, { transform: [{ scale }], opacity: disabled ? 0.7 : 1 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export const pressStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
