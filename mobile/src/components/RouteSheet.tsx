import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistance, formatDuration, formatSaved, shortLabel } from '../lib/format';
import { colors, fonts, radius, shadow } from '../theme';
import type { RoutePair, TravelMode } from '../types';
import { Kicker, Pill } from './Controls';
import { Sheet } from './Sheet';
import { Tap } from './Tap';

interface RouteSheetProps {
  routes: RoutePair;
  mode: TravelMode;
  message: string;
  onStart: () => void;
  onDetails: () => void;
  onChange: () => void;
  onDismiss: () => void;
}

function distanceParts(meters: number): { value: string; unit: string } {
  if (meters < 1000) {
    return { value: String(Math.max(10, Math.round(meters / 10) * 10)), unit: 'm' };
  }
  return {
    value: (meters / 1000).toFixed(meters < 10_000 ? 1 : 0),
    unit: 'km',
  };
}

export function RouteSheet({
  routes,
  mode,
  message,
  onStart,
  onDetails,
  onChange,
  onDismiss,
}: RouteSheetProps) {
  const insets = useSafeAreaInsets();
  const shortest = routes.shortest;
  const fastest = routes.fastest;
  const saved = Math.max(0, fastest.distanceMeters - shortest.distanceMeters);
  const savedPercent =
    fastest.distanceMeters > 0 ? Math.round((saved / fastest.distanceMeters) * 100) : 0;
  const hasSaving = saved >= 25;
  const parts = distanceParts(shortest.distanceMeters);
  const maxDistance = Math.max(shortest.distanceMeters, fastest.distanceMeters, 1);
  const warnings = shortest.warnings.slice(0, 2);
  const sourceLabel = routes.source === 'valhalla' ? 'Valhalla · OSM data' : 'Live OSM street graph';

  return (
    <Sheet style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Kicker>The short cut</Kicker>
            <View style={styles.headerDot} />
            <Text style={styles.headerMode}>{mode === 'riding' ? 'Ride' : 'Walk'}</Text>
          </View>
          <Tap
            style={styles.closeButton}
            onPress={onDismiss}
            haptic="light"
            accessibilityLabel="Close route"
          >
            <Ionicons name="close" size={17} color={colors.muted} />
          </Tap>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.distanceBlock}>
            <Text style={styles.distanceValue}>
              {parts.value}
              <Text style={styles.distanceUnit}> {parts.unit}</Text>
            </Text>
            <Text style={styles.distanceCaption}>least mapped distance</Text>
          </View>
          <View style={styles.timeCard}>
            <View style={styles.timeIcon}>
              <Ionicons name="time-outline" size={15} color={colors.teal} />
            </View>
            <Text style={styles.timeValue}>{formatDuration(shortest.durationSeconds)}</Text>
            <Text style={styles.timeCaption}>estimated</Text>
          </View>
        </View>

        <View style={styles.destinationRow}>
          <Ionicons name="flag" size={12} color={colors.coral} />
          <Text style={styles.destinationText} numberOfLines={1}>
            {shortLabel(
              routes.source === 'valhalla' ? 'Shortest usable route' : 'Shortest route from map data',
              2,
            )}
          </Text>
          <Pill label={sourceLabel} background={colors.surfaceAlt} color={colors.muted} />
        </View>

        <View style={styles.compareCard}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareTitle}>Shortest vs fastest</Text>
            {hasSaving ? (
              <Pill
                label={`${savedPercent}% shorter`}
                background={colors.mintSoft}
                color={colors.mint}
                icon="trending-down"
              />
            ) : (
              <Pill label="Already optimal" background={colors.mintSoft} color={colors.mint} icon="checkmark" />
            )}
          </View>

          <View style={styles.barRow}>
            <View style={styles.barLabels}>
              <View style={styles.barName}>
                <View style={[styles.legendDot, { backgroundColor: colors.coral }]} />
                <Text style={styles.barNameText}>Short Cut</Text>
              </View>
              <Text style={styles.barValue}>{formatDistance(shortest.distanceMeters)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  styles.barFillCoral,
                  { width: `${Math.max(8, (shortest.distanceMeters / maxDistance) * 100)}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.barRow}>
            <View style={styles.barLabels}>
              <View style={styles.barName}>
                <View style={[styles.legendDot, { backgroundColor: colors.mutedLight }]} />
                <Text style={styles.barNameText}>Fastest alternative</Text>
              </View>
              <Text style={styles.barValue}>{formatDistance(fastest.distanceMeters)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  styles.barFillSlate,
                  { width: `${Math.max(8, (fastest.distanceMeters / maxDistance) * 100)}%` },
                ]}
              />
            </View>
          </View>

          <View style={[styles.savingRow, !hasSaving && styles.savingRowMuted]}>
            <View style={[styles.savingIcon, !hasSaving && styles.savingIconMuted]}>
              <Ionicons
                name={hasSaving ? 'git-compare-outline' : 'checkmark-circle-outline'}
                size={15}
                color={hasSaving ? colors.mint : colors.teal}
              />
            </View>
            <View style={styles.savingCopy}>
              <Text style={[styles.savingValue, !hasSaving && styles.savingValueMuted]}>
                {hasSaving ? `You save ${formatSaved(saved)}` : 'No shorter mapped route found'}
              </Text>
              <Text style={styles.savingDetail}>
                {hasSaving
                  ? `${formatDuration(fastest.durationSeconds)} on the fastest route · ${formatPercent(
                      shortest.durationSeconds,
                      fastest.durationSeconds,
                    )}`
                  : 'This route is both the shortest and quickest option.'}
              </Text>
            </View>
          </View>
        </View>

        {warnings.length ? (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle" size={16} color={colors.amber} />
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Road notes</Text>
              {warnings.map((warning) => (
                <Text key={warning} style={styles.warningText}>
                  {warning}
                </Text>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.clearRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.teal} />
            <Text style={styles.clearText}>
              Mapped one-way and access restrictions are applied.
            </Text>
          </View>
        )}

        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </ScrollView>

      <View style={styles.actions}>
        <Tap style={styles.cta} onPress={onStart} haptic="medium" accessibilityLabel="Start navigation">
          <Ionicons name="navigate" size={18} color={colors.white} />
          <Text style={styles.ctaText}>Start navigation</Text>
          <View style={styles.ctaArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.coral} />
          </View>
        </Tap>
        <Tap
          style={styles.detailsButton}
          onPress={onDetails}
          haptic="light"
          accessibilityLabel="Route details"
        >
          <Ionicons name="list" size={19} color={colors.ink} />
        </Tap>
      </View>

      <View style={styles.footer}>
        <Tap haptic="none" onPress={onChange} accessibilityLabel="Change destination">
          <Text style={styles.footerLink}>Change destination</Text>
        </Tap>
        <Tap
          haptic="none"
          onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}
          accessibilityLabel="Open map data attribution"
        >
          <Text style={styles.footerMuted}>© OpenStreetMap</Text>
        </Tap>
      </View>
    </Sheet>
  );
}

function formatPercent(shortestSeconds: number, fastestSeconds: number): string {
  const delta = Math.round((fastestSeconds - shortestSeconds) / 60);
  if (delta >= 1) return `${delta} min slower`;
  if (delta <= -1) return `${Math.abs(delta)} min faster`;
  return 'about the same time';
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
  },
  scroll: {
    paddingBottom: 8,
  },
  scrollView: {
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  headerMode: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.3,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  distanceBlock: {
    flex: 1,
  },
  distanceValue: {
    fontFamily: fonts.displayBold,
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: -3.2,
    color: colors.ink,
  },
  distanceUnit: {
    fontFamily: fonts.display,
    fontSize: 25,
    letterSpacing: -1,
    color: colors.inkSoft,
  },
  distanceCaption: {
    marginTop: -2,
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.1,
  },
  timeCard: {
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(43,105,104,0.14)',
    alignItems: 'flex-start',
  },
  timeIcon: {
    marginBottom: 4,
  },
  timeValue: {
    fontFamily: fonts.displaySemibold,
    fontSize: 20,
    letterSpacing: -0.6,
    color: colors.teal,
  },
  timeCaption: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: colors.teal,
    opacity: 0.68,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 14,
  },
  destinationText: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
  },
  compareCard: {
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadow.tiny,
  },
  compareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  compareTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.2,
    color: colors.ink,
  },
  barRow: {
    marginBottom: 10,
  },
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  barName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  barNameText: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  barValue: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: colors.ink,
  },
  barTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barFillCoral: {
    backgroundColor: colors.coral,
  },
  barFillSlate: {
    backgroundColor: colors.mutedLight,
    opacity: 0.72,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
    paddingTop: 11,
    paddingHorizontal: 10,
    paddingBottom: 9,
    borderRadius: radius.md,
    backgroundColor: colors.mintSoft,
  },
  savingRowMuted: {
    backgroundColor: colors.tealSoft,
  },
  savingIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  savingIconMuted: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  savingCopy: {
    flex: 1,
  },
  savingValue: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.mint,
    letterSpacing: -0.1,
  },
  savingValueMuted: {
    color: colors.teal,
  },
  savingDetail: {
    marginTop: 1,
    fontFamily: fonts.sans,
    fontSize: 9.5,
    lineHeight: 13,
    color: colors.muted,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 12,
    padding: 11,
    borderRadius: radius.md,
    backgroundColor: colors.amberSoft,
  },
  warningCopy: {
    flex: 1,
    gap: 2,
  },
  warningTitle: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  warningText: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  clearText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.muted,
  },
  message: {
    marginTop: 9,
    fontFamily: fonts.sans,
    fontSize: 9.5,
    lineHeight: 13,
    color: colors.mutedLight,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.coral,
    shadowColor: colors.coralDeep,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: colors.white,
    letterSpacing: -0.1,
  },
  ctaArrow: {
    position: 'absolute',
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  detailsButton: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 2,
  },
  footerLink: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.teal,
  },
  footerMuted: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.mutedLight,
  },
});
