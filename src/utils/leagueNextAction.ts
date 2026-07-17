// Single source of truth for the one "next action" strip on a Playing-now browse card.
// The green "N looking for matches" chip owns the looking signal, so this strip never mentions
// looking — it complements the chip. Priority: pre-season → minimum met (hold) → keep playing.
// Pure/selector so it can be unit-tested in isolation.

export type LeagueNextActionKind = "preseason" | "hold" | "playmore";

export type LeagueNextAction = {
  kind: LeagueNextActionKind;
  text: string;
  cta: string;
  tone: "default" | "ok";
};

export type LeagueNextActionInput = {
  // Pre-season: enrolled but the league hasn't started (no standings yet).
  preSeason: boolean;
  // Season minimum reached (computeSeasonProgress().met).
  minimumMet: boolean;
  // The viewer's current standing label, e.g. "1st", used in the "hold" copy.
  rankLabel?: string | null;
};

export const resolveLeagueNextAction = (input: LeagueNextActionInput): LeagueNextAction => {
  if (input.preSeason) {
    return { kind: "preseason", text: "You're in — nothing to do yet", cta: "Details →", tone: "ok" };
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

  return { kind: "playmore", text: "Line up your next match", cta: "Find a match →", tone: "default" };
};
