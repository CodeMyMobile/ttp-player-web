import { useCallback, useEffect, useMemo } from "react";

import { listMyLeagues, getLeagueFixtures } from "../../api/leagues";
import { listMatches } from "../../api/matches";
import { getPlayerUpcomingLessons } from "../../api/player";
import { useApiRequest } from "../../hooks/useApiRequest";
import { getStoredAuthToken } from "../../services/authToken";
import { listInvites } from "../../services/invites";
import { buildViewerIdentities } from "../../utils/leagueSeason";
import { toLocalYmd } from "../../utils/dateTime";
import { weekDays } from "../../utils/weekDays";
import { countNeedsResponse, groupWeek } from "./adapters";
import { loadMyWeek, type MyWeekLoad } from "./loadMyWeek";
import type { WeekDayItems, WeekItem } from "./types";

/** Fired after anything that changes the week (accept, decline, book, cancel): My Week refetches. */
export const MY_WEEK_CHANGED_EVENT = "my-week:changed";

export const notifyMyWeekChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MY_WEEK_CHANGED_EVENT));
};

const readStoredJson = (key: string) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const weekFetcher = async (): Promise<MyWeekLoad> => {
  const token = getStoredAuthToken() ?? undefined;
  const identities = buildViewerIdentities(readStoredJson("user"), readStoredJson("playerPersonalDetails"));
  return loadMyWeek(
    {
      upcomingLessons: ({ to }) => (token ? getPlayerUpcomingLessons(token, { to }) : Promise.resolve({ lessons: [] })),
      // One call: every status a booked match can hold, this week only, without the tab counts.
      myMatches: ({ from, to }) =>
        listMatches({
          token,
          filter: "my",
          status: "upcoming,confirmed,open",
          from,
          to,
          counts: false,
          includeHidden: true,
          include_hidden: true,
          perPage: 100,
          page: 1,
        }),
      pendingInvites: () => listInvites({ status: "pending", perPage: 50, page: 1 }),
      myLeagues: () => listMyLeagues({ token }),
      leagueFixtures: (leagueId) => getLeagueFixtures({ leagueId, token, mine: true, status: "scheduled" }),
    },
    identities,
  );
};

const NO_PARAMS = {};

export interface UseMyWeek {
  /** Today and the next six days, each with its items. */
  days: WeekDayItems[];
  items: WeekItem[];
  /** For the My Week badge: items only this player can answer. */
  needsResponseCount: number;
  loading: boolean;
  /** Sources that failed; the rest of the week still shows. */
  errors: MyWeekLoad["errors"];
  refetch: () => void;
}

/**
 * The player's rolling week: booked lessons and matches, invites waiting both ways, and
 * league matches due. Refetches on MY_WEEK_CHANGED_EVENT.
 */
export const useMyWeek = (): UseMyWeek => {
  const { data, loading, refetch } = useApiRequest(weekFetcher, NO_PARAMS);

  const reload = useCallback(() => {
    refetch().catch(() => {
      // loadMyWeek never rejects; nothing to surface here.
    });
  }, [refetch]);

  useEffect(() => {
    window.addEventListener(MY_WEEK_CHANGED_EVENT, reload);
    return () => window.removeEventListener(MY_WEEK_CHANGED_EVENT, reload);
  }, [reload]);

  // The week rolls over at midnight; today's key keeps the grouping current between fetches.
  const todayKey = toLocalYmd(new Date());
  const days = useMemo(() => groupWeek(data?.items ?? [], weekDays(new Date(`${todayKey}T12:00:00`))), [data, todayKey]);

  return {
    days,
    items: days.flatMap((day) => day.items),
    needsResponseCount: countNeedsResponse(days),
    loading,
    errors: data?.errors ?? {},
    refetch: reload,
  };
};

export default useMyWeek;
