import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
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
import { Tap } from '../components/Tap';
import { HYDERABAD_CENTER, PRESET_PLACES, presetToPlace } from '../data/places';
import { haversine } from '../lib/geo';
import { formatShortDistance, shortLabel } from '../lib/format';
import { searchPlaces } from '../lib/routing';
import type { Place } from '../types';
import { useTrip } from '../state/TripProvider';
import { colors, fonts, radius, shadow } from '../theme';
import type { SavedPlaceKind } from '../lib/storage';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function placeParts(place: Place) {
  const parts = place.label.split(',').map((part) => part.trim()).filter(Boolean);
  return { title: parts[0] ?? place.label, context: parts.slice(1, 3).join(', ') };
}

function iconForPlace(place: Place): IconName {
  const text = place.label.toLowerCase();
  if (text.includes('airport')) return 'airplane';
  if (text.includes('railway') || text.includes('junction') || text.includes('station')) return 'train';
  if (text.includes('metro')) return 'subway';
  if (text.includes('mall') || text.includes('market') || text.includes('shopping') || text.includes('ikea')) {
    return 'bag-handle';
  }
  if (text.includes('hospital') || text.includes('clinic')) return 'medkit';
  if (text.includes('college') || text.includes('university') || text.includes('school')) return 'school';
  if (text.includes('lake') || text.includes('sagar')) return 'water';
  if (text.includes('park') || text.includes('garden')) return 'leaf';
  if (text.includes('fort') || text.includes('temple') || text.includes('masjid')) return 'sparkles';
  if (text.includes('charminar') || text.includes('golconda')) return 'sparkles';
  if (text.includes('hitec') || text.includes('cyber')) return 'business';
  return 'location';
}

function distanceLabel(place: Place, from: { lat: number; lon: number }) {
  const meters = haversine(place, from);
  if (meters < 80) return 'Here';
  return formatShortDistance(meters);
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ target?: string }>();
  const target = params.target === 'origin' ? 'origin' : 'destination';
  const {
    origin,
    location,
    recents,
    savedPlaces,
    setOrigin,
    setPickTarget,
    planQuickTrip,
    locateMe,
    locating,
    savePlace,
    forgetPlace,
    clearRecentPlaces,
  } = useTrip();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [wide, setWide] = useState(false);
  const [saveKind, setSaveKind] = useState<SavedPlaceKind | null>(null);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const isLocal = Boolean(
    location && haversine(location, HYDERABAD_CENTER) < 90_000,
  );
  const nearLat = isLocal && location ? location.lat : HYDERABAD_CENTER.lat;
  const nearLon = isLocal && location ? location.lon : HYDERABAD_CENTER.lon;
  const distanceFrom = origin ?? location ?? HYDERABAD_CENTER;

  const title = saveKind
    ? `Save ${saveKind}`
    : target === 'origin'
      ? 'Starting point'
      : 'Where to?';
  const kicker = saveKind ? 'Saved place' : target === 'origin' ? 'From' : 'To';

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      setError('');
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setSearched(false);
    setError('');
    const timer = setTimeout(() => {
      searchPlaces(trimmed, controller.signal, {
        near: { lat: nearLat, lon: nearLon },
        wide,
      })
        .then((places) => {
          if (controller.signal.aborted) return;
          setResults(places);
          setSearching(false);
          setSearched(true);
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setSearching(false);
          setSearched(true);
          setError(caught instanceof Error ? caught.message : 'Search failed. Try again.');
        });
    }, 320);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [nearLat, nearLon, query, wide]);

  const excludedNames = new Set(
    [
      ...recents,
      ...(savedPlaces.home ? [savedPlaces.home] : []),
      ...(savedPlaces.work ? [savedPlaces.work] : []),
    ].map((place) => place.label.split(',')[0]?.trim().toLowerCase() ?? ''),
  );

  const popular = PRESET_PLACES.map(presetToPlace)
    .map((place) => ({ place, meters: haversine(place, distanceFrom) }))
    .filter(
      ({ place, meters }) =>
        meters > 250 && !excludedNames.has(place.label.split(',')[0]?.trim().toLowerCase() ?? ''),
    )
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 6)
    .map((entry) => entry.place);

  const saveOptions = PRESET_PLACES.map(presetToPlace)
    .map((place) => ({ place, meters: haversine(place, distanceFrom) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 6)
    .map((entry) => entry.place);

  const choose = (place: Place) => {
    Keyboard.dismiss();
    if (saveKind) {
      void savePlace(saveKind, place).finally(() => {
        setSaveKind(null);
        router.back();
      });
      return;
    }
    if (target === 'origin') {
      setOrigin(place);
      router.back();
      return;
    }
    void planQuickTrip(place);
    router.back();
  };

  const chooseCurrentLocation = async () => {
    const place = await locateMe();
    if (place) router.back();
  };

  const pickOnMap = () => {
    Keyboard.dismiss();
    setPickTarget(target);
    router.back();
  };

  const beginSave = (kind: SavedPlaceKind) => {
    setSaveKind(kind);
    setQuery('');
    setResults([]);
    setWide(false);
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const back = () => {
    if (saveKind) {
      setSaveKind(null);
      return;
    }
    router.back();
  };

  const showEmpty = query.trim().length < 2;
  const savedRows = [
    savedPlaces.home
      ? { kind: 'home' as const, label: 'Home', icon: 'home' as IconName, place: savedPlaces.home }
      : null,
    savedPlaces.work
      ? { kind: 'work' as const, label: 'Work', icon: 'briefcase' as IconName, place: savedPlaces.work }
      : null,
  ].filter(Boolean) as {
    kind: SavedPlaceKind;
    label: string;
    icon: IconName;
    place: Place;
  }[];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Tap
          style={styles.backButton}
          onPress={back}
          haptic="light"
          accessibilityLabel={saveKind ? 'Cancel saving this place' : 'Close search'}
        >
          <Ionicons name="arrow-back" size={19} color={colors.ink} />
        </Tap>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>

      <View style={styles.searchCard}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setWide(false);
          }}
          placeholder={
            saveKind
              ? `Search an address for ${saveKind}`
              : target === 'origin'
                ? 'Search a starting point'
                : 'Search an address or place'
          }
          placeholderTextColor={colors.muted}
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
              setWide(false);
              inputRef.current?.focus();
            }}
            haptic="none"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.mutedLight} />
          </Tap>
        ) : null}
      </View>

      {!saveKind ? (
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
              {target === 'origin' ? 'Set starting point on map' : 'Choose on map'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.mutedLight} />
          </Tap>
        </View>
      ) : (
        <View style={styles.saveHint}>
          <Ionicons name="bookmark" size={14} color={colors.teal} />
          <Text style={styles.saveHintText}>
            Pick the place you want to save as {saveKind}. You can change it any time.
          </Text>
        </View>
      )}

      {saveKind && savedPlaces[saveKind] ? (
        <Tap
          style={styles.removeSaved}
          haptic="light"
          accessibilityLabel={`Remove saved ${saveKind}`}
          onPress={() => {
            void forgetPlace(saveKind).then(() => {
              setSaveKind(null);
              router.back();
            });
          }}
        >
          <Ionicons name="trash-outline" size={14} color={colors.danger} />
          <Text style={styles.removeSavedText}>Remove saved {saveKind}</Text>
        </Tap>
      ) : null}

      {wide && !showEmpty && query.trim().length >= 2 ? (
        <View style={styles.wideRow}>
          <View style={styles.wideChip}>
            <Ionicons name="globe-outline" size={12} color={colors.teal} />
            <Text style={styles.wideText}>Searching across India</Text>
          </View>
          <Tap haptic="none" onPress={() => setWide(false)} accessibilityLabel="Search near Hyderabad instead">
            <Text style={styles.wideReset}>Back to Hyderabad</Text>
          </Tap>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Search is unavailable</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        ) : null}

        {showEmpty ? (
          <>
            {!saveKind ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Saved places</Text>
                  <View style={styles.rule} />
                </View>
                {savedRows.length ? (
                  <>
                    {savedRows.map((row) => (
                      <PlaceRow
                        key={row.kind}
                        place={row.place}
                        title={row.label}
                        subtitle={shortLabel(row.place.label, 2)}
                        icon={row.icon}
                        tint={colors.teal}
                        distance={distanceLabel(row.place, distanceFrom)}
                        onPress={() => choose(row.place)}
                      />
                    ))}
                    <View style={styles.savedActions}>
                      {savedRows.some((row) => row.kind === 'home') ? (
                        <Tap
                          haptic="none"
                          style={styles.savedActionButton}
                          onPress={() => beginSave('home')}
                          accessibilityLabel="Change home"
                        >
                          <Text style={styles.savedLink}>Change home</Text>
                        </Tap>
                      ) : (
                        <Tap
                          haptic="none"
                          style={styles.savedActionButton}
                          onPress={() => beginSave('home')}
                          accessibilityLabel="Set home"
                        >
                          <Text style={styles.savedLink}>Set home</Text>
                        </Tap>
                      )}
                      <View style={styles.savedDot} />
                      {savedRows.some((row) => row.kind === 'work') ? (
                        <Tap
                          haptic="none"
                          style={styles.savedActionButton}
                          onPress={() => beginSave('work')}
                          accessibilityLabel="Change work"
                        >
                          <Text style={styles.savedLink}>Change work</Text>
                        </Tap>
                      ) : (
                        <Tap
                          haptic="none"
                          style={styles.savedActionButton}
                          onPress={() => beginSave('work')}
                          accessibilityLabel="Set work"
                        >
                          <Text style={styles.savedLink}>Set work</Text>
                        </Tap>
                      )}
                    </View>
                  </>
                ) : (
                  <View style={styles.savedCards}>
                    <Tap
                      style={styles.savedCard}
                      onPress={() => beginSave('home')}
                      haptic="light"
                      accessibilityLabel="Set your home address"
                    >
                      <View style={styles.savedCardIcon}>
                        <Ionicons name="home" size={16} color={colors.teal} />
                      </View>
                      <View style={styles.savedCardCopy}>
                        <Text style={styles.savedCardTitle}>Home</Text>
                        <Text style={styles.savedCardText}>Add a place</Text>
                      </View>
                      <Ionicons name="add" size={16} color={colors.muted} />
                    </Tap>
                    <Tap
                      style={styles.savedCard}
                      onPress={() => beginSave('work')}
                      haptic="light"
                      accessibilityLabel="Set your work address"
                    >
                      <View style={styles.savedCardIcon}>
                        <Ionicons name="briefcase" size={16} color={colors.teal} />
                      </View>
                      <View style={styles.savedCardCopy}>
                        <Text style={styles.savedCardTitle}>Work</Text>
                        <Text style={styles.savedCardText}>Add a place</Text>
                      </View>
                      <Ionicons name="add" size={16} color={colors.muted} />
                    </Tap>
                  </View>
                )}
              </View>
            ) : null}

            {recents.length && !saveKind ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent</Text>
                  <View style={styles.rule} />
                  <Tap
                    haptic="none"
                    style={styles.sectionActionButton}
                    onPress={() => void clearRecentPlaces()}
                    accessibilityLabel="Clear recent destinations"
                  >
                    <Text style={styles.sectionAction}>Clear</Text>
                  </Tap>
                </View>
                {recents.slice(0, 3).map((place, index) => (
                  <PlaceRow
                    key={`${place.label}-${index}`}
                    place={place}
                    icon="time-outline"
                    tint={colors.muted}
                    distance={distanceLabel(place, distanceFrom)}
                    onPress={() => choose(place)}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {saveKind ? `Places near you` : 'Popular in Hyderabad'}
                </Text>
                <View style={styles.rule} />
              </View>
              {(saveKind ? saveOptions.slice(0, 4) : popular).map((place) => (
                <PlaceRow
                  key={place.label}
                  place={place}
                  icon={iconForPlace(place)}
                  tint={colors.coral}
                  distance={distanceLabel(place, distanceFrom)}
                  onPress={() => choose(place)}
                />
              ))}
            </View>

            {!saveKind ? (
              <View style={styles.hintCard}>
                <Ionicons name="information-circle-outline" size={15} color={colors.teal} />
                <Text style={styles.hintText}>
                  Short Cut ranks mapped streets by distance, then shows what the conventional
                  fastest route costs in extra metres.
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.section}>
            {!searching && results.length ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {wide ? 'Matches across India' : 'Matches near Hyderabad'}
                </Text>
                <View style={styles.rule} />
                <Text style={styles.countText}>{results.length}</Text>
              </View>
            ) : null}

            {searching && !results.length ? (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color={colors.teal} />
                <Text style={styles.searchingText}>Searching mapped places…</Text>
              </View>
            ) : null}

            {results.map((place) => (
              <PlaceRow
                key={`${place.label}-${place.lat}-${place.lon}`}
                place={place}
                icon={iconForPlace(place)}
                tint={place.kind === 'preset' ? colors.coral : colors.teal}
                distance={distanceLabel(place, distanceFrom)}
                onPress={() => choose(place)}
              />
            ))}

            {!searching && searched && !results.length && !error ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="map-outline" size={20} color={colors.teal} />
                </View>
                <Text style={styles.emptyTitle}>
                  No matches {wide ? 'across India' : 'near Hyderabad'}
                </Text>
                <Text style={styles.emptyText}>
                  Try a landmark, street, or neighbourhood. Mapped names follow OpenStreetMap.
                </Text>
                {!wide ? (
                  <Tap
                    style={styles.wideButton}
                    onPress={() => setWide(true)}
                    haptic="light"
                    accessibilityLabel="Search across India"
                  >
                    <Ionicons name="globe-outline" size={15} color={colors.teal} />
                    <Text style={styles.wideButtonText}>Search across India</Text>
                  </Tap>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PlaceRow({
  place,
  title,
  subtitle,
  icon,
  tint,
  distance,
  onPress,
}: {
  place: Place;
  title?: string;
  subtitle?: string;
  icon: IconName;
  tint: string;
  distance: string;
  onPress: () => void;
}) {
  const parts = placeParts(place);
  const heading = title ?? parts.title;
  const context = subtitle ?? parts.context;
  return (
    <Tap
      style={styles.row}
      onPress={onPress}
      haptic="light"
      accessibilityLabel={`Choose ${heading}, ${context}`}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: tint === colors.coral ? colors.coralSoft : colors.tealSoft },
        ]}
      >
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {heading}
        </Text>
        {context ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {context}
          </Text>
        ) : null}
      </View>
      <Text style={styles.rowDistance}>{distance}</Text>
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
    paddingTop: 4,
    paddingBottom: 13,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadow.tiny,
  },
  headerCopy: {
    flex: 1,
    gap: 1,
  },
  kicker: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.teal,
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
    borderWidth: 1,
    borderColor: colors.lineStrong,
    ...shadow.tiny,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 0,
  },
  clearButton: {
    width: 30,
    height: 30,
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
    minHeight: 46,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: 'rgba(252,252,246,0.7)',
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
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  saveHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
  },
  saveHintText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.inkSoft,
  },
  wideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 10,
  },
  wideChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.tealSoft,
  },
  wideText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.teal,
  },
  wideReset: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.teal,
    textDecorationLine: 'underline',
    textDecorationColor: colors.lineStrong,
  },
  scroll: {
    flex: 1,
    marginTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  section: {
    marginTop: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 4,
    minHeight: 24,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  sectionAction: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.teal,
  },
  sectionActionButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingVertical: 8,
    paddingHorizontal: 4,
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
    fontSize: 14,
    color: colors.ink,
  },
  rowSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 15,
    color: colors.muted,
  },
  rowDistance: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: colors.teal,
  },
  savedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 4,
  },
  savedCards: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  savedCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  savedCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealSoft,
  },
  savedCardCopy: {
    flex: 1,
    gap: 1,
  },
  savedCardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.ink,
  },
  savedCardText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.muted,
  },
  savedLink: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: colors.teal,
  },
  savedActionButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  savedDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  removeSaved: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 38,
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.coralSoft,
  },
  removeSavedText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.danger,
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 24,
    paddingHorizontal: 4,
  },
  searchingText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.muted,
  },
  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    marginTop: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealSoft,
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 17,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  emptyText: {
    marginTop: 5,
    maxWidth: 280,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.muted,
  },
  wideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.tealSoft,
  },
  wideButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.teal,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    marginTop: 10,
    borderRadius: radius.md,
    backgroundColor: colors.coralSoft,
  },
  errorCopy: {
    flex: 1,
    gap: 2,
  },
  errorTitle: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: colors.danger,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 15,
    color: colors.inkSoft,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 18,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.muted,
  },
});
