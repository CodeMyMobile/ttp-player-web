import { levelNumber } from "./levelScope";
import { normalizeCourt, courtName } from "./playerCard";

/**
 * Ordering for the Find Players list, and the rules that decide whether we are willing
 * to call that ordering a recommendation.
 */

export type RankableViewer = {
  level: string | null;
  courts: string[];
  availability: string[];
};

export type RankablePlayer = {
  level: string;
  localCourts: string[];
  availability: string[];
  verified?: boolean;
  profileImageUrl?: string;
};

/** Fewer than this and order carries no information worth stamping. */
export const MIN_RANKABLE_RESULTS = 4;

/**
 * Weights, heaviest first. Same court beats everything: two players who use the same
 * court will actually meet, and everything else is a preference.
 *
 * `sameCourt` is the heaviest signal sitting on the least reliable data we have — label
 * matching, no venue IDs — which is why the comparison is normalised first. See
 * normalizeCourt.
 */
export const scorePlayer = (player: RankablePlayer, viewer: RankableViewer): number => {
  let score = 0;

  const mine = new Set((viewer.courts ?? []).map((c) => normalizeCourt(courtName(c))).filter(Boolean));
  const shares = (player.localCourts ?? []).some((c) => mine.has(normalizeCourt(courtName(c))));
  if (shares) score += 40;

  const slots = new Set((viewer.availability ?? []).map((s) => s.trim().toLowerCase()));
  score += (player.availability ?? []).filter((s) => slots.has(String(s).trim().toLowerCase())).length * 8;

  const mineLevel = levelNumber(viewer.level);
  const theirLevel = levelNumber(player.level);
  if (mineLevel !== null && theirLevel !== null) {
    // Closeness of level, tapering linearly to nothing just under two rungs apart.
    // Rounded: the raw arithmetic produces values like 5.9999999999999964, which are
    // fine to sort by and awful to read in a debug log or a test failure.
    score += Math.round(Math.max(0, 30 - Math.abs(theirLevel - mineLevel) * 16));
  }

  // A confirmed rating breaks ties; it does not outrank a shared court.
  if (player.verified) score += 4;
  if (player.profileImageUrl) score += 2;

  return score;
};

export const rankPlayers = <T extends RankablePlayer>(players: T[], viewer: RankableViewer): T[] =>
  [...players]
    .map((player, index) => ({ player, index, score: scorePlayer(player, viewer) }))
    // Stable: equal scores keep the order the API returned rather than shuffling.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.player);

/* ------------------------------------------------------------------ the claim */

export type CurationInput = {
  /** False when the viewer has no match profile — nothing was curated for anyone. */
  hasProfile: boolean;
  /** False when the viewer has no level; the strongest signal is then missing. */
  hasLevel: boolean;
  /** True only while every filter is still ours. */
  filtersUntouched: boolean;
  /** Did the ranking actually run over this result set? */
  rankingRan: boolean;
  resultCount: number;
};

/**
 * "Recommended by The Tennis Plan" is a claim, and it only renders when the claim is
 * true. A brand mark on an unranked list is the one failure here that costs more than
 * shipping nothing at all — it spends trust to say something untrue.
 *
 * Every one of these must hold:
 *  - the viewer has a profile, or nothing was curated FOR anyone
 *  - the viewer has a level, or the heaviest personal signal is missing
 *  - no filter has been set, or the user is doing the choosing and we are not
 *  - the ranking actually ran rather than being short-circuited or unavailable
 *  - enough results that order carries information
 */
export const isCurated = (input: CurationInput): boolean =>
  input.hasProfile &&
  input.hasLevel &&
  input.filtersUntouched &&
  input.rankingRan &&
  input.resultCount >= MIN_RANKABLE_RESULTS;
