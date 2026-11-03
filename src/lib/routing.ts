export type TravelMode = 'riding' | 'walking';
export type LatLng = [number, number];

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export interface RouteLine {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
}

export interface RoutePair {
  shortest: RouteLine;
  fastest: RouteLine;
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
}

type RoadGraph = Map<string, Edge[]>;
type Metric = 'distance' | 'time';

const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const OVERPASS_REQUEST_TIMEOUT_MS = 12_000;
const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
const VALHALLA_REQUEST_TIMEOUT_MS = 15_000;

class MinHeap {
  private items: Array<{ id: string; cost: number }> = [];

  get size() { return this.items.length; }

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
        const child = right < this.items.length && this.items[right].cost < this.items[left].cost ? right : left;
        if (this.items[child].cost >= tail.cost) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = tail;
    }
    return first;
  }
}

function haversine(a: Pick<Place, 'lat' | 'lon'>, b: Pick<Place, 'lat' | 'lon'>) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function roadAllowed(tags: Record<string, string>, mode: TravelMode) {
  const highway = tags.highway;
  if (!highway || ['construction', 'proposed', 'raceway', 'abandoned', 'platform', 'bus_guideway'].includes(highway)) return false;

  const forbidden = mode === 'riding'
    ? ['footway', 'pedestrian', 'steps', 'path', 'cycleway', 'bridleway', 'corridor']
    : ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'raceway'];
  if (forbidden.includes(highway)) return false;

  const accessKeys = mode === 'riding'
    ? ['motorcycle', 'motor_vehicle', 'vehicle', 'access']
    : ['foot', 'access'];
  const access = accessKeys.map((key) => tags[key]).find((value) => value && value !== 'inherit');
  if (access && ['no', 'private', 'agricultural', 'forestry', 'use_sidepath'].includes(access)) return false;

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
    return tags.highway === 'footway' || tags.highway === 'path' || tags.highway === 'pedestrian' ? 4.7 : 4.3;
  }
  const defaults: Record<string, number> = {
    motorway: 55, trunk: 45, primary: 32, secondary: 28, tertiary: 25,
    residential: 22, unclassified: 22, living_street: 12, service: 16, track: 15,
  };
  return defaults[tags.highway] ?? 20;
}

function oneWay(tags: Record<string, string>, mode: TravelMode) {
  if (mode === 'walking') return tags['oneway:foot'] ?? 'no';
  const explicit = mode === 'riding'
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

function buildGraph(elements: Array<Record<string, unknown>>, mode: TravelMode) {
  const nodes = new Map<string, RoadNode>();
  const ways: Array<{ nodes: string[]; tags: Record<string, string> }> = [];
  for (const element of elements) {
    if (element.type === 'node' && typeof element.id === 'number' && typeof element.lat === 'number' && typeof element.lon === 'number') {
      nodes.set(String(element.id), { id: String(element.id), lat: element.lat, lon: element.lon });
    } else if (element.type === 'way' && Array.isArray(element.nodes) && element.tags && typeof element.tags === 'object') {
      const tags = element.tags as Record<string, string>;
      if (roadAllowed(tags, mode)) ways.push({ nodes: (element.nodes as number[]).map(String), tags });
    }
  }

  const graph: RoadGraph = new Map();
  for (const way of ways) {
    const direction = oneWay(way.tags, mode).toLowerCase();
    const reverseOnly = direction === '-1' || direction === 'reverse';
    const forwardOnly = ['yes', 'true', '1'].includes(direction);
    for (let index = 0; index < way.nodes.length - 1; index += 1) {
      const first = nodes.get(way.nodes[index]);
      const second = nodes.get(way.nodes[index + 1]);
      if (!first || !second) continue;
      const meters = haversine(first, second);
      const seconds = meters / (speedKph(way.tags, mode) / 3.6);
      const forward: Edge = { to: second.id, meters, seconds };
      const backward: Edge = { to: first.id, meters, seconds };
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
  let cursor = target;
  let meters = 0;
  let seconds = 0;
  while (cursor !== start) {
    const step = previous.get(cursor);
    if (!step) return undefined;
    meters += step.edge.meters;
    seconds += step.edge.seconds;
    cursor = step.from;
    path.push(cursor);
  }
  path.reverse();
  return { path, meters, seconds };
}

function makeRoute(path: string[], nodes: Map<string, RoadNode>, meters: number, seconds: number, from: Place, to: Place, mode: TravelMode): RouteLine {
  const connectorMeters = path.length ? haversine(from, nodes.get(path[0])!) + haversine(to, nodes.get(path[path.length - 1])!) : 0;
  const connectorSeconds = connectorMeters / ((mode === 'walking' ? 4.5 : 18) / 3.6);
  const coordinates: LatLng[] = [
    [from.lat, from.lon],
    ...path.map((id) => {
      const node = nodes.get(id)!;
      return [node.lat, node.lon] as LatLng;
    }),
    [to.lat, to.lon],
  ];
  return {
    coordinates,
    distanceMeters: meters + connectorMeters,
    durationSeconds: seconds + connectorSeconds,
  };
}

function queryBounds(from: Place, to: Place) {
  const margin = Math.max(0.008, (Math.max(Math.abs(from.lat - to.lat), Math.abs(from.lon - to.lon)) * 0.14));
  return {
    south: Math.min(from.lat, to.lat) - margin,
    west: Math.min(from.lon, to.lon) - margin,
    north: Math.max(from.lat, to.lat) + margin,
    east: Math.max(from.lon, to.lon) + margin,
  };
}

async function fetchRoadElements(query: string) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), OVERPASS_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const data = await response.json() as { elements?: Array<Record<string, unknown>> };
      if (Array.isArray(data.elements)) return data.elements;
    } catch {
      // Try the next public instance when this one is offline, overloaded, or unreachable.
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw new Error('OpenStreetMap street data is busy or unreachable from all available services. Wait a moment and try again.');
}

async function requestValhallaRoute(from: Place, to: Place, mode: TravelMode, shortest: boolean): Promise<RouteLine> {
  const costing = mode === 'riding' ? 'motorcycle' : 'pedestrian';
  const costingOptions = mode === 'riding'
    ? { motorcycle: { shortest, disable_hierarchy_pruning: shortest } }
    : { pedestrian: { shortest } };
  const body = {
    locations: [
      { lat: from.lat, lon: from.lon },
      { lat: to.lat, lon: to.lon },
    ],
    costing,
    costing_options: costingOptions,
    units: 'kilometers',
    format: 'osrm',
    shape_format: 'geojson',
    directions_type: 'none',
  };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), VALHALLA_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(VALHALLA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': 'short-cut-mvp.local',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Valhalla returned HTTP ${response.status}.`);
    const data = await response.json() as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: number[][] };
      }>;
    };
    const route = data.routes?.[0];
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration) || !route.geometry?.coordinates?.length) {
      throw new Error('Valhalla returned no usable route.');
    }
    return {
      coordinates: route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as LatLng),
      distanceMeters: route.distance!,
      durationSeconds: route.duration!,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function findRoutesFromOverpass(from: Place, to: Place, mode: TravelMode): Promise<RoutePair> {
  const bounds = queryBounds(from, to);
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = `[out:json][timeout:10];(way["highway"](${bbox}););out body;>;out skel qt;`;
  const elements = await fetchRoadElements(query);
  if (!elements.length) throw new Error('No mapped streets were found nearby. Try another pair of locations.');
  const { graph, nodes } = buildGraph(elements, mode);
  if (!graph.size) throw new Error(`No mapped ${mode === 'walking' ? 'walking paths' : 'rideable roads'} were found nearby.`);

  const start = nearestNode(from, nodes, graph);
  const end = nearestNode(to, nodes, graph);
  if (!start || !end || start.distance > 350 || end.distance > 350) {
    throw new Error('Could not snap both places to a nearby mapped street. Try choosing points closer to a road.');
  }
  const shortest = pathBetween(graph, start.node.id, end.node.id, 'distance');
  if (!shortest) throw new Error('The mapped street network does not connect these locations for this travel mode.');
  const fastest = pathBetween(graph, start.node.id, end.node.id, 'time') ?? shortest;
  return {
    shortest: makeRoute(shortest.path, nodes, shortest.meters, shortest.seconds, from, to, mode),
    fastest: makeRoute(fastest.path, nodes, fastest.meters, fastest.seconds, from, to, mode),
  };
}

export async function findRoutes(from: Place, to: Place, mode: TravelMode): Promise<RoutePair> {
  if (haversine(from, to) < 20) throw new Error('Choose two locations at least 20 metres apart.');
  try {
    const shortest = await requestValhallaRoute(from, to, mode, true);
    let fastest = shortest;
    try {
      fastest = await requestValhallaRoute(from, to, mode, false);
    } catch {
      // Keep the shortest route usable if the comparison request is rate-limited or unavailable.
    }
    return { shortest, fastest };
  } catch {
    return findRoutesFromOverpass(from, to, mode);
  }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
    'accept-language': 'en',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error('Place search is unavailable right now.');
  const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
  return results.map((result) => ({
    label: result.display_name,
    lat: Number(result.lat),
    lon: Number(result.lon),
  }));
}
