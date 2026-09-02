// Domain types for the League Dashboard.
//
// These describe the SHAPE the dashboard components consume. Fixtures back them
// today (see fixtures.ts) but a real API can populate the same shapes later
// without any component changes — the hooks are the only seam that would swap.

import type { NextMoveContext } from "./nextMove";
import type { LeagueLadderRow } from "../../pages/leagueLadder";

// Re-export the next-move contract so consumers import everything from one place.
export type {
  NextMove,
  NextMoveContext,
  NextMoveTone,
  NextMoveKind,
  NextMoveTarget,
  MatchmakeCandidate,
  UnplayedOpponent,
  UnscoredResult,
  PendingChallenge,
} from "./nextMove";

/** Status colour convention — shared across switcher pills, hero, next-move, banner.
 *  amber  = needs your action        (unscored match, response required)
 *  green  = active / waiting on others (looking for a match, in progress)
 *  violet = neutral / upcoming        (your rank, next match)
 *  gray   = inactive / archived / no action needed */
export type StatusTone = "amber" | "green" | "violet" | "gray";

export type TabKey = "ladder" | "standings" | "players" | "results" | "pending";

export interface LeagueStatus {
  label: string;
  tone: StatusTone;
}

/** Compact league descriptor used by the switcher dropdown. */
export interface LeagueSummary {
  id: string;
  name: string;
  /** Secondary line, e.g. "Flex league · 4.0". Mirrors the mock's `lvl`. */
  level: string;
  eyebrow: string;
  sub: string;
  status: LeagueStatus;
  archived: boolean;
}

export type TrendDir = "up" | "down" | "flat";

/** Rank movement this week. `value` is the number of places (▲1/▼2) or free text
 *  ("play to qualify"). Absent/flat with no value renders as a neutral dash. */
export interface Trend {
  dir: TrendDir;
  value?: string | number;
}

export interface StandingRow {
  rank: number;
  playerId: string;
  name: string;
  initials: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  gameDiff: number;
  gamesWon: number;
  gamesLost: number;
  trend: Trend;
  /** Active win streak → rendered as a flame + count. */
  streak?: number;
  isYou?: boolean;
}

export interface RosterPlayer {
  playerId: string;
  name: string;
  initials: string;
  /** The Tennis Plan rating (TPR). Null when the player has none — a player with
   *  no matches is unrated, which is not the same as rated 0.0. */
  rating: number | null;
  /** NTRP conversion display value (backend-calculated/entered, or estimated from TPR); null when none. */
  ntrp?: string | null;
  /** True when `ntrp` was estimated from the TPR rather than a real rating. */
  ntrpEstimated?: boolean;
  /** UTR conversion display value; null when none. */
  utr?: string | null;
  /** True when `utr` was estimated from the TPR rather than a real rating. */
  utrEstimated?: boolean;
  wins: number;
  losses: number;
  /** Optional contact handle for the quick-action (sms/mailto). Message button
   *  renders regardless; this just gives it a target when present. */
  contact?: string;
  /** Raw phone from the members payload, any format. Normalised at the point of use. */
  phone?: string | null;
  /**
   * Per-league opt-in to sharing this number with other players in the division.
   *
   * NOT YET SUPPLIED BY THE BACKEND — see `share_contact` in api/leagues.ts. Until
   * it lands this is always undefined, which `canShowContact` treats as withheld,
   * so no number is rendered. Do not default it to true.
   */
  shareContact?: boolean;
}

export interface ResultRow {
  id: string;
  winnerName: string;
  loserName: string;
  score: string;
  playedAgo: string;
}

export interface PendingRow {
  id: string;
  player1: string;
  player2: string;
  /** True when the viewing player is one of the two — surfaces "your" matches. */
  isYours: boolean;
}

export interface LookingPlayer {
  playerId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  when: string;
  location: string;
  /** Viewer hasn't played them yet ("Still needs to play" chip). */
  stillNeedsToPlay: boolean;
  /** Also a personalized suggestion for the viewer ("Matches you" flag). */
  isMatch: boolean;
}

export interface TickerItem {
  id: string;
  text: string;
}

export interface WeekStats {
  matchesPlayed: number;
  scheduled: number;
  biggestUpset: string;
  hottestStreak: { name: string; streak: number };
}

export interface SeasonProgress {
  label: string;
  /** 0–100 fill percentage for the progress bar. */
  pct: number;
}

/** The personalized violet hero — driven entirely by the viewing player's state. */
export interface ViewerHero {
  badge: string;
  headline: string;
  sub: string;
  ctaLabel: string;
  /** "Win your first → projected #9" style forward-looking chip. */
  projectedChip: string;
  /** Big number, e.g. "#2" or "—". */
  rankStat: string;
  rankLabel: string;
  tone: StatusTone;
}

/** A league's complete dataset. Switching leagues swaps this whole object so the
 *  entire page repopulates (standings, roster, hero, next move, everything). */
export interface LeagueData {
  summary: LeagueSummary;
  standings: StandingRow[];
  ladder: LeagueLadderRow[];
  roster: RosterPlayer[];
  results: ResultRow[];
  pending: PendingRow[];
  looking: LookingPlayer[];
  ticker: TickerItem[];
  week: WeekStats;
  season: SeasonProgress;
  hero: ViewerHero;
  /** Input for computeNextMove — the viewing player's live context. */
  nextMoveContext: NextMoveContext;
  /** Count for the amber "N pending matches need a score" banner. */
  pendingScoreCount: number;
  /** Distinct OTHER players with an open future need (for the action-slot's
   *  "N players are looking — view all" fallback). Distinct hosts, not needs,
   *  so a player posting multiple slots counts once. */
  playersLookingCount: number;
}
