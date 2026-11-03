import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { IconButton } from '../components/Controls';
import { MapCanvas, MapCanvasHandle } from '../components/MapCanvas';
import { PlannerSheet } from '../components/PlannerSheet';
import { RouteSheet } from '../components/RouteSheet';
import { Tap } from '../components/Tap';
import { useTrip } from '../state/TripProvider';
import { colors, fonts, radius, shadow } from '../theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapCanvasHandle>(null);
  const {
    origin,
    destination,
    mode,
    routes,
    status,
    message,
    location,
    locating,
    pickTarget,
    recents,
    setMode,
    setPickTarget,
    pickPlace,
    clearRoute,
    calculate,
    planQuickTrip,
    locateMe,
  } = useTrip();

  const hasResults = Boolean(routes);
  const bottomPadding = hasResults ? 430 : 372;

  const handleRecenter = () => {
    if (location) {
      mapRef.current?.zoomToUser();
    } else {
      void locateMe();
    }
  };

  return (
    <View style={styles.root}>
      <MapCanvas
        ref={mapRef}
        origin={origin}
        destination={destination}
        routes={routes}
        mode={hasResults ? 'results' : 'plan'}
        userLocation={location}
        topPadding={110}
        bottomPadding={bottomPadding}
        pickTarget={pickTarget}
        onPick={pickPlace}
        showLabels={hasResults}
      />

      <View style={[styles.topBar, { top: insets.top + 10 }]} pointerEvents="box-none">
        <View style={styles.brandChip}>
          <View style={styles.brandTile}>
            <BrandMark size={15} color={colors.white} />
          </View>
          <View>
            <Text style={styles.wordmark}>SHORT CUT</Text>
            <Text style={styles.tagline}>THE SHORTEST WAY THERE</Text>
          </View>
        </View>

        <View style={styles.topActions}>
          {hasResults ? (
            <IconButton
              icon="scan"
              label="Fit route on map"
              variant="glass"
              size={42}
              iconSize={18}
              onPress={() => mapRef.current?.fitRoutes()}
            />
          ) : null}
          <IconButton
            icon="locate"
            label="Recentre map on my location"
            variant="glass"
            size={42}
            iconSize={18}
            busy={locating}
            onPress={handleRecenter}
          />
        </View>
      </View>

      {pickTarget ? (
        <View style={[styles.pickBanner, { top: insets.top + 66 }]} pointerEvents="box-none">
          <View style={styles.pickPulseMuted}>
            <Ionicons name="pin" size={15} color={colors.coral} />
          </View>
          <Text style={styles.pickText}>
            Tap the map to set your {pickTarget === 'origin' ? 'starting point' : 'destination'}
          </Text>
          <Tap
            style={styles.pickClose}
            onPress={() => setPickTarget(null)}
            haptic="light"
            accessibilityLabel="Cancel map selection"
          >
            <Ionicons name="close" size={15} color={colors.muted} />
          </Tap>
        </View>
      ) : null}

      {hasResults ? (
        <RouteSheet
          routes={routes!}
          mode={mode}
          message={message}
          onStart={() => router.push('/navigate')}
          onDetails={() => router.push('/details')}
          onChange={clearRoute}
          onDismiss={clearRoute}
        />
      ) : (
        <PlannerSheet
          origin={origin}
          destination={destination}
          mode={mode}
          status={status}
          message={message}
          locating={locating}
          recents={recents}
          onOriginPress={() =>
            router.push({ pathname: '/search', params: { target: 'origin' } })
          }
          onDestinationPress={() =>
            router.push({ pathname: '/search', params: { target: 'destination' } })
          }
          onLocate={() => void locateMe()}
          onModeChange={setMode}
          onFind={() => void calculate()}
          onQuickDestination={(place) => void planQuickTrip(place)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paperDeep,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(250,251,245,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.85)',
    ...shadow.tiny,
  },
  brandTile: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coral,
  },
  wordmark: {
    fontFamily: fonts.displayBold,
    fontSize: 12.5,
    letterSpacing: 1.1,
    color: colors.ink,
  },
  tagline: {
    marginTop: 1,
    fontFamily: fonts.bold,
    fontSize: 6.5,
    letterSpacing: 1.25,
    color: colors.mutedLight,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    ...shadow.lifted,
  },
  pickPulseMuted: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coralSoft,
  },
  pickText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.paper,
  },
  pickClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
