// Pure helpers for the home v2 score grid (ScoreGrid.tsx): which deciding-set chip is on,
// when the third column opens, how a typed cell becomes a number, and the winner line.
// Scoring rules themselves stay in scoring.ts.

import { setStatus, setWinnerSide } from "./scoring";
import type { Format, MatchSet, Result, SetKind, Side } from "./scoring";

/** The format chips: how the deciding set is played, or the match didn't finish. */
export type FormatChip = "mtb" | "set" | "retired";

export const FORMAT_CHIPS: { key: FormatChip; label: string }[] = [
  { key: "mtb", label: "Match tiebreak" },
  { key: "set", label: "Full 3rd set" },
  { key: "retired", label: "Retired/default" },
];

export const activeChip = (sets: MatchSet[], dnf: boolean): FormatChip =>
  dnf ? "retired" : sets[2]?.kind === "mtb" ? "mtb" : "set";

export const deciderKind = (chip: FormatChip): SetKind | null =>
  chip === "mtb" ? "mtb" : chip === "set" ? "set" : null;

/** The third column only takes a score at one set all; any other time it would be thrown away. */
export function thirdSetOpen(sets: MatchSet[], format: Format): boolean {
  if (format !== "bo3") return false;
  const first = sets[0] ? setWinnerSide(sets[0]) : null;
  const second = sets[1] ? setWinnerSide(sets[1]) : null;
  return !!first && !!second && first !== second;
}

/** Digits only: one for a set's games, two for a match tiebreak's points. */
export const cleanCell = (raw: string, kind: SetKind): string =>
  raw.replace(/\D/g, "").slice(0, kind === "mtb" ? 2 : 1);

/**
 * A set counts once both of its cells are filled. Until then it's empty, so typing a 6 in
 * one cell doesn't read as 6–0 and announce a winner before the other score is in.
 */
export function setFromCells(kind: SetKind, you: string, opp: string): MatchSet {
  if (you === "" || opp === "") return { kind, you: 0, opp: 0, tb: null };
  return { kind, you: Number(you), opp: Number(opp), tb: null };
}

/**
 * "You won 6–4, 3–6, 10–7". Each set is written winner's games first, as scores are read
 * out in tennis. Null until the result is complete.
 */
export function winnerLine(
  { result, sets, dnf, opponentName }:
  { result: Result; sets: MatchSet[]; dnf: boolean; opponentName: string },
): string | null {
  if (!result.complete || !result.winner) return null;
  const who = result.winner === "you" ? "You" : opponentName;
  if (dnf) return `${who} won by retirement or default`;
  const winner: Side = result.winner;
  const loser: Side = winner === "you" ? "opp" : "you";
  const score = sets
    .filter((set) => setStatus(set) === "ok")
    .map((set) => `${set[winner]}–${set[loser]}`)
    .join(", ");
  return `${who} won ${score}`;
}
