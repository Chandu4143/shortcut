import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Kicker } from '../components/Controls';
import { Tap } from '../components/Tap';
import { PRESET_PLACES, presetToPlace } from '../data/places';
import { shortLabel } from '../lib/format';
import { searchPlaces } from '../lib/routing';
import { useTrip } from '../state/TripProvider';
import { colors, fonts, radius, shadow } from '../theme';
import type { Place } from '../types';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ target?: string }>();
  const target = params.target === 'origin' ? 'origin' : 'destination';
  const {
    origin,
    destination,
    recents,
    setOrigin,
    setDestination,
    setPickTarget,
    locateMe,
    locating,
  } = useTrip();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const current = target === 'origin' ? origin : destination;
  const title = target === 'origin' ? 'Starting point' : 'Where to?';

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setError('');
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setError('');
    const timer = setTimeout(() => {
      searchPlaces(trimmed, controller.signal)
        .then((places) => {
          if (controller.signal.aborted) return;
          setResults(places);
          setSearching(false);
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setSearching(false);
          setError(caught instanceof Error ? caught.message : 'Search failed. Try again.');
        });
    }, 340);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const presets = useMemo(() => PRESET_PLACES.slice(0, 8).map(presetToPlace), []);

  const choose = (place: Place) => {
    Keyboard.dismiss();
    if (target === 'origin') {
      setOrigin(place);
    } else {
      setDestination(place);
    }
    router.back();
  };

  const chooseCurrentLocation = async () => {
    const place = await locateMe();
    if (place) {
      if (target === 'destination') setDestination(place);
      router.back();
    }
  };

  const pickOnMap = () => {
    Keyboard.dismiss();
    setPickTarget(target);
    router.back();
  };

  const showEmpty = query.trim().length < 2;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Tap
          style={styles.backButton}
          onPress={() => router.back()}
          haptic="light"
          accessibilityLabel="Close search"
        >
          <Ionicons name="arrow-back" size={19} color={colors.ink} />
        </Tap>
        <View style={styles.headerCopy}>
          <Kicker color={target === 'origin' ? colors.teal : colors.coral}>
            {target === 'origin' ? 'From' : 'Destination'}
          </Kicker>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>

      <View style={styles.searchCard}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={target === 'origin' ? 'Search a starting point' : 'Search an address or place'}
          placeholderTextColor={colors.mutedLight}
          autoFocus
          returnKeyType="search"
          selectionColor={colors.coral}
          autoCorrect={false}
          autoCapitalize="words"
          accessibilityLabel="Search for a place"
        />
        {searching ? <ActivityIndicator size="small" color={colors.coral} /> : null}
        {!searching && query.length ? (
          <Tap
            style={styles.clearButton}
            onPress={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            haptic="none"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.mutedLight} />
          </Tap>
        ) : null}
      </View>

      <View style={styles.shortcuts}>
        {target === 'origin' ? (
          <Tap
            style={styles.shortcut}
            onPress={() => void chooseCurrentLocation()}
            accessibilityLabel="Use my current location"
            haptic="light"
          >
            <View style={[styles.shortcutIcon, { backgroundColor: colors.tealSoft }]}>
              {locating ? (
                <ActivityIndicator size="small" color={colors.teal} />
              ) : (
                <Ionicons name="locate" size={16} color={colors.teal} />
              )}
            </View>
            <Text style={styles.shortcutText}>Use my current location</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.mutedLight} />
          </Tap>
        ) : null}
        <Tap
          style={styles.shortcut}
          onPress={pickOnMap}
          accessibilityLabel="Choose on map"
          haptic="light"
        >
          <View style={[styles.shortcutIcon, { backgroundColor: colors.coralSoft }]}>
            <Ionicons name="map-outline" size={16} color={colors.coral} />
          </View>
          <Text style={styles.shortcutText}>
            {target === 'origin' ? 'Set starting point on map' : 'Choose destination on map'}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.mutedLight} />
        </Tap>
      </View>

      {current ? (
        <View style={styles.currentRow}>
          <View style={styles.currentDot} />
          <Text style={styles.currentLabel} numberOfLines={1}>
            {shortLabel(current.label, 3)}
          </Text>
          <Tap
            haptic="none"
            onPress={() => (target === 'origin' ? setOrigin(null) : setDestination(null))}
            accessibilityLabel="Clear current value"
          >
            <Text style={styles.currentClear}>
              {target === 'origin' ? 'Reset' : 'Clear'}
            </Text>
          </Tap>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Search unavailable</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        ) : null}

        {showEmpty ? (
          <>
            {target === 'destination' && recents.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Kicker color={colors.muted}>Recent</Kicker>
                  <View style={styles.rule} />
                </View>
                {recents.map((place, index) => (
                  <PlaceRow
                    key={`${place.label}-${index}`}
                    place={place}
                    icon="time-outline"
                    tint={colors.teal}
                    onPress={() => choose(place)}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Kicker color={colors.muted}>Popular in Hyderabad</Kicker>
                <View style={styles.rule} />
              </View>
              {presets.map((place) => (
                <PlaceRow
                  key={place.label}
                  place={place}
                  icon="location-outline"
                  tint={colors.coral}
                  onPress={() => choose(place)}
                />
              ))}
            </View>

            <View style={styles.hintCard}>
              <Ionicons name="flash" size={16} color={colors.amber} />
              <Text style={styles.hintText}>
                Short Cut compares the least-distance route with the conventional fastest
                alternative before you ride.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Kicker color={colors.muted}>
                {searching ? 'Searching Hyderabad' : `${results.length} matches`}
              </Kicker>
              <View style={styles.rule} />
            </View>
            {results.map((place) => (
              <PlaceRow
                key={`${place.label}-${place.lat}-${place.lon}`}
                place={place}
                icon={place.kind === 'preset' ? 'business-outline' : 'location-outline'}
                tint={place.kind === 'preset' ? colors.coral : colors.teal}
                onPress={() => choose(place)}
              />
            ))}
            {!searching && !results.length && !error ? (
              <Text style={styles.emptyText}>
                No places matched. Try a landmark, street, or neighbourhood.
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PlaceRow({
  place,
  icon,
  tint,
  onPress,
}: {
  place: Place;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
  onPress: () => void;
}) {
  const parts = place.label.split(',').map((part) => part.trim()).filter(Boolean);
  const primary = parts[0] ?? place.label;
  const secondary = parts.slice(1, 4).join(', ');
  return (
    <Tap
      style={styles.row}
      onPress={onPress}
      haptic="light"
      accessibilityLabel={`Choose ${primary}`}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint === colors.coral ? colors.coralSoft : colors.tealSoft }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {primary}
        </Text>
        {secondary ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.mutedLight} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadow.tiny,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.displaySemibold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -1.2,
    color: colors.ink,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 18,
    paddingHorizontal: 14,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    ...shadow.tiny,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 0,
  },
  clearButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcuts: {
    marginHorizontal: 18,
    marginTop: 10,
    gap: 8,
  },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: 'rgba(250,251,245,0.65)',
  },
  shortcutIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkSoft,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
  },
  currentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.mint,
  },
  currentLabel: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.muted,
  },
  currentClear: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.teal,
  },
  scroll: {
    flex: 1,
    marginTop: 10,
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  section: {
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: radius.md,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.ink,
  },
  rowSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.muted,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    paddingVertical: 18,
    textAlign: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    marginTop: 14,
    borderRadius: radius.md,
    backgroundColor: colors.coralSoft,
  },
  errorCopy: {
    flex: 1,
    gap: 2,
  },
  errorTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.danger,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 22,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.amberSoft,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.inkSoft,
  },
});
