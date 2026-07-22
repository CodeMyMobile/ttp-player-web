// Shared league season-progress math. Mirrors the computation in
// features/leagueDashboard/useLeagueDashboard.ts (matches-played vs a default minimum) so the
// browse cards and the dashboard agree without duplicating drift-prone logic. The dashboard
// feature is out of scope for this change and left untouched; it should adopt this helper in a
// follow-up so there is a single source of truth.

// League config carries no explicit per-league minimum, so default to 6 (same as the dashboard).
export const LEAGUE_MIN_MATCHES = 6;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type SeasonProgress = {
  played: number;
  minimum: number;
  pct: number;
  met: boolean;
  label: string;
};

export const computeSeasonProgress = (
  viewerMatchesPlayed: number | string | null | undefined,
  archived = false,
  minimum: number = LEAGUE_MIN_MATCHES,
): SeasonProgress => {
  const played = Math.max(0, Math.floor(Number(viewerMatchesPlayed) || 0));
  const safeMin = minimum > 0 ? minimum : LEAGUE_MIN_MATCHES;
  const pct = archived
    ? 100
    : Math.max(0, Math.min(100, Math.round((played / safeMin) * 100)));
  return {
    played,
    minimum: safeMin,
    pct,
    met: played >= safeMin,
    label: archived ? "Season complete" : `${played} of ${safeMin} minimum matches`,
  };
};

// Whole weeks remaining until end_date. null when absent/unparseable; 0 once past.
// `now` is injectable for deterministic tests.
export const weeksRemaining = (
  endDate: string | null | undefined,
  now: number = Date.now(),
): number | null => {
  if (!endDate) return null;
  const end = Date.parse(endDate);
  if (Number.isNaN(end)) return null;
  const ms = end - now;
  if (ms <= 0) return 0;
  return Math.ceil(ms / WEEK_MS);
};
