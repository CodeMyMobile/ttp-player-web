/**
 * "Classes for your level" on the Group Lessons page.
 *
 * A class's level is written two ways in production, often both:
 *
 *   metadata.level  "Intermediate (NTRP 3.5)"      the coach picked a level
 *   title           "4.5+ Liveball at Culver City HS"
 *                   "Liveball Intensive (2h, curated 3.5-4.0 group)"   no level field at all
 *
 * The title is the more specific of the two ("3.5+" vs the label's bare 3.5) and the only
 * source for about half the classes, so it is read first. A class with neither is open to
 * anyone and always fits.
 */

export type LevelBand = {
  min: number;
  /** null for an open band ("4.5+"). */
  max: number | null;
};

/**
 * NTRP levels as written: 2.0 to 7.0, in halves or (on external listings) quarters, so
 * "3.5" and "2.75". Always with a decimal point: a bare "4" in a title is too often a
 * count or a time to read as a level.
 */
const LEVEL = String.raw`([2-7]\.\d{1,2})`;
// Neither end may be a clock time ("6.30-7.30pm").
const NOT_TIME = String.raw`(?![\d.]|\s*(?:am|pm|h\b|hr|hour|min))`;
const RANGE = new RegExp(String.raw`(?:^|[^\d.])${LEVEL}\s*(?:-|–|—|to)\s*${LEVEL}${NOT_TIME}`, "i");
const PLUS = new RegExp(String.raw`(?:^|[^\d.])${LEVEL}\s*\+`);
// Not followed by a time or duration ("6.5 hours", "7.0pm" are not levels).
// Nor the start of a range that wasn't a level range ("6.30-7.30pm").
const SINGLE = new RegExp(String.raw`(?:^|[^\d.])${LEVEL}${NOT_TIME}(?!\s*(?:-|–|—|to)\s*\d)`, "i");

const isLevel = (value: number) => value >= 2 && value <= 7;

const fromText = (text: string | null | undefined): LevelBand | null => {
  if (!text) return null;
  const range = RANGE.exec(text);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (isLevel(a) && isLevel(b)) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const plus = PLUS.exec(text);
  if (plus && isLevel(Number(plus[1]))) return { min: Number(plus[1]), max: null };
  const single = SINGLE.exec(text);
  if (single && isLevel(Number(single[1]))) {
    const level = Number(single[1]);
    return { min: level, max: level };
  }
  return null;
};

export const classLevelBand = (lesson: {
  title?: string | null;
  level?: number | null;
  skillLabel?: string | null;
}): LevelBand | null => {
  const fromTitle = fromText(lesson.title);
  if (fromTitle) return fromTitle;
  if (lesson.level !== null && lesson.level !== undefined && Number.isFinite(lesson.level)) {
    return { min: lesson.level, max: lesson.level };
  }
  return fromText(lesson.skillLabel);
};

/**
 * How far outside a class's range still counts as a fit. A quarter level: enough that a
 * 3.5 sees a "2.75 - 3.25" listing and a played 3.67 sees the 3.5 classes, not so much that
 * a 3.5 is shown 2.5 - 3.0 drills and 4.0 liveballs. Half a level let in nine classes in
 * ten, which is not a filter.
 */
const TOLERANCE = 0.25;

/**
 * Whether a class suits a player of this level.
 *
 * An open band ("3.5+") is read as reaching half a level above its floor, not to the top of
 * the scale: a 5.0 is allowed into a 3.5+ liveball but it is not a class for them.
 */
export const fitsPlayerLevel = (band: LevelBand | null, playerLevel: number): boolean => {
  if (band === null) return true;
  const top = band.max ?? band.min + 0.5;
  return playerLevel >= band.min - TOLERANCE && playerLevel <= top + TOLERANCE;
};

const positive = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

/**
 * The player's level on the NTRP scale classes use, or null when they have none.
 *
 * A level from played matches first (calculated_ntrp, only once a match is behind it), then
 * a USTA rating they entered, then the rating quiz's estimate. The quiz writes
 * self_rated_seed on the NTRP scale, the same number its result screen shows.
 * 0 means "never set" (a bulk recompute writes it), not a level.
 */
export const playerLevelOf = (details: {
  calculated_ntrp?: unknown;
  matches_played?: unknown;
  usta_rating?: unknown;
  self_rated_seed?: unknown;
} | null | undefined): number | null => {
  if (!details) return null;
  const played = Number(details.matches_played ?? 0) > 0 ? positive(details.calculated_ntrp) : null;
  return played ?? positive(details.usta_rating) ?? positive(details.self_rated_seed);
};

/** "3.5" for the chip. Played ratings arrive as 3.67; the nearest half reads as a level. */
export const formatPlayerLevel = (level: number) => (Math.round(level * 2) / 2).toFixed(1);
