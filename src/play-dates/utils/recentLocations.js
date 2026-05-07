const RECENT_LOCATIONS_STORAGE_KEY = "matchCreator.recentLocations";
export const RECENT_LOCATIONS_LIMIT = 5;
export const RECENT_LOCATIONS_EVENT = "recentLocationsUpdated";

const broadcastRecentLocations = (entries) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(RECENT_LOCATIONS_EVENT, { detail: entries }),
    );
  } catch (error) {
    console.warn("Failed to broadcast recent locations", error);
  }
};

const normalizeStoredLocationEntry = (entry) => {
  if (!entry) return null;
  if (typeof entry === "string") {
    const label = entry.trim();
    return label ? { label, latitude: null, longitude: null } : null;
  }
  if (typeof entry === "object") {
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (!label) return null;
    const latitude = Number.isFinite(entry.latitude)
      ? entry.latitude
      : null;
    const longitude = Number.isFinite(entry.longitude)
      ? entry.longitude
      : null;
    return { label, latitude, longitude };
  }
  return null;
};

const persistRecentLocations = (entries) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_LOCATIONS_STORAGE_KEY,
      JSON.stringify(entries),
    );
  } catch (error) {
    console.warn("Failed to save recent location", error);
  }
  broadcastRecentLocations(entries);
};

export const loadRecentLocations = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_LOCATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    const normalized = [];

    for (const entry of parsed) {
      const normalizedEntry = normalizeStoredLocationEntry(entry);
      if (!normalizedEntry) continue;
      const key = normalizedEntry.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(normalizedEntry);
      if (normalized.length >= RECENT_LOCATIONS_LIMIT) break;
    }

    return normalized;
  } catch (error) {
    console.warn("Failed to load recent locations", error);
    return [];
  }
};

export const recordRecentLocation = (label, latitude, longitude) => {
  const normalizedLabel = typeof label === "string" ? label.trim() : "";
  if (!normalizedLabel) return loadRecentLocations();

  const entry = {
    label: normalizedLabel,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };

  const existing = loadRecentLocations();
  const deduped = existing.filter(
    (item) => item.label.toLowerCase() !== entry.label.toLowerCase(),
  );
  const next = [entry, ...deduped].slice(0, RECENT_LOCATIONS_LIMIT);
  persistRecentLocations(next);
  return next;
};
