// Pure, framework-free helpers for the Log a Result flow.
// No React in here — safe to unit-test and to share with the backend contract later.

export const initials = (name) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

export const newSet = () => ({ kind: "set", you: 0, opp: 0, tb: null });

// local (not UTC) yyyy-mm-dd, so "today" is correct near midnight
export const localISO = (d = new Date()) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};
export const TODAY = localISO();
export const YESTERDAY = localISO(new Date(Date.now() - 86400000));

export function prettyDate(iso) {
  if (iso === TODAY) return "Today";
  if (iso === YESTERDAY) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

// a tennis set is valid at 6 with a 2-game lead, or 7-5 / 7-6 (tiebreak);
// a match tiebreak ("mtb") is first to 10, win by 2
export function setStatus(s) {
  const { you, opp } = s;
  if (you === 0 && opp === 0) return "empty";
  if (you === opp) return "invalid";
  const hi = Math.max(you, opp), lo = Math.min(you, opp);
  if (s.kind === "mtb") return hi >= 10 && hi - lo >= 2 ? "ok" : "invalid";
  if (hi === 6 && lo <= 4) return "ok";
  if (hi === 7 && (lo === 5 || lo === 6)) return "ok";
  return "invalid";
}

export const isTiebreakSet = (s) =>
  s.kind === "set" && ((s.you === 7 && s.opp === 6) || (s.you === 6 && s.opp === 7));

export function cellState(s, side) {
  if (setStatus(s) !== "ok") return "neutral";
  const mine = side === "you" ? s.you : s.opp;
  const theirs = side === "you" ? s.opp : s.you;
  return mine > theirs ? "win" : "lose";
}

export const cellClass = (state) =>
  state === "win" ? "text-slate-900 font-extrabold"
  : state === "lose" ? "text-slate-300 font-bold"
  : "text-slate-600 font-bold";

export function fmtSet(s) {
  if (s.kind === "mtb") return `[${s.you}-${s.opp}]`;
  let str = `${s.you}-${s.opp}`;
  if (s.tb && (s.tb.you || s.tb.opp)) str += `(${Math.min(s.tb.you, s.tb.opp)})`;
  return str;
}

export function scoreString(sets, dnf) {
  if (dnf) return "Retired";
  return sets.filter((s) => setStatus(s) !== "empty").map(fmtSet).join("  ");
}

// scoreboard layout helpers
export const boardTemplate = (sets) => `minmax(84px,1fr) ${sets.map(() => "auto").join(" ")}`;
export const colLabel = (s, i, format) =>
  s.kind === "mtb" ? "TB" : format === "single" ? "Set" : `Set ${i + 1}`;

// derive winner / completeness from the entered sets
export function computeResult({ sets, dnf, dnfWinner, format }) {
  if (dnf) {
    return {
      complete: !!dnfWinner, winner: dnfWinner, you: 0, opp: 0,
      issue: dnfWinner ? null : "Pick who won.", decider: null,
    };
  }
  const target = format === "single" ? 1 : 2;
  let you = 0, opp = 0, anyInvalid = false, decider = null;
  const entered = sets.filter((s) => setStatus(s) !== "empty");
  for (const s of entered) {
    if (setStatus(s) !== "ok") { anyInvalid = true; continue; }
    if (s.you > s.opp) you++; else opp++;
    if (s.kind === "mtb") decider = "mtb";
  }
  const winner = !anyInvalid && Math.max(you, opp) === target
    ? (you > opp ? "you" : "opp") : null;
  let issue = null;
  if (entered.length === 0) issue = format === "single" ? "Enter the games." : "Enter the games for each set.";
  else if (anyInvalid) issue = "Check the set scores — e.g. 6-4, 7-5 or 7-6.";
  else if (!winner) issue = format === "single" ? "Finish the set." : "Needs a 2-set winner.";
  return { complete: !!winner, winner, you, opp, issue, decider };
}

// The body this page WOULD POST. Shaped to the Match model in the league brief.
// TODO(Sahil): POST /matches  → { match_id, status: "pending", confirm_window_ends_at }
export function buildSubmitPayload({ me, opponent, date, court, format, sets, dnf, dnfWinner }) {
  const base = {
    context: "casual",
    reported_by: me.id,     // player_a is the current user
    player_b: opponent.id,
    played_at: date,        // local yyyy-mm-dd
    venue_id: court.id,     // REQUIRED — new field on Match, FK to courts
    format,
  };
  if (dnf) return { ...base, retired: { winner: dnfWinner }, score_string: "Retired" };
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
