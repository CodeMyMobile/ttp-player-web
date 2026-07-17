// Single source of truth for the one "next action" strip on a Playing-now browse card.
// Priority order (per spec): pre-season → (1) unlogged score → (2) minimum-not-met + players
// looking → (3) minimum met → nothing. Pure/selector so it can be unit-tested in isolation.

export type LeagueNextActionKind = "preseason" | "log-score" | "looking" | "hold" | "none";

export type LeagueNextAction = {
  kind: LeagueNextActionKind;
  text: string;
  cta: string;
  tone: "default" | "ok";
};

export type LeagueNextActionInput = {
  // Pre-season: enrolled but the league hasn't started (no standings yet).
  preSeason: boolean;
  // A played match whose score the viewer hasn't logged yet (from getLeagueFixtures scheduled+mine).
  hasUnloggedScore: boolean;
  unloggedOpponentName?: string | null;
  // Season minimum reached (computeSeasonProgress().met).
  minimumMet: boolean;
  // Distinct other players currently looking for matches in this league.
  playersLookingCount: number;
  // The viewer's current standing label, e.g. "1st", used in the "hold" copy.
  rankLabel?: string | null;
};

export const resolveLeagueNextAction = (input: LeagueNextActionInput): LeagueNextAction => {
  if (input.preSeason) {
    return { kind: "preseason", text: "You're in — nothing to do yet", cta: "Details →", tone: "ok" };
  }

  if (input.hasUnloggedScore) {
    const who = input.unloggedOpponentName?.trim() || null;
    return {
      kind: "log-score",
      text: who ? `Score vs ${who} not logged yet` : "A match score isn't logged yet",
      cta: "Log score →",
      tone: "default",
    };
  }

  if (!input.minimumMet && input.playersLookingCount > 0) {
    return {
      kind: "looking",
      text: `${input.playersLookingCount} looking for matches`,
      cta: "Find a match →",
      tone: "default",
    };
  }

  if (input.minimumMet) {
    const rank = input.rankLabel?.trim();
    return {
      kind: "hold",
      text: rank ? `Minimum met — keep playing to hold ${rank}` : "Minimum met — keep playing",
      cta: "Find a match →",
      tone: "ok",
    };
  }

  return { kind: "none", text: "You're all set for now", cta: "Details →", tone: "ok" };
};
