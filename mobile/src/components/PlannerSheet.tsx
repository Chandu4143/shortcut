import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEMO_DESTINATIONS, presetToPlace } from '../data/places';
import { shortLabel } from '../lib/format';
import { colors, fonts, radius, shadow } from '../theme';
import type { Place, TravelMode } from '../types';
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
  recents?: Place[];
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
  recents = [],
}: PlannerSheetProps) {
  const insets = useSafeAreaInsets();
  const loading = status === 'loading';

  return (
    <Sheet style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.headerRow}>
          <Kicker>Distance-first navigation</Kicker>
          <View style={styles.coverage}>
            <View style={styles.coverageDot} />
            <Text style={styles.coverageText}>Hyderabad pilot</Text>
          </View>
        </View>

        <Text style={styles.headline}>
          Take the{'\n'}
          <Text style={styles.headlineAccent}>shorter street.</Text>
        </Text>
        <Text style={styles.subtitle}>
          Find the least distance through streets you can actually use.
        </Text>

        <View style={styles.fieldCard}>
          <Tap
            style={styles.fieldRow}
            onPress={onOriginPress}
            accessibilityLabel={`Starting point: ${origin ? shortLabel(origin.label) : 'not set'}`}
          >
            <View style={[styles.fieldIcon, styles.fieldIconStart]}>
              <View style={styles.startDot} />
            </View>
            <View style={styles.fieldCopy}>
              <Text style={styles.fieldLabel}>FROM</Text>
              <Text
                style={[styles.fieldValue, !origin && styles.fieldPlaceholder]}
                numberOfLines={1}
              >
                {origin ? shortLabel(origin.label, 2) : 'Choose a starting point'}
              </Text>
            </View>
            <Tap
              style={styles.locateButton}
              onPress={onLocate}
              disabled={locating}
              accessibilityLabel="Use my current location"
              haptic="light"
            >
              {locating ? (
                <ActivityIndicator size="small" color={colors.teal} />
              ) : (
                <Ionicons name="locate" size={18} color={colors.teal} />
              )}
            </Tap>
          </Tap>
          <Divider style={styles.fieldDivider} />
          <Tap
            style={styles.fieldRow}
            onPress={onDestinationPress}
            accessibilityLabel={`Destination: ${destination ? shortLabel(destination.label) : 'not set'}`}
          >
            <View style={[styles.fieldIcon, styles.fieldIconEnd]}>
              <Ionicons name="location" size={16} color={colors.coral} />
            </View>
            <View style={styles.fieldCopy}>
              <Text style={styles.fieldLabel}>TO</Text>
              <Text
                style={[styles.fieldValue, !destination && styles.fieldPlaceholder]}
                numberOfLines={1}
              >
                {destination ? shortLabel(destination.label, 2) : 'Where do you want to go?'}
              </Text>
            </View>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={17} color={colors.mutedLight} />
            </View>
          </Tap>
        </View>

        <View style={styles.modeRow}>
          <Kicker color={colors.muted}>Travel mode</Kicker>
          <ModeSwitch value={mode} onChange={onModeChange} />
        </View>

        <Tap style={styles.cta} onPress={onFind} disabled={loading} haptic="medium" accessibilityLabel="Find shortest route">
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="navigate" size={17} color={colors.white} />
          )}
          <Text style={styles.ctaText}>{loading ? 'Finding the shorter way' : 'Find shortest route'}</Text>
          {!loading ? (
            <View style={styles.ctaArrow}>
              <Ionicons name="arrow-forward" size={16} color={colors.coral} />
            </View>
          ) : null}
        </Tap>

        <View style={styles.messageRow}>
          <Ionicons
            name={
              status === 'error'
                ? 'alert-circle'
                : status === 'ready'
                  ? 'checkmark-circle'
                  : 'information-circle-outline'
            }
            size={14}
            color={status === 'error' ? colors.danger : status === 'ready' ? colors.teal : colors.mutedLight}
          />
          <Text
            style={[
              styles.message,
              status === 'error' && styles.messageError,
              status === 'ready' && styles.messageReady,
            ]}
            numberOfLines={2}
          >
            {message}
          </Text>
        </View>

        {recents.length ? (
          <>
            <View style={styles.quickHeader}>
              <Kicker color={colors.muted}>Recent</Kicker>
              <View style={styles.quickRule} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickScroller}
            >
              {recents.map((place, index) => (
                <Tap
                  key={`${place.label}-${index}`}
                  style={styles.quickChip}
                  onPress={() => onQuickDestination(place)}
                  accessibilityLabel={`Route to ${shortLabel(place.label, 1)}`}
                >
                  <View style={[styles.quickPin, styles.recentPin]}>
                    <Ionicons name="time" size={12} color={colors.teal} />
                  </View>
                  <Text style={styles.quickText} numberOfLines={1}>
                    {shortLabel(place.label, 1)}
                  </Text>
                </Tap>
              ))}
            </ScrollView>
          </>
        ) : null}

        <View style={styles.quickHeader}>
          <Kicker color={colors.muted}>Quick destinations</Kicker>
          <View style={styles.quickRule} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickScroller}
        >
          {DEMO_DESTINATIONS.map((preset) => (
            <Tap
              key={preset.id}
              style={styles.quickChip}
              onPress={() => onQuickDestination(presetToPlace(preset))}
              accessibilityLabel={`Route to ${preset.name}`}
            >
              <View style={styles.quickPin}>
                <Ionicons name="arrow-up" size={11} color={colors.coral} style={styles.quickPinIcon} />
              </View>
              <Text style={styles.quickText}>{preset.name}</Text>
            </Tap>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>Mapped roads · no live traffic</Text>
          </View>
          <Tap
            haptic="none"
            onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}
            accessibilityLabel="Open map data attribution"
          >
            <Text style={styles.footerLink}>Data & attribution</Text>
          </Tap>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '76%',
  },
  scroll: {
    paddingBottom: 2,
  },
  scrollView: {
    flexShrink: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  coverage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coverageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  coverageText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.muted,
  },
  headline: {
    marginTop: 16,
    fontFamily: fonts.displaySemibold,
    fontSize: 38,
    lineHeight: 39,
    letterSpacing: -2.1,
    color: colors.ink,
  },
  headlineAccent: {
    color: colors.coral,
  },
  subtitle: {
    marginTop: 9,
    marginBottom: 18,
    maxWidth: 300,
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldIconStart: {
    backgroundColor: colors.tealSoft,
  },
  fieldIconEnd: {
    backgroundColor: colors.coralSoft,
  },
  startDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
    borderColor: colors.teal,
    backgroundColor: colors.surface,
  },
  fieldCopy: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: colors.mutedLight,
  },
  fieldValue: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.ink,
  },
  fieldPlaceholder: {
    color: colors.mutedLight,
  },
  fieldDivider: {
    marginLeft: 55,
  },
  locateButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealSoft,
  },
  chevron: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 14,
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
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    minHeight: 32,
    paddingTop: 9,
    paddingHorizontal: 2,
  },
  message: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.muted,
  },
  messageError: {
    color: colors.danger,
  },
  messageReady: {
    color: colors.teal,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 9,
  },
  quickRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  quickScroller: {
    gap: 7,
    paddingRight: 12,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  quickPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coralSoft,
  },
  quickPinIcon: {
    transform: [{ rotate: '45deg' }],
  },
  recentPin: {
    backgroundColor: colors.tealSoft,
  },
  quickText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.inkSoft,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.mint,
  },
  footerText: {
    fontFamily: fonts.sans,
    fontSize: 9.5,
    color: colors.mutedLight,
  },
  footerLink: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: colors.muted,
    textDecorationLine: 'underline',
    textDecorationColor: colors.lineStrong,
  },
});
