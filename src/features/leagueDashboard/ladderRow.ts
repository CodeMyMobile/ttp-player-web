// Pure logic for a ladder row: the gap bar's height, the rating-status badge,
// the matches count, and the viewer's gap-to-neighbour copy.
//
// All of it lives here rather than in the component because each piece has an
// edge case that is invisible in a rendered row: a division where every TPR is
// identical divides by zero, a player verified by vouching has zero matches, and
// the viewer at rank 1 has nobody above them to measure against.

/** Bar height bounds, in px. A floor so the bottom of the ladder stays visible. */
export const GAP_BAR_MIN_PX = 14;
export const GAP_BAR_MAX_PX = 34;

/**
 * Height scaled linearly between the division's lowest and highest TPR.
 *
 * When every player shares a rating — a new division where nobody has played —
 * min and max are equal and the linear scale is 0/0. That degrades to a uniform
 * MID height rather than NaN, so the column reads as "no spread yet" instead of
 * collapsing.
 */
export const gapBarHeight = (rating: number, min: number, max: number): number => {
  if (!Number.isFinite(rating) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return GAP_BAR_MIN_PX;
  }
  const span = max - min;
  if (span <= 0) return Math.round((GAP_BAR_MIN_PX + GAP_BAR_MAX_PX) / 2);
  const t = Math.min(1, Math.max(0, (rating - min) / span));
  return Math.round(GAP_BAR_MIN_PX + t * (GAP_BAR_MAX_PX - GAP_BAR_MIN_PX));
};

/** Min/max TPR across the division, for scaling every bar against the same range. */
export const ratingRange = (ratings: number[]): { min: number; max: number } => {
  const usable = ratings.filter((value) => Number.isFinite(value));
  if (!usable.length) return { min: 0, max: 0 };
  return { min: Math.min(...usable), max: Math.max(...usable) };
};

/**
 * One badge, two states, never blank — an absent badge teaches a new player
 * nothing about why one number is trustworthy and another is a starting guess.
 *
 * NOTE: this qualifies the TPR, not the self-reported NTRP/UTR. `rating_source`
 * keys off matches_played / verified_level_count / self_rated_seed
 * (ttp-api routes/leagues.js:199), all of which describe how the TPR was
 * arrived at. That is why it sits in the TPR column.
 *
 * `results` (earned from matches) and `verified` (vouched for by other players)
 * both read as Verified for now; splitting them is a league-wide copy decision.
 */
export const isVerifiedRating = (ratingBadge: string | null | undefined): boolean =>
  String(ratingBadge ?? "").toLowerCase() === "verified";

export const ratingStatusLabel = (ratingBadge: string | null | undefined): string =>
  isVerifiedRating(ratingBadge) ? "Verified" : "est.";

/**
 * "12 matches", or an em dash when the count would contradict the badge.
 *
 * A player vouched for by three others (`verified_level_count >= 3`) is Verified
 * with matches_played of 0. "Verified · 0 matches" reads as a bug, so the count
 * is withheld rather than printed.
 */
export const matchesLabel = (
  matchesPlayed: number | null | undefined,
  ratingBadge: string | null | undefined,
): string => {
  // Number(null) is 0 and 0 is finite, so a bare Number() check reports "0
  // matches" for a player whose count we simply do not have.
  if (matchesPlayed === null || matchesPlayed === undefined) return "—";
  const count = Number(matchesPlayed);
  if (!Number.isFinite(count) || count < 0) return "—";
  if (count === 0 && isVerifiedRating(ratingBadge)) return "—";
  return `${count} ${count === 1 ? "match" : "matches"}`;
};

/** Missing NTRP/UTR reads as an em dash — the label stays, only the value goes. */
export const ratingValue = (label: string | null | undefined): string => {
  const text = String(label ?? "").trim();
  return !text || text === "-" ? "—" : text;
};

export interface GapNeighbour {
  rank: number;
  rating: number;
}

/**
 * The viewer's distance to the player directly above, or — at the top of the
 * ladder — to the one directly below. Null when they are alone in the division,
 * because "clear of nobody" is not a thing to say.
 */
export const viewerGapLabel = (
  viewer: GapNeighbour,
  above: GapNeighbour | null,
  below: GapNeighbour | null,
): string | null => {
  if (above && Number.isFinite(above.rating) && Number.isFinite(viewer.rating)) {
    return `${(above.rating - viewer.rating).toFixed(2)} behind #${above.rank}`;
  }
  if (below && Number.isFinite(below.rating) && Number.isFinite(viewer.rating)) {
    return `${(viewer.rating - below.rating).toFixed(2)} clear of #${below.rank}`;
  }
  return null;
};

/**
 * TPR to two decimals. Three implies a precision the rating does not have.
 * Guards null/undefined explicitly — Number(null) is 0, which would print a
 * confident "0.00" for a player with no rating.
 */
export const tprLabel = (rating: number | null | undefined): string => {
  if (rating === null || rating === undefined) return "—";
  return Number.isFinite(Number(rating)) ? Number(rating).toFixed(2) : "—";
};
