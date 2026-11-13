/**
 * How closely a class's level matches the player's, for the "At your level" / "Near your
 * level" chips on home.
 *
 * The one rule, mirrored from the API's classLevelFit (ttp-api src/lib/classLevel.js):
 *
 *   exact  the player's shown level is inside the class's band ("3.5-4.0" for a 4.0)
 *   near   within half a level of it (a 4.0 class for a 4.5)
 *   null   anything further, or either level unknown: nothing is claimed
 *
 * The player's level is compared as it is shown, the nearest half: a played 4.6 is a 4.5.
 * A "3.5+" class is a 3.5 class that stronger players may join, so a 4.0 is near it, not at it.
 */
import type { LevelBand } from "./groupLessonLevelFit";

export type LevelFit = "exact" | "near";

const NEAR = 0.5;

const toLevel = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const level = Number(value);
  return Number.isFinite(level) ? level : null;
};

export const shownLevel = (level: unknown): number | null => {
  const value = toLevel(level);
  return value === null ? null : Math.round(value * 2) / 2;
};

export const levelMatch = (band: LevelBand | null | undefined, viewerLevel: unknown): LevelFit | null => {
  const shown = shownLevel(viewerLevel);
  const min = toLevel(band?.min);
  if (shown === null || min === null) return null;
  const top = toLevel(band?.max) ?? min;
  if (shown >= min && shown <= top) return "exact";
  if (shown >= min - NEAR && shown <= top + NEAR) return "near";
  return null;
};

export const levelMatchLabel = (fit: LevelFit | null): string | null =>
  fit === "exact" ? "At your level" : fit === "near" ? "Near your level" : null;
