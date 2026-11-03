import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow, type } from '../theme';
import type { TravelMode } from '../types';
import { Tap } from './Tap';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function IconButton({
  icon,
  onPress,
  variant = 'light',
  size = 44,
  busy,
  label,
  iconSize,
}: {
  icon: IconName;
  onPress?: () => void;
  variant?: 'light' | 'dark' | 'coral' | 'ghost' | 'glass';
  size?: number;
  busy?: boolean;
  label: string;
  iconSize?: number;
}) {
  const palette = {
    light: { background: colors.surface, color: colors.ink, border: colors.line },
    dark: { background: colors.navInkSoft, color: colors.white, border: 'rgba(255,255,255,0.12)' },
    coral: { background: colors.coral, color: colors.white, border: colors.coral },
    ghost: { background: 'transparent', color: colors.ink, border: 'transparent' },
    glass: { background: 'rgba(250,251,245,0.92)', color: colors.ink, border: 'rgba(255,255,255,0.8)' },
  }[variant];

  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        variant === 'light' || variant === 'glass' ? shadow.tiny : null,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={palette.color} />
      ) : (
        <Ionicons name={icon} size={iconSize ?? Math.round(size * 0.45)} color={palette.color} />
      )}
    </Tap>
  );
}

export function ModeSwitch({
  value,
  onChange,
  variant = 'light',
}: {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
  variant?: 'light' | 'dark';
}) {
  const dark = variant === 'dark';
  const options: Array<{ key: TravelMode; label: string; icon: IconName }> = [
    { key: 'riding', label: 'Ride', icon: 'bicycle' },
    { key: 'walking', label: 'Walk', icon: 'walk' },
  ];
  return (
    <View
      style={[
        styles.modeSwitch,
        { backgroundColor: dark ? 'rgba(255,255,255,0.07)' : colors.surfaceAlt, borderColor: dark ? 'rgba(255,255,255,0.1)' : colors.line },
      ]}
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Tap
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.key)}
            style={[
              styles.modeOption,
              selected && {
                backgroundColor: dark ? 'rgba(255,255,255,0.13)' : colors.surface,
                shadowColor: '#17312E',
                shadowOpacity: dark ? 0 : 0.08,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 2 },
                elevation: dark ? 0 : 2,
              },
            ]}
          >
            <Ionicons
              name={option.icon}
              size={15}
              color={selected ? (dark ? colors.white : colors.coral) : dark ? 'rgba(255,255,255,0.55)' : colors.muted}
            />
            <Text
              style={[
                styles.modeText,
                { color: selected ? (dark ? colors.white : colors.ink) : dark ? 'rgba(255,255,255,0.55)' : colors.muted },
              ]}
            >
              {option.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

export function Kicker({ children, color = colors.teal }: { children: React.ReactNode; color?: string }) {
  return <Text style={[styles.kicker, { color }]}>{children}</Text>;
}

export function Divider({ style }: { style?: object }) {
  return <View style={[styles.divider, style]} />;
}

export function Pill({
  label,
  background = colors.mintSoft,
  color = colors.mint,
  icon,
}: {
  label: string;
  background?: string;
  color?: string;
  icon?: IconName;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeSwitch: {
    flexDirection: 'row',
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  modeOption: {
    minWidth: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  modeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  kicker: {
    ...type.kicker,
    fontSize: 9.5,
    letterSpacing: 1.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
