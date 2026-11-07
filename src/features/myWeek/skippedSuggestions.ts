/**
 * Suggestions the player skipped on My Week, kept on this device: suggestion id → its day.
 * Pruned once the day has passed, so the list never grows.
 */

export const SKIPPED_KEY = "ttp_my_week_skipped";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): StorageLike | null => {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

const readAll = (storage: StorageLike | null): Record<string, string> => {
  try {
    const parsed = JSON.parse(storage?.getItem(SKIPPED_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const writeAll = (entries: Record<string, string>, storage: StorageLike | null) => {
  try {
    storage?.setItem(SKIPPED_KEY, JSON.stringify(entries));
  } catch {
    // No storage: a skip lasts until the page reloads.
  }
};

/** Skipped ids for today or later. Drops (and forgets) older ones. */
export const readSkipped = (todayKey: string, storage: StorageLike | null = browserStorage()): Set<string> => {
  const all = readAll(storage);
  const kept = Object.fromEntries(Object.entries(all).filter(([, dayKey]) => typeof dayKey === "string" && dayKey >= todayKey));
  if (Object.keys(kept).length !== Object.keys(all).length) writeAll(kept, storage);
  return new Set(Object.keys(kept));
};

export const skipSuggestion = (id: string, dayKey: string, storage: StorageLike | null = browserStorage()) =>
  writeAll({ ...readAll(storage), [id]: dayKey }, storage);

export const unskipSuggestion = (id: string, storage: StorageLike | null = browserStorage()) => {
  const all = readAll(storage);
  delete all[id];
  writeAll(all, storage);
};
