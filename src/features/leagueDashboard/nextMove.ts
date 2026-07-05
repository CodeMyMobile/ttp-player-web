// Pure "Your next move" resolver for the league dashboard.
//
// Evaluates a viewing player's context top-down and returns exactly ONE action.
// Rungs are checked in order and the FIRST match wins (Rung 0 beats everything).
// This function is UI-agnostic: it returns semantic data (kind/tone/icon key +
// copy + a routing target), and the component renders it. It has no React or
// network dependencies so it can be unit-tested in isolation.

export type NextMoveTone = "amber" | "green" | "violet" | "gray";

/** Where the action's CTA should take the player. `all-matches` is the shared
 *  browse-open-matches page — Rung 2 is the ONLY rung allowed to target it. */
export type NextMoveTarget =
  | "add-score"
  | "respond-challenge"
  | "schedule-candidate"
  | "all-matches"
  | "add-availability"
  | "direct-challenge"
  | "notify-me";

export type NextMoveKind =
  | "report_result"
  | "respond_challenge"
  | "schedule_candidate"
  | "browse_open"
  | "add_availability"
  | "challenge_opponent"
  | "all_caught_up";

/** A completed match the viewer played but hasn't scored yet. */
export interface UnscoredResult {
  matchId: string | number;
  opponentName: string;
  /** ISO date the match was completed/pending since (for "pending since …"). */
  completedAt?: string;
}

/** A challenge someone sent the viewer that awaits the viewer's response. */
export interface PendingChallenge {
  challengeId: string | number;
  fromName: string;
  createdAt?: string;
}

/** A player already looking whose availability matches the viewer's. */
export interface MatchmakeCandidate {
  playerId: string | number;
  name: string;
  /** The suggestion id to hand off to the accept flow (scheduling). */
  suggestionId?: string | number;
  /** Display string for when/where, e.g. "Sat Jul 12 · 3 PM". */
  when?: string;
  distanceMiles?: number | null;
  /** candidate.rating - viewer.rating (signed). */
  ratingDelta?: number | null;
}

/** A league opponent the viewer has neither played nor challenged. */
export interface UnplayedOpponent {
  playerId: string | number;
  name: string;
  /** opponent.rating - viewer.rating (signed); closeness = abs(ratingDelta). */
  ratingDelta: number;
  /** ISO timestamp of the opponent's last activity (more recent = better). */
  lastActiveAt: string;
}

export interface NextMoveContext {
  has_posted_availability: boolean;
  open_match_count: number;
  matchmake_candidate: MatchmakeCandidate | null;
  unscored_results: UnscoredResult[];
  pending_challenges_for_me: PendingChallenge[];
  unplayed_opponents: UnplayedOpponent[];
}

export interface NextMove {
  /** Which rung produced this action (0–4) — handy for debugging + tests. */
  rung: 0 | 1 | 2 | 3 | 4;
  kind: NextMoveKind;
  tone: NextMoveTone;
  /** Semantic icon key the component maps to an SVG/lucide glyph. */
  icon: string;
  title: string;
  body: string;
  /** Optional supporting line (location/rating gap/etc.). */
  meta?: string;
  cta: { label: string; target: NextMoveTarget };
  /** True for the low-emphasis "all caught up" ghost CTA. */
  ghost?: boolean;
}

const ratingGap = (delta?: number | null): string => {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "";
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  return `rating gap ${delta >= 0 ? "+" : "−"}${rounded.toFixed(1)}`;
};

/** Closest rating first (min |ratingDelta|); ties broken by most recently active. */
export const pickBestUnplayedOpponent = (
  opponents: UnplayedOpponent[],
): UnplayedOpponent | null => {
  if (!opponents.length) return null;
  return [...opponents].sort((a, b) => {
    const byRating = Math.abs(a.ratingDelta) - Math.abs(b.ratingDelta);
    if (byRating !== 0) return byRating;
    // More recent lastActiveAt wins (descending time).
    return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
  })[0];
};

export const computeNextMove = (ctx: NextMoveContext): NextMove => {
  // ── Rung 0: close open loops (highest priority, always amber) ───────────────
  if (ctx.unscored_results.length > 0) {
    const r = ctx.unscored_results[0];
    return {
      rung: 0,
      kind: "report_result",
      tone: "amber",
      icon: "clipboard-check",
      title: "Report your last result",
      body: `You played ${r.opponentName} — add the score to close it out.`,
      meta: r.completedAt ? `Pending since ${r.completedAt}` : undefined,
      cta: { label: "Add score", target: "add-score" },
    };
  }
  if (ctx.pending_challenges_for_me.length > 0) {
    const c = ctx.pending_challenges_for_me[0];
    return {
      rung: 0,
      kind: "respond_challenge",
      tone: "amber",
      icon: "bolt",
      title: "Respond to a challenge",
      body: `${c.fromName} challenged you to a match. Accept or propose a new time.`,
      meta: c.createdAt ? `Waiting since ${c.createdAt}` : undefined,
      cta: { label: "Respond", target: "respond-challenge" },
    };
  }

  // ── Rung 1: availability posted AND a matched candidate → schedule ──────────
  if (ctx.has_posted_availability && ctx.matchmake_candidate) {
    const m = ctx.matchmake_candidate;
    const metaBits = [
      m.when,
      m.distanceMiles != null && Number.isFinite(m.distanceMiles) ? `${m.distanceMiles} mi` : "",
      ratingGap(m.ratingDelta),
    ].filter(Boolean);
    return {
      rung: 1,
      kind: "schedule_candidate",
      tone: "violet",
      icon: "calendar-plus",
      title: "Get your next match on the calendar",
      body: `${m.name} matches your availability.`,
      meta: metaBits.length ? metaBits.join(" · ") : undefined,
      cta: { label: `Schedule with ${m.name.split(" ")[0]}`, target: "schedule-candidate" },
    };
  }

  // ── Rung 2: not posted, but there IS an open pool → browse open matches ─────
  if (!ctx.has_posted_availability && ctx.open_match_count > 0) {
    return {
      rung: 2,
      kind: "browse_open",
      tone: "violet",
      icon: "users",
      title: `${ctx.open_match_count} ${ctx.open_match_count === 1 ? "player has" : "players have"} open times`,
      body: "You haven't set your availability yet — browse everyone who's open.",
      meta: "Opens the all-matches page",
      cta: { label: "Browse open matches", target: "all-matches" },
    };
  }

  // ── Rung 3: no open matches ────────────────────────────────────────────────
  // HARD RULE: we never reach "all-matches" here — open_match_count === 0.
  if (ctx.open_match_count === 0) {
    if (!ctx.has_posted_availability) {
      return {
        rung: 3,
        kind: "add_availability",
        tone: "violet",
        icon: "calendar-plus",
        title: "Be the first to open a time",
        body: "No open matches yet. Add your availability so opponents can book you.",
        meta: "Seeds the pool for the next player",
        cta: { label: "Add availability", target: "add-availability" },
      };
    }
    const opponent = pickBestUnplayedOpponent(ctx.unplayed_opponents);
    if (opponent) {
      return {
        rung: 3,
        kind: "challenge_opponent",
        tone: "violet",
        icon: "target-arrow",
        title: "Challenge someone directly",
        body: `No open times match yours right now. Challenge ${opponent.name} — you haven't played yet.`,
        meta: ratingGap(opponent.ratingDelta) || undefined,
        cta: { label: `Challenge ${opponent.name.split(" ")[0]}`, target: "direct-challenge" },
      };
    }
  }

  // ── Rung 4: exhausted — played or challenged everyone available ─────────────
  return {
    rung: 4,
    kind: "all_caught_up",
    tone: "gray",
    icon: "check",
    title: "You're all caught up",
    body: "You've played or challenged everyone available. We'll let you know the moment someone posts a time.",
    cta: { label: "Notify me when a time opens", target: "notify-me" },
    ghost: true,
  };
};
