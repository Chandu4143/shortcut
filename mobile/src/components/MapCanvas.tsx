import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  StyleSpecification,
} from '@maplibre/maplibre-react-native';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Linking, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../theme';
import { routeBounds, toLngLat } from '../lib/geo';
import type { LatLng, Place, RoutePair, UserPosition } from '../types';
import lightStyleJson from '../map/style.json';
import darkStyleJson from '../map/style-dark.json';
import { Tap } from './Tap';

const LIGHT_STYLE = lightStyleJson as unknown as StyleSpecification;
const DARK_STYLE = darkStyleJson as unknown as StyleSpecification;
const HYDERABAD: [number, number] = [78.4867, 17.385];

export interface MapCanvasHandle {
  fitRoutes: () => void;
  recenter: () => void;
  zoomToUser: () => void;
}

interface MapCanvasProps {
  origin: Place | null;
  destination: Place | null;
  routes: RoutePair | null;
  activeRoute?: 'shortest' | 'fastest';
  mode: 'plan' | 'results' | 'navigate';
  userLocation?: UserPosition | null;
  follow?: boolean;
  pickTarget?: 'origin' | 'destination' | null;
  onPick?: (place: Place) => void;
  onUserPan?: () => void;
  dark?: boolean;
  topPadding?: number;
  bottomPadding?: number;
  showLabels?: boolean;
  showAttribution?: boolean;
}

function lineFeature(coordinates: LatLng[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: coordinates.map(toLngLat),
    },
  };
}

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  {
    origin,
    destination,
    routes,
    activeRoute = 'shortest',
    mode,
    userLocation,
    follow = true,
    pickTarget,
    onPick,
    onUserPan,
    dark = false,
    topPadding = 160,
    bottomPadding = 380,
    showLabels = false,
    showAttribution = true,
  },
  ref,
) {
  const cameraRef = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);

  const routesShareLine = useMemo(() => {
    if (!routes) return false;
    return (
      routes.shortest.coordinates.length === routes.fastest.coordinates.length &&
      routes.shortest.coordinates.every(
        (point, index) =>
          Math.abs(point[0] - routes.fastest.coordinates[index][0]) < 0.000001 &&
          Math.abs(point[1] - routes.fastest.coordinates[index][1]) < 0.000001,
      )
    );
  }, [routes]);

  const primaryFeature = useMemo(() => {
    if (!routes) return null;
    return lineFeature(activeRoute === 'fastest' ? routes.fastest.coordinates : routes.shortest.coordinates);
  }, [activeRoute, routes]);

  const alternateFeature = useMemo(() => {
    if (!routes || routesShareLine) return null;
    return lineFeature(activeRoute === 'fastest' ? routes.shortest.coordinates : routes.fastest.coordinates);
  }, [activeRoute, routes, routesShareLine]);

  const fitRoutes = useCallback(
    (animated = true) => {
      if (!cameraRef.current) return;
      const padding = {
        top: topPadding,
        bottom: bottomPadding,
        left: 26,
        right: 26,
      };
      const coordinates = routes
        ? [...routes.shortest.coordinates, ...routes.fastest.coordinates]
        : [];
      if (coordinates.length > 1) {
        cameraRef.current.fitBounds(routeBounds(coordinates), {
          padding,
          duration: animated ? 750 : 0,
        });
        return;
      }
      const points = [
        ...(origin ? [[origin.lat, origin.lon] as LatLng] : []),
        ...(destination ? [[destination.lat, destination.lon] as LatLng] : []),
      ];
      if (points.length > 1) {
        cameraRef.current.fitBounds(routeBounds(points), {
          padding,
          duration: animated ? 700 : 0,
        });
      } else if (points.length === 1) {
        cameraRef.current.easeTo({
          center: toLngLat(points[0]),
          zoom: 15.2,
          duration: animated ? 700 : 0,
        });
      } else {
        cameraRef.current.easeTo({
          center: HYDERABAD,
          zoom: 12.2,
          duration: animated ? 700 : 0,
        });
      }
    },
    [bottomPadding, destination, origin, routes, topPadding],
  );

  const followUser = useCallback(
    (animated = true) => {
      if (!userLocation || !cameraRef.current) return;
      cameraRef.current.easeTo({
        center: [userLocation.lon, userLocation.lat],
        zoom: 16.6,
        pitch: 48,
        bearing: userLocation.heading ?? 0,
        padding: { top: 170, bottom: 290, left: 0, right: 0 },
        duration: animated ? 900 : 0,
      });
    },
    [userLocation],
  );

  useImperativeHandle(ref, () => ({
    fitRoutes: () => fitRoutes(true),
    recenter: () => {
      if (mode === 'navigate' && userLocation) {
        followUser(true);
        return;
      }
      fitRoutes(true);
    },
    zoomToUser: () => {
      if (userLocation && cameraRef.current) {
        cameraRef.current.easeTo({
          center: [userLocation.lon, userLocation.lat],
          zoom: 16,
          duration: 700,
        });
      }
    },
  }));

  useEffect(() => {
    if (!mapReady) return;
    if (mode === 'navigate') {
      if (userLocation && follow) {
        followUser(true);
      } else if (!userLocation && routes && cameraRef.current) {
        cameraRef.current.fitBounds(routeBounds(routes.shortest.coordinates), {
          padding: { top: 190, bottom: 300, left: 32, right: 32 },
          duration: 600,
        });
      }
      return;
    }
    fitRoutes(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, mode, routes, origin, destination, fitRoutes]);

  useEffect(() => {
    if (!mapReady || mode !== 'navigate' || !follow || !userLocation) {
      return;
    }
    followUser(true);
    // Follow only when the fix or bearing changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, mapReady, mode, userLocation?.heading, userLocation?.lat, userLocation?.lon]);

  const handlePress = useCallback(
    (event: { nativeEvent?: { lngLat?: [number, number] } }) => {
      if (!pickTarget || !onPick) return;
      const lngLat = event.nativeEvent?.lngLat;
      if (!lngLat) return;
      const [lon, lat] = lngLat;
      onPick({
        lat,
        lon,
        label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        kind: 'pin',
      });
    },
    [onPick, pickTarget],
  );

  const routeColor = dark ? '#FF6A47' : colors.coral;
  const alternativeColor = dark ? 'rgba(154, 176, 168, 0.75)' : 'rgba(90, 112, 118, 0.72)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Map
        mapStyle={dark ? DARK_STYLE : LIGHT_STYLE}
        style={StyleSheet.absoluteFill}
        logo={false}
        attribution={false}
        compass={false}
        scaleBar={false}
        androidView="texture"
        onDidFinishLoadingMap={() => setMapReady(true)}
        onDidFailLoadingMap={() => setMapReady(true)}
        onWillStartLoadingMap={() => setMapReady(false)}
        onPress={handlePress}
        onRegionWillChange={(event) => {
          if (event.nativeEvent?.userInteraction) onUserPan?.();
        }}
      >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: HYDERABAD, zoom: 12.2 }}
        minZoom={3}
        maxZoom={19}
      />

      {alternateFeature ? (
        <GeoJSONSource id="alternate-route" data={alternateFeature}>
          <Layer
            id="alternate-route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': alternativeColor,
              'line-width': 4,
              'line-opacity': 0.9,
              'line-dasharray': [2, 2.4],
            }}
          />
        </GeoJSONSource>
      ) : null}

      {primaryFeature ? (
        <>
          <GeoJSONSource id="active-glow" data={primaryFeature}>
            <Layer
              id="active-glow-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': routeColor,
                'line-width': 16,
                'line-opacity': dark ? 0.22 : 0.14,
                'line-blur': 6,
              }}
            />
          </GeoJSONSource>
          <GeoJSONSource id="active-casing" data={primaryFeature}>
            <Layer
              id="active-casing-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': dark ? 'rgba(255,255,255,0.92)' : '#FFFFFF',
                'line-width': 9,
                'line-opacity': 0.9,
              }}
            />
          </GeoJSONSource>
          <GeoJSONSource id="active-route" data={primaryFeature}>
            <Layer
              id="active-route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': routeColor,
                'line-width': 6,
                'line-opacity': 1,
              }}
            />
          </GeoJSONSource>
        </>
      ) : null}

      {origin && mode !== 'navigate' && !(origin.kind === 'gps' && userLocation) ? (
        <Marker lngLat={toLngLat([origin.lat, origin.lon])} anchor="bottom">
          <View style={styles.startMarkerWrap}>
            {showLabels ? (
              <View style={styles.markerLabel}>
                <Text style={styles.markerLabelText} numberOfLines={1}>
                  {origin.kind === 'gps' ? 'You' : 'Start'}
                </Text>
              </View>
            ) : null}
            <View style={styles.startMarker}>
              <View style={styles.startMarkerCore} />
            </View>
          </View>
        </Marker>
      ) : null}

      {destination ? (
        <Marker lngLat={toLngLat([destination.lat, destination.lon])} anchor="bottom">
          <View style={styles.endMarkerWrap}>
            {showLabels ? (
              <View style={styles.markerLabel}>
                <Text style={styles.markerLabelText} numberOfLines={1}>
                  {destination.label.split(',')[0]}
                </Text>
              </View>
            ) : null}
            <View style={styles.endMarker}>
              <View style={styles.endMarkerCore}>
                <Ionicons name="flag" size={12} color={colors.white} />
              </View>
            </View>
          </View>
        </Marker>
      ) : null}

      {userLocation ? (
        <Marker lngLat={[userLocation.lon, userLocation.lat]} anchor="center">
          <UserDot navigating={mode === 'navigate'} />
        </Marker>
      ) : null}
      </Map>

      {showAttribution ? (
        <Tap
          style={[
            styles.attribution,
            dark && styles.attributionDark,
            { bottom: Math.max(12, bottomPadding - 20) },
          ]}
          haptic="none"
          accessibilityRole="link"
          accessibilityLabel="Map data from OpenStreetMap and OpenFreeMap"
          onPress={() => {
            void Linking.openURL('https://www.openstreetmap.org/copyright');
          }}
        >
          <Text style={[styles.attributionText, dark && styles.attributionTextDark]}>
            © OpenStreetMap · OpenFreeMap
          </Text>
        </Tap>
      ) : null}
    </View>
  );
});

function UserDot({ navigating }: { navigating: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] });
  const opacity = pulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.35, 0.12, 0] });

  if (navigating) {
    return (
      <View style={styles.navDot}>
        <Ionicons name="navigate" size={18} color={colors.white} />
      </View>
    );
  }

  return (
    <View style={styles.userDotWrap}>
      <Animated.View
        style={[
          styles.userPulse,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
      <View style={styles.userDot}>
        <View style={styles.userDotCore} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  startMarkerWrap: {
    alignItems: 'center',
    gap: 5,
  },
  startMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10201E',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  startMarkerCore: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.white,
  },
  endMarkerWrap: {
    alignItems: 'center',
    gap: 5,
  },
  endMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10201E',
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  endMarkerCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.coral,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLabel: {
    maxWidth: 130,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(250,251,245,0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(23,43,40,0.12)',
  },
  markerLabelText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: colors.ink,
    letterSpacing: 0.2,
  },
  userDotWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.coral,
  },
  userDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10201E',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  userDotCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.coral,
  },
  navDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.coral,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  attribution: {
    position: 'absolute',
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(252,252,246,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(19,38,34,0.1)',
    ...shadow.tiny,
  },
  attributionDark: {
    backgroundColor: 'rgba(18,33,31,0.72)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  attributionText: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    letterSpacing: 0.1,
    color: colors.muted,
  },
  attributionTextDark: {
    color: 'rgba(242,243,234,0.62)',
  },
});
