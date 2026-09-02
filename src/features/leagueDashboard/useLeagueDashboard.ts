// Live data-seam hook for the League Dashboard.
//
// Replaces the mock hooks (useLeague/usePlayer/useNextMove) on the live path:
// resolves the auth token + viewer identity, fetches the real leagues API in
// parallel, and maps the responses into the dashboard's domain shapes (types.ts)
// so no component's prop contract changes. The pure resolver computeNextMove is
// fed a NextMoveContext built here — it is NOT modified.
//
// TRUTHFUL-UI: where the API has no backing data (rank-movement history, per-row
// streak history, a challenges endpoint, per-opponent last-active time), we
// DEGRADE to neutral placeholders rather than fabricate — each marked `// NOTE:`.

import { useEffect, useMemo, useState } from "react";

import {
  type League,
  type LeagueFixture,
  type LeagueMatchNeed,
  type LeagueMatchSuggestion,
  type LeaguePlayer,
  type LeagueStanding,
  getLeagueFixtures,
  getLeagueMatchNeeds,
  getLeaguePlayers,
  getLeagueStandings,
  listMyLeagues,
} from "../../api/leagues";
import { useAuth } from "../../context/AuthContext";
import { getStoredAuthToken } from "../../services/authToken";
import {
  formatLeagueDate,
  formatLeagueTime,
  isFutureLeagueItem,
} from "../../pages/leagueDetailTime";
import { buildLeagueLadderRows } from "../../pages/leagueLadder";
import { orientScore } from "../../pages/leagueScore";
import { deriveNtrp, deriveUtr } from "../../utils/ratingConversions";
import { computeNextMove } from "./nextMove";
import type {
  LeagueData,
  LeagueStatus,
  LeagueSummary,
  LookingPlayer,
  NextMove,
  NextMoveContext,
  PendingRow,
  ResultRow,
  RosterPlayer,
  StandingRow,
  ViewerHero,
} from "./types";

const MIN_MATCHES = 6; // NOTE: league config has no explicit minimum; default to 6.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const ARCHIVED_STATUSES = new Set([
  "completed",
  "complete",
  "ended",
  "archived",
  "closed",
  "finished",
]);

export interface UseLeagueDashboardResult {
  data: LeagueData | null;
  hero: ViewerHero | null;
  nextMove: NextMove | null;
  leagues: LeagueSummary[];
  loading: boolean;
  error: string | null;
}

const normalizeIdentity = (value: unknown) => String(value ?? "").trim().toLowerCase();

const initials = (name?: string | null): string =>
  String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const firstName = (name?: string | null) => String(name ?? "").split(/\s+/)[0] || "Player";

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isArchivedLeague = (league?: League | null) =>
  ARCHIVED_STATUSES.has(String(league?.status ?? "").toLowerCase());

const shortDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Human "2h ago" / "yesterday" / "Mar 14" for a completed match's played_date.
const relativeTime = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const flipScore = (score: string): string =>
  score
    .split(/\s+/)
    .map((set) => {
      const [a, b] = set.split("-");
      return b !== undefined ? `${b}-${a}` : set;
    })
    .join(" ");

const setsWon = (score: string, side: 0 | 1): number =>
  score.split(/\s+/).reduce((count, set) => {
    const [a, b] = set.split("-").map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return count;
    const firstWon = a > b;
    return count + (side === 0 ? (firstWon ? 1 : 0) : firstWon ? 0 : 1);
  }, 0);

// Resolve a completed fixture to winner-first display + winner/loser ids & names.
interface CompletedResult {
  id: string;
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  score: string;
  playedDate?: string | null;
}

const resolveCompleted = (fixture: LeagueFixture): CompletedResult => {
  const p1Score = orientScore(fixture); // player1-first
  const p1Name = fixture.player1_name || "Player 1";
  const p2Name = fixture.player2_name || "Player 2";
  const p1Id = String(fixture.player1_id ?? "");
  const p2Id = String(fixture.player2_id ?? "");
  const winnerId = fixture.winner_id != null ? String(fixture.winner_id) : "";
  let winnerIsP1: boolean;
  if (winnerId) {
    winnerIsP1 = winnerId === p1Id;
  } else {
    // Fallback: infer the winner from the player1-first set tally.
    winnerIsP1 = setsWon(p1Score, 0) >= setsWon(p1Score, 1);
  }
  return {
    id: String(fixture.id),
    winnerId: winnerIsP1 ? p1Id : p2Id,
    loserId: winnerIsP1 ? p2Id : p1Id,
    winnerName: winnerIsP1 ? p1Name : p2Name,
    loserName: winnerIsP1 ? p2Name : p1Name,
    score: winnerIsP1 ? p1Score : flipScore(p1Score),
    playedDate: fixture.played_date,
  };
};

interface ViewerContext {
  identities: Set<string>;
  userId: unknown;
}

const matchesViewer = (
  viewer: ViewerContext,
  ...candidates: Array<unknown>
): boolean =>
  candidates
    .map(normalizeIdentity)
    .filter(Boolean)
    .some((identity) => viewer.identities.has(identity));

// ── Summaries (switcher list + active league header) ───────────────────────────

const leagueLevel = (league: League): string => {
  const eyebrow = league.format ? `${league.format}` : "Flex league";
  const bits = [eyebrow, league.skill_band, league.gender].filter(Boolean);
  return bits.join(" · ") || "Flex league";
};

const leagueEyebrow = (league: League): string =>
  league.format ? String(league.format) : "Flex league";

const summaryFromLeague = (league: League): LeagueSummary => {
  const archived = isArchivedLeague(league);
  const status: LeagueStatus = archived
    ? { label: league.status ? String(league.status) : "Ended", tone: "gray" }
    : { label: "Active", tone: "green" };
  return {
    id: String(league.id),
    name: league.name,
    level: leagueLevel(league),
    eyebrow: leagueEyebrow(league),
    sub: [league.skill_band, league.gender].filter(Boolean).join(" · ") || "Flex league",
    status,
    archived,
  };
};

// ── The full mapping: raw API responses → LeagueData + hero + nextMove ──────────

interface RawBundle {
  league: League;
  standings: LeagueStanding[];
  players: LeaguePlayer[];
  completed: LeagueFixture[];
  pending: LeagueFixture[];
  myNeeds: LeagueMatchNeed[];
  suggestions: LeagueMatchSuggestion[];
  allNeeds: LeagueMatchNeed[];
}

const buildDashboard = (
  leagueId: string,
  raw: RawBundle,
  viewer: ViewerContext,
): { data: LeagueData; hero: ViewerHero; nextMove: NextMove } => {
  const { league, standings, players, completed, pending, myNeeds, suggestions, allNeeds } = raw;
  const archived = isArchivedLeague(league);

  // Lookups by player id.
  const ratingByPlayer = new Map<string, number | null>();
  const contactByPlayer = new Map<string, string | undefined>();
  players.forEach((player) => {
    ratingByPlayer.set(String(player.player_id), toNumber(player.current_rating));
    contactByPlayer.set(
      String(player.player_id),
      (player.phone || player.email || undefined) as string | undefined,
    );
  });
  const recordByPlayer = new Map<string, { wins: number; losses: number }>();
  standings.forEach((row) => {
    recordByPlayer.set(String(row.player_id), { wins: row.wins, losses: row.losses });
  });

  // Viewer's own standing (by id or name).
  const viewerStanding = standings.find((row) =>
    matchesViewer(viewer, row.player_id, row.full_name),
  );
  const viewerPlayer = players.find((player) =>
    matchesViewer(viewer, player.player_id, player.full_name, player.email),
  );
  const viewerId = String(
    viewerStanding?.player_id ?? viewerPlayer?.player_id ?? viewer.userId ?? "",
  );
  const viewerRating = viewerPlayer ? toNumber(viewerPlayer.current_rating) : null;
  const viewerMatchesPlayed = viewerStanding?.matches_played ?? 0;
  const viewerRank = viewerStanding?.rank;

  // Completed results, resolved winner-first.
  const resolved = completed.map(resolveCompleted);

  // Per-player CURRENT win streak, computed from completed results in date order.
  // NOTE: the API has no streak history; we derive an active streak from results.
  const streakByPlayer = (() => {
    const timeline = new Map<string, Array<{ t: number; won: boolean }>>();
    const record = (playerId: string, t: number, won: boolean) => {
      if (!playerId) return;
      const list = timeline.get(playerId) ?? [];
      list.push({ t, won });
      timeline.set(playerId, list);
    };
    resolved.forEach((r) => {
      const t = new Date(r.playedDate || 0).getTime();
      record(r.winnerId, t, true);
      record(r.loserId, t, false);
    });
    const out = new Map<string, number>();
    timeline.forEach((entries, playerId) => {
      const ordered = [...entries].sort((a, b) => a.t - b.t);
      let streak = 0;
      for (let i = ordered.length - 1; i >= 0 && ordered[i].won; i -= 1) streak += 1;
      out.set(playerId, streak);
    });
    return out;
  })();

  // Standings rows.
  const standingRows: StandingRow[] = standings.map((row) => {
    const pid = String(row.player_id);
    const streak = streakByPlayer.get(pid) ?? 0;
    return {
      rank: row.rank,
      playerId: pid,
      name: row.full_name || `Player ${pid}`,
      initials: initials(row.full_name),
      matchesPlayed: row.matches_played,
      wins: row.wins,
      losses: row.losses,
      gameDiff: row.game_differential,
      gamesWon: row.games_for,
      gamesLost: row.games_against,
      // NOTE: no rank-movement history in the API → always flat (renders "–").
      trend: { dir: "flat" },
      // NOTE: streak derived from results; only surface a real (≥2) streak.
      ...(streak >= 2 ? { streak } : {}),
      ...(matchesViewer(viewer, row.player_id, row.full_name) ? { isYou: true } : {}),
    };
  });

  const ladderPlayers = players.length ? players : standings.map((row) => ({
    player_id: row.player_id,
    full_name: row.full_name,
    current_rating: row.current_rating,
    usta_rating: row.usta_rating,
    uta_rating: row.uta_rating,
    calculated_ntrp: row.calculated_ntrp,
    calculated_utr: row.calculated_utr,
    is_estimate: row.is_estimate,
    rating_gender: row.rating_gender,
    matches_played: row.matches_played,
    rating_source: row.matches_played > 0 ? "results" : row.is_estimate ? "self_rated" : null,
  }));
  const ladder = buildLeagueLadderRows({ players: ladderPlayers, standings, viewerId });

  // Roster.
  const roster: RosterPlayer[] = players.map((player) => {
    const pid = String(player.player_id);
    const record = recordByPlayer.get(pid) ?? { wins: 0, losses: 0 };
    // Prefer a real value (backend-calculated, then player-entered); estimate from
    // TPR only as a fallback — same logic as the public match-results page.
    const ntrpConv = deriveNtrp(player.calculated_ntrp ?? player.usta_rating, player.current_rating, player.rating_gender);
    const utrConv = deriveUtr(player.calculated_utr ?? player.uta_rating, player.current_rating);
    return {
      playerId: pid,
      name: player.full_name || `Player ${pid}`,
      initials: initials(player.full_name),
      // Unrated stays null rather than collapsing to 0 — "TPR 0.0" reads as a
      // real, very low rating, when it only ever meant "no matches yet".
      rating: toNumber(player.current_rating),
      ntrp: ntrpConv.value,
      ntrpEstimated: ntrpConv.estimated,
      utr: utrConv.value,
      utrEstimated: utrConv.estimated,
      wins: record.wins,
      losses: record.losses,
      contact: (player.phone || player.email || undefined) as string | undefined,
      phone: (player.phone ?? null) as string | null,
      // Consent only — never inferred from the presence of a number. The backend
      // does not send share_contact yet, so this stays undefined and the contact
      // sheet renders nothing. See api/leagues.ts.
      shareContact: typeof player.share_contact === "boolean" ? player.share_contact : undefined,
    };
  });

  // Results.
  const results: ResultRow[] = resolved.map((r) => ({
    id: r.id,
    winnerName: r.winnerName,
    loserName: r.loserName,
    score: r.score || "Score TBD",
    playedAgo: relativeTime(r.playedDate) || "recently",
  }));

  // Pending rows (viewer's scheduled-but-unscored fixtures).
  const pendingRows: PendingRow[] = pending.map((fixture) => ({
    id: String(fixture.id),
    player1: fixture.player1_name || "Player 1",
    player2: fixture.player2_name || "Player 2",
    isYours: matchesViewer(viewer, fixture.player1_id, fixture.player1_name)
      || matchesViewer(viewer, fixture.player2_id, fixture.player2_name),
  }));

  // Players looking — the UNION of every other player's future open need AND the
  // viewer's personalized suggestions. Suggestions and needs are different entities
  // (a suggested player may have no row in the "all needs" list), so we merge both
  // to avoid dropping suggested matches. One row per player; matches flagged and
  // surfaced first.
  const futureOpenNeeds = allNeeds
    .filter(isFutureLeagueItem)
    .filter((need) => !matchesViewer(viewer, need.host_id, need.player_id, need.player_name));
  const futureSuggestions = suggestions.filter(isFutureLeagueItem);

  const suggestedPlayerIds = new Set(
    futureSuggestions.map((s) => String(s.suggested_player_id ?? "")).filter(Boolean),
  );
  const suggestedMatchIds = new Set(
    futureSuggestions
      .flatMap((s) => [s.suggested_match_id, s.match_id])
      .filter((v) => v != null)
      .map((v) => String(v)),
  );

  const byPlayer = new Map<string, LookingPlayer>();

  // Needs first (actual posted slots), soonest kept per player.
  [...futureOpenNeeds]
    .sort((a, b) => new Date(a.start_date_time || 0).getTime() - new Date(b.start_date_time || 0).getTime())
    .forEach((need) => {
      const pid = String(need.host_id ?? need.player_id ?? need.id);
      if (byPlayer.has(pid)) return;
      const record = recordByPlayer.get(pid) ?? { wins: 0, losses: 0 };
      byPlayer.set(pid, {
        playerId: pid,
        name: need.player_name || "League player",
        rating: toNumber(need.player_skill) ?? 0,
        wins: record.wins,
        losses: record.losses,
        when: `${formatLeagueDate(need.start_date_time, need.timezone)} · ${formatLeagueTime(need.start_date_time, need.timezone)}`,
        location: need.match_location || need.location || need.location_text || "Location TBD",
        stillNeedsToPlay: need.has_played_before === false,
        isMatch: suggestedPlayerIds.has(pid) || suggestedMatchIds.has(String(need.id)),
      });
    });

  // Then any suggested player not already represented by a need (never dropped).
  futureSuggestions.forEach((s) => {
    const pid = String(s.suggested_player_id ?? s.id);
    if (byPlayer.has(pid)) return;
    const record = recordByPlayer.get(pid) ?? { wins: 0, losses: 0 };
    byPlayer.set(pid, {
      playerId: pid,
      name: s.player_name || "League player",
      rating: toNumber(s.player_skill) ?? 0,
      wins: record.wins,
      losses: record.losses,
      when: `${formatLeagueDate(s.match_date, s.timezone)} · ${formatLeagueTime(s.match_time, s.timezone)}`,
      location: s.match_location || "Location TBD",
      stillNeedsToPlay: s.has_played_before === false,
      isMatch: true,
    });
  });

  const looking: LookingPlayer[] = [...byPlayer.values()].sort(
    (a, b) => Number(b.isMatch) - Number(a.isMatch),
  );

  // Ticker — most recent completed results, newest first.
  const ticker = [...resolved]
    .sort((a, b) => new Date(b.playedDate || 0).getTime() - new Date(a.playedDate || 0).getTime())
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      text: `${firstName(r.winnerName)} d. ${firstName(r.loserName)} ${r.score} · ${relativeTime(r.playedDate) || "recently"}`.trim(),
    }));

  // This week.
  const weekCutoff = Date.now() - WEEK_MS;
  const resultsThisWeek = resolved.filter(
    (r) => new Date(r.playedDate || 0).getTime() >= weekCutoff,
  );
  // Biggest upset: lower-rated beat higher-rated (by rating), largest gap wins.
  let biggestUpset = "—"; // NOTE: DEGRADE — no upset this week or ratings missing.
  let bestUpsetGap = 0;
  resultsThisWeek.forEach((r) => {
    const wr = ratingByPlayer.get(r.winnerId);
    const lr = ratingByPlayer.get(r.loserId);
    if (wr == null || lr == null) return;
    const gap = lr - wr;
    if (gap > bestUpsetGap) {
      bestUpsetGap = gap;
      biggestUpset = `${firstName(r.winnerName)} d. ${firstName(r.loserName)}`;
    }
  });
  // Hottest streak: player with the largest active win streak (≥2).
  let hottestStreak = { name: "—", streak: 0 }; // NOTE: DEGRADE when no ≥2 streak exists.
  streakByPlayer.forEach((streak, pid) => {
    if (streak >= 2 && streak > hottestStreak.streak) {
      const row = standingRows.find((s) => s.playerId === pid);
      hottestStreak = { name: firstName(row?.name), streak };
    }
  });

  // Season progress.
  const seasonPct = Math.max(0, Math.min(100, Math.round((viewerMatchesPlayed / MIN_MATCHES) * 100)));
  const season = archived
    ? { label: "Season complete", pct: 100 }
    : { label: `${viewerMatchesPlayed} of ${MIN_MATCHES} minimum matches`, pct: seasonPct };

  // Summary (active league) — override the switcher status with the viewer's rank.
  const seasonEnd = shortDate(league.deadline);
  const summary: LeagueSummary = {
    ...summaryFromLeague(league),
    sub: [
      players.length ? `${players.length} active players` : "League details",
      seasonEnd ? `season ends ${seasonEnd}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    status: archived
      ? { label: league.status ? String(league.status) : "Ended", tone: "gray" }
      : viewerRank && viewerMatchesPlayed > 0
        ? { label: `You're #${viewerRank}`, tone: "violet" }
        : { label: "Unranked", tone: "violet" },
  };

  // ── NextMoveContext ──────────────────────────────────────────────────────────
  // Distinct OTHER players looking (not need count) — one player posting several
  // slots counts once. Feeds the action-slot's "N players are looking" fallback.
  const playersLookingCount = new Set(
    futureOpenNeeds.map((need) => String(need.host_id ?? need.player_id ?? need.player_name ?? "")),
  ).size;

  const topSuggestion = suggestions.filter(isFutureLeagueItem)[0];
  const matchmakeCandidate =
    myNeeds.length > 0 && topSuggestion
      ? {
          playerId: String(topSuggestion.suggested_player_id ?? topSuggestion.id),
          suggestionId: topSuggestion.id,
          name: topSuggestion.player_name || "League player",
          when: `${formatLeagueDate(topSuggestion.match_date, topSuggestion.timezone)} · ${formatLeagueTime(topSuggestion.match_time, topSuggestion.timezone)}`,
          distanceMiles: toNumber(topSuggestion.distance_miles),
          ratingDelta:
            viewerRating != null && toNumber(topSuggestion.player_skill) != null
              ? (toNumber(topSuggestion.player_skill) as number) - viewerRating
              : null,
        }
      : null;

  // Opponents the viewer has already faced (completed + pending), for unplayed set.
  const playedOpponentIds = new Set<string>();
  resolved.forEach((r) => {
    if (matchesViewer(viewer, r.winnerId) || (viewerId && r.winnerId === viewerId)) playedOpponentIds.add(r.loserId);
    if (matchesViewer(viewer, r.loserId) || (viewerId && r.loserId === viewerId)) playedOpponentIds.add(r.winnerId);
  });
  completed.forEach((fixture) => {
    if (matchesViewer(viewer, fixture.player1_id, fixture.player1_name)) playedOpponentIds.add(String(fixture.player2_id));
    if (matchesViewer(viewer, fixture.player2_id, fixture.player2_name)) playedOpponentIds.add(String(fixture.player1_id));
  });
  pending.forEach((fixture) => {
    if (matchesViewer(viewer, fixture.player1_id, fixture.player1_name)) playedOpponentIds.add(String(fixture.player2_id));
    if (matchesViewer(viewer, fixture.player2_id, fixture.player2_name)) playedOpponentIds.add(String(fixture.player1_id));
  });

  const unplayedOpponents = players
    .filter((player) => {
      const pid = String(player.player_id);
      if (pid === viewerId) return false;
      if (matchesViewer(viewer, player.player_id, player.full_name, player.email)) return false;
      return !playedOpponentIds.has(pid);
    })
    .map((player) => {
      const theirRating = toNumber(player.current_rating);
      return {
        playerId: String(player.player_id),
        name: player.full_name || `Player ${player.player_id}`,
        ratingDelta:
          theirRating != null && viewerRating != null ? theirRating - viewerRating : 0,
        // NOTE: DEGRADE — API has no per-opponent last-active time; epoch fallback
        // only affects the Rung-3b closest-rating tiebreak.
        lastActiveAt: new Date(0).toISOString(),
      };
    });

  const nextMoveContext: NextMoveContext = {
    has_posted_availability: myNeeds.length > 0,
    open_match_count: futureOpenNeeds.length,
    matchmake_candidate: matchmakeCandidate,
    // NOTE: pending fixtures are scheduled-but-unscored, not necessarily PLAYED.
    // A viewer who has never played (viewerMatchesPlayed === 0) has nothing to
    // report, so gate on it — otherwise a never-played player wrongly resolves to
    // Rung 0 "Add score" for a match that hasn't happened. The API can't cleanly
    // flag played-but-unreported, so this gate is the best available proxy.
    unscored_results:
      viewerMatchesPlayed > 0
        ? pending.map((fixture) => {
            const opponent = matchesViewer(viewer, fixture.player1_id, fixture.player1_name)
              ? fixture.player2_name
              : fixture.player1_name;
            return {
              matchId: fixture.id,
              opponentName: opponent || "your opponent",
              // NOTE: pending fixtures may lack a date; fall back to undefined.
              completedAt: shortDate(fixture.played_date) ?? undefined,
            };
          })
        : [],
    // NOTE: DEGRADE — no challenges endpoint exists, so this is always empty.
    pending_challenges_for_me: [],
    unplayed_opponents: unplayedOpponents,
  };

  const nextMove = computeNextMove(nextMoveContext);

  // ── Hero (viewer-driven) ───────────────────────────────────────────────────
  const isNewPlayer = viewerMatchesPlayed === 0;
  const hero: ViewerHero = isNewPlayer
    ? {
        badge: "New player",
        headline: "You haven't played yet.",
        sub:
          nextMoveContext.open_match_count > 0
            ? "Open matches are waiting. Win your first to get on the board."
            : "Post your availability to get your first match on the calendar.",
        ctaLabel: nextMove.cta.label,
        // NOTE: truthful — no projected number without a real projection model.
        projectedChip: "Win your first to get ranked",
        rankStat: "—",
        rankLabel: "Unranked",
        tone: archived ? "gray" : "violet",
      }
    : {
        badge: archived ? "Season complete" : "Your standing",
        headline: archived ? `You finished #${viewerRank}.` : `You're #${viewerRank}.`,
        sub: `${viewerStanding?.wins ?? 0}–${viewerStanding?.losses ?? 0} across ${viewerMatchesPlayed} ${viewerMatchesPlayed === 1 ? "match" : "matches"}.`,
        ctaLabel: nextMove.cta.label,
        // NOTE: truthful chip — no invented projected rank.
        projectedChip: viewerRank === 1 ? "Hold your #1 spot" : "Win to climb the table",
        rankStat: `#${viewerRank}`,
        rankLabel: archived ? "Final rank" : "Current rank",
        tone: archived ? "gray" : "violet",
      };

  const data: LeagueData = {
    summary,
    standings: standingRows,
    ladder,
    roster,
    results,
    pending: pendingRows,
    looking,
    ticker,
    week: {
      matchesPlayed: resultsThisWeek.length,
      scheduled: pending.length,
      biggestUpset,
      hottestStreak,
    },
    season,
    hero,
    nextMoveContext,
    pendingScoreCount: pending.length,
    playersLookingCount,
  };

  return { data, hero, nextMove };
};

export const useLeagueDashboard = (leagueId?: string): UseLeagueDashboardResult => {
  const { user } = useAuth();
  const token = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );

  const viewer = useMemo<ViewerContext>(() => {
    const userId =
      user?.id ?? user?.user_id ?? user?.player_id ?? user?.profile?.id ?? user?.profile?.user_id;
    const identities = new Set(
      [
        normalizeIdentity(userId),
        normalizeIdentity(user?.email),
        normalizeIdentity(user?.profile?.email),
        normalizeIdentity(user?.full_name),
        normalizeIdentity(user?.profile?.full_name),
        normalizeIdentity(user?.name),
      ].filter(Boolean),
    );
    return { identities, userId };
  }, [user]);

  const [state, setState] = useState<{
    data: LeagueData | null;
    hero: ViewerHero | null;
    nextMove: NextMove | null;
    leagues: LeagueSummary[];
  }>({ data: null, hero: null, nextMove: null, leagues: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setError("Missing league");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      getLeagueStandings({ leagueId, token, signal: controller.signal }),
      getLeaguePlayers({ leagueId, token, signal: controller.signal }),
      getLeagueFixtures({ leagueId, token, status: "confirmed", signal: controller.signal }),
      getLeagueFixtures({ leagueId, token, status: "scheduled", mine: true, signal: controller.signal }),
      getLeagueMatchNeeds({ leagueId, token, signal: controller.signal }),
      getLeagueMatchNeeds({ leagueId, token, scope: "all", signal: controller.signal }),
      listMyLeagues({ token, signal: controller.signal }),
    ])
      .then(([standingsRes, playersRes, completedRes, pendingRes, needsRes, allNeedsRes, leaguesRes]) => {
        if (controller.signal.aborted) return;
        const league = standingsRes.league ?? playersRes.league;
        const raw: RawBundle = {
          league,
          standings: standingsRes.standings ?? [],
          players: playersRes.players ?? [],
          completed: completedRes.fixtures ?? [],
          pending: pendingRes.fixtures ?? [],
          myNeeds: needsRes.myNeeds ?? [],
          suggestions: needsRes.suggestions ?? [],
          allNeeds: allNeedsRes.needs ?? [],
        };
        const built = buildDashboard(String(leagueId), raw, viewer);

        // Switcher list: real leagues, with the active one carrying the richer summary.
        const apiLeagues = leaguesRes.leagues ?? [];
        const summaries: LeagueSummary[] = apiLeagues.map((l) =>
          String(l.id) === String(leagueId) ? built.data.summary : summaryFromLeague(l),
        );
        // Ensure the active league is always present (in case listMyLeagues omits it).
        if (!summaries.some((s) => s.id === built.data.summary.id)) {
          summaries.unshift(built.data.summary);
        }

        setState({
          data: built.data,
          hero: built.hero,
          nextMove: built.nextMove,
          leagues: summaries,
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load league");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [leagueId, token, viewer]);

  return { ...state, loading, error };
};
