export type Coordinates = { latitude: number; longitude: number };

const USER_LOCATION_STORAGE_KEY = "player:web:user-location";
const USER_LOCATION_LABEL_STORAGE_KEY = "player:web:user-location-label";
const USER_LOCATION_RADIUS_STORAGE_KEY = "player:web:user-location-radius";
const USER_LOCATION_AREA_STORAGE_KEY = "player:web:user-location-area";
export const USER_LOCATION_CHANGED_EVENT = "player:web:user-location-changed";

// West LA (Sawtelle). Used only until the player picks a location, and every
// geo-scoped surface falls back to it — the feed, group lessons, find players
// and the coach search.
//
// This was Downtown LA, which put every venue the product actually serves
// outside the 10-mile default radius: Mar Vista 11.4mi, Westwood 11.6mi,
// Penmar 13.3mi, Santa Monica 14.4mi. A new player with no location set saw an
// empty page and no reason why. Sawtelle is the tighter centre of the area in
// the mockups — the furthest of those venues is 4.5mi from here.
//
// The trade is that Downtown is now outside the default radius (11.7mi). That
// is the right way round: someone there sets their location and gets real
// results, rather than everyone else starting empty.
const DEFAULT_COORDINATES_VALUE: Coordinates = { latitude: 34.0395, longitude: -118.4455 };

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

// The neighbourhood for the chosen location ("Mar Vista"), captured from the
// Google Places result at pick time. Kept separate from the label because the
// label is a full formatted address, far too long for the header.
export const getStoredLocationArea = (): string | null => {
  try {
    const raw = localStorage.getItem(USER_LOCATION_AREA_STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed || null;
  } catch {
    return null;
  }
};

export const storeLocationArea = (area: string | null) => {
  try {
    if (!area || !area.trim()) {
      localStorage.removeItem(USER_LOCATION_AREA_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(USER_LOCATION_CHANGED_EVENT));
      return;
    }
    localStorage.setItem(USER_LOCATION_AREA_STORAGE_KEY, area.trim());
    window.dispatchEvent(new CustomEvent(USER_LOCATION_CHANGED_EVENT));
  } catch {
    // ignore storage errors
  }
};

/**
 * Pulls the neighbourhood out of a Google Places result, most specific first.
 * Returns null when the place carries none of these, so callers fall back
 * rather than showing something misleading.
 */
export const readPlaceArea = (place: unknown): string | null => {
  const components = (place as { address_components?: unknown })?.address_components;
  if (!Array.isArray(components)) return null;

  const preference = ["neighborhood", "sublocality", "sublocality_level_1", "locality"];
  for (const type of preference) {
    const match = components.find(
      (component) =>
        component &&
        typeof component === "object" &&
        Array.isArray((component as { types?: unknown }).types) &&
        (component as { types: unknown[] }).types.includes(type),
    ) as { long_name?: string; short_name?: string } | undefined;
    const name = match?.long_name || match?.short_name;
    if (name && name.trim()) return name.trim();
  }
  return null;
};

/**
 * Header fallback for accounts that stored a location before areas were
 * captured: show the first segment of the address rather than the whole thing.
 */
export const shortLocationLabel = (label: string | null): string | null => {
  if (!label) return null;
  const first = label.split(",")[0]?.trim();
  return first || null;
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
