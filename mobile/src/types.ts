export type TravelMode = 'riding' | 'walking';

/** [latitude, longitude] – matches the web MVP. Convert at the map edge. */
export type LatLng = [number, number];

export type PlaceKind = 'gps' | 'search' | 'pin' | 'preset' | 'recent';

export interface Place {
  label: string;
  lat: number;
  lon: number;
  kind?: PlaceKind;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export type ManeuverType =
  | 'depart'
  | 'turn'
  | 'continue'
  | 'merge'
  | 'fork'
  | 'roundabout'
  | 'arrive';

export interface Maneuver {
  key: string;
  /** Short imperative used in the navigation card, e.g. "Turn left". */
  instruction: string;
  /** Full routing-engine sentence with street names when available. */
  detail?: string;
  type: ManeuverType;
  modifier?: string;
  location: LatLng;
  distanceFromStart: number;
  coordinateIndex: number;
}

export interface RouteLine {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  maneuvers: Maneuver[];
  warnings: string[];
}

export interface RoutePair {
  shortest: RouteLine;
  fastest: RouteLine;
  source: 'valhalla' | 'openstreetmap';
}

export interface UserPosition {
  lat: number;
  lon: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

export interface RouteProgress {
  distanceAlong: number;
  distanceRemaining: number;
  distanceFromRoute: number;
  fraction: number;
  snapped: LatLng;
  bearing: number;
  nextManeuver: Maneuver | null;
  distanceToManeuver: number;
  etaSeconds: number;
  arrived: boolean;
}
