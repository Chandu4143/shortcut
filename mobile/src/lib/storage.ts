import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from '../types';

const RECENTS_KEY = '@shortcut/recents/v2';
const VOICE_KEY = '@shortcut/voice/v1';
const SAVED_KEY = '@shortcut/saved/v1';

export type SavedPlaceKind = 'home' | 'work';
export type SavedPlaces = Record<SavedPlaceKind, Place | null>;

const EMPTY_SAVED: SavedPlaces = { home: null, work: null };

const GENERIC_LABELS = new Set([
  'destination',
  'starting point',
  'start',
  'current location',
  'my location',
  'where do you want to go?',
  'choose a starting point',
  'dropped pin',
]);

function isUsablePlace(place: Place | null | undefined): place is Place {
  if (!place || typeof place.label !== 'string') return false;
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return false;
  return !GENERIC_LABELS.has(place.label.trim().toLowerCase());
}

function samePlace(a: Place, b: Place, meters = 80) {
  const lat = (a.lat + b.lat) / 2;
  const lonScale = Math.cos((lat * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 111_320;
  const dx = (a.lon - b.lon) * 111_320 * lonScale;
  return Math.sqrt(dx * dx + dy * dy) < meters;
}

export async function loadRecents(): Promise<Place[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Place[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isUsablePlace).slice(0, 5);
  } catch {
    return [];
  }
}

export async function saveRecent(place: Place): Promise<Place[]> {
  if (!isUsablePlace(place)) return loadRecents();
  try {
    const existing = await loadRecents();
    const deduped = existing.filter((item) => !samePlace(item, place));
    const next = [{ ...place, kind: 'recent' as const }, ...deduped].slice(0, 5);
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [place];
  }
}

export async function clearRecents(): Promise<Place[]> {
  try {
    await AsyncStorage.removeItem(RECENTS_KEY);
  } catch {
    // Recents are a convenience; storage failures simply leave them in memory.
  }
  return [];
}

export async function loadSavedPlaces(): Promise<SavedPlaces> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    if (!raw) return EMPTY_SAVED;
    const parsed = JSON.parse(raw) as Partial<SavedPlaces>;
    return {
      home: isUsablePlace(parsed?.home) ? parsed.home : null,
      work: isUsablePlace(parsed?.work) ? parsed.work : null,
    };
  } catch {
    return EMPTY_SAVED;
  }
}

export async function saveSavedPlace(kind: SavedPlaceKind, place: Place): Promise<SavedPlaces> {
  const current = await loadSavedPlaces();
  const next: SavedPlaces = { ...current, [kind]: { ...place, kind: 'search' as const } };
  try {
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory value; persistence can succeed next time.
  }
  return next;
}

export async function removeSavedPlace(kind: SavedPlaceKind): Promise<SavedPlaces> {
  const current = await loadSavedPlaces();
  const next: SavedPlaces = { ...current, [kind]: null };
  try {
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures; the provider still reflects the change.
  }
  return next;
}

export async function loadVoiceEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VOICE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function saveVoiceEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VOICE_KEY, String(enabled));
  } catch {
    // Voice preference is non-critical; ignore storage failures.
  }
}
