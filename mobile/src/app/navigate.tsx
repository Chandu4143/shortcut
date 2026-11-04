import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../components/Controls';
import { ManeuverIcon } from '../components/ManeuverIcon';
import { MapCanvas } from '../components/MapCanvas';
import { Tap } from '../components/Tap';
import { cumulativeDistances, bearing, pointAtDistance, progressOnRoute } from '../lib/geo';
import { formatArrival, formatDistance, formatDuration, shortLabel } from '../lib/format';
import { useTrip } from '../state/TripProvider';
import { colors, fonts, radius, shadow } from '../theme';

const SIM_STEP_METERS = 6;
const SIM_TICK_MS = 520;
const OFF_ROUTE_METERS = 42;
const REROUTE_COOLDOWN_MS = 9000;

export default function NavigateScreen() {
  const insets = useSafeAreaInsets();
  const {
    routes,
    destination,
    mode,
    activeRoute,
    location,
    locationStatus,
    voiceEnabled,
    setVoiceEnabled,
    recalculateFrom,
    startTracking,
    stopTracking,
  } = useTrip();

  const route = routes?.[activeRoute] ?? routes?.shortest;
  const [simActive, setSimActive] = useState(false);
  const [simPlaying, setSimPlaying] = useState(false);
  const [simDistance, setSimDistance] = useState(0);
  const [follow, setFollow] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [notice, setNotice] = useState('');
  const [arrivedOnce, setArrivedOnce] = useState(false);

  const speakRef = useRef(new Set<string>());
  const reroutingRef = useRef(false);
  const offRouteCount = useRef(0);
  const lastRerouteAt = useRef(0);

  const cumulative = useMemo(
    () => (route ? cumulativeDistances(route.coordinates) : []),
    [route],
  );

  const demoPosition = useMemo(() => {
    if (!simActive || !route || !cumulative.length) return null;
    return pointAtDistance(route.coordinates, cumulative, simDistance);
  }, [cumulative, route, simActive, simDistance]);

  const position = useMemo(() => {
    if (demoPosition) {
      return { lat: demoPosition.point[0], lon: demoPosition.point[1], heading: demoPosition.bearing };
    }
    if (location) {
      return { lat: location.lat, lon: location.lon, heading: location.heading ?? null };
    }
    return null;
  }, [demoPosition, location]);

  const progress = useMemo(() => {
    if (!route || !position) return null;
    return progressOnRoute(route, { lat: position.lat, lon: position.lon });
  }, [position, route]);

  const arrived = Boolean(progress?.arrived);
  const remaining = progress?.distanceRemaining ?? route?.distanceMeters ?? 0;
  const etaSeconds = progress?.etaSeconds ?? route?.durationSeconds ?? 0;
  const fraction = progress?.fraction ?? 0;
  const nextManeuver = progress?.nextManeuver ?? route?.maneuvers[0] ?? null;

  const guidanceBearing = useMemo(() => {
    if (!position) return null;
    const gpsSpeed = location?.speed ?? 0;
    if (
      position.heading != null &&
      Number.isFinite(position.heading) &&
      (simActive || gpsSpeed > 1.2)
    ) {
      return position.heading;
    }
    // A stationary GPS heading is usually 0 (north). Face the route instead.
    if (progress) return progress.bearing;
    if (!nextManeuver) return null;
    return bearing(
      { lat: position.lat, lon: position.lon },
      { lat: nextManeuver.location[0], lon: nextManeuver.location[1] },
    );
  }, [location?.speed, nextManeuver, position, progress, simActive]);

  useEffect(() => {
    void startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  useEffect(() => {
    if (!simActive || !simPlaying || !route) return;
    const timer = setInterval(() => {
      setSimDistance((current) => Math.min(route.distanceMeters, current + SIM_STEP_METERS));
    }, SIM_TICK_MS);
    return () => clearInterval(timer);
  }, [route, simActive, simPlaying]);

  useEffect(() => {
    if (simActive && route && simDistance >= route.distanceMeters) {
      setSimPlaying(false);
    }
  }, [route, simActive, simDistance]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4200);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    speakRef.current.clear();
  }, [route]);

  useEffect(() => {
    if (!arrived || arrivedOnce) return;
    setArrivedOnce(true);
    setSimPlaying(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (voiceEnabled) {
      Speech.speak('You have arrived at your destination.');
    }
  }, [arrived, arrivedOnce, voiceEnabled]);

  useEffect(() => {
    const maneuver = progress?.nextManeuver;
    if (!maneuver || !voiceEnabled || arrived || !progress) return;
    if (progress.distanceToManeuver > 260) return;
    if (speakRef.current.has(maneuver.key)) return;
    speakRef.current.add(maneuver.key);
    const detail =
      maneuver.detail && maneuver.detail !== maneuver.instruction ? `. ${maneuver.detail}` : '';
    Speech.speak(`${maneuver.instruction}${detail}`, { rate: 0.98, pitch: 1.02 });
  }, [arrived, progress, voiceEnabled]);

  useEffect(() => {
    if (!progress || simActive || reroutingRef.current || arrived || !position) {
      offRouteCount.current = 0;
      return;
    }
    if (progress.distanceFromRoute > OFF_ROUTE_METERS) {
      offRouteCount.current += 1;
    } else {
      offRouteCount.current = 0;
    }
    const now = Date.now();
    if (
      offRouteCount.current >= 2 &&
      now - lastRerouteAt.current > REROUTE_COOLDOWN_MS
    ) {
      offRouteCount.current = 0;
      lastRerouteAt.current = now;
      reroutingRef.current = true;
      setRerouting(true);
      setNotice('You left the route — finding a shorter way back.');
      if (voiceEnabled) Speech.speak('Off route. Rerouting.');
      void recalculateFrom({
        lat: position.lat,
        lon: position.lon,
        label: 'Current location',
        kind: 'gps',
      })
        .then((pair) => {
          if (!pair) setNotice('Could not reroute. Follow the highlighted route.');
        })
        .finally(() => {
          reroutingRef.current = false;
          setRerouting(false);
        });
    }
  }, [
    arrived,
    position,
    progress,
    recalculateFrom,
    simActive,
    voiceEnabled,
  ]);

  const endTrip = useCallback(() => {
    Speech.stop();
    stopTracking();
    router.replace('/');
  }, [stopTracking]);

  const confirmEndTrip = useCallback(() => {
    Alert.alert('End navigation?', 'Your route will be closed and the map stays where it is.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: endTrip },
    ]);
  }, [endTrip]);

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (!next) {
      Speech.stop();
    } else {
      Speech.speak('Voice guidance on.');
    }
  };

  const togglePreview = () => {
    if (!simActive) {
      setSimDistance(0);
      setSimActive(true);
      setSimPlaying(true);
      setFollow(true);
      return;
    }
    setSimPlaying((current) => !current);
  };

  const stopPreview = () => {
    setSimActive(false);
    setSimPlaying(false);
    setSimDistance(0);
  };

  if (!route) return <Redirect href="/" />;

  const speedKph = Math.round(
    (route.distanceMeters / Math.max(1, route.durationSeconds)) * 3.6,
  );
  const accuracy = location?.accuracy ? `±${Math.round(location.accuracy)} m` : null;
  const liveSpeed =
    location?.speed != null && location.speed >= 0.5 ? Math.round(location.speed * 3.6) : null;
  const speedLabel = simActive
    ? 'Preview'
    : liveSpeed != null
      ? `${liveSpeed} km/h`
      : accuracy
        ? `GPS ${accuracy}`
        : `${speedKph} km/h avg`;
  const modeLabel = mode === 'riding' ? 'Riding' : 'Walking';
  const nextNextManeuver = (() => {
    if (!progress?.nextManeuver) return null;
    const index = route.maneuvers.findIndex(
      (maneuver) => maneuver.key === progress.nextManeuver?.key,
    );
    return index >= 0 ? route.maneuvers[index + 1] ?? null : null;
  })();
  const nextInstruction = nextManeuver?.instruction ?? 'Follow the route';
  const rawDetail = nextManeuver?.detail?.trim();
  const nextDetail =
    rawDetail &&
    rawDetail.replace(/[.\s]/g, '').toLowerCase() !==
      nextInstruction.replace(/[.\s]/g, '').toLowerCase()
      ? rawDetail
      : null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <MapCanvas
        origin={null}
        destination={destination}
        routes={routes}
        activeRoute={activeRoute}
        mode="navigate"
        userLocation={
          position
            ? {
                lat: position.lat,
                lon: position.lon,
                heading: guidanceBearing,
              }
            : null
        }
        topPadding={200}
        bottomPadding={310}
        dark
        follow={follow}
        onUserPan={() => setFollow(false)}
      />

      <View style={[styles.topOverlay, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.navHeader}>
          <View style={styles.navChip}>
            <View style={styles.navChipDot} />
            <Text style={styles.navChipText}>{simActive ? 'Previewing route' : 'Navigating'}</Text>
            <Text style={styles.navChipMode}>· {modeLabel}</Text>
          </View>
          <View style={styles.navActions}>
            <IconButton
              icon={voiceEnabled ? 'volume-high' : 'volume-mute'}
              label={voiceEnabled ? 'Mute voice guidance' : 'Enable voice guidance'}
              variant="dark"
              size={40}
              iconSize={17}
              onPress={toggleVoice}
            />
            <IconButton
              icon="close"
              label="End navigation"
              variant="dark"
              size={40}
              iconSize={18}
              onPress={confirmEndTrip}
            />
          </View>
        </View>

        {arrived ? (
          <View style={[styles.maneuverCard, styles.arrivedCard]}>
            <View style={styles.arrivedIcon}>
              <Ionicons name="checkmark" size={28} color={colors.navInk} />
            </View>
            <View style={styles.maneuverCopy}>
              <Text style={styles.maneuverKicker}>Journey complete</Text>
              <Text style={styles.maneuverTitle}>You&apos;ve arrived</Text>
              <Text style={styles.maneuverDetail} numberOfLines={2}>
                {formatDistance(route.distanceMeters)} covered on the{' '}
                {activeRoute === 'fastest' ? 'fastest' : 'shortest'} route
                {destination ? ` to ${shortLabel(destination.label, 1)}` : ''}.
              </Text>
            </View>
          </View>
        ) : progress ? (
          <View style={styles.maneuverCard}>
            <View style={styles.maneuverIconWrap}>
              <ManeuverIcon
                maneuver={nextManeuver}
                size={30}
                containerSize={62}
                color={colors.white}
                background="rgba(255,255,255,0.1)"
              />
            </View>
            <View style={styles.maneuverCopy}>
              <View style={styles.maneuverTopRow}>
                <Text style={styles.maneuverKicker}>
                  {nextManeuver?.type === 'arrive' ? 'Destination' : 'Next maneuver'}
                </Text>
                <Text style={styles.maneuverDistance}>
                  {formatDistance(progress.distanceToManeuver)}
                </Text>
              </View>
              <Text style={styles.maneuverTitle} numberOfLines={1}>
                {nextInstruction}
              </Text>
              <Text style={styles.maneuverDetail} numberOfLines={2}>
                {nextDetail ?? destination?.label ?? 'Continue on the highlighted route'}
              </Text>
              {nextNextManeuver && nextNextManeuver.type !== 'arrive' ? (
                <View style={styles.thenRow}>
                  <Text style={styles.thenLabel}>Then</Text>
                  <Text style={styles.thenText} numberOfLines={1}>
                    {nextNextManeuver.instruction}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.maneuverCard}>
            <View style={styles.waitingIcon}>
              <ActivityIndicator size="small" color={colors.coral} />
            </View>
            <View style={styles.maneuverCopy}>
              <Text style={styles.maneuverKicker}>Position</Text>
              <Text style={styles.maneuverTitle}>Getting your GPS fix</Text>
              <Text style={styles.maneuverDetail} numberOfLines={2}>
                {locationStatus === 'denied'
                  ? 'Location is off. Preview the drive from the route start below.'
                  : 'Hold tight — or preview the drive from the route start.'}
              </Text>
            </View>
          </View>
        )}

        {rerouting ? (
          <View style={styles.statusBanner}>
            <ActivityIndicator size="small" color={colors.coral} />
            <Text style={styles.statusText}>Finding a shorter way back…</Text>
          </View>
        ) : notice ? (
          <View style={styles.statusBanner}>
            <Ionicons name="information-circle" size={15} color={colors.coral} />
            <Text style={styles.statusText}>{notice}</Text>
          </View>
        ) : progress && progress.distanceFromRoute > OFF_ROUTE_METERS && !simActive ? (
          <View style={styles.statusBanner}>
            <Ionicons name="warning" size={15} color={colors.amber} />
            <Text style={styles.statusText}>Off the shortest route</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, fraction * 100)}%` }]} />
        </View>

        <View style={styles.remainingRow}>
          <View style={styles.remainingCopy}>
            <Text style={styles.remainingLabel}>Distance remaining</Text>
            <Text style={styles.remainingValue}>{formatDistance(remaining)}</Text>
            <Text style={styles.remainingMeta}>
              {arrived
                ? 'You have reached the destination'
                : `${formatDuration(etaSeconds)} · arrive ${formatArrival(etaSeconds)}`}
            </Text>
          </View>
          <View style={styles.statsColumn}>
            <View style={styles.statRow}>
              <Ionicons name="speedometer-outline" size={12} color="rgba(240,242,233,0.5)" />
              <Text style={styles.statText}>{speedLabel}</Text>
            </View>
            <View style={styles.statRow}>
              <Ionicons name="git-commit-outline" size={12} color="rgba(240,242,233,0.5)" />
              <Text style={styles.statText}>{formatDistance(route.distanceMeters)} total</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          {arrived ? (
            <Tap
              style={styles.doneButton}
              onPress={endTrip}
              haptic="medium"
              accessibilityLabel="Finish navigation"
            >
              <Ionicons name="checkmark" size={18} color={colors.white} />
              <Text style={styles.doneText}>Done</Text>
            </Tap>
          ) : (
            <>
              <Tap
                style={styles.previewButton}
                onPress={togglePreview}
                haptic="light"
                accessibilityLabel={
                  simActive ? 'Pause route preview' : `Preview the ${mode === 'riding' ? 'ride' : 'walk'}`
                }
              >
                <Ionicons
                  name={simActive && simPlaying ? 'pause' : 'play'}
                  size={14}
                  color={colors.paper}
                />
                <Text style={styles.previewText}>
                  {simActive
                    ? simPlaying
                      ? 'Pause preview'
                      : 'Resume preview'
                    : `Preview ${mode === 'riding' ? 'ride' : 'walk'}`}
                </Text>
              </Tap>
              {simActive ? (
                <Tap
                  style={styles.iconAction}
                  onPress={stopPreview}
                  haptic="none"
                  accessibilityLabel="Stop route preview"
                >
                  <Ionicons name="stop" size={14} color="rgba(240,242,233,0.7)" />
                </Tap>
              ) : null}
              <View style={styles.actionSpacer} />
              {!follow ? (
                <Tap
                  style={styles.iconAction}
                  onPress={() => {
                    setFollow(true);
                    setNotice('');
                  }}
                  haptic="light"
                  accessibilityLabel="Recentre on my location"
                >
                  <Ionicons name="locate" size={16} color={colors.paper} />
                </Tap>
              ) : null}
              <Tap
                style={styles.endButton}
                onPress={confirmEndTrip}
                haptic="medium"
                accessibilityLabel="End navigation"
              >
                <Text style={styles.endText}>End</Text>
              </Tap>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navInk,
  },
  topOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 8,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,33,31,0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  navChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mintBright,
  },
  navChipText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.paper,
  },
  navChipMode: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: 'rgba(240,242,233,0.64)',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  maneuverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 13,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(18,33,31,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    ...shadow.lifted,
  },
  arrivedCard: {
    borderColor: 'rgba(47,175,122,0.35)',
  },
  maneuverIconWrap: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(228,85,55,0.13)',
  },
  arrivedIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mintBright,
  },
  waitingIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(228,85,55,0.13)',
  },
  maneuverCopy: {
    flex: 1,
    gap: 2,
  },
  maneuverTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  maneuverKicker: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: 'rgba(240,242,233,0.62)',
  },
  maneuverDistance: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.coral,
  },
  maneuverTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: -0.8,
    color: colors.paper,
  },
  maneuverDetail: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: 'rgba(240,242,233,0.68)',
  },
  thenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  thenLabel: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(240,242,233,0.6)',
  },
  thenText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 10,
    color: 'rgba(240,242,233,0.82)',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,33,31,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: 'rgba(240,242,233,0.82)',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    backgroundColor: 'rgba(18,33,31,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    ...shadow.lifted,
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 22,
    right: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.mintBright,
  },
  remainingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  remainingCopy: {
    flex: 1,
  },
  remainingLabel: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: 'rgba(240,242,233,0.62)',
  },
  remainingValue: {
    marginTop: 1,
    fontFamily: fonts.displayBold,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -2.4,
    color: colors.paper,
  },
  remainingMeta: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: 'rgba(240,242,233,0.68)',
  },
  statsColumn: {
    alignItems: 'flex-end',
    gap: 5,
    paddingBottom: 3,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: 'rgba(240,242,233,0.72)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 13,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  previewText: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: 'rgba(240,242,233,0.82)',
  },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionSpacer: {
    flex: 1,
  },
  endButton: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(228,85,55,0.55)',
    backgroundColor: 'rgba(228,85,55,0.12)',
  },
  endText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#FF8A70',
  },
  doneButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.mintBright,
  },
  doneText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.navInk,
  },
});
