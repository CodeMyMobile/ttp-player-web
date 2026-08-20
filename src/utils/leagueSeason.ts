import {
  getLeagueFixtures,
  getLeagueStandings,
  type LeagueFixture,
  type LeagueStanding,
  type League,
} from "../api/leagues";
import type { PlayerPersonalDetails } from "../api/playerProfile";

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


const FINISHED_LEAGUE_STATUSES = new Set([
  "finished",
  "completed",
  "complete",
  "ended",
  "closed",
  "archived",
  "past",
]);

/**
 * The end date as a LOCAL calendar day.
 *
 * "2026-08-20" is date-only, which Date.parse reads as UTC midnight — 5pm the
 * previous day in Pacific. Against a local start-of-today that made a season
 * read as finished on its own final day, in every timezone behind UTC, hiding
 * it from the player while they could still play in it.
 *
 * Date-only values are therefore built from their digits as a local date.
 * Values carrying a time are left to Date.parse, which is right for them.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const endOfSeasonDay = (value: string): number | null => {
  const match = value.trim().match(DATE_ONLY);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const isPastLeague = (league: League, now: Date = new Date()): boolean => {
  const status = String(league.status ?? "").trim().toLowerCase();
  if (FINISHED_LEAGUE_STATUSES.has(status)) return true;
  const end = league.end_date || league.deadline;
  if (!end) return false;
  const endTime = endOfSeasonDay(String(end));
  if (endTime === null) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return endTime < startOfToday.getTime();
};

/**
 * The player's leagues that are still running, nearest deadline first.
 *
 * Order matters with concurrent seasons: the one closing soonest is the one a
 * player needs to act on, and burying it below another is how a deadline gets
 * missed.
 */
export const activeSeasons = (leagues: League[] = [], now: Date = new Date()): League[] =>
  (Array.isArray(leagues) ? leagues : [])
    .filter((league) => league && !isPastLeague(league, now))
    .sort((a, b) => {
      const left = Date.parse(String(a.end_date || a.deadline || ""));
      const right = Date.parse(String(b.end_date || b.deadline || ""));
      if (Number.isNaN(left) && Number.isNaN(right)) return 0;
      if (Number.isNaN(left)) return 1;   // undated seasons sort last
      if (Number.isNaN(right)) return -1;
      return left - right;
    });

/**
 * "Sam, Dan, Priya" — first names, matching the mockup, capped so a large league
 * does not run the line off the card. Null when there is nobody left to play, so
 * the caller omits the clause rather than printing a trailing separator.
 */
export const opponentNames = (
  opponents: Array<{ full_name?: string | null }> = [],
  limit = 3,
): string | null => {
  const names = (Array.isArray(opponents) ? opponents : [])
    .map((o) => (typeof o?.full_name === "string" ? o.full_name.trim().split(/\s+/)[0] : ""))
    .filter(Boolean);
  if (!names.length) return null;
  return names.length <= limit
    ? names.join(", ")
    : `${names.slice(0, limit).join(", ")} +${names.length - limit}`;
};

// --- viewer identity -------------------------------------------------------
//
// Moved verbatim from LeaguesPage so the home season module counts the viewer's
// matches exactly as the leagues page does. Two screens deriving "how far
// through this season am I" from the same payload would drift, and the drift
// would be invisible until they disagreed on a number.

export const normalizeIdentity = (value: unknown) => String(value ?? "").trim().toLowerCase();

// The account id (user.id) and the league player_id are different id-spaces, so a single-id
// compare misses the viewer's own row. Match by id OR name OR email — mirrors useLeagueDashboard.
export const buildViewerIdentities = (
  user: unknown,
  player?: PlayerPersonalDetails | null,
): Set<string> => {
  const u = (user ?? {}) as Record<string, unknown> & { profile?: Record<string, unknown> };
  const uProfile = (u.profile ?? {}) as Record<string, unknown>;
  const userId = u.id ?? u.user_id ?? u.player_id ?? uProfile.id ?? uProfile.user_id;
  return new Set(
    [
      normalizeIdentity(userId),
      normalizeIdentity(u.email),
      normalizeIdentity(uProfile.email),
      normalizeIdentity(u.full_name),
      normalizeIdentity(uProfile.full_name),
      normalizeIdentity(u.name),
      // The fetched player profile is the reliable league-player identity (user_id matches
      // standings.player_id; full_name matches standings.full_name).
      normalizeIdentity(player?.user_id),
      normalizeIdentity(player?.id),
      normalizeIdentity(player?.full_name),
      normalizeIdentity(player?.email),
    ].filter(Boolean),
  );
};

export const matchesViewer = (identities: Set<string>, ...candidates: unknown[]): boolean =>
  candidates
    .map(normalizeIdentity)
    .filter(Boolean)
    .some((identity) => identities.has(identity));

export interface SeasonEnrichment {
  loading: boolean;
  error?: boolean;
  rank?: number | null;
  total?: number | null;
  matchesPlayed?: number;
  matchesTotal?: number;
  wins?: number;
  losses?: number;
  preSeason?: boolean;
}

/**
 * Turns a league's standings and the viewer's fixtures into season progress.
 *
 * Pure so it can be tested — this repo has no React harness, and this is the
 * arithmetic behind every "5 of 8 matches played" on the site.
 *
 * Three details that are easy to get wrong and are the reason this is shared
 * rather than reimplemented: a fixture counts as played when it carries a
 * score, not a played_date, which is unreliable; the total falls back to
 * round-robin (players − 1) when the fixtures list is empty but standings
 * exist; and the viewer's fixtures are filtered client-side as well, because
 * the backend has been seen ignoring mine=true and returning the whole league.
 */
export const deriveSeasonEnrichment = ({
  standings = [],
  fixtures = [],
  viewerIdentities,
}: {
  standings?: LeagueStanding[];
  fixtures?: LeagueFixture[];
  viewerIdentities: Set<string>;
}): SeasonEnrichment => {
  const total = standings.length;
  const mineRow = standings.find((row) =>
    matchesViewer(viewerIdentities, row.player_id, row.full_name),
  );

  const myFixtures = fixtures.filter((fixture) =>
    matchesViewer(
      viewerIdentities,
      fixture.player1_id,
      fixture.player1_name,
      fixture.player2_id,
      fixture.player2_name,
    ),
  );

  const hasScore = (fixture: LeagueFixture) =>
    typeof fixture.score === "string" && fixture.score.trim() !== "";

  const matchesTotal = myFixtures.length || Math.max(0, total - 1);
  const matchesPlayed = myFixtures.length
    ? myFixtures.filter(hasScore).length
    : Number(mineRow?.matches_played ?? 0);

  return {
    loading: false,
    preSeason: total === 0,
    rank: mineRow?.rank ?? null,
    total: total || null,
    matchesPlayed,
    matchesTotal,
    wins: mineRow ? Number(mineRow.wins) : undefined,
    losses: mineRow ? Number(mineRow.losses) : undefined,
  };
};

/** Standings plus the viewer's fixtures. Fixtures failing (404 = none) must not sink the card. */
export const fetchSeasonEnrichment = async ({
  leagueId,
  token,
  signal,
  viewerIdentities,
}: {
  leagueId: number | string;
  token?: string;
  signal?: AbortSignal;
  viewerIdentities: Set<string>;
}): Promise<SeasonEnrichment> => {
  const [standingsRes, fixturesRes] = await Promise.all([
    getLeagueStandings({ leagueId, token, signal }),
    getLeagueFixtures({ leagueId, token, mine: true, signal }).catch(() => ({
      fixtures: [] as LeagueFixture[],
    })),
  ]);

  return deriveSeasonEnrichment({
    standings: standingsRes.standings ?? [],
    fixtures: fixturesRes.fixtures ?? [],
    viewerIdentities,
  });
};
