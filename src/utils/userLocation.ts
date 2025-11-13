export type Coordinates = { latitude: number; longitude: number };

const USER_LOCATION_STORAGE_KEY = "player:web:user-location";

const DEFAULT_COORDINATES_VALUE: Coordinates = { latitude: 34.0549076, longitude: -118.242643 };

export const DEFAULT_COORDINATES: Coordinates = DEFAULT_COORDINATES_VALUE;
export const DEFAULT_POSITION: Coordinates = DEFAULT_COORDINATES_VALUE;

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
      return;
    }
    localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(coords));
  } catch {
    // ignore storage errors
  }
};
