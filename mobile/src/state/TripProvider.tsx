import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Place, RoutePair, TravelMode, UserPosition } from '../types';
import { findRoutes, reverseGeocode } from '../lib/routing';
import {
  clearRecents,
  loadRecents,
  loadSavedPlaces,
  loadVoiceEnabled,
  removeSavedPlace,
  saveRecent,
  saveSavedPlace,
  saveVoiceEnabled,
  type SavedPlaceKind,
  type SavedPlaces,
} from '../lib/storage';
import { HYDERABAD_CENTER } from '../data/places';

type TripStatus = 'idle' | 'loading' | 'ready' | 'error';
type LocationStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';
type PickTarget = 'origin' | 'destination' | null;
export type ActiveRoute = 'shortest' | 'fastest';

interface TripContextValue {
  origin: Place | null;
  destination: Place | null;
  mode: TravelMode;
  routes: RoutePair | null;
  activeRoute: ActiveRoute;
  status: TripStatus;
  message: string;
  location: UserPosition | null;
  locationStatus: LocationStatus;
  locating: boolean;
  pickTarget: PickTarget;
  recents: Place[];
  savedPlaces: SavedPlaces;
  voiceEnabled: boolean;
  setOrigin: (place: Place | null) => void;
  setDestination: (place: Place | null) => void;
  setMode: (mode: TravelMode) => void;
  setActiveRoute: (route: ActiveRoute) => void;
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
  savePlace: (kind: SavedPlaceKind, place: Place) => Promise<void>;
  forgetPlace: (kind: SavedPlaceKind) => Promise<void>;
  clearRecentPlaces: () => Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);

const DEFAULT_MESSAGE = 'Shortest distance first, with mapped access and one-way rules.';
const EMPTY_SAVED: SavedPlaces = { home: null, work: null };

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [origin, setOriginState] = useState<Place | null>(null);
  const [destination, setDestinationState] = useState<Place | null>(null);
  const [mode, setModeState] = useState<TravelMode>('riding');
  const [routes, setRoutes] = useState<RoutePair | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>('shortest');
  const [status, setStatus] = useState<TripStatus>('idle');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [location, setLocation] = useState<UserPosition | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('unknown');
  const [locating, setLocating] = useState(false);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [recents, setRecents] = useState<Place[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaces>(EMPTY_SAVED);
  const [voiceEnabled, setVoiceEnabledState] = useState(true);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    let active = true;
    Promise.all([loadRecents(), loadVoiceEnabled(), loadSavedPlaces()]).then(
      ([storedRecents, storedVoice, storedSaved]) => {
        if (!active) return;
        setRecents(storedRecents);
        setVoiceEnabledState(storedVoice);
        setSavedPlaces(storedSaved);
      },
    );
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
        void reverseGeocode(position.lat, position.lon)
          .then((label) => {
            if (!active || isCoordinateLabel(label)) return;
            setOriginState((current) => {
              if (!current || current.kind !== 'gps') return current;
              if (
                Math.abs(current.lat - position.lat) > 0.0005 ||
                Math.abs(current.lon - position.lon) > 0.0005
              ) {
                return current;
              }
              return { ...current, label };
            });
          })
          .catch(() => undefined);
      }
    })().catch(() => {
      if (active) setLocationStatus('unavailable');
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, []);

  const resetRoute = useCallback(() => {
    requestRef.current += 1;
    setRoutes(null);
    setActiveRoute('shortest');
    setStatus('idle');
    setMessage(DEFAULT_MESSAGE);
  }, []);

  const setOrigin = useCallback(
    (place: Place | null) => {
      setOriginState(place);
      setPickTarget(null);
      resetRoute();
    },
    [resetRoute],
  );

  const setDestination = useCallback(
    (place: Place | null) => {
      setDestinationState(place);
      setPickTarget(null);
      resetRoute();
    },
    [resetRoute],
  );

  const requestRoute = useCallback(
    async (from: Place, to: Place, travelMode: TravelMode): Promise<RoutePair | null> => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setStatus('loading');
      setMessage('Comparing the shortest and fastest mapped routes…');
      try {
        const pair = await findRoutes(from, to, travelMode);
        if (requestRef.current !== requestId) return null;
        setRoutes(pair);
        setActiveRoute('shortest');
        setStatus('ready');
        setMessage(
          pair.source === 'valhalla'
            ? 'Shortest route found · mapped access rules applied.'
            : 'Shortest route built from live OpenStreetMap street data.',
        );
        return pair;
      } catch (caught) {
        if (requestRef.current !== requestId) return null;
        setRoutes(null);
        setActiveRoute('shortest');
        setStatus('error');
        setMessage(caught instanceof Error ? caught.message : 'Route calculation failed. Try again.');
        return null;
      }
    },
    [],
  );

  /**
   * Switching travel mode should re-route in place, not throw the rider back to
   * the planner. The old route stays visible until the new one arrives.
   */
  const setTravelMode = useCallback(
    (next: TravelMode) => {
      if (next === mode) return;
      setModeState(next);
      if (!origin || !destination || !routes) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setStatus('loading');
      findRoutes(origin, destination, next)
        .then((pair) => {
          if (requestRef.current !== requestId) return;
          setRoutes(pair);
          setActiveRoute('shortest');
          setStatus('ready');
          setMessage(
            next === 'riding'
              ? 'Riding route · mapped access rules applied.'
              : 'Walking route · mapped access rules applied.',
          );
        })
        .catch(() => {
          if (requestRef.current !== requestId) return;
          setStatus(routes ? 'ready' : 'error');
          setMessage('Could not switch travel mode. Check your connection and try again.');
        });
    },
    [destination, mode, origin, routes],
  );

  const swapEndpoints = useCallback(() => {
    if (!origin && !destination) return;
    setOriginState(destination);
    setDestinationState(origin);
    setPickTarget(null);
    resetRoute();
  }, [destination, origin, resetRoute]);

  const clearRoute = useCallback(() => {
    resetRoute();
  }, [resetRoute]);

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
      resetRoute();
      const centre = { lat: position.lat, lon: position.lon };
      const label = await reverseGeocode(position.lat, position.lon);
      const resolved = isCoordinateLabel(label) ? 'My location' : label;
      setOriginState((existing) => {
        if (!existing || existing.kind !== 'gps') return existing;
        if (Math.abs(existing.lat - centre.lat) > 0.0005 || Math.abs(existing.lon - centre.lon) > 0.0005) {
          return existing;
        }
        return { ...existing, label: resolved };
      });
      return { ...place, label: resolved };
    } catch {
      setLocationStatus('unavailable');
      setMessage('Could not get a GPS fix. Search for a starting point or try again outdoors.');
      return null;
    } finally {
      setLocating(false);
    }
  }, [resetRoute]);

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
    if (!destination) {
      setStatus('error');
      setMessage('Choose a destination first.');
      return;
    }
    if (!origin) {
      setStatus('error');
      setMessage('Add a starting point — or use your current location.');
      return;
    }
    setPickTarget(null);
    const pair = await requestRoute(origin, destination, mode);
    if (pair) void saveRecent(destination).then(setRecents);
  }, [destination, mode, origin, requestRoute]);

  const planQuickTrip = useCallback(
    async (to: Place) => {
      const from: Place | null =
        origin ??
        (location
          ? { lat: location.lat, lon: location.lon, label: 'My location', kind: 'gps' }
          : null);
      setOriginState(from);
      setDestinationState(to);
      setPickTarget(null);
      if (!from) {
        resetRoute();
        setStatus('error');
        setMessage('Add a starting point — or use your current location.');
        return;
      }
      const pair = await requestRoute(from, to, mode);
      if (pair) void saveRecent(to).then(setRecents);
    },
    [location, mode, origin, requestRoute, resetRoute],
  );

  const recalculateFrom = useCallback(
    async (place: Place): Promise<RoutePair | null> => {
      if (!destination) return null;
      return requestRoute(place, destination, mode);
    },
    [destination, mode, requestRoute],
  );

  const pickPlace = useCallback(
    (place: Place) => {
      if (pickTarget === 'origin') {
        setOriginState(place);
        setPickTarget(null);
        resetRoute();
        void reverseGeocode(place.lat, place.lon).then((label) => {
          const resolved = isCoordinateLabel(label) ? 'Pinned location' : label;
          setOriginState((current) =>
            current &&
            Math.abs(current.lat - place.lat) < 0.00001 &&
            Math.abs(current.lon - place.lon) < 0.00001
              ? { ...current, label: resolved }
              : current,
          );
        });
      } else if (pickTarget === 'destination') {
        setDestinationState(place);
        setPickTarget(null);
        void planQuickTrip(place);
        void reverseGeocode(place.lat, place.lon).then((label) => {
          const resolved = isCoordinateLabel(label) ? 'Pinned location' : label;
          const named = { ...place, label: resolved };
          setDestinationState((current) =>
            current &&
            Math.abs(current.lat - place.lat) < 0.00001 &&
            Math.abs(current.lon - place.lon) < 0.00001
              ? { ...current, label: resolved }
              : current,
          );
          void saveRecent(named).then(setRecents);
        });
      } else {
        setPickTarget(null);
      }
    },
    [pickTarget, planQuickTrip, resetRoute],
  );

  const savePlace = useCallback(async (kind: SavedPlaceKind, place: Place) => {
    setSavedPlaces(await saveSavedPlace(kind, place));
  }, []);

  const forgetPlace = useCallback(async (kind: SavedPlaceKind) => {
    setSavedPlaces(await removeSavedPlace(kind));
  }, []);

  const clearRecentPlaces = useCallback(async () => {
    setRecents(await clearRecents());
  }, []);

  const value: TripContextValue = {
    origin,
    destination,
    mode,
    routes,
    activeRoute,
    status,
    message,
    location,
    locationStatus,
    locating,
    pickTarget,
    recents,
    savedPlaces,
    voiceEnabled,
    setOrigin,
    setDestination,
    setMode: setTravelMode,
    setActiveRoute,
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
    savePlace,
    forgetPlace,
    clearRecentPlaces,
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) throw new Error('useTrip must be used inside TripProvider');
  return context;
}

function isCoordinateLabel(label: string) {
  return /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(label.trim());
}

function toUserPosition(location: Location.LocationObject): UserPosition {  return {
    lat: location.coords.latitude,
    lon: location.coords.longitude,
    accuracy: location.coords.accuracy ?? undefined,
    heading: location.coords.heading,
    speed: location.coords.speed,
    timestamp: location.timestamp,
  };
}

/** Fallback used by demos and deep links when no location is available. */
export const DEMO_ORIGIN: Place = {
  label: 'Koti, Hyderabad',
  lat: HYDERABAD_CENTER.lat,
  lon: HYDERABAD_CENTER.lon,
  kind: 'preset',
};
