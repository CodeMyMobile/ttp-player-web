import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { listMyLeagues, getLeagueFixtures } from "../../api/leagues";
import { listMatches } from "../../api/matches";
import { getPlayerUpcomingLessons } from "../../api/player";
import { getStoredAuthToken } from "../../services/authToken";
import { listInvites } from "../../services/invites";
import { buildViewerIdentities } from "../../utils/leagueSeason";
import { toLocalYmd } from "../../utils/dateTime";
import { weekDays } from "../../utils/weekDays";
import { countNeedsResponse, groupWeek, laterItems } from "./adapters";
import { loadMyWeek, type MyWeekLoad } from "./loadMyWeek";
import { createMyWeekStore } from "./myWeekStore";
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

/** The app's one copy of the week (myWeekStore). */
export const myWeekStore = createMyWeekStore(weekFetcher);
// Whose week the store holds: the signed-in token when it was asked for. undefined = nobody yet.
let weekOwnerToken: string | null | undefined;

// Once per page load: a change anywhere reloads the week, and coming back to a tab that sat
// in the background picks up anything stale.
let listening = false;
const listenForChanges = () => {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(MY_WEEK_CHANGED_EVENT, () => {
    void myWeekStore.reload();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && myWeekStore.getSnapshot().data) void myWeekStore.ensureFresh();
  });
};

export interface UseMyWeek {
  /** Today and the next six days, each with its items. */
  days: WeekDayItems[];
  items: WeekItem[];
  /** Invites waiting on this player for matches after the week, soonest first. */
  later: WeekItem[];
  /** For the My Week badge: everything only this player can answer, this week or later. */
  needsResponseCount: number;
  loading: boolean;
  /** Sources that failed; the rest of the week still shows. */
  errors: MyWeekLoad["errors"];
  refetch: () => void;
}

/**
 * The player's rolling week: booked lessons and matches, invites waiting both ways, and
 * league matches due. Shared across the app (myWeekStore): it loads when a screen asks and the
 * week is over a minute old, and straight away on MY_WEEK_CHANGED_EVENT.
 *
 * `enabled: false` (signed out, or My Week off) fetches nothing and shows an empty week. It
 * doesn't clear the shared copy: while sign-in is still resolving, one screen can briefly say
 * signed out while another is already loading. A different signed-in token clears it instead,
 * so one player never sees another's week.
 */
export const useMyWeek = ({ enabled = true }: { enabled?: boolean } = {}): UseMyWeek => {
  const snapshot = useSyncExternalStore(myWeekStore.subscribe, myWeekStore.getSnapshot, myWeekStore.getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    const token = getStoredAuthToken() ?? null;
    if (token !== weekOwnerToken) {
      if (weekOwnerToken !== undefined) myWeekStore.clear();
      weekOwnerToken = token;
    }
    listenForChanges();
    void myWeekStore.ensureFresh();
  }, [enabled]);

  const refetch = useCallback(() => {
    void myWeekStore.reload();
  }, []);

  // The week rolls over at midnight; today's key keeps the grouping current between fetches.
  const todayKey = toLocalYmd(new Date());
  const data = enabled ? snapshot.data : undefined;
  const { days, later } = useMemo(() => {
    const week = weekDays(new Date(`${todayKey}T12:00:00`));
    const items = data?.items ?? [];
    return { days: groupWeek(items, week), later: laterItems(items, week) };
  }, [data, todayKey]);

  return {
    days,
    items: days.flatMap((day) => day.items),
    later,
    needsResponseCount: countNeedsResponse(days, later),
    loading: enabled && (snapshot.loading || !snapshot.data),
    errors: data?.errors ?? {},
    refetch,
  };
};

/** The My Week tab's badge: how many things only this player can answer. 0 hides it. */
export const useMyWeekBadge = (enabled: boolean): number => useMyWeek({ enabled }).needsResponseCount;

/** "9+" past nine. */
export const badgeLabel = (count: number): string => (count > 9 ? "9+" : String(count));

export default useMyWeek;
