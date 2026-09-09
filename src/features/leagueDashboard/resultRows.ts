// Ordering and scoping for the Results tab.
//
// Pure, and in its own file for the same reason ladderRow.ts is: the edge cases are
// invisible in a rendered list. A result with no played date, two results logged in the
// same minute, and a viewer who appears as the loser rather than the winner all look
// like ordinary rows until one of them sorts to the wrong end.

import type { ResultRow } from "./types";

/**
 * Epoch ms for a played date.
 *
 * An absent or unparseable date collapses to 0, which under a newest-first order puts it
 * last — where a result we cannot place in time belongs.
 *
 * Both guards are load-bearing and neither covers the other. `|| 0` catches null and the
 * empty string; the NaN check catches a string that is present but not a date, where
 * `new Date(...).getTime()` is NaN. A comparator that returns NaN sorts nothing, so one
 * malformed row would leave the whole list in arrival order — silently reinstating the
 * bug this file exists to fix.
 */
export const playedAtMs = (playedDate: string | null | undefined): number => {
  const ms = new Date(playedDate || 0).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Newest first.
 *
 * Ties break on nothing — Array.prototype.sort is stable in every engine we target, so
 * two results sharing a timestamp keep the order the API sent them in rather than
 * swapping between renders.
 */
export const byNewestPlayed = (a: ResultRow, b: ResultRow): number =>
  playedAtMs(b.playedDate) - playedAtMs(a.playedDate);

export type ResultScope = "all" | "mine";

/** The rows a scope shows. "all" is the identity, not a copy — nothing mutates these. */
export const scopeResults = (rows: ResultRow[], scope: ResultScope): ResultRow[] =>
  scope === "mine" ? rows.filter((row) => row.isYours) : rows;
