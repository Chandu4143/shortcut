import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEMO_DESTINATIONS, presetToPlace } from '../data/places';
import { shortLabel } from '../lib/format';
import { colors, fonts, radius, shadow } from '../theme';
import type { Place, TravelMode } from '../types';
import type { SavedPlaces } from '../lib/storage';
import { Divider, Kicker, ModeSwitch } from './Controls';
import { Sheet } from './Sheet';
import { Tap } from './Tap';

interface PlannerSheetProps {
  origin: Place | null;
  destination: Place | null;
  mode: TravelMode;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  locating: boolean;
  onOriginPress: () => void;
  onDestinationPress: () => void;
  onLocate: () => void;
  onModeChange: (mode: TravelMode) => void;
  onFind: () => void;
  onQuickDestination: (place: Place) => void;
  onSwap: () => void;
  recents?: Place[];
  savedPlaces: SavedPlaces;
}

function placeTitle(place: Place) {
  const first = place.label.split(',')[0]?.trim() ?? place.label;
  return first.length > 22 ? first : shortLabel(place.label, 2);
}

export function PlannerSheet({
  origin,
  destination,
  mode,
  status,
  message,
  locating,
  onOriginPress,
  onDestinationPress,
  onLocate,
  onModeChange,
  onFind,
  onQuickDestination,
  onSwap,
  recents = [],
  savedPlaces,
}: PlannerSheetProps) {
  const insets = useSafeAreaInsets();
  const loading = status === 'loading';
  const hasMessage = status === 'error' || loading;

  const savedChips = [
    savedPlaces.home ? { key: 'home', label: 'Home', icon: 'home' as const, place: savedPlaces.home } : null,
    savedPlaces.work ? { key: 'work', label: 'Work', icon: 'briefcase' as const, place: savedPlaces.work } : null,
  ].filter(Boolean) as { key: string; label: string; icon: 'home' | 'briefcase'; place: Place }[];

  const recentChips = recents
    .filter((place) => !savedChips.some((chip) => chip.place.label === place.label))
    .slice(0, 3)
    .map((place, index) => ({ key: `recent-${index}`, place }));

  const firstRun = !savedChips.length && !recentChips.length;

  return (
    <Sheet style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.headerRow}>
        <Kicker>Plan a ride</Kicker>
        <View style={styles.coverage}>
          <View style={styles.coverageDot} />
          <Text style={styles.coverageText}>Hyderabad</Text>
        </View>
      </View>

      <View style={styles.fieldCard}>
        <View style={styles.originRow}>
          <Tap
            style={styles.originMain}
            onPress={onOriginPress}
            haptic="light"
            accessibilityLabel={`Starting point: ${origin ? placeTitle(origin) : 'not set'}`}
          >
            <View style={styles.originDotWrap}>
              <View style={styles.originDot} />
            </View>
            <View style={styles.fieldCopy}>
              <Text style={styles.fieldLabel}>FROM</Text>
              <Text style={[styles.originValue, !origin && styles.placeholder]} numberOfLines={1}>
                {origin ? placeTitle(origin) : 'Choose a starting point'}
              </Text>
            </View>
          </Tap>
          <Tap
            style={styles.iconButton}
            onPress={onLocate}
            disabled={locating}
            haptic="light"
            accessibilityLabel="Use my current location"
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.teal} />
            ) : (
              <Ionicons name="locate" size={17} color={colors.teal} />
            )}
          </Tap>
          <Tap
            style={styles.iconButton}
            onPress={onSwap}
            disabled={!origin && !destination}
            haptic="light"
            accessibilityLabel="Swap starting point and destination"
          >
            <Ionicons name="swap-vertical" size={17} color={colors.muted} />
          </Tap>
        </View>

        <Divider style={styles.fieldDivider} />

        <Tap
          style={styles.destinationRow}
          onPress={onDestinationPress}
          haptic="light"
          accessibilityLabel={`Destination: ${destination ? placeTitle(destination) : 'not set'}`}
        >
          <View style={styles.destinationIcon}>
            <Ionicons name="flag" size={15} color={colors.coral} />
          </View>
          <View style={styles.fieldCopy}>
            <Text style={styles.fieldLabel}>TO</Text>
            <Text style={[styles.destinationValue, !destination && styles.placeholder]} numberOfLines={1}>
              {destination ? placeTitle(destination) : 'Where do you want to go?'}
            </Text>
          </View>
          <View style={styles.searchAffordance}>
            <Ionicons name="search" size={16} color={colors.muted} />
          </View>
        </Tap>
      </View>

      <View style={styles.modeRow}>
        <Text style={styles.modeLabel}>Travel mode</Text>
        <ModeSwitch value={mode} onChange={onModeChange} />
      </View>

      <Tap
        style={[styles.cta, loading && styles.ctaLoading]}
        onPress={onFind}
        disabled={loading}
        haptic="medium"
        accessibilityLabel="Find the shortest route"
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Ionicons name="navigate" size={17} color={colors.white} />
        )}
        <Text style={styles.ctaText}>{loading ? 'Finding the shorter way…' : 'Find shortest route'}</Text>
        {!loading ? <Ionicons name="arrow-forward" size={17} color="rgba(255,255,255,0.82)" /> : null}
      </Tap>

      {hasMessage ? (
        <View style={styles.messageRow}>
          <Ionicons
            name={status === 'error' ? 'alert-circle' : 'information-circle-outline'}
            size={14}
            color={status === 'error' ? colors.danger : colors.muted}
          />
          <Text style={[styles.message, status === 'error' && styles.messageError]} numberOfLines={2}>
            {message}
          </Text>
        </View>
      ) : null}

      {firstRun ? (
        <View style={styles.chipSection}>
          <Text style={styles.chipHeading}>Try a destination</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroller}
            keyboardShouldPersistTaps="handled"
          >
            {DEMO_DESTINATIONS.slice(0, 4).map((preset) => {
              const place = presetToPlace(preset);
              return (
                <Tap
                  key={preset.id}
                  style={styles.chip}
                  onPress={() => onQuickDestination(place)}
                  haptic="light"
                  accessibilityLabel={`Route to ${preset.name}`}
                >
                  <Ionicons name="arrow-up" size={11} color={colors.coral} style={styles.chipArrow} />
                  <Text style={styles.chipText}>{preset.name}</Text>
                </Tap>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.chipSection}>
          <Text style={styles.chipHeading}>{savedChips.length ? 'Saved and recent' : 'Recent'}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroller}
            keyboardShouldPersistTaps="handled"
          >
            {savedChips.map((chip) => (
              <Tap
                key={chip.key}
                style={[styles.chip, styles.chipSaved]}
                onPress={() => onQuickDestination(chip.place)}
                haptic="light"
                accessibilityLabel={`Route to ${chip.label}, ${placeTitle(chip.place)}`}
              >
                <Ionicons name={chip.icon} size={12} color={colors.teal} />
                <Text style={styles.chipText}>{chip.label}</Text>
              </Tap>
            ))}
            {recentChips.map(({ key, place }) => (
              <Tap
                key={key}
                style={styles.chip}
                onPress={() => onQuickDestination(place)}
                haptic="light"
                accessibilityLabel={`Route to ${placeTitle(place)}`}
              >
                <Ionicons name="time-outline" size={12} color={colors.muted} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {shortLabel(place.label, 1)}
                </Text>
              </Tap>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>Mapped roads · no live traffic</Text>
        <Tap
          haptic="none"
          onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}
          accessibilityRole="link"
          accessibilityLabel="Open map data attribution"
        >
          <Text style={styles.footerLink}>© OpenStreetMap</Text>
        </Tap>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '50%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 1,
    marginBottom: 12,
  },
  coverage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  coverageDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  coverageText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.muted,
  },
  fieldCard: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.tiny,
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  originMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 44,
  },
  originDotWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealSoft,
  },
  originDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2.4,
    borderColor: colors.teal,
    backgroundColor: colors.surface,
  },
  fieldCopy: {
    flex: 1,
    gap: 1,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: colors.muted,
  },
  originValue: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  placeholder: {
    color: colors.muted,
    fontFamily: fonts.sans,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  fieldDivider: {
    marginLeft: 51,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 60,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
  },
  destinationIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coralSoft,
  },
  destinationValue: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  searchAffordance: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  modeLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  cta: {
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
  ctaLoading: {
    opacity: 0.9,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    letterSpacing: -0.1,
    color: colors.white,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 9,
    paddingHorizontal: 2,
  },
  message: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 15,
    color: colors.muted,
  },
  messageError: {
    color: colors.danger,
  },
  chipSection: {
    marginTop: 10,
  },
  chipHeading: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 7,
  },
  chipScroller: {
    gap: 7,
    paddingRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 190,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipSaved: {
    backgroundColor: colors.tealSoft,
    borderColor: 'rgba(36,98,95,0.14)',
  },
  chipArrow: {
    transform: [{ rotate: '45deg' }],
  },
  chipText: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 11,
  },
  footerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.mintBright,
  },
  footerText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.muted,
  },
  footerLink: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: colors.muted,
    textDecorationLine: 'underline',
    textDecorationColor: colors.lineStrong,
  },
});
