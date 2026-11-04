import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatArrival, formatDistance, formatDuration } from '../lib/format';
import { colors, fonts, radius, shadow } from '../theme';
import type { RoutePair, TravelMode } from '../types';
import type { ActiveRoute } from '../state/TripProvider';
import { Kicker } from './Controls';
import { Sheet } from './Sheet';
import { Tap } from './Tap';

interface RouteSheetProps {
  routes: RoutePair;
  mode: TravelMode;
  activeRoute: ActiveRoute;
  busy?: boolean;
  onSelectRoute: (route: ActiveRoute) => void;
  onModeChange: (mode: TravelMode) => void;
  onStart: () => void;
  onDetails: () => void;
  onChange: () => void;
  onDismiss: () => void;
}

export function RouteSheet({
  routes,
  mode,
  activeRoute,
  busy = false,
  onSelectRoute,
  onModeChange,
  onStart,
  onDetails,
  onChange,
  onDismiss,
}: RouteSheetProps) {
  const insets = useSafeAreaInsets();
  const shortest = routes.shortest;
  const fastest = routes.fastest;
  const active = activeRoute === 'fastest' ? fastest : shortest;
  const saved = Math.max(0, fastest.distanceMeters - shortest.distanceMeters);
  const hasSaving = saved >= 25;
  const savedPercent =
    fastest.distanceMeters > 0 ? Math.round((saved / fastest.distanceMeters) * 100) : 0;
  const timeDeltaMinutes = Math.round((fastest.durationSeconds - shortest.durationSeconds) / 60);
  const warnings = active.warnings.slice(0, 2);
  const parts = distanceParts(active.distanceMeters);

  const banner =
    activeRoute === 'shortest'
      ? hasSaving
        ? {
            value: formatDistance(saved),
            text: 'shorter than the fastest route',
            detail: `${savedPercent}% less distance`,
            tone: 'good' as const,
          }
        : {
            value: 'Already optimal',
            text: 'same distance as fastest',
            detail: 'No shorter line was found',
            tone: 'calm' as const,
          }
      : {
          value: hasSaving ? `+${formatDistance(saved)}` : 'Same distance',
          text: 'on the fastest route',
          detail:
            timeDeltaMinutes < 0
              ? `${Math.abs(timeDeltaMinutes)} min quicker than the shortest`
              : 'Same estimated time as the shortest',
          tone: 'calm' as const,
        };

  return (
    <Sheet style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.headerRow}>
        <Kicker>{activeRoute === 'shortest' ? 'Shortest route' : 'Fastest route'}</Kicker>
        <View style={styles.headerActions}>
          {busy ? <ActivityIndicator size="small" color={colors.teal} /> : null}
          <View style={styles.modeToggle}>
            <Tap
              style={[styles.modeButton, mode === 'riding' && styles.modeButtonActive]}
              onPress={() => onModeChange('riding')}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === 'riding' }}
              accessibilityLabel="Switch to riding"
            >
              <Ionicons
                name="bicycle"
                size={12}
                color={mode === 'riding' ? colors.coral : colors.muted}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  mode === 'riding' && styles.modeButtonTextActive,
                ]}
              >
                Ride
              </Text>
            </Tap>
            <Tap
              style={[styles.modeButton, mode === 'walking' && styles.modeButtonActive]}
              onPress={() => onModeChange('walking')}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === 'walking' }}
              accessibilityLabel="Switch to walking"
            >
              <Ionicons
                name="walk"
                size={12}
                color={mode === 'walking' ? colors.coral : colors.muted}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  mode === 'walking' && styles.modeButtonTextActive,
                ]}
              >
                Walk
              </Text>
            </Tap>
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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroRow}>
          <View style={styles.distanceBlock}>
            <Text style={styles.distanceValue}>
              {parts.value}
              <Text style={styles.distanceUnit}> {parts.unit}</Text>
            </Text>
            <Text style={styles.distanceCaption}>
              {activeRoute === 'shortest' ? 'shortest mapped distance' : 'fastest route distance'}
            </Text>
          </View>
          <View style={styles.timeBlock}>
            <Text style={styles.timeValue}>{formatDuration(active.durationSeconds)}</Text>
            <Text style={styles.timeCaption}>arrive {formatArrival(active.durationSeconds)}</Text>
          </View>
        </View>

        <View style={[styles.savingBanner, banner.tone === 'good' ? styles.savingGood : styles.savingCalm]}>
          <View style={[styles.savingIcon, banner.tone === 'good' ? styles.savingIconGood : styles.savingIconCalm]}>
            <Ionicons
              name={banner.tone === 'good' ? 'trending-down' : 'git-compare-outline'}
              size={15}
              color={banner.tone === 'good' ? colors.mint : colors.teal}
            />
          </View>
          <View style={styles.savingCopy}>
            <Text style={[styles.savingValue, banner.tone === 'calm' && styles.savingValueCalm]}>
              {banner.value} <Text style={styles.savingUnit}>{banner.text}</Text>
            </Text>
            <Text style={styles.savingDetail}>{banner.detail}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Choose a route</Text>

        <View style={styles.options}>
          <RouteOption
            label="Shortest"
            note={hasSaving ? `${formatDistance(saved)} less distance` : 'Least distance'}
            distance={shortest.distanceMeters}
            duration={shortest.durationSeconds}
            selected={activeRoute === 'shortest'}
            onPress={() => onSelectRoute('shortest')}
          />
          <RouteOption
            label="Fastest"
            note={
              timeDeltaMinutes < 0
                ? `${Math.abs(timeDeltaMinutes)} min quicker`
                : 'Conventional route'
            }
            distance={fastest.distanceMeters}
            duration={fastest.durationSeconds}
            selected={activeRoute === 'fastest'}
            onPress={() => onSelectRoute('fastest')}
          />
        </View>

        {warnings.length ? (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle" size={15} color={colors.amber} />
            <View style={styles.warningCopy}>
              {warnings.map((warning) => (
                <Text key={warning} style={styles.warningText}>
                  {warning}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Tap
          style={styles.cta}
          onPress={onStart}
          haptic="medium"
          accessibilityLabel="Start navigation"
        >
          <Ionicons name="navigate" size={18} color={colors.white} />
          <Text style={styles.ctaText}>Start navigation</Text>
        </Tap>
        <Tap
          style={styles.detailsButton}
          onPress={onDetails}
          haptic="light"
          accessibilityLabel="Open turn-by-turn directions"
        >
          <Ionicons name="list" size={18} color={colors.ink} />
          <Text style={styles.detailsText}>Directions</Text>
        </Tap>
      </View>

      <View style={styles.footer}>
        <Tap haptic="none" onPress={onChange} accessibilityLabel="Change destination">
          <Text style={styles.footerLink}>Change destination</Text>
        </Tap>
        <Tap
          haptic="none"
          onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}
          accessibilityRole="link"
          accessibilityLabel="Open map data attribution"
        >
          <Text style={styles.footerMuted}>© OpenStreetMap · no live traffic</Text>
        </Tap>
      </View>
    </Sheet>
  );
}

function RouteOption({
  label,
  note,
  distance,
  duration,
  selected,
  onPress,
}: {
  label: string;
  note: string;
  distance: number;
  duration: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Tap
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} route, ${formatDistance(distance)}, ${formatDuration(duration)}`}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioCore} /> : null}
      </View>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
        <Text style={styles.optionNote}>{note}</Text>
      </View>
      <View style={styles.optionMetrics}>
        <Text style={styles.optionDistance}>{formatDistance(distance)}</Text>
        <Text style={styles.optionTime}>{formatDuration(duration)}</Text>
      </View>
    </Tap>
  );
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

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '58%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 48,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
  },
  modeButtonActive: {
    backgroundColor: colors.surface,
    ...shadow.tiny,
  },
  modeButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: colors.muted,
  },
  modeButtonTextActive: {
    color: colors.ink,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  distanceBlock: {
    flex: 1,
  },
  distanceValue: {
    fontFamily: fonts.displayBold,
    fontSize: 50,
    lineHeight: 52,
    letterSpacing: -2.8,
    color: colors.ink,
  },
  distanceUnit: {
    fontFamily: fonts.display,
    fontSize: 23,
    letterSpacing: -0.8,
    color: colors.inkSoft,
  },
  distanceCaption: {
    marginTop: -1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.muted,
  },
  timeBlock: {
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  timeValue: {
    fontFamily: fonts.displaySemibold,
    fontSize: 22,
    letterSpacing: -0.7,
    color: colors.ink,
  },
  timeCaption: {
    marginTop: 1,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.muted,
  },
  savingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  savingGood: {
    backgroundColor: colors.mintSoft,
  },
  savingCalm: {
    backgroundColor: colors.tealSoft,
  },
  savingIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingIconGood: {
    backgroundColor: 'rgba(255,255,255,0.66)',
  },
  savingIconCalm: {
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  savingCopy: {
    flex: 1,
  },
  savingValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: -0.1,
    color: colors.mint,
  },
  savingValueCalm: {
    color: colors.teal,
  },
  savingUnit: {
    fontFamily: fonts.medium,
  },
  savingDetail: {
    marginTop: 1,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.muted,
  },
  sectionLabel: {
    marginTop: 14,
    marginBottom: 7,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  options: {
    gap: 7,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.coral,
    backgroundColor: colors.coralSoft,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.6,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.coral,
    backgroundColor: colors.white,
  },
  radioCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.coral,
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.ink,
  },
  optionLabelSelected: {
    color: colors.coralDeep,
  },
  optionNote: {
    marginTop: 1,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.muted,
  },
  optionMetrics: {
    alignItems: 'flex-end',
  },
  optionDistance: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.ink,
  },
  optionTime: {
    marginTop: 1,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: colors.muted,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.amberSoft,
  },
  warningCopy: {
    flex: 1,
    gap: 2,
  },
  warningText: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cta: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    letterSpacing: -0.1,
    color: colors.white,
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 54,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  detailsText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.ink,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  footerLink: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: colors.teal,
  },
  footerMuted: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: colors.muted,
  },
});
