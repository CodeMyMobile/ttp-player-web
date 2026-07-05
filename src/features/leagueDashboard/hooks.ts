// Data-seam hooks for the League Dashboard.
//
// Components consume ONLY these hooks — never fixtures directly. Each is backed
// by mock fixtures today but shaped so a real fetch (React Query, SWR, etc.) can
// drop in without changing any component: same return shape, same call sites.

import { useMemo } from "react";

import { computeNextMove } from "./nextMove";
import { getLeagueData, getLeagueSummaries } from "./fixtures";
import type { LeagueData, LeagueSummary, NextMove, StandingRow, ViewerHero } from "./types";

export interface UseLeagueResult {
  data: LeagueData;
  /** All leagues for the switcher (active + archived), ordered. */
  leagues: LeagueSummary[];
}

/** The active league's full dataset + the switcher list. Swapping `leagueId`
 *  returns an entirely different dataset, repopulating the whole page. */
export const useLeague = (leagueId?: string): UseLeagueResult => {
  return useMemo(
    () => ({
      data: getLeagueData(leagueId),
      leagues: getLeagueSummaries(),
    }),
    [leagueId],
  );
};

export interface UsePlayerResult {
  hero: ViewerHero;
  /** The viewing player's standings row, if they appear in the table. */
  you?: StandingRow;
}

/** The viewing player's record + derived hero for the active league. */
export const usePlayer = (leagueId?: string): UsePlayerResult => {
  const data = getLeagueData(leagueId);
  return useMemo(
    () => ({
      hero: data.hero,
      you: data.standings.find((row) => row.isYou),
    }),
    [data],
  );
};

/** The single "next move" for the viewing player, from the pure resolver. */
export const useNextMove = (leagueId?: string): NextMove => {
  const data = getLeagueData(leagueId);
  return useMemo(() => computeNextMove(data.nextMoveContext), [data]);
};
