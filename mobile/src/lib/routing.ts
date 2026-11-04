import type { LatLng, Maneuver, Place, RouteLine, RoutePair, TravelMode } from '../types';
import { HYDERABAD_CENTER, HYDERABAD_VIEWBOX, searchPresetPlaces } from '../data/places';
import {
  buildGeometryManeuvers,
  cumulativeDistances,
  haversine,
  isSamePoint,
  toLatLng,
} from './geo';

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
const VALHALLA_TIMEOUT_MS = 16_000;
const OVERPASS_REQUEST_TIMEOUT_MS = 14_000;
const SEARCH_TIMEOUT_MS = 9_000;
const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

class MinHeap {
  private items: { id: string; cost: number }[] = [];

  get size() {
    return this.items.length;
  }

  push(item: { id: string; cost: number }) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].cost <= item.cost) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    if (!this.items.length) return undefined;
    const first = this.items[0];
    const tail = this.items.pop()!;
    if (this.items.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child =
          right < this.items.length && this.items[right].cost < this.items[left].cost ? right : left;
        if (this.items[child].cost >= tail.cost) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = tail;
    }
    return first;
  }
}

interface ValhallaStep {
  distance?: number;
  name?: string;
  geometry?: { coordinates?: number[][] };
  maneuver?: {
    type?: string;
    modifier?: string;
    instruction?: string;
    location?: [number, number];
  };
}

interface ValhallaRoute {
  distance?: number;
  duration?: number;
  legs?: { steps?: ValhallaStep[] }[];
}

function withTimeout(parent: AbortSignal | undefined, milliseconds: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  const abort = () => controller.abort();
  parent?.addEventListener('abort', abort);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', abort);
    },
  };
}

function capitalize(value: string) {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

function valhallaInstruction(type: string | undefined, modifier: string | undefined): string {
  const normalized = (type ?? 'turn').toLowerCase();
  const direction = modifier?.toLowerCase();
  if (normalized === 'depart') return 'Start';
  if (normalized === 'arrive') return 'Arrive';
  if (normalized === 'uturn' || direction === 'uturn') return 'Make a U-turn';
  if (normalized === 'turn' || normalized === 'end of road') {
    return direction ? `Turn ${direction}` : 'Turn';
  }
  if (normalized === 'new name' || normalized === 'continue') return 'Continue';
  if (normalized === 'merge') return direction ? `Merge ${direction}` : 'Merge';
  if (normalized === 'fork') return direction ? `Keep ${direction}` : 'Keep straight';
  if (normalized === 'roundabout' || normalized === 'rotary') return 'Take the roundabout';
  if (normalized === 'exit roundabout' || normalized === 'exit rotary') return 'Exit the roundabout';
  if (normalized === 'use lane') return 'Keep lane';
  if (normalized === 'ramp' || normalized === 'exit') {
    return direction ? `Take the ${direction} exit` : 'Take the exit';
  }
  return capitalize(normalized.replace(/_/g, ' '));
}

function maneuverType(type: string | undefined): Maneuver['type'] {
  const normalized = (type ?? '').toLowerCase();
  if (normalized === 'depart') return 'depart';
  if (normalized === 'arrive') return 'arrive';
  if (normalized === 'merge') return 'merge';
  if (normalized === 'fork') return 'fork';
  if (normalized.includes('roundabout') || normalized === 'rotary') return 'roundabout';
  if (normalized === 'continue' || normalized === 'new name') return 'continue';
  return 'turn';
}

function parseValhallaRoute(route: ValhallaRoute): RouteLine {
  const coordinates: LatLng[] = [];
  const maneuvers: Maneuver[] = [];
  let cumulative = 0;

  for (let legIndex = 0; legIndex < (route.legs?.length ?? 0); legIndex += 1) {
    const steps = route.legs?.[legIndex]?.steps ?? [];
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      const step = steps[stepIndex];
      const stepCoordinates = (step.geometry?.coordinates ?? []).map((pair) =>
        toLatLng([pair[0], pair[1]]),
      );
      if (coordinates.length && stepCoordinates.length) {
        if (isSamePoint({ lat: coordinates[coordinates.length - 1][0], lon: coordinates[coordinates.length - 1][1] }, { lat: stepCoordinates[0][0], lon: stepCoordinates[0][1] })) {
          stepCoordinates.shift();
        }
      }

      const maneuver = step.maneuver;
      if (maneuver) {
        const location: LatLng = maneuver.location
          ? [maneuver.location[1], maneuver.location[0]]
          : stepCoordinates[0] ?? coordinates[coordinates.length - 1] ?? [0, 0];
        const type = maneuverType(maneuver.type);
        maneuvers.push({
          key: `v-${legIndex}-${stepIndex}`,
          instruction: valhallaInstruction(maneuver.type, maneuver.modifier),
          detail: maneuver.instruction ?? step.name ?? undefined,
          type,
          modifier: maneuver.modifier,
          location,
          distanceFromStart: cumulative,
          coordinateIndex: coordinates.length,
        });
      }

      coordinates.push(...stepCoordinates);
      cumulative += step.distance ?? 0;
    }
  }

  const distanceMeters = route.distance ?? cumulative;
  if (!maneuvers.length || !maneuvers.some((maneuver) => maneuver.type === 'arrive')) {
    const geometryManeuvers = buildGeometryManeuvers(coordinates, distanceMeters);
    maneuvers.push(...geometryManeuvers.filter((maneuver) => maneuver.type === 'arrive'));
  }

  const warnings: string[] = [];
  if (distanceMeters > 12_000) {
    warnings.push('Long route: verify the highlighted streets before riding.');
  }

  return {
    coordinates,
    distanceMeters,
    durationSeconds: route.duration ?? Math.max(60, distanceMeters / 5.5),
    maneuvers,
    warnings,
  };
}

async function requestValhallaRoute(
  from: Place,
  to: Place,
  mode: TravelMode,
  shortest: boolean,
): Promise<RouteLine> {
  const { signal, cleanup } = withTimeout(undefined, VALHALLA_TIMEOUT_MS);
  const costing = mode === 'riding' ? 'motorcycle' : 'pedestrian';
  const body = {
    locations: [
      { lat: from.lat, lon: from.lon },
      { lat: to.lat, lon: to.lon },
    ],
    costing,
    costing_options:
      mode === 'riding'
        ? { motorcycle: { shortest, disable_hierarchy_pruning: shortest } }
        : { pedestrian: { shortest } },
    units: 'kilometers',
    format: 'osrm',
    shape_format: 'geojson',
    directions_type: 'instructions',
    language: 'en-GB',
  };

  try {
    const response = await fetch(VALHALLA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': 'short-cut-mobile-mvp',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}.`);
    const data = (await response.json()) as { routes?: ValhallaRoute[] };
    const route = data.routes?.[0];
    const geometryCoordinates =
      route?.legs
        ?.flatMap((leg) => leg.steps ?? [])
        .flatMap((step) => step.geometry?.coordinates ?? []) ?? [];
    if (!route || geometryCoordinates.length < 2) {
      throw new Error('The routing service could not find a usable route between these points.');
    }
    return parseValhallaRoute(route);
  } finally {
    cleanup();
  }
}

interface RoadNode {
  id: string;
  lat: number;
  lon: number;
}

interface Edge {
  to: string;
  meters: number;
  seconds: number;
  highway?: string;
  surface?: string;
  narrow?: boolean;
}

type RoadGraph = Map<string, Edge[]>;
type Metric = 'distance' | 'time';

function roadAllowed(tags: Record<string, string>, mode: TravelMode) {
  const highway = tags.highway;
  if (!highway) return false;
  if (['construction', 'proposed', 'raceway', 'abandoned', 'platform', 'bus_guideway'].includes(highway)) {
    return false;
  }

  const forbidden =
    mode === 'riding'
      ? ['footway', 'pedestrian', 'steps', 'path', 'cycleway', 'bridleway', 'corridor']
      : ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'raceway'];
  if (forbidden.includes(highway)) return false;

  const accessKeys =
    mode === 'riding'
      ? ['motorcycle', 'motor_vehicle', 'vehicle', 'access']
      : ['foot', 'access'];
  const access = accessKeys.map((key) => tags[key]).find((value) => value && value !== 'inherit');
  if (
    access &&
    ['no', 'private', 'agricultural', 'forestry', 'use_sidepath'].includes(access.toLowerCase())
  ) {
    return false;
  }

  if (mode === 'walking' && tags.foot === 'yes') return true;
  if (mode === 'riding' && tags.motorcycle === 'yes') return true;
  return true;
}

function speedKph(tags: Record<string, string>, mode: TravelMode) {
  const posted = tags.maxspeed?.match(/\d+(?:\.\d+)?/);
  if (posted && tags.maxspeed && !tags.maxspeed.toLowerCase().includes('walk')) {
    const parsed = Number(posted[0]) * (tags.maxspeed.toLowerCase().includes('mph') ? 1.60934 : 1);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 160) return parsed;
  }
  if (mode === 'walking') {
    return ['footway', 'path', 'pedestrian'].includes(tags.highway ?? '') ? 4.7 : 4.3;
  }
  const defaults: Record<string, number> = {
    motorway: 55,
    trunk: 45,
    primary: 32,
    secondary: 28,
    tertiary: 25,
    residential: 22,
    unclassified: 22,
    living_street: 12,
    service: 16,
    track: 15,
  };
  return defaults[tags.highway ?? ''] ?? 20;
}

function oneWay(tags: Record<string, string>, mode: TravelMode) {
  if (mode === 'walking') return tags['oneway:foot'] ?? 'no';
  const explicit =
    mode === 'riding'
      ? tags['oneway:motorcycle'] ?? tags['oneway:motor_vehicle'] ?? tags['oneway:vehicle']
      : tags['oneway:bicycle'] ?? tags['oneway:vehicle'];
  if (explicit) return explicit;
  if (tags.junction === 'roundabout') return tags.oneway ?? 'yes';
  return tags.oneway ?? 'no';
}

function addEdge(graph: RoadGraph, from: string, edge: Edge) {
  const edges = graph.get(from) ?? [];
  edges.push(edge);
  graph.set(from, edges);
}

function buildGraph(elements: Record<string, unknown>[], mode: TravelMode) {
  const nodes = new Map<string, RoadNode>();
  const ways: { nodes: string[]; tags: Record<string, string> }[] = [];
  for (const element of elements) {
    if (
      element.type === 'node' &&
      typeof element.id === 'number' &&
      typeof element.lat === 'number' &&
      typeof element.lon === 'number'
    ) {
      nodes.set(String(element.id), {
        id: String(element.id),
        lat: element.lat,
        lon: element.lon,
      });
    } else if (
      element.type === 'way' &&
      Array.isArray(element.nodes) &&
      element.tags &&
      typeof element.tags === 'object'
    ) {
      const tags = element.tags as Record<string, string>;
      if (roadAllowed(tags, mode)) {
        ways.push({ nodes: (element.nodes as number[]).map(String), tags });
      }
    }
  }

  const graph: RoadGraph = new Map();
  for (const way of ways) {
    const direction = oneWay(way.tags, mode).toLowerCase();
    const reverseOnly = direction === '-1' || direction === 'reverse';
    const forwardOnly = ['yes', 'true', '1'].includes(direction);
    const width = Number.parseFloat((way.tags.width ?? '').replace(/[^0-9.]/g, ''));
    const narrow = Number.isFinite(width) && width > 0 && width < 3.2;
    for (let index = 0; index < way.nodes.length - 1; index += 1) {
      const first = nodes.get(way.nodes[index]);
      const second = nodes.get(way.nodes[index + 1]);
      if (!first || !second) continue;
      const meters = haversine(first, second);
      const seconds = meters / (speedKph(way.tags, mode) / 3.6);
      const forward: Edge = {
        to: second.id,
        meters,
        seconds,
        highway: way.tags.highway,
        surface: way.tags.surface,
        narrow,
      };
      const backward: Edge = { ...forward, to: first.id };
      if (!reverseOnly) addEdge(graph, first.id, forward);
      if (!forwardOnly) addEdge(graph, second.id, backward);
    }
  }
  return { graph, nodes, roadsRead: ways.length };
}

function nearestNode(place: Place, nodes: Map<string, RoadNode>, graph: RoadGraph) {
  let nearest: RoadNode | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes.values()) {
    if (!graph.has(node.id)) continue;
    const distance = haversine(place, node);
    if (distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  }
  return nearest ? { node: nearest, distance: nearestDistance } : undefined;
}

function pathBetween(graph: RoadGraph, start: string, target: string, metric: Metric) {
  const heap = new MinHeap();
  const distances = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, { from: string; edge: Edge }>();
  heap.push({ id: start, cost: 0 });

  while (heap.size) {
    const current = heap.pop()!;
    if (current.cost !== distances.get(current.id)) continue;
    if (current.id === target) break;
    for (const edge of graph.get(current.id) ?? []) {
      const nextCost = current.cost + (metric === 'distance' ? edge.meters : edge.seconds);
      if (nextCost >= (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(edge.to, nextCost);
      previous.set(edge.to, { from: current.id, edge });
      heap.push({ id: edge.to, cost: nextCost });
    }
  }

  if (!distances.has(target)) return undefined;
  const path: string[] = [target];
  const edges: Edge[] = [];
  let cursor = target;
  let meters = 0;
  let seconds = 0;
  while (cursor !== start) {
    const step = previous.get(cursor);
    if (!step) return undefined;
    meters += step.edge.meters;
    seconds += step.edge.seconds;
    edges.push(step.edge);
    cursor = step.from;
    path.push(cursor);
  }
  path.reverse();
  return { path, meters, seconds, edges };
}

function makeRoute(
  path: string[],
  nodes: Map<string, RoadNode>,
  meters: number,
  seconds: number,
  from: Place,
  to: Place,
  mode: TravelMode,
  edges: Edge[],
): RouteLine {
  const connectorMeters = path.length
    ? haversine(from, nodes.get(path[0])!) + haversine(to, nodes.get(path[path.length - 1])!)
    : 0;
  const connectorSeconds = connectorMeters / ((mode === 'walking' ? 4.5 : 18) / 3.6);
  const coordinates: LatLng[] = [
    [from.lat, from.lon],
    ...path.map((id) => {
      const node = nodes.get(id)!;
      return [node.lat, node.lon] as LatLng;
    }),
    [to.lat, to.lon],
  ];

  const surfaces = new Set(
    edges
      .map((edge) => edge.surface?.toLowerCase())
      .filter((surface): surface is string => Boolean(surface)),
  );
  const warnings: string[] = [];
  const rough = ['unpaved', 'gravel', 'dirt', 'ground', 'cobblestone', 'compacted', 'fine_gravel', 'earth', 'mud', 'sand'];
  for (const surface of surfaces) {
    if (rough.includes(surface)) {
      warnings.push(`Includes a ${surface.replace(/_/g, ' ')} surface.`);
    }
  }
  if (edges.some((edge) => edge.narrow)) warnings.push('Includes a narrow mapped passage.');
  if (edges.some((edge) => ['track', 'path', 'service'].includes(edge.highway ?? ''))) {
    warnings.push('Uses smaller unclassified streets.');
  }

  const computed = cumulativeDistances(coordinates);
  const total = computed[computed.length - 1] || meters + connectorMeters;
  return {
    coordinates,
    distanceMeters: meters + connectorMeters,
    durationSeconds: seconds + connectorSeconds,
    maneuvers: buildGeometryManeuvers(coordinates, total),
    warnings,
  };
}

function queryBounds(from: Place, to: Place) {
  const margin = Math.max(0.008, Math.max(Math.abs(from.lat - to.lat), Math.abs(from.lon - to.lon)) * 0.14);
  return {
    south: Math.min(from.lat, to.lat) - margin,
    west: Math.min(from.lon, to.lon) - margin,
    north: Math.max(from.lat, to.lat) + margin,
    east: Math.max(from.lon, to.lon) + margin,
  };
}

async function fetchRoadElements(query: string) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const { signal, cleanup } = withTimeout(undefined, OVERPASS_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { elements?: Record<string, unknown>[] };
      if (Array.isArray(data.elements)) return data.elements;
    } catch {
      // Try the next public instance when this one is overloaded or unreachable.
    } finally {
      cleanup();
    }
  }
  throw new Error('OpenStreetMap street data is busy or unreachable. Wait a moment and try again.');
}

async function findRoutesFromOverpass(from: Place, to: Place, mode: TravelMode): Promise<RoutePair> {
  const bounds = queryBounds(from, to);
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = `[out:json][timeout:12];(way["highway"](${bbox}););out body;>;out skel qt;`;
  const elements = await fetchRoadElements(query);
  if (!elements.length) throw new Error('No mapped streets were found nearby. Try another pair of locations.');
  const { graph, nodes } = buildGraph(elements, mode);
  if (!graph.size) {
    throw new Error(
      `No mapped ${mode === 'walking' ? 'walking paths' : 'rideable roads'} were found nearby.`,
    );
  }

  const start = nearestNode(from, nodes, graph);
  const end = nearestNode(to, nodes, graph);
  if (!start || !end || start.distance > 450 || end.distance > 450) {
    throw new Error('Could not snap both places to a nearby mapped street. Try points closer to a road.');
  }
  const shortest = pathBetween(graph, start.node.id, end.node.id, 'distance');
  if (!shortest) {
    throw new Error('The mapped street network does not connect these locations for this travel mode.');
  }
  const fastest = pathBetween(graph, start.node.id, end.node.id, 'time') ?? shortest;
  return {
    shortest: makeRoute(shortest.path, nodes, shortest.meters, shortest.seconds, from, to, mode, shortest.edges),
    fastest: makeRoute(fastest.path, nodes, fastest.meters, fastest.seconds, from, to, mode, fastest.edges),
    source: 'openstreetmap',
  };
}

export async function findRoutes(from: Place, to: Place, mode: TravelMode): Promise<RoutePair> {
  if (haversine(from, to) < 20) {
    throw new Error('Choose two locations at least 20 metres apart.');
  }

  const [shortestResult, fastestResult] = await Promise.allSettled([
    requestValhallaRoute(from, to, mode, true),
    requestValhallaRoute(from, to, mode, false),
  ]);

  if (shortestResult.status === 'fulfilled') {
    return {
      shortest: shortestResult.value,
      fastest: fastestResult.status === 'fulfilled' ? fastestResult.value : shortestResult.value,
      source: 'valhalla',
    };
  }

  return findRoutesFromOverpass(from, to, mode);
}

function composeLabel(parts: (string | undefined)[]): string {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(trimmed);
  }
  return clean.join(', ');
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_value?: string;
  };
}

/** Anything farther than this from the rider is not a useful "nearby" result. */
const NEAR_RADIUS_METERS = 45_000;

export interface PlaceSearchOptions {
  /** Bias results around this point. Defaults to central Hyderabad. */
  near?: { lat: number; lon: number };
  /** Skip the local radius filter, e.g. when the rider asks to search across India. */
  wide?: boolean;
}

function withinRadius(place: Place, near: { lat: number; lon: number }) {
  return haversine(place, near) <= NEAR_RADIUS_METERS;
}

/** Broad bounding box for India, used when the rider searches beyond Hyderabad. */
function withinIndia(place: Place) {
  return place.lat >= 8 && place.lat <= 37.5 && place.lon >= 68 && place.lon <= 97.5;
}

async function searchPhoton(
  query: string,
  signal: AbortSignal | undefined,
  near: { lat: number; lon: number },
  wide: boolean,
): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '10',
    lang: 'en',
    lat: String(near.lat),
    lon: String(near.lon),
    zoom: '12',
    location_bias_scale: '0.7',
  });
  const { signal: timeoutSignal, cleanup } = withTimeout(signal, SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: timeoutSignal,
    });
    if (!response.ok) throw new Error('Photon search unavailable');
    const data = (await response.json()) as { features?: PhotonFeature[] };
    const places: Place[] = [];
    for (const feature of data.features ?? []) {
      const properties = feature.properties;
      const coordinates = feature.geometry?.coordinates;
      if (!properties || !coordinates) continue;
      if (wide && properties.country && properties.country.toLowerCase() !== 'india') continue;
      const label = composeLabel([
        properties.name,
        [properties.housenumber, properties.street].filter(Boolean).join(' '),
        properties.district,
        properties.city ?? properties.county,
        properties.state,
        properties.country,
      ]);
      if (!label) continue;
      const [lon, lat] = coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      places.push({ label, lat, lon, kind: 'search' });
    }
    return places;
  } finally {
    cleanup();
  }
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function searchNominatim(
  query: string,
  signal: AbortSignal | undefined,
  near: { lat: number; lon: number },
  wide: boolean,
): Promise<Place[]> {
  const deltaLat = 0.5;
  const deltaLon = 0.65;
  const viewbox = wide
    ? HYDERABAD_VIEWBOX
    : [near.lon - deltaLon, near.lat - deltaLat, near.lon + deltaLon, near.lat + deltaLat].join(',');
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '10',
    addressdetails: '1',
    'accept-language': 'en',
    countrycodes: 'in',
    viewbox,
    bounded: wide ? '0' : '1',
    dedupe: '1',
  });
  const { signal: timeoutSignal, cleanup } = withTimeout(signal, SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ShortCut/1.0 (Hyderabad navigation MVP)',
      },
      signal: timeoutSignal,
    });
    if (!response.ok) throw new Error('Place search is unavailable right now.');
    const results = (await response.json()) as NominatimResult[];
    return results
      .map((result) => ({
        label: result.display_name,
        lat: Number(result.lat),
        lon: Number(result.lon),
        kind: 'search' as const,
      }))
      .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon));
  } finally {
    cleanup();
  }
}

function dedupePlaces(places: Place[]): Place[] {
  const result: Place[] = [];
  for (const place of places) {
    const name = place.label.split(',')[0]?.trim().toLowerCase() ?? '';
    const duplicate = result.some((existing) => {
      const distance = haversine(existing, place);
      if (distance < 90) return true;
      const existingName = existing.label.split(',')[0]?.trim().toLowerCase() ?? '';
      return Boolean(name) && name === existingName && distance < 1500;
    });
    if (duplicate) continue;
    result.push(place);
  }
  return result;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  options: PlaceSearchOptions = {},
): Promise<Place[]> {
  const near = options.near ?? HYDERABAD_CENTER;
  const wide = options.wide ?? false;
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const localPresets = searchPresetPlaces(trimmed, 3).filter((place) =>
    wide ? withinIndia(place) : withinRadius(place, near),
  );

  let places: Place[] = [];
  let failures = 0;

  try {
    places = await searchPhoton(trimmed, signal, near, wide);
  } catch (error) {
    if (signal?.aborted) throw error;
    failures += 1;
  }

  const hasNearby = wide
    ? places.some(withinIndia)
    : places.some((place) => withinRadius(place, near));

  // Photon sometimes ranks distant villages first. Ask Nominatim for a
  // location-bounded second opinion before telling the rider nothing matched.
  if (!places.length || !hasNearby) {
    try {
      const fallback = await searchNominatim(trimmed, signal, near, wide);
      places = [...places, ...fallback];
    } catch (error) {
      if (signal?.aborted) throw error;
      failures += 1;
    }
  }

  if (failures >= 2) {
    // Curated Hyderabad places still work when the network is down.
    if (localPresets.length) return dedupePlaces(localPresets).slice(0, 8);
    throw new Error('Place search is unavailable. Check your connection and try again.');
  }

  const usable = places.filter((place) => (wide ? withinIndia(place) : withinRadius(place, near)));
  return dedupePlaces([...localPresets, ...usable]).slice(0, 8);
}

export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string> {
  const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    zoom: '18',
    'accept-language': 'en',
  });
  const { signal: timeoutSignal, cleanup } = withTimeout(signal, 6000);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ShortCut/1.0 (Hyderabad navigation MVP)',
      },
      signal: timeoutSignal,
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as { display_name?: string };
    return data.display_name?.split(',').slice(0, 4).join(', ') ?? fallback;
  } catch {
    return fallback;
  } finally {
    cleanup();
  }
}
