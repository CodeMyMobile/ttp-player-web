import { useEffect, useState } from "react";

import { getLeagueBestBets, type BestBetsResponse } from "../../api/availability";
import { getStoredAuthToken } from "../../services/authToken";

export type BestBetsState =
  | { status: "loading" }
  | { status: "ready"; data: BestBetsResponse }
  // Not a member, or the request failed: the section is left out rather than guessed at.
  | { status: "unavailable" };

/** The viewer's best bets this week in a league (ttp-api GET /leagues/:id/best-bets). */
export const useBestBets = (leagueId: string | number | null | undefined, enabled: boolean): BestBetsState => {
  const [state, setState] = useState<BestBetsState>({ status: "loading" });
  useEffect(() => {
    if (!enabled || leagueId == null || leagueId === "") {
      setState({ status: "unavailable" });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    getLeagueBestBets({ leagueId, token: getStoredAuthToken() ?? undefined, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "unavailable" });
      });
    return () => controller.abort();
  }, [leagueId, enabled]);
  return state;
};
