import { toCanonicalAvailability } from "./matchProfile";
import { levelNumber } from "./levelScope";
import type { DirectoryPlayer } from "./suggestedPlayer";

/**
 * Who the home page's "Players to hit with" block suggests, in what order, and
 * why. One pure function so the carousel, the compact Find players tile and the
 * tests all read the same answer. See useHomePlayers for where the input comes from.
 *
 * Rules, in order:
 * - The viewer's level is their survey level (what Find Players matches on). With
 *   no level there is nothing to match, so the block asks them to set one.
 * - Level is a hard gate: within ±0.5 NTRP of the viewer. A player with no level
 *   of their own is never suggested.
 * - Within the viewer's radius (default 10 mi). If fewer than MIN_SUGGESTIONS
 *   qualify, widen to WIDEN_TO_MILES. The level range never widens.
 * - Players at the viewer's exact level come first, then those half a level away.
 * - Within each of those two groups: score shared court +3, overlapping
 *   availability +2, verified rating +1, profile photo +1.
 * - With a `seed`, each group is shuffled, weighted by score, so better matches
 *   tend to lead but the same player isn't always first. Without one, the order
 *   is by score, then nearest. The home page passes a new seed per visit.
 */

export const DEFAULT_HOME_RADIUS_MILES = 10;
export const WIDEN_TO_MILES = 15;
export const MIN_SUGGESTIONS = 2;
export const MAX_SUGGESTIONS = 8;
/** Half a level either side, plus float slack: 3.5 → 3.0–4.0. */
const LEVEL_TOLERANCE = 0.5 + 1e-9;

export type ReasonType = "same_court" | "weekends" | "weekday_am" | "weekday_pm" | "level";

export interface SuggestionReason {
  type: ReasonType;
  label: string;
}

export interface PlayerSuggestion {
  player: DirectoryPlayer;
  /** At the viewer's exact level, rather than half a level away. */
  exactLevel: boolean;
  score: number;
  distanceMiles: number | null;
  reason: SuggestionReason;
}

export interface SuggestionViewer {
  /** The survey level label, e.g. "3.5" or "NTRP 4.5+". Null or blank = no level. */
  level: string | null | undefined;
  /** Canonical slots: "Weekdays AM", "Weekday PM", "Weekends". */
  availability: string[];
  /** The viewer's courts, as labels. */
  courts: string[];
}

export type HomePlayersResult =
  | {
      state: "suggestions";
      /** Up to MAX_SUGGESTIONS, best first. */
      suggestions: PlayerSuggestion[];
      /** Everyone who qualified, before the cap; the "See all" and tile count. */
      total: number;
      radiusMiles: number;
    }
  | {
      /** The viewer has a level, but fewer than MIN_SUGGESTIONS qualify. */
      state: "hidden";
      total: number;
      radiusMiles: number;
    }
  | {
      /** The viewer has no level: show the "Set your level" prompt. */
      state: "noLevel";
      /** Nearby players at any level, photos first, for the prompt's photo row. */
      nearby: DirectoryPlayer[];
      nearbyCount: number;
      radiusMiles: number;
    };

const normalize = (value: string) => value.trim().toLowerCase();

/** A comma-separated court string or a list, as labels. Shared with Find Players. */
export const toCourtList = (value: string | string[] | null | undefined): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
};

/**
 * The numbers a level label covers. "3.5" is exactly 3.5; "4.5+" is 4.5 and up.
 * Null for a label with no number ("Unknown", "Prefer not to say", "").
 */
const levelInterval = (label: string | null | undefined): [number, number] | null => {
  const value = levelNumber(label);
  if (value === null || value <= 0) return null;
  const openEnded = typeof label === "string" && label.trim().endsWith("+");
  return [value, openEnded ? Number.POSITIVE_INFINITY : value];
};

export const hasLevel = (label: string | null | undefined): boolean => levelInterval(label) !== null;

/**
 * Whether two levels are within half a level of each other. Compares the numbers
 * rather than option positions because the two sides come from different places:
 * the viewer's survey label and each player's label as Find Players normalises it.
 * "4.5+" counts as 4.5 and up, so a 5.0 viewer and a "4.5+" player are in range.
 */
export const isNearLevel = (
  viewerLevel: string | null | undefined,
  playerLevel: string | null | undefined,
): boolean => {
  const viewer = levelInterval(viewerLevel);
  const player = levelInterval(playerLevel);
  if (!viewer || !player) return false;
  const gap = Math.max(0, player[0] - viewer[1], viewer[0] - player[1]);
  return gap <= LEVEL_TOLERANCE;
};

/**
 * Whether a player is at the viewer's own level: the two labels cover a common
 * number. "4.5" and "4.5+" are the same level; "4.0" and "4.5" are not.
 */
export const isExactLevel = (
  viewerLevel: string | null | undefined,
  playerLevel: string | null | undefined,
): boolean => {
  const viewer = levelInterval(viewerLevel);
  const player = levelInterval(playerLevel);
  if (!viewer || !player) return false;
  return Math.max(0, player[0] - viewer[1], viewer[0] - player[1]) <= 1e-9;
};

/** distance_miles from the API, or null when it didn't send one. */
export const distanceOf = (player: DirectoryPlayer): number | null => {
  const raw = player.raw?.distance_miles;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/**
 * Inside `radius`? A player with no known distance came back from a search at
 * `searchedMiles`, so they count only once the radius reaches that far.
 */
const isWithin = (player: DirectoryPlayer, radius: number, searchedMiles: number) => {
  const distance = distanceOf(player);
  return distance === null ? radius >= searchedMiles : distance <= radius;
};

const slotsOf = (slots: string[]) => new Set(slots.map((slot) => normalize(toCanonicalAvailability(slot))));

const WEEKENDS = normalize("Weekends");
const WEEKDAY_AM = normalize("Weekdays AM");
const WEEKDAY_PM = normalize("Weekday PM");

const formatMiles = (miles: number) => (miles < 10 ? miles.toFixed(1) : String(Math.round(miles)));

/** The reason chip, in priority order. One short string. */
export const reasonFor = ({
  sameCourt,
  sharedSlots,
  distanceMiles,
}: {
  sameCourt: boolean;
  sharedSlots: Set<string>;
  distanceMiles: number | null;
}): SuggestionReason => {
  if (sameCourt) return { type: "same_court", label: "Same home court" };
  if (sharedSlots.has(WEEKENDS)) return { type: "weekends", label: "Both free weekends" };
  if (sharedSlots.has(WEEKDAY_AM)) return { type: "weekday_am", label: "Weekday mornings" };
  if (sharedSlots.has(WEEKDAY_PM)) return { type: "weekday_pm", label: "Weekday evenings" };
  return {
    type: "level",
    label: distanceMiles === null ? "Your level" : `Your level · ${formatMiles(distanceMiles)} mi`,
  };
};

const scoreOf = (player: DirectoryPlayer, viewerCourts: Set<string>, viewerSlots: Set<string>) => {
  const sameCourt = player.localCourts.some((court) => viewerCourts.has(normalize(court)));
  const playerSlots = slotsOf(player.availability);
  const sharedSlots = new Set([...playerSlots].filter((slot) => viewerSlots.has(slot)));
  const distanceMiles = distanceOf(player);
  const score =
    (sameCourt ? 3 : 0) +
    (sharedSlots.size > 0 ? 2 : 0) +
    (player.verified ? 1 : 0) +
    (player.profileImageUrl ? 1 : 0);
  return { score, distanceMiles, reason: reasonFor({ sameCourt, sharedSlots, distanceMiles }) };
};

const byDistance = (a: number | null, b: number | null) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
};

/** A small seeded random generator (mulberry32), so one seed gives one order. */
const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * A random order where heavier items tend to come first: each gets the key
 * u^(1/weight) and the highest keys lead (weighted sampling without replacement).
 */
const weightedShuffle = <T>(items: T[], weightOf: (item: T) => number, random: () => number): T[] =>
  items
    .map((item) => ({ item, key: Math.pow(random(), 1 / weightOf(item)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);

/**
 * Within the viewer's radius, widening to WIDEN_TO_MILES when fewer than
 * MIN_SUGGESTIONS are found there. Returns the players and the radius used.
 */
const withinWidening = (
  players: DirectoryPlayer[],
  radiusMiles: number,
  searchedMiles: number,
): { players: DirectoryPlayer[]; radiusMiles: number } => {
  const near = players.filter((player) => isWithin(player, radiusMiles, searchedMiles));
  if (near.length >= MIN_SUGGESTIONS || radiusMiles >= WIDEN_TO_MILES) {
    return { players: near, radiusMiles };
  }
  return {
    players: players.filter((player) => isWithin(player, WIDEN_TO_MILES, searchedMiles)),
    radiusMiles: WIDEN_TO_MILES,
  };
};

/** The radius to search, so one call covers both the viewer's radius and the widening. */
export const searchRadiusMiles = (radiusMiles: number = DEFAULT_HOME_RADIUS_MILES) =>
  Math.max(radiusMiles, WIDEN_TO_MILES);

export const homePlayerSuggestions = ({
  players,
  viewer,
  radiusMiles = DEFAULT_HOME_RADIUS_MILES,
  searchedMiles = searchRadiusMiles(radiusMiles),
  seed,
}: {
  /** Find Players' own list for this viewer: self and blocked players are already out. */
  players: DirectoryPlayer[];
  viewer: SuggestionViewer;
  radiusMiles?: number;
  /** The radius the players were fetched with. */
  searchedMiles?: number;
  /** Shuffles the order (see the rules above). Omit for a fixed order. */
  seed?: number;
}): HomePlayersResult => {
  if (!hasLevel(viewer.level)) {
    const nearby = withinWidening(players, radiusMiles, searchedMiles);
    const random = seed === undefined ? null : seededRandom(seed);
    const pool = random ? weightedShuffle(nearby.players, () => 1, random) : nearby.players;
    // Photos first: the row is there to show real people.
    const withPhotos = [...pool].sort(
      (a, b) => Number(Boolean(b.profileImageUrl)) - Number(Boolean(a.profileImageUrl)),
    );
    return {
      state: "noLevel",
      nearby: withPhotos,
      nearbyCount: nearby.players.length,
      radiusMiles: nearby.radiusMiles,
    };
  }

  // The hard gate: a level of their own, within half a level of the viewer's.
  const atLevel = players.filter((player) => isNearLevel(viewer.level, player.level));
  const { players: inRange, radiusMiles: usedRadius } = withinWidening(atLevel, radiusMiles, searchedMiles);

  if (inRange.length < MIN_SUGGESTIONS) {
    return { state: "hidden", total: inRange.length, radiusMiles: usedRadius };
  }

  const viewerCourts = new Set(viewer.courts.map(normalize));
  const viewerSlots = slotsOf(viewer.availability);
  const scored = inRange.map((player) => ({
    player,
    exactLevel: isExactLevel(viewer.level, player.level),
    ...scoreOf(player, viewerCourts, viewerSlots),
  }));
  const random = seed === undefined ? null : seededRandom(seed);
  const order = (group: typeof scored) =>
    random
      ? weightedShuffle(group, (s) => 1 + s.score, random)
      : [...group].sort((a, b) => b.score - a.score || byDistance(a.distanceMiles, b.distanceMiles));
  const ranked = [
    ...order(scored.filter((s) => s.exactLevel)),
    ...order(scored.filter((s) => !s.exactLevel)),
  ];

  return {
    state: "suggestions",
    suggestions: ranked.slice(0, MAX_SUGGESTIONS),
    total: ranked.length,
    radiusMiles: usedRadius,
  };
};

/** Find Players with the filters the block used. */
export const findPlayersHref = (radiusMiles: number) =>
  `/find-players?radius=${encodeURIComponent(String(radiusMiles))}&level=near`;

/** The rating quiz, set to bring the player back to home when they save. */
export const HOME_RATING_QUIZ_HREF = "/rating-quiz?from=home";
