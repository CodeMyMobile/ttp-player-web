import type { LeagueFixture, PlayoffBracket, PlayoffMatch } from "../api/leagues";

// End-of-season playoffs (ttp-api #475): the top 8 play single elimination, quarter-finals
// 1v8, 4v5, 3v6, 2v7. The winner of slot s goes to slot ceil(s/2) of the next round, as
// player 1 from an odd slot. Players with 6+ regular-season matches get the places first.

export const PLAYOFF_SIZE = 8;
export const PLAYOFF_MIN_MATCHES = 6;
export const FINAL_ROUND = 3;

export const ROUND_NAMES: Record<number, string> = { 1: "Quarter-final", 2: "Semi-final", 3: "Final" };
const ROUND_SHORT: Record<number, string> = { 1: "QF", 2: "SF", 3: "Final" };

const DECIDED = new Set(["confirmed", "walkover", "bye"]);

const sameId = (a: unknown, b: unknown) => a != null && b != null && a !== "" && String(a) === String(b);

type PlayoffRow = Pick<PlayoffMatch, "playoff_round" | "bracket_slot"> &
  Partial<Pick<PlayoffMatch, "player1_id" | "player2_id" | "player1_name" | "player2_name" | "seed1" | "seed2" | "status" | "winner_id">>;

export const isPlayoffFixture = (fixture: Pick<LeagueFixture, "stage">) => fixture.stage === "playoff";

export const roundName = (round: number | null | undefined) => ROUND_NAMES[Number(round)] ?? "Playoff";

/** "QF 2", "SF 1", "Final". */
export const playoffShortLabel = ({ playoff_round, bracket_slot }: Pick<PlayoffRow, "playoff_round" | "bracket_slot">) => {
  const round = Number(playoff_round);
  if (round === FINAL_ROUND) return ROUND_SHORT[FINAL_ROUND];
  return `${ROUND_SHORT[round] ?? "Playoff"} ${bracket_slot ?? ""}`.trim();
};

/** The earlier match that sends a player to this side, e.g. side 2 of SF 1 comes from QF 2. */
export const feederLabel = (match: PlayoffRow, side: 1 | 2) => {
  const round = Number(match.playoff_round);
  if (round <= 1) return null;
  const slot = Number(match.bracket_slot) * 2 - (side === 1 ? 1 : 0);
  return `Winner of ${playoffShortLabel({ playoff_round: round - 1, bracket_slot: slot })}`;
};

export interface PlayoffSide {
  playerId: string | null;
  name: string;
  seed: number | null;
  won: boolean;
  /** No player yet: the name is "Winner of QF 2" or "Bye". */
  placeholder: boolean;
}

export const playoffSide = (match: PlayoffRow, side: 1 | 2): PlayoffSide => {
  const id = match[`player${side}_id`];
  const seed = match[`seed${side}`] ?? null;
  if (id != null && id !== "") {
    return {
      playerId: String(id),
      name: match[`player${side}_name`] || "Player",
      seed,
      won: sameId(match.winner_id, id),
      placeholder: false,
    };
  }
  const name = match.status === "bye" ? "Bye" : feederLabel(match, side) ?? "To be decided";
  return { playerId: null, name, seed: null, won: false, placeholder: true };
};

export const isDecided = (match: Pick<PlayoffMatch, "status">) => DECIDED.has(match.status);

/** Both players known and no winner yet: the match can be arranged and scored. */
export const isPlayable = (match: PlayoffRow & Pick<PlayoffMatch, "status">) =>
  Boolean(match.player1_id && match.player2_id) && !isDecided(match) && match.status !== "cancelled";

export const championName = (bracket: PlayoffBracket | null) => {
  if (!bracket?.champion_id) return null;
  const final = bracket.rounds.find((round) => round.round === FINAL_ROUND)?.matches[0];
  if (!final) return null;
  return sameId(final.player1_id, bracket.champion_id) ? final.player1_name ?? null : final.player2_name ?? null;
};

export type ViewerPlayoffState =
  | { kind: "none" }
  | { kind: "play"; match: PlayoffMatch; opponent: PlayoffSide; me: PlayoffSide; round: string }
  | { kind: "score-sent"; match: PlayoffMatch; opponent: PlayoffSide; round: string }
  | { kind: "waiting"; match: PlayoffMatch; me: PlayoffSide; waitingFor: string; round: string }
  | { kind: "out"; round: string }
  | { kind: "champion" };

/**
 * Where the viewer stands: their match to play, a score waiting on confirmation, through and
 * waiting for an opponent, knocked out (in which round), champion, or not in the playoffs.
 */
export const viewerPlayoffState = (bracket: PlayoffBracket | null, viewerId: string | null | undefined): ViewerPlayoffState => {
  if (!bracket || !viewerId) return { kind: "none" };
  if (sameId(bracket.champion_id, viewerId)) return { kind: "champion" };

  const mine = bracket.rounds
    .flatMap((round) => round.matches)
    .filter((match) => sameId(match.player1_id, viewerId) || sameId(match.player2_id, viewerId))
    .sort((a, b) => b.playoff_round - a.playoff_round);
  const latest = mine[0];
  if (!latest) return { kind: "none" };

  const mySide: 1 | 2 = sameId(latest.player1_id, viewerId) ? 1 : 2;
  const otherSide: 1 | 2 = mySide === 1 ? 2 : 1;
  const me = playoffSide(latest, mySide);
  const opponent = playoffSide(latest, otherSide);
  const round = roundName(latest.playoff_round);

  if (isDecided(latest)) {
    // A decided match is the latest only when the viewer lost it (a win puts them in the
    // next round), or it's a bye whose next-round row hasn't been read yet.
    return sameId(latest.winner_id, viewerId) ? { kind: "none" } : { kind: "out", round };
  }
  if (opponent.placeholder) return { kind: "waiting", match: latest, me, waitingFor: opponent.name, round };
  if (latest.status === "pending_confirmation" || latest.status === "disputed" || latest.match_result_id) {
    return { kind: "score-sent", match: latest, opponent, round };
  }
  return { kind: "play", match: latest, opponent, me, round };
};

/** A fixture-picker label for a playoff row: "Semi-final: Ana vs Ben". */
export const playoffFixtureLabel = (fixture: LeagueFixture) =>
  `${roundName(fixture.playoff_round)}: ${fixture.player1_name || "Player"} vs ${fixture.player2_name || "Player"}`;
