import type { Place } from '../types';

export const HYDERABAD_CENTER = { lat: 17.385, lon: 78.4867 };
export const HYDERABAD_VIEWBOX = '78.10,17.10,78.80,17.70';

export interface PresetPlace {
  id: string;
  name: string;
  area: string;
  category: string;
  lat: number;
  lon: number;
}

export const PRESET_PLACES: PresetPlace[] = [
  {
    id: 'charminar',
    name: 'Charminar',
    area: 'Old City',
    category: 'Landmark',
    lat: 17.3616,
    lon: 78.4747,
  },
  {
    id: 'golconda',
    name: 'Golconda Fort',
    area: 'Ibrahim Bagh',
    category: 'Landmark',
    lat: 17.3833,
    lon: 78.4011,
  },
  {
    id: 'hitec',
    name: 'HITEC City',
    area: 'Madhapur',
    category: 'Tech hub',
    lat: 17.4435,
    lon: 78.3772,
  },
  {
    id: 'hussain-sagar',
    name: 'Hussain Sagar',
    area: 'Tank Bund',
    category: 'Lake',
    lat: 17.4239,
    lon: 78.4738,
  },
  {
    id: 'secunderabad',
    name: 'Secunderabad Junction',
    area: 'Secunderabad',
    category: 'Railway',
    lat: 17.4344,
    lon: 78.5015,
  },
  {
    id: 'inorbit',
    name: 'Inorbit Mall',
    area: 'Madhapur',
    category: 'Shopping',
    lat: 17.4344,
    lon: 78.3865,
  },
  {
    id: 'banjara',
    name: 'Banjara Hills',
    area: 'Road No. 12',
    category: 'Neighbourhood',
    lat: 17.4126,
    lon: 78.4392,
  },
  {
    id: 'jubilee',
    name: 'Jubilee Hills Check Post',
    area: 'Jubilee Hills',
    category: 'Junction',
    lat: 17.4239,
    lon: 78.413,
  },
  {
    id: 'osmania',
    name: 'Osmania University',
    area: 'Amberpet',
    category: 'Campus',
    lat: 17.4126,
    lon: 78.5292,
  },
  {
    id: 'koti',
    name: 'Koti',
    area: 'Koti',
    category: 'Junction',
    lat: 17.385,
    lon: 78.4867,
  },
  {
    id: 'airport',
    name: 'Rajiv Gandhi International Airport',
    area: 'Shamshabad',
    category: 'Airport',
    lat: 17.2403,
    lon: 78.4294,
  },
  {
    id: 'ikea',
    name: 'IKEA Hyderabad',
    area: 'HITEC City',
    category: 'Shopping',
    lat: 17.4375,
    lon: 78.3832,
  },
];

export function presetToPlace(preset: PresetPlace): Place {
  return {
    label: `${preset.name}, ${preset.area}, Hyderabad`,
    lat: preset.lat,
    lon: preset.lon,
    kind: 'preset',
  };
}

export const DEMO_DESTINATIONS = PRESET_PLACES.filter((place) =>
  ['charminar', 'golconda', 'hitec', 'hussain-sagar', 'secunderabad', 'airport'].includes(place.id),
);

export function searchPresetPlaces(query: string, limit = 6): Place[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const matches = PRESET_PLACES.filter((place) =>
    `${place.name} ${place.area} ${place.category}`.toLowerCase().includes(normalized),
  );
  return matches.slice(0, limit).map(presetToPlace);
}
