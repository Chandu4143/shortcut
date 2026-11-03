import type { Coordinates, LatLng, Maneuver, RouteProgress, RouteLine } from '../types';

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;

export function haversine(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

/** Compass bearing from a to b, in degrees clockwise from north. */
export function bearing(a: Coordinates, b: Coordinates): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLon = toRadians(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function normalizeDelta(delta: number): number {
  let value = delta;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

export function toLngLat([lat, lon]: LatLng): [number, number] {
  return [lon, lat];
}

export function toLatLng([lon, lat]: [number, number]): LatLng {
  return [lat, lon];
}

export function cumulativeDistances(coordinates: LatLng[]): number[] {
  const distances = new Array<number>(coordinates.length);
  if (coordinates.length === 0) return distances;
  distances[0] = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    distances[index] =
      distances[index - 1] + haversine({ lat: previous[0], lon: previous[1] }, { lat: current[0], lon: current[1] });
  }
  return distances;
}

/** [west, south, east, north] for MapLibre. */
export function routeBounds(coordinates: LatLng[]): [number, number, number, number] {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const [lat, lon] of coordinates) {
    west = Math.min(west, lon);
    south = Math.min(south, lat);
    east = Math.max(east, lon);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

export function pointAtDistance(
  coordinates: LatLng[],
  cumulative: number[],
  distanceAlong: number,
): { point: LatLng; bearing: number } {
  if (coordinates.length === 0) return { point: [0, 0], bearing: 0 };
  if (coordinates.length === 1) return { point: coordinates[0], bearing: 0 };
  const target = Math.max(0, Math.min(distanceAlong, cumulative[cumulative.length - 1]));
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    if (cumulative[index + 1] >= target) {
      const segmentLength = cumulative[index + 1] - cumulative[index];
      const t = segmentLength > 0 ? (target - cumulative[index]) / segmentLength : 0;
      const a = coordinates[index];
      const b = coordinates[index + 1];
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        bearing: bearing({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }),
      };
    }
  }
  return {
    point: coordinates[coordinates.length - 1],
    bearing: bearing(
      { lat: coordinates[coordinates.length - 2][0], lon: coordinates[coordinates.length - 2][1] },
      { lat: coordinates[coordinates.length - 1][0], lon: coordinates[coordinates.length - 1][1] },
    ),
  };
}

export interface Projection {
  distanceAlong: number;
  distanceFromRoute: number;
  snapped: LatLng;
  bearing: number;
  segmentIndex: number;
}

/** Projects a GPS point onto the route, returning progress along it. */
export function projectOnRoute(
  coordinates: LatLng[],
  cumulative: number[],
  point: Coordinates,
): Projection {
  if (coordinates.length === 0) {
    return {
      distanceAlong: 0,
      distanceFromRoute: Number.POSITIVE_INFINITY,
      snapped: [point.lat, point.lon],
      bearing: 0,
      segmentIndex: 0,
    };
  }
  if (coordinates.length === 1) {
    return {
      distanceAlong: 0,
      distanceFromRoute: haversine(point, { lat: coordinates[0][0], lon: coordinates[0][1] }),
      snapped: coordinates[0],
      bearing: 0,
      segmentIndex: 0,
    };
  }

  const cosLat = Math.cos(toRadians(point.lat));
  let best: Projection | null = null;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const a = coordinates[index];
    const b = coordinates[index + 1];
    const ax = (a[1] - point.lon) * cosLat * 111_320;
    const ay = (a[0] - point.lat) * 110_540;
    const bx = (b[1] - point.lon) * cosLat * 111_320;
    const by = (b[0] - point.lat) * 110_540;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    const closestX = ax + dx * t;
    const closestY = ay + dy * t;
    const distance = Math.hypot(closestX, closestY);
    if (!best || distance < best.distanceFromRoute) {
      const segmentLength = cumulative[index + 1] - cumulative[index];
      best = {
        distanceAlong: cumulative[index] + segmentLength * t,
        distanceFromRoute: distance,
        snapped: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        bearing: bearing({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }),
        segmentIndex: index,
      };
    }
  }

  return best as Projection;
}

function modifierFor(delta: number): string {
  const magnitude = Math.abs(delta);
  const side = delta > 0 ? 'right' : 'left';
  if (magnitude > 155) return 'around';
  if (magnitude > 120) return `sharp ${side}`;
  if (magnitude > 55) return side;
  return `slight ${side}`;
}

function instructionFor(delta: number): string {
  const magnitude = Math.abs(delta);
  if (magnitude > 155) return 'Make a U-turn';
  const side = delta > 0 ? 'right' : 'left';
  if (magnitude > 120) return `Sharp ${side}`;
  if (magnitude > 55) return `Turn ${side}`;
  return `Slight ${side}`;
}

/** Geometry-only turn generation for the OpenStreetMap fallback graph. */
export function buildGeometryManeuvers(coordinates: LatLng[], totalDistance: number): Maneuver[] {
  if (coordinates.length < 2) {
    return [
      {
        key: 'arrive-0',
        instruction: 'Arrive',
        type: 'arrive',
        location: coordinates[0] ?? [0, 0],
        distanceFromStart: totalDistance,
        coordinateIndex: 0,
      },
    ];
  }

  const cumulative = cumulativeDistances(coordinates);
  const maneuvers: Maneuver[] = [
    {
      key: 'depart',
      instruction: 'Start',
      detail: 'Follow the highlighted route',
      type: 'depart',
      location: coordinates[0],
      distanceFromStart: 0,
      coordinateIndex: 0,
    },
  ];

  let lastTurnDistance = -Infinity;
  let lastTurnMagnitude = 0;

  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const distanceHere = cumulative[index];
    if (distanceHere < 30 || totalDistance - distanceHere < 25) continue;

    let back = index;
    while (back > 0 && distanceHere - cumulative[back] < 20) back -= 1;
    let forward = index;
    while (forward < coordinates.length - 1 && cumulative[forward] - distanceHere < 20) forward += 1;
    if (back === index || forward === index) continue;

    const before = coordinates[back];
    const here = coordinates[index];
    const after = coordinates[forward];
    const incoming = bearing({ lat: before[0], lon: before[1] }, { lat: here[0], lon: here[1] });
    const outgoing = bearing({ lat: here[0], lon: here[1] }, { lat: after[0], lon: after[1] });
    const delta = normalizeDelta(outgoing - incoming);
    const magnitude = Math.abs(delta);
    if (magnitude < 36) continue;

    if (distanceHere - lastTurnDistance < 45) {
      if (magnitude > lastTurnMagnitude && maneuvers.length > 1) {
        maneuvers[maneuvers.length - 1] = {
          key: `turn-${index}`,
          instruction: instructionFor(delta),
          detail: 'Mapped turn',
          type: 'turn',
          modifier: modifierFor(delta),
          location: here,
          distanceFromStart: distanceHere,
          coordinateIndex: index,
        };
        lastTurnMagnitude = magnitude;
      }
      continue;
    }

    maneuvers.push({
      key: `turn-${index}`,
      instruction: instructionFor(delta),
      detail: 'Mapped turn',
      type: 'turn',
      modifier: modifierFor(delta),
      location: here,
      distanceFromStart: distanceHere,
      coordinateIndex: index,
    });
    lastTurnDistance = distanceHere;
    lastTurnMagnitude = magnitude;
  }

  maneuvers.push({
    key: 'arrive',
    instruction: 'Arrive',
    detail: 'Destination',
    type: 'arrive',
    location: coordinates[coordinates.length - 1],
    distanceFromStart: totalDistance,
    coordinateIndex: coordinates.length - 1,
  });

  return maneuvers;
}

export function nextManeuver(maneuvers: Maneuver[], distanceAlong: number): { maneuver: Maneuver | null; distance: number } {
  const arrival = maneuvers.find((maneuver) => maneuver.type === 'arrive');
  for (const maneuver of maneuvers) {
    if (maneuver.type === 'depart') continue;
    if (maneuver.distanceFromStart > distanceAlong + 8) {
      return { maneuver, distance: Math.max(0, maneuver.distanceFromStart - distanceAlong) };
    }
  }
  return { maneuver: arrival ?? null, distance: arrival ? Math.max(0, arrival.distanceFromStart - distanceAlong) : 0 };
}

export function progressOnRoute(route: RouteLine, point: Coordinates, cumulative?: number[]): RouteProgress {
  const distances = cumulative ?? cumulativeDistances(route.coordinates);
  const projection = projectOnRoute(route.coordinates, distances, point);
  const distanceRemaining = Math.max(0, route.distanceMeters - projection.distanceAlong);
  const fraction = route.distanceMeters > 0 ? Math.min(1, projection.distanceAlong / route.distanceMeters) : 0;
  const next = nextManeuver(route.maneuvers, projection.distanceAlong);
  const speed = route.distanceMeters > 0 ? route.distanceMeters / Math.max(1, route.durationSeconds) : 1;
  return {
    distanceAlong: projection.distanceAlong,
    distanceRemaining,
    distanceFromRoute: projection.distanceFromRoute,
    fraction,
    snapped: projection.snapped,
    bearing: projection.bearing,
    nextManeuver: next.maneuver,
    distanceToManeuver: next.distance,
    etaSeconds: distanceRemaining / Math.max(1.2, speed),
    arrived: distanceRemaining < 22 || projection.distanceAlong >= route.distanceMeters - 18,
  };
}

export function midpoint(coordinates: LatLng[]): LatLng {
  if (coordinates.length === 0) return [17.385, 78.4867];
  return coordinates[Math.floor(coordinates.length / 2)];
}

export function isSamePoint(a: Coordinates, b: Coordinates, tolerance = 3): boolean {
  return haversine(a, b) <= tolerance;
}

export function parseDestinationFromUrl(raw: string): { lat: number; lon: number; label?: string } | null {
  const readCoords = (text: string) => {
    const m = text.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
  };

  const url = raw.trim();
  if (url.startsWith('geo:')) {
    const body = url.slice(4);
    const head = body.split('?')[0];
    const direct = readCoords(head);
    if (direct) return direct;
    try {
      const params = new URLSearchParams(body.includes('?') ? body.slice(body.indexOf('?') + 1) : '');
      const q = params.get('q') || params.get('query');
      if (q) {
        const c = readCoords(q);
        if (c) {
          const labelMatch = q.match(/\(([^)]+)\)/);
          return { ...c, label: labelMatch?.[1] };
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  if (url.startsWith('google.navigation:')) {
    const query = url.slice('google.navigation:'.length);
    try {
      const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
      const q = params.get('q') || params.get('query') || params.get('destination');
      if (q) {
        const c = readCoords(q);
        if (c) return c;
      }
    } catch {
      // ignore
    }
    const m = url.match(/[?&](?:q|query|destination)=([^&]+)/);
    if (m) {
      try {
        const decoded = decodeURIComponent(m[1]);
        const c = readCoords(decoded);
        if (c) return c;
      } catch {
        // ignore
      }
    }
    return null;
  }

  try {
    const u = new URL(url);
    const candidates = [
      u.searchParams.get('q'),
      u.searchParams.get('query'),
      u.searchParams.get('destination'),
      u.searchParams.get('daddr'),
      u.searchParams.get('ll'),
    ].filter(Boolean) as string[];
    for (const c0 of candidates) {
      const c = readCoords(c0);
      if (c) {
        const labelMatch = c0.match(/\(([^)]+)\)/);
        return { ...c, label: labelMatch?.[1] };
      }
    }
    const pm = u.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (pm) return { lat: Number(pm[1]), lon: Number(pm[2]) };

    // Custom-scheme intents such as shortcut://17.44,78.37?q=HITEC%20City are
    // parsed by Expo Router as a route, so read the host part as coordinates.
    const authority = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[?#]/)[0];
    const hostCoords = readCoords(decodeURIComponent(authority));
    if (hostCoords) {
      const q = u.searchParams.get('q') ?? u.searchParams.get('query');
      const label = q && !readCoords(q) ? q : undefined;
      return { ...hostCoords, label };
    }
  } catch {
    // ignore
  }
  return null;
}
