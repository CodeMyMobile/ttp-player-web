import { request } from "./http";

export interface RankingRow {
  user_id: number;
  full_name?: string | null;
  current_rating?: number | string | null;
  matches_played?: number | null;
  is_provisional?: boolean;
  distance_miles?: number | string | null;
  court_area?: string | null;
  /**
   * Present on the response but deliberately NOT used — see rankedPosition().
   * Typed so nobody has to guess whether it exists.
   */
  rank?: number;
}

export interface RankingsResponse {
  rankings: RankingRow[];
}

export interface FetchRankingsParams {
  token?: string;
  nearLat?: number;
  nearLng?: number;
  radiusMiles?: number;
  signal?: AbortSignal;
}

const RANKINGS_PATH = "/match-results/rankings";

export const fetchRankings = ({
  token,
  nearLat,
  nearLng,
  radiusMiles,
  signal,
}: FetchRankingsParams = {}) =>
  request<RankingsResponse>(RANKINGS_PATH, {
    token,
    signal,
    query: {
      near_lat: nearLat,
      near_lng: nearLng,
      radius_miles: radiusMiles,
    },
  });

const ratingOf = (row: RankingRow) => {
  // Number(null) is 0, not NaN — so null must be rejected before coercion or an
  // unrated player reads as rated with a rating of zero and sorts last.
  const raw = row?.current_rating;
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/**
 * The viewer's position among the returned players, 1-based, or null when they
 * aren't in the list.
 *
 * DO NOT replace this with `row.rank`. The API assigns `rank = index + 1` AFTER
 * re-sorting the rows by distance, so whenever near_lat/near_lng/radius_miles
 * are supplied — which is exactly how the home tile calls it — `rank` is
 * proximity order, not rating order, and the closest player comes out first.
 * Re-sorting by current_rating here is the workaround. Ties keep the API's
 * relative order, so equal ratings resolve consistently between renders.
 */
export const rankedPosition = (rankings: RankingRow[], userId: number | null | undefined) => {
  if (!Array.isArray(rankings) || userId == null) return null;

  const rated = rankings.filter((row) => ratingOf(row) !== null);
  const ordered = rated
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const diff = (ratingOf(b.row) as number) - (ratingOf(a.row) as number);
      return diff || a.index - b.index;
    })
    .map((entry) => entry.row);

  const position = ordered.findIndex((row) => Number(row.user_id) === Number(userId));
  return position === -1 ? null : position + 1;
};

/**
 * The rated gate. Presence of a row in the rankings is what "this player has a
 * rating" means — survey completion is a different thing and must not be used
 * for this.
 */
export const isRatedInRankings = (
  rankings: RankingRow[],
  userId: number | null | undefined,
) => {
  if (!Array.isArray(rankings) || userId == null) return false;
  return rankings.some(
    (row) => Number(row.user_id) === Number(userId) && ratingOf(row) !== null,
  );
};

const ORDINAL_SUFFIXES = ["th", "st", "nd", "rd"];

/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export const ordinal = (value: number) => {
  const remainderTen = value % 10;
  const remainderHundred = value % 100;
  const suffix =
    remainderTen <= 3 && remainderHundred - remainderTen !== 10
      ? ORDINAL_SUFFIXES[remainderTen] || ORDINAL_SUFFIXES[0]
      : ORDINAL_SUFFIXES[0];
  return `${value}${suffix}`;
};

/**
 * Copy for the rating tile's sub-line. "Nearby" rather than a club name: the
 * ranking is scoped by radius, so we can say who is close, not who plays where.
 */
export const ladderPositionLabel = (position: number | null) =>
  position === null ? null : `${ordinal(position)} nearby`;
