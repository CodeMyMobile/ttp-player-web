// Pure, framework-free helpers for the Log a Result flow.
// No React in here — safe to unit-test and to share with the backend contract later.
//
// This file is the source of truth for the data shapes the page works with and for
// the body it would POST. Keep the types in sync with the backend Match model.

// ---- Data shapes -----------------------------------------------------------

export type Format = "single" | "bo3";

export type Side = "you" | "opp";

export type SetKind = "set" | "mtb";

// Optional 7-6 tiebreak points kept for display only.
export interface TiebreakPoints {
  you: number;
  opp: number;
}

export interface MatchSet {
  kind: SetKind;
  you: number;
  opp: number;
  tb: TiebreakPoints | null;
}

export interface Player {
  id: string;
  name: string;
  ntrp: string;
  color?: string; // tailwind avatar classes, e.g. "bg-rose-100 text-rose-700"
}

export interface CurrentUser {
  id: string;
  name: string;
  ntrp: string;
}

export interface Court {
  id: string;
  name: string;
  area: string;
}

export interface Result {
  complete: boolean;
  winner: Side | null;
  you: number;
  opp: number;
  issue: string | null;
  decider: "mtb" | null;
}

export type SetStatus = "empty" | "invalid" | "ok";

export type CellState = "win" | "lose" | "neutral";

// The body this page WOULD POST. Shaped to the Match model in the league brief.
export interface SubmitPayloadBase {
  context: "casual";
  reported_by: string; // player_a is the current user
  player_b: string;
  played_at: string; // local yyyy-mm-dd
  venue_id: string; // REQUIRED — new field on Match, FK to courts
  format: Format;
}

export interface SubmitSet {
  kind: SetKind;
  you: number;
  opp: number;
  tb?: TiebreakPoints;
}

export type SubmitPayload =
  | (SubmitPayloadBase & { retired: { winner: Side }; score_string: "Retired" })
  | (SubmitPayloadBase & { retired: false; sets: SubmitSet[]; score_string: string });

// ---- Helpers ---------------------------------------------------------------

export const initials = (name: string): string =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

export const newSet = (): MatchSet => ({ kind: "set", you: 0, opp: 0, tb: null });

// local (not UTC) yyyy-mm-dd, so "today" is correct near midnight
export const localISO = (d: Date = new Date()): string => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};
export const TODAY = localISO();
export const YESTERDAY = localISO(new Date(Date.now() - 86400000));

export function prettyDate(iso: string): string {
  if (iso === TODAY) return "Today";
  if (iso === YESTERDAY) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

// a tennis set is valid at 6 with a 2-game lead, or 7-5 / 7-6 (tiebreak);
// a match tiebreak ("mtb") is first to 10, win by 2
export function setStatus(s: MatchSet): SetStatus {
  const { you, opp } = s;
  if (you === 0 && opp === 0) return "empty";
  if (you === opp) return "invalid";
  const hi = Math.max(you, opp), lo = Math.min(you, opp);
  if (s.kind === "mtb") return hi >= 10 && hi - lo >= 2 ? "ok" : "invalid";
  if (hi === 6 && lo <= 4) return "ok";
  if (hi === 7 && (lo === 5 || lo === 6)) return "ok";
  return "invalid";
}

export const isTiebreakSet = (s: MatchSet): boolean =>
  s.kind === "set" && ((s.you === 7 && s.opp === 6) || (s.you === 6 && s.opp === 7));

export function cellState(s: MatchSet, side: Side): CellState {
  if (setStatus(s) !== "ok") return "neutral";
  const mine = side === "you" ? s.you : s.opp;
  const theirs = side === "you" ? s.opp : s.you;
  return mine > theirs ? "win" : "lose";
}

export const cellClass = (state: CellState): string =>
  state === "win" ? "text-slate-900 font-extrabold"
  : state === "lose" ? "text-slate-300 font-bold"
  : "text-slate-600 font-bold";

export function fmtSet(s: MatchSet): string {
  if (s.kind === "mtb") return `[${s.you}-${s.opp}]`;
  let str = `${s.you}-${s.opp}`;
  if (s.tb && (s.tb.you || s.tb.opp)) str += `(${Math.min(s.tb.you, s.tb.opp)})`;
  return str;
}

export function scoreString(sets: MatchSet[], dnf: boolean): string {
  if (dnf) return "Retired";
  return sets.filter((s) => setStatus(s) !== "empty").map(fmtSet).join("  ");
}

// scoreboard layout helpers
export const boardTemplate = (sets: MatchSet[]): string =>
  `minmax(84px,1fr) ${sets.map(() => "auto").join(" ")}`;
export const colLabel = (s: MatchSet, i: number, format: Format): string =>
  s.kind === "mtb" ? "TB" : format === "single" ? "Set" : `Set ${i + 1}`;

// derive winner / completeness from the entered sets
export function computeResult(
  { sets, dnf, dnfWinner, format }:
  { sets: MatchSet[]; dnf: boolean; dnfWinner: Side | null; format: Format },
): Result {
  if (dnf) {
    return {
      complete: !!dnfWinner, winner: dnfWinner, you: 0, opp: 0,
      issue: dnfWinner ? null : "Pick who won.", decider: null,
    };
  }
  const target = format === "single" ? 1 : 2;
  let you = 0, opp = 0, anyInvalid = false;
  let decider: "mtb" | null = null;
  const entered = sets.filter((s) => setStatus(s) !== "empty");
  for (const s of entered) {
    if (setStatus(s) !== "ok") { anyInvalid = true; continue; }
    if (s.you > s.opp) you++; else opp++;
    if (s.kind === "mtb") decider = "mtb";
  }
  const winner: Side | null = !anyInvalid && Math.max(you, opp) === target
    ? (you > opp ? "you" : "opp") : null;
  let issue: string | null = null;
  if (entered.length === 0) issue = format === "single" ? "Enter the games." : "Enter the games for each set.";
  else if (anyInvalid) issue = "Check the set scores — e.g. 6-4, 7-5 or 7-6.";
  else if (!winner) issue = format === "single" ? "Finish the set." : "Needs a 2-set winner.";
  return { complete: !!winner, winner, you, opp, issue, decider };
}

// The body this page WOULD POST. Shaped to the Match model in the league brief.
// TODO(Sahil): POST /matches  → { match_id, status: "pending", confirm_window_ends_at }
export function buildSubmitPayload(
  { me, opponent, date, court, format, sets, dnf, dnfWinner }:
  {
    me: CurrentUser; opponent: Player; date: string; court: Court;
    format: Format; sets: MatchSet[]; dnf: boolean; dnfWinner: Side | null;
  },
): SubmitPayload {
  const base: SubmitPayloadBase = {
    context: "casual",
    reported_by: me.id,     // player_a is the current user
    player_b: opponent.id,
    played_at: date,        // local yyyy-mm-dd
    venue_id: court.id,     // REQUIRED — new field on Match, FK to courts
    format,
  };
  if (dnf) return { ...base, retired: { winner: dnfWinner as Side }, score_string: "Retired" };
  const played = sets.filter((s) => setStatus(s) !== "empty");
  return {
    ...base,
    retired: false,
    // player_a (you) first; match-tiebreak deciders store as 1-0 games for the
    // rating engine per margin_config — points kept only for display.
    sets: played.map((s) => ({ kind: s.kind, you: s.you, opp: s.opp, ...(s.tb ? { tb: s.tb } : {}) })),
    score_string: scoreString(sets, false),
  };
}
