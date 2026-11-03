import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Place, RoutePair, TravelMode, UserPosition } from '../types';
import { findRoutes, reverseGeocode } from '../lib/routing';
import { loadRecents, loadVoiceEnabled, saveRecent, saveVoiceEnabled } from '../lib/storage';
import { HYDERABAD_CENTER } from '../data/places';

type TripStatus = 'idle' | 'loading' | 'ready' | 'error';
type LocationStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';
type PickTarget = 'origin' | 'destination' | null;

interface TripContextValue {
  origin: Place | null;
  destination: Place | null;
  mode: TravelMode;
  routes: RoutePair | null;
  status: TripStatus;
  message: string;
  location: UserPosition | null;
  locationStatus: LocationStatus;
  locating: boolean;
  pickTarget: PickTarget;
  recents: Place[];
  voiceEnabled: boolean;
  setOrigin: (place: Place | null) => void;
  setDestination: (place: Place | null) => void;
  setMode: (mode: TravelMode) => void;
  swapEndpoints: () => void;
  setPickTarget: (target: PickTarget) => void;
  pickPlace: (place: Place) => void;
  clearRoute: () => void;
  calculate: () => Promise<void>;
  planQuickTrip: (destination: Place) => Promise<void>;
  recalculateFrom: (place: Place) => Promise<RoutePair | null>;
  locateMe: () => Promise<Place | null>;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  setVoiceEnabled: (enabled: boolean) => void;
}

const TripContext = createContext<TripContextValue | null>(null);

const DEFAULT_MESSAGE = 'Routes follow mapped access and one-way restrictions.';

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [origin, setOriginState] = useState<Place | null>(null);
  const [destination, setDestinationState] = useState<Place | null>(null);
  const [mode, setModeState] = useState<TravelMode>('riding');
  const [routes, setRoutes] = useState<RoutePair | null>(null);
  const [status, setStatus] = useState<TripStatus>('idle');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [location, setLocation] = useState<UserPosition | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('unknown');
  const [locating, setLocating] = useState(false);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [recents, setRecents] = useState<Place[]>([]);
  const [voiceEnabled, setVoiceEnabledState] = useState(true);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    let active = true;
    Promise.all([loadRecents(), loadVoiceEnabled()]).then(([storedRecents, storedVoice]) => {
      if (!active) return;
      setRecents(storedRecents);
      setVoiceEnabledState(storedVoice);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!active) return;
      if (permission.status !== 'granted') {
        setLocationStatus(permission.canAskAgain ? 'unknown' : 'denied');
        return;
      }
      setLocationStatus('granted');
      // Prefer a fresh fix over a stale cached one (emulator default = Mountain View).
      let positionSource: Location.LocationObject | null = null;
      try {
        positionSource = await Promise.race<Location.LocationObject>([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<Location.LocationObject>((_, reject) =>
            setTimeout(() => reject(new Error('location-timeout')), 6000),
          ),
        ]);
      } catch {
        positionSource = await Location.getLastKnownPositionAsync({
          maxAge: 120_000,
          requiredAccuracy: 200,
        });
      }
      if (positionSource && active) {
        const position = toUserPosition(positionSource);
        setLocation(position);
        setOriginState((current) =>
          current ?? {
            lat: position.lat,
            lon: position.lon,
            label: 'My location',
            kind: 'gps',
          },
        );
      }
    })().catch(() => {
      if (active) setLocationStatus('unavailable');
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setRoutes(null);
    setStatus('idle');
    setMessage(DEFAULT_MESSAGE);
  }, [origin, destination, mode]);

  useEffect(() => {
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, []);

  const setOrigin = useCallback((place: Place | null) => {
    setOriginState(place);
    setPickTarget(null);
  }, []);

  const setDestination = useCallback((place: Place | null) => {
    setDestinationState(place);
    setPickTarget(null);
  }, []);

  const setTravelMode = useCallback((next: TravelMode) => {
    setModeState(next);
  }, []);

  const swapEndpoints = useCallback(() => {
    setOriginState(destination);
    setDestinationState(origin);
  }, [destination, origin]);

  const clearRoute = useCallback(() => {
    setRoutes(null);
    setStatus('idle');
    setMessage(DEFAULT_MESSAGE);
  }, []);

  const locateMe = useCallback(async (): Promise<Place | null> => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationStatus('denied');
        setMessage('Location is off. Search for a starting point instead.');
        return null;
      }
      setLocationStatus('granted');
      // Prefer a fresh GPS fix; fall back to last-known only on failure/timeout.
      let positionSource: Location.LocationObject | null = null;
      try {
        positionSource = await Promise.race<Location.LocationObject>([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<Location.LocationObject>((_, reject) =>
            setTimeout(() => reject(new Error('location-timeout')), 8000),
          ),
        ]);
      } catch {
        positionSource = await Location.getLastKnownPositionAsync({
          maxAge: 60_000,
          requiredAccuracy: 120,
        });
      }
      if (!positionSource) throw new Error('No location fix available.');
      const position = toUserPosition(positionSource);
      setLocation(position);
      const place: Place = {
        lat: position.lat,
        lon: position.lon,
        label: 'My location',
        kind: 'gps',
      };
      setOriginState(place);
      setPickTarget(null);
      setMessage(DEFAULT_MESSAGE);
      const centre = { lat: position.lat, lon: position.lon };
      const label = await reverseGeocode(position.lat, position.lon);
      setOriginState((existing) => {
        if (!existing || existing.kind !== 'gps') return existing;
        if (Math.abs(existing.lat - centre.lat) > 0.0005 || Math.abs(existing.lon - centre.lon) > 0.0005) {
          return existing;
        }
        return { ...existing, label };
      });
      return { ...place, label };
    } catch {
      setLocationStatus('unavailable');
      setMessage('Could not get a GPS fix. Search for a starting point or try again outdoors.');
      return null;
    } finally {
      setLocating(false);
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (watchRef.current) return;
    const permission =
      (await Location.getForegroundPermissionsAsync()).status === 'granted'
        ? { status: 'granted' as const }
        : await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setLocationStatus('denied');
      return;
    }
    setLocationStatus('granted');
    try {
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 4,
          timeInterval: 1200,
        },
        (update) => {
          setLocation(toUserPosition(update));
        },
      );
    } catch {
      setLocationStatus('unavailable');
    }
  }, []);

  const stopTracking = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const setVoiceEnabled = useCallback((enabled: boolean) => {
    setVoiceEnabledState(enabled);
    void saveVoiceEnabled(enabled);
  }, []);

  const calculate = useCallback(async () => {
    if (!origin || !destination) {
      setStatus('error');
      setMessage(
        !destination
          ? 'Add a destination to find the shortest route.'
          : 'Add a starting point — or use your current location.',
      );
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setPickTarget(null);
    setStatus('loading');
    setMessage('Comparing the shortest and fastest mapped routes…');
    try {
      const pair = await findRoutes(origin, destination, mode);
      if (requestRef.current !== requestId) return;
      setRoutes(pair);
      setStatus('ready');
      setMessage(
        pair.source === 'valhalla'
          ? 'Shortest route found · mapped access rules applied.'
          : 'Shortest route built from live OpenStreetMap street data.',
      );
      void saveRecent(destination).then(setRecents);
    } catch (caught) {
      if (requestRef.current !== requestId) return;
      setRoutes(null);
      setStatus('error');
      setMessage(caught instanceof Error ? caught.message : 'Route calculation failed. Try again.');
    }
  }, [destination, mode, origin]);

  const planQuickTrip = useCallback(
    async (to: Place) => {
      const from: Place =
        origin ??
        (location
          ? { lat: location.lat, lon: location.lon, label: 'My location', kind: 'gps' }
          : DEMO_ORIGIN);
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setOriginState(origin ?? from);
      setDestinationState(to);
      setPickTarget(null);
      setStatus('loading');
      setMessage('Comparing the shortest and fastest mapped routes…');
      try {
        const pair = await findRoutes(from, to, mode);
        if (requestRef.current !== requestId) return;
        setRoutes(pair);
        setStatus('ready');
        setMessage(
          pair.source === 'valhalla'
            ? 'Shortest route found · mapped access rules applied.'
            : 'Shortest route built from live OpenStreetMap street data.',
        );
        void saveRecent(to).then(setRecents);
      } catch (caught) {
        if (requestRef.current !== requestId) return;
        setRoutes(null);
        setStatus('error');
        setMessage(caught instanceof Error ? caught.message : 'Route calculation failed. Try again.');
      }
    },
    [location, mode, origin],
  );

  const recalculateFrom = useCallback(
    async (place: Place): Promise<RoutePair | null> => {
      if (!destination) return null;
      try {
        const pair = await findRoutes(place, destination, mode);
        setRoutes(pair);
        setStatus('ready');
        return pair;
      } catch {
        return null;
      }
    },
    [destination, mode],
  );

  const pickPlace = useCallback(
    (place: Place) => {
      if (pickTarget === 'origin') {
        setOriginState(place);
      } else if (pickTarget === 'destination') {
        setDestinationState(place);
        void saveRecent(place).then(setRecents);
      }
      setPickTarget(null);
    },
    [pickTarget],
  );

  const value: TripContextValue = {
    origin,
    destination,
    mode,
    routes,
    status,
    message,
    location,
    locationStatus,
    locating,
    pickTarget,
    recents,
    voiceEnabled,
    setOrigin,
    setDestination,
    setMode: setTravelMode,
    swapEndpoints,
    setPickTarget,
    pickPlace,
    clearRoute,
    calculate,
    planQuickTrip,
    recalculateFrom,
    locateMe,
    startTracking,
    stopTracking,
    setVoiceEnabled,
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) throw new Error('useTrip must be used inside TripProvider');
  return context;
}

function toUserPosition(location: Location.LocationObject): UserPosition {
  return {
    lat: location.coords.latitude,
    lon: location.coords.longitude,
    accuracy: location.coords.accuracy ?? undefined,
    heading: location.coords.heading,
    speed: location.coords.speed,
    timestamp: location.timestamp,
  };
}

export const DEMO_ORIGIN: Place = {
  label: 'Koti, Hyderabad',
  lat: HYDERABAD_CENTER.lat,
  lon: HYDERABAD_CENTER.lon,
  kind: 'preset',
};
