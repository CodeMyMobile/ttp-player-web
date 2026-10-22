import type { PlayerPersonalDetails } from "../../api/playerProfile";

const toNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const positiveNumber = (value: unknown) => {
  const numeric = toNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
};

/**
 * Whether the player already has a level the quiz must not replace: a declared
 * USTA rating, an earlier quiz estimate, or a match-derived rating. Shared by
 * the in-app quiz (which locks itself) and the public-site handoff (which skips
 * the save), so the two can't disagree about who already has a level.
 */
export const hasStoredRating = (details: PlayerPersonalDetails | null) =>
  Boolean(
    positiveNumber(details?.usta_rating) ||
      positiveNumber(details?.self_rated_seed) ||
      positiveNumber(details?.calculated_ntrp) ||
      (positiveNumber(details?.current_rating) && Number(details?.matches_played || 0) > 0),
  );

/** Keeps the cached profile current, so the home tile reads the new level without a reload. */
export const storeUpdatedProfile = (details: PlayerPersonalDetails) => {
  try {
    localStorage.setItem("playerPersonalDetails", JSON.stringify(details));
    window.dispatchEvent(new StorageEvent("storage", { key: "playerPersonalDetails" }));
  } catch {
    // Best effort. The saved response is still the source of truth.
  }
};
