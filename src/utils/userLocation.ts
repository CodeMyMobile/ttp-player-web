export type Coordinates = { latitude: number; longitude: number };

const USER_LOCATION_STORAGE_KEY = "player:web:user-location";
const USER_LOCATION_LABEL_STORAGE_KEY = "player:web:user-location-label";
const USER_LOCATION_RADIUS_STORAGE_KEY = "player:web:user-location-radius";
export const USER_LOCATION_CHANGED_EVENT = "player:web:user-location-changed";

const DEFAULT_COORDINATES_VALUE: Coordinates = { latitude: 34.0549076, longitude: -118.242643 };

export const DEFAULT_COORDINATES: Coordinates = DEFAULT_COORDINATES_VALUE;
export const DEFAULT_POSITION: Coordinates = DEFAULT_COORDINATES_VALUE;

// Single source of truth for the default search radius (miles) when none is
// stored. getStoredLocationRadius() still returns null when unset; callers fall
// back to this constant so the default can't drift across pages.
export const DEFAULT_RADIUS_MILES = 10;

export const getStoredLocation = (): Coordinates | null => {
  try {
    const raw = localStorage.getItem(USER_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coordinates | null;
    if (!parsed) return null;
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const storeLocation = (coords: Coordinates | null) => {
  try {
    if (!coords) {
      localStorage.removeItem(USER_LOCATION_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(USER_LOCATION_CHANGED_EVENT));
      return;
    }
    localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(coords));
    window.dispatchEvent(new CustomEvent(USER_LOCATION_CHANGED_EVENT));
  } catch {
    // ignore storage errors
  }
};

export const getStoredLocationLabel = (): string | null => {
  try {
    const raw = localStorage.getItem(USER_LOCATION_LABEL_STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed || null;
  } catch {
    return null;
  }
};

export const storeLocationLabel = (label: string | null) => {
  try {
    if (!label || !label.trim()) {
      localStorage.removeItem(USER_LOCATION_LABEL_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(USER_LOCATION_CHANGED_EVENT));
      return;
    }
    localStorage.setItem(USER_LOCATION_LABEL_STORAGE_KEY, label.trim());
    window.dispatchEvent(new CustomEvent(USER_LOCATION_CHANGED_EVENT));
  } catch {
    // ignore storage errors
  }
};

export const getStoredLocationRadius = (): number | null => {
  try {
    const raw = localStorage.getItem(USER_LOCATION_RADIUS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const storeLocationRadius = (radius: number | null) => {
  try {
    if (radius === null || radius === undefined || !Number.isFinite(radius)) {
      localStorage.removeItem(USER_LOCATION_RADIUS_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(USER_LOCATION_CHANGED_EVENT));
      return;
    }
    localStorage.setItem(USER_LOCATION_RADIUS_STORAGE_KEY, String(radius));
    window.dispatchEvent(new CustomEvent(USER_LOCATION_CHANGED_EVENT));
  } catch {
    // ignore storage errors
  }
};
