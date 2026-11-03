import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from '../types';

const RECENTS_KEY = '@shortcut/recents/v1';
const VOICE_KEY = '@shortcut/voice/v1';

export async function loadRecents(): Promise<Place[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Place[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (place) =>
        typeof place?.label === 'string' &&
        Number.isFinite(place?.lat) &&
        Number.isFinite(place?.lon),
    );
  } catch {
    return [];
  }
}

export async function saveRecent(place: Place): Promise<Place[]> {
  try {
    const existing = await loadRecents();
    const deduped = existing.filter(
      (item) =>
        Math.abs(item.lat - place.lat) > 0.0002 ||
        Math.abs(item.lon - place.lon) > 0.0002 ||
        item.label !== place.label,
    );
    const next = [{ ...place, kind: 'recent' as const }, ...deduped].slice(0, 6);
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [place];
  }
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
