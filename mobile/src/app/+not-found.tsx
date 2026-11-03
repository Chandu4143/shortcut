import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tap } from '../components/Tap';
import { parseDestinationFromUrl } from '../lib/geo';
import { useTrip } from '../state/TripProvider';
import { colors, fonts, radius } from '../theme';

/**
 * Expo Router sends every external navigation intent (geo:, google.navigation:,
 * links shared from other apps) here. Parse the coordinates, start the route
 * request, then hand the user back to the map.
 */
export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();
  const url = Linking.useURL();
  const { planQuickTrip } = useTrip();
  const [failed, setFailed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const parsed = url ? parseDestinationFromUrl(url) : null;
    if (!parsed) {
      const timer = setTimeout(() => setFailed(true), 700);
      return () => clearTimeout(timer);
    }
    handled.current = true;
    void planQuickTrip({
      lat: parsed.lat,
      lon: parsed.lon,
      label: parsed.label ?? 'Destination',
      kind: 'search',
    });
    // Navigate straight away: planQuickTrip keeps running in TripProvider and
    // the home screen shows its loading/result state. A timer here would be
    // cancelled by the provider re-render that the route request triggers.
    router.replace('/');
  }, [planQuickTrip, url]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
      ]}
    >
      {failed ? (
        <>
          <View style={styles.iconWrap}>
            <Ionicons name="map-outline" size={30} color={colors.coral} />
          </View>
          <Text style={styles.title}>Link not recognised</Text>
          <Text style={styles.body}>
            Short Cut could not find coordinates in this link. Open the app and search for the
            destination instead.
          </Text>
          <Tap
            style={styles.cta}
            onPress={() => router.replace('/')}
            haptic="medium"
            accessibilityLabel="Open Short Cut"
          >
            <Text style={styles.ctaText}>Open Short Cut</Text>
          </Tap>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.coral} />
          <Text style={styles.title}>Finding your destination…</Text>
          <Text style={styles.body}>Short Cut is opening the shortest route for this link.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.paper,
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coralSoft,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.displaySemibold,
    fontSize: 22,
    letterSpacing: -0.8,
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  cta: {
    marginTop: 10,
    height: 48,
    paddingHorizontal: 26,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coral,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
});
