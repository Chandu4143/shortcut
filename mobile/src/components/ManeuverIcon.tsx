import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import type { Maneuver } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function iconFor(maneuver: Maneuver | null): IconName {
  if (!maneuver) return 'arrow-up';
  if (maneuver.type === 'arrive') return 'flag';
  if (maneuver.type === 'roundabout') return 'sync';
  if (maneuver.type === 'merge') return 'git-merge';
  if (maneuver.type === 'fork') return 'git-branch';
  const modifier = maneuver.modifier?.toLowerCase() ?? '';
  if (modifier.includes('u-turn') || modifier === 'uturn') return 'return-down-back';
  if (modifier.includes('sharp left')) return 'arrow-undo';
  if (modifier.includes('sharp right')) return 'arrow-redo';
  if (modifier.includes('slight left') || modifier.includes('keep left') || modifier === 'left') {
    return modifier.includes('slight') ? 'return-up-back' : 'arrow-back';
  }
  if (modifier.includes('slight right') || modifier.includes('keep right') || modifier === 'right') {
    return modifier.includes('slight') ? 'return-up-forward' : 'arrow-forward';
  }
  if (maneuver.type === 'continue' || maneuver.type === 'depart') return 'arrow-up';
  return 'arrow-up';
}

export function maneuverIconName(maneuver: Maneuver | null): IconName {
  return iconFor(maneuver);
}

export function ManeuverIcon({
  maneuver,
  size = 22,
  color = colors.coral,
  background,
  containerSize,
}: {
  maneuver: Maneuver | null;
  size?: number;
  color?: string;
  background?: string;
  containerSize?: number;
}) {
  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize ?? size * 2,
          height: containerSize ?? size * 2,
          borderRadius: (containerSize ?? size * 2) / 2,
          backgroundColor: background ?? colors.coralSoft,
        },
      ]}
    >
      <Ionicons name={iconFor(maneuver)} size={size} color={color} />
    </View>
  );
}

export function ManeuverRow({ maneuver, distance }: { maneuver: Maneuver; distance: string }) {
  return (
    <View style={styles.row}>
      <ManeuverIcon maneuver={maneuver} size={17} containerSize={38} />
      <View style={styles.copy}>
        <Text style={styles.title}>{maneuver.instruction}</Text>
        {maneuver.detail ? (
          <Text style={styles.detail} numberOfLines={2}>
            {maneuver.detail}
          </Text>
        ) : null}
      </View>
      <Text style={styles.distance}>{distance}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  detail: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.muted,
  },
  distance: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.teal,
  },
});
