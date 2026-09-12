import { useMemo } from "react";
import {
  fetchMyRankingSummary,
  ladderPositionLabel,
} from "../api/matchResults";
import { getPlayerUpcomingLessons } from "../api/player";
import { fetchUpcomingGroupLessons, holdsGroupSpot, mapUpcomingGroupLessonsResponse } from "../api/groupLessons";
import { listMatches } from "../api/matches";
import { getStoredAuthToken } from "../services/authToken";
import {
  DEFAULT_POSITION,
  DEFAULT_RADIUS_MILES,
  getStoredLocation,
  getStoredLocationRadius,
} from "../utils/userLocation";
import {
  groupLessonsToBookings,
  lessonsToBookings,
  nextBookingLabel,
  nextTodayBooking,
  summariseWeekBookings,
  type WeekBooking,
} from "../utils/weekBookings";
import { buildMyMatchBookings } from "../utils/homeMatchBookings";
import { listMyOrders } from "../restringing/restringingService";
import { listInvites } from "../services/invites";
import { buildPlayerInviteItems } from "../utils/dashboardInvites";

import { getPlayerDiscoverNearby, getPlayerExternalLessons } from "../api/playerHome";
import { fetchPlayerCoaches } from "../api/playerCoaches";
import { listMyLeagues, getLeagueResultOpponents } from "../api/leagues";
import { fetchTipVideos, hasYouTubeKey } from "../api/youtube";
import { pickTipOfDay, readCachedTips, writeCachedTips, type TipVideo } from "../utils/tipOfDay";
import {
  activeSeasons,
  buildViewerIdentities,
  matchesViewer,
  fetchSeasonEnrichment,
  opponentNames,
  weeksRemaining,
  type SeasonEnrichment,
} from "../utils/leagueSeason";
import { getComparableCoachIds, normalizeStatus } from "./useCoachRoster";
import {
  buildActivityItems,
  buildCoachActivities,
  buildExternalLessonActivities,
  buildMatchActivities,
  extractCollection,
  extractLessons,
  getApiDayKey,
} from "../utils/activityFeed";
import { buildHomeAlerts, type HomeAlert } from "../utils/homeAlertStack";
import { selectHomeInvite, type HomeInviteItem } from "../utils/homeInvite";
import { useApiRequest } from "./useApiRequest";
import type { RatingState } from "../utils/homeTiles";

/** Matches the identity fallback chain used elsewhere, e.g. LeagueDetailPage.tsx:438. */
export const readViewerId = (user: unknown): number | null => {
  const record = user as Record<string, unknown> | null | undefined;
  const profile = record?.profile as Record<string, unknown> | undefined;
  const candidate =
    record?.id ?? record?.user_id ?? record?.player_id ?? profile?.id ?? profile?.user_id;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
};

const rankingSummaryFetcher = () => fetchMyRankingSummary({ token: getStoredAuthToken() ?? undefined });
const NO_LADDER_PARAMS = {};

/**
 * Rating, global ladder position, and the rated gate — one small call.
 */
export function useLadderStanding(viewerId: number | null) {
  const { data, loading, error } = useApiRequest(rankingSummaryFetcher, NO_LADDER_PARAMS, {
    skip: viewerId === null,
  });

  const ratingRaw = data?.current_rating;
  const rating = ratingRaw == null || ratingRaw === "" ? null : Number(ratingRaw);

  /**
   * Three states, because `Boolean(data?.ranked)` had only one way to be false
   * and three ways to get there: genuinely unrated, still loading, and never
   * asked — the request is skipped while `viewerId` is null, and `viewerId`
   * comes from an id chain off the stored user that can come back empty.
   *
   * All three rendered "Play a match to get rated", so a player with a rating
   * and a ladder position was told to go and play a match. `unknown` is the
   * honest answer for the two that are not an answer.
   */
  const ratingState: RatingState =
    loading || error || data === undefined ? "unknown" : data.ranked ? "rated" : "unrated";

  return {
    loading,
    error,
    ratingState,
    rating: rating !== null && Number.isFinite(rating) ? rating : null,
    positionLabel: ladderPositionLabel(data?.rank ?? null),
  };
}

/** The stored identity, read the same way the ladder reads it. */
const readStoredJson = (key: string) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const bookingsFetcher = async (): Promise<WeekBooking[]> => {
  const token = getStoredAuthToken() ?? undefined;
  const storedUser = readStoredJson("user");
  const viewerIdentities = buildViewerIdentities(
    storedUser,
    readStoredJson("playerPersonalDetails"),
  );
  const viewerId = readViewerId(storedUser);
  const stored = getStoredLocation() ?? DEFAULT_POSITION;

  // Settled, not all — one failing source should degrade the count, not blank
  // the tile. A wrong-but-present number is worse than a smaller one, so a
  // rejected source contributes nothing rather than a guess.
  // Matches are asked for the way PlayerCalendar asks — the screen that already
  // shows them correctly:
  //
  //   filter: "my"      scopes to this player's participant rows server-side.
  //                     Without it this was the public browse list, so the count
  //                     described matches near you rather than matches you are in.
  //   includeHidden     a link-only match you joined is still yours. The API
  //                     drops is_hidden rows unless asked.
  //   two statuses      league matches sit at "confirmed", never "upcoming", and
  //                     the API filters on exact equality — one query cannot see
  //                     both. Duplicates cannot arise (a match holds one status)
  //                     and summariseWeekBookings dedupes by kind:id regardless.
  const myMatchQuery = {
    token,
    filter: "my",
    includeHidden: true,
    include_hidden: true,
    perPage: 50,
    page: 1,
  } as const;
  const [lessons, groups, upcomingMatches, confirmedMatches] = await Promise.allSettled([
    token ? getPlayerUpcomingLessons(token) : Promise.resolve(null),
    fetchUpcomingGroupLessons({
      token,
      perPage: 50,
      page: 1,
      position: { latitude: stored.latitude, longitude: stored.longitude },
    }),
    listMatches({ ...myMatchQuery, status: "upcoming" }),
    listMatches({ ...myMatchQuery, status: "confirmed" }),
  ]);

  const bookings: WeekBooking[] = [];

  if (lessons.status === "fulfilled" && lessons.value) {
    const rows = (lessons.value as { data?: unknown[] })?.data;
    bookings.push(...lessonsToBookings(Array.isArray(rows) ? rows : []));
  }

  if (groups.status === "fulfilled" && groups.value) {
    const mapped = mapUpcomingGroupLessonsResponse(groups.value);
    bookings.push(
      ...groupLessonsToBookings(mapped.lessons, (lesson) => {
        const players = (lesson as { groupPlayers?: unknown[] })?.groupPlayers;
        if (!Array.isArray(players)) return false;
        // The spot has to be YOURS. This asked whether *anyone* on the lesson
        // held a spot, and the source is /player/upcoming_group_lessons — the
        // nearby list, not your bookings — so every popular class in your area
        // counted as one of your bookings. Three lessons you had never seen
        // read as "3 booked".
        //
        // Matched on id, name or email rather than id alone, for the same
        // reason the ladder does: the participant's player_id and the account
        // user id are not always the same number.
        return players.some((player) => {
          const record = player as Record<string, unknown>;
          if (!matchesViewer(viewerIdentities, record.playerId, record.participantId, record.email, record.name)) {
            return false;
          }
          return holdsGroupSpot(
            record.status as number,
            record.paymentStatus as number,
            record.paymentMethod as string,
          );
        });
      }),
    );
  }

  // listMatches resolves to { matches, pagination, raw } — never an array. This
  // read it with Array.isArray, which is never true for an object, so match play
  // contributed nothing to the home page and did so silently.
  //
  // The rules for turning those rows into bookings live in utils/homeMatchBookings,
  // where they are tested.
  bookings.push(
    ...buildMyMatchBookings({
      upcoming: upcomingMatches.status === "fulfilled" ? upcomingMatches.value.matches : [],
      confirmed: confirmedMatches.status === "fulfilled" ? confirmedMatches.value.matches : [],
      viewerId,
      currentUser: storedUser,
    }),
  );

  return bookings;
};

const NO_PARAMS = {};

/**
 * Confirmed bookings in the next 7 days, the soonest, and the soonest still to
 * come today.
 *
 * The today row is a filter over the same three responses rather than a fourth
 * call — it cannot disagree with the tile beside it, which it would if it
 * fetched separately.
 */
export function useWeekBookings(skip = false) {
  const { data, loading, error } = useApiRequest(bookingsFetcher, NO_PARAMS, { skip });
  const summary = useMemo(() => summariseWeekBookings(data ?? []), [data]);
  const today = useMemo(() => nextTodayBooking(data ?? []), [data]);

  return {
    loading,
    error,
    count: summary.count,
    nextLabel: nextBookingLabel(summary.next),
    today,
  };
}

const restringOrdersFetcher = async () => {
  // listMyOrders already unwraps to data.orders ?? [].
  const orders = await listMyOrders();
  return Array.isArray(orders) ? orders : [];
};

/**
 * The alert stack. One call today (restring orders); the shape takes a bag so
 * later sources join without changing the signature.
 *
 * A failed fetch yields an empty stack, not an error row — an alert we cannot
 * confirm is one we must not show.
 */
export function useHomeAlerts(skip = false): {
  loading: boolean;
  alerts: HomeAlert[];
} {
  const { data, loading } = useApiRequest(restringOrdersFetcher, NO_PARAMS, { skip });
  const alerts = useMemo(() => buildHomeAlerts({ restringOrders: data ?? [] }), [data]);

  return { loading, alerts };
}

/** The list endpoint has been seen returning several envelope shapes. */
const extractInvites = (response: unknown): unknown[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  const record = response as Record<string, unknown>;
  for (const key of ["data", "invites", "items"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
};

const invitesFetcher = async () => {
  // Same query the dashboard uses. perPage 5 is plenty: only the soonest is
  // rendered and the rest collapse to a "N more" link.
  const response = await listInvites({ status: "pending", page: 1, perPage: 5, filter: "pending" });
  return buildPlayerInviteItems(extractInvites(response));
};

/**
 * The pending invite to show, plus how many are behind it.
 *
 * Normalisation is shared with the legacy dashboard via buildPlayerInviteItems —
 * one set of field-fallback chains over /invites, not two that can drift.
 */
export function useHomeInvites(skip = false) {
  const { data, loading, error, refetch } = useApiRequest(invitesFetcher, NO_PARAMS, { skip });
  const selection = useMemo(() => selectHomeInvite((data ?? []) as HomeInviteItem[]), [data]);

  return { loading, error, refetch, ...selection };
}

const FEED_WINDOW_DAYS = 7;

/**
 * Per-source page size for the feed.
 *
 * The legacy dashboard asks for 12 of each, which is a page size for a screen
 * showing one day. This feed covers a rolling week, and the mockups show
 * Lessons 31 / Groups 14 / Matches 14 in a single week — so 12 silently drops
 * most of the lessons and makes the "See all N this week" count wrong as well
 * as the list short.
 *
 * The count rendered is always the number of items actually held, never a
 * pagination total, so the feed cannot claim more than it can show.
 */
const FEED_PER_SOURCE = 50;

const dayKey = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const activityFeedFetcher = async () => {
  const token = getStoredAuthToken() ?? undefined;
  const stored = getStoredLocation() ?? DEFAULT_POSITION;
  const location = { latitude: stored.latitude, longitude: stored.longitude };
  const radius = getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES;
  const start = dayKey(0);
  const end = dayKey(FEED_WINDOW_DAYS - 1);

  // Settled, not all: one dead source should shrink the feed, not blank it.
  // The same reasoning as the bookings tile — a smaller list beats an error.
  const [nearby, external, roster] = await Promise.allSettled([
    getPlayerDiscoverNearby({
      token,
      location,
      radius,
      // level is deliberately fixed. filters.level is exact string equality on
      // free text and silently returns nothing on an unrecognised value, which
      // is why the level control is not built. See the brief's omissions table.
      filters: { startDate: start, endDate: end, level: "All" },
      search: "",
      matchSearch: "",
      coachesPage: 1,
      coachesPerPage: FEED_PER_SOURCE,
      lessonsPage: 1,
      lessonsPerPage: FEED_PER_SOURCE,
      matchesPage: 1,
      matchesPerPage: FEED_PER_SOURCE,
    }),
    getPlayerExternalLessons({
      token,
      page: 1,
      perPage: FEED_PER_SOURCE,
      search: "",
      position: location,
      filters: { radius, startDate: start, endDate: end },
    }),
    // Powers the "My coaches" filter. Settled like the rest: if it fails the
    // chip simply does not appear, rather than the feed breaking.
    fetchPlayerCoaches({ token, perPage: 100, page: 1 }),
  ]);

  if (nearby.status !== "fulfilled") {
    throw nearby.reason instanceof Error ? nearby.reason : new Error("Unable to load nearby activities.");
  }

  const response = nearby.value as Record<string, unknown>;
  const items = [
    ...buildCoachActivities(extractCollection(response?.coaches_availability)),
    ...buildActivityItems(extractCollection(response?.group_lessons)),
    ...(external.status === "fulfilled" ? buildExternalLessonActivities(extractLessons(external.value)) : []),
    ...buildMatchActivities(extractCollection(response?.match_play)),
    // Ordered by the clock the player reads, not by startTime. startTime is an
    // ISO instant, and the four sources disagree on what an instant means: a
    // floating group lesson serialises its literal digits, a converted match
    // serialises real UTC. Sorting on it put converted items seven hours late,
    // so a 3pm lesson landed below a 6pm one and the list looked grouped by
    // type. sortAt is the local wall clock from every source.
  ].sort((a, b) => String(a.sortAt ?? a.startTime).localeCompare(String(b.sortAt ?? b.startTime)));

  const searchArea = response?.search_area as Record<string, unknown> | undefined;
  // Never earlier than today. The API has been seen returning a window that
  // opens yesterday, and "Play this week" must not offer a session that has
  // already happened — string comparison is safe here because both are
  // YYYY-MM-DD.
  const apiStart = getApiDayKey(searchArea?.window_start);
  const windowStart = apiStart && apiStart > start ? apiStart : start;
  const apiEnd = getApiDayKey(searchArea?.window_end);
  const windowEnd = apiEnd && apiEnd >= windowStart ? apiEnd : dayKey(FEED_WINDOW_DAYS - 1);

  // Accepted coaches only — a pending request is not yet "my coach".
  const myCoachIds =
    roster.status === "fulfilled" && Array.isArray(roster.value)
      ? roster.value
          .filter((entry) => normalizeStatus(entry) === "accepted")
          .flatMap((entry) => getComparableCoachIds(entry))
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      : [];

  return { items, windowStart, windowEnd, myCoachIds };
};

/**
 * The "Play this week" feed: coach availability, group lessons, external
 * lessons and matches over a rolling week, unioned and sorted by start.
 *
 * Normalisation is shared with the legacy dashboard through utils/activityFeed
 * so the two screens cannot disagree about the same payload.
 */
export function useActivityFeed(skip = false) {
  const { data, loading, error } = useApiRequest(activityFeedFetcher, NO_PARAMS, { skip });

  return {
    loading,
    error,
    items: data?.items ?? [],
    windowStart: data?.windowStart ?? null,
    windowEnd: data?.windowEnd ?? null,
    myCoachIds: data?.myCoachIds ?? [],
  };
}


export interface HomeSeason {
  id: string;
  name: string;
  endDate: string | null;
  weeksLeft: number | null;
  enrichment: SeasonEnrichment;
  /** "Sam, Dan, Priya", or null when there is nobody left to play. */
  stillToPlay: string | null;
}

const seasonsFetcher = async (params: { user: unknown }) => {
  const token = getStoredAuthToken() ?? undefined;
  const list = await listMyLeagues({ token });
  const mine = list?.sections?.mine ?? [];
  const running = activeSeasons(mine);
  if (!running.length) return [] as HomeSeason[];

  const identities = buildViewerIdentities(params.user, null);

  // Settled per season: one league failing shrinks the module rather than
  // blanking it, the same rule the rest of the page follows.
  const built = await Promise.allSettled(
    running.map(async (league) => {
      const [enrichment, opponents] = await Promise.all([
        fetchSeasonEnrichment({ leagueId: league.id, token, viewerIdentities: identities }),
        getLeagueResultOpponents({ leagueId: league.id, token })
          .then((r) => r?.opponents ?? [])
          .catch(() => []),
      ]);

      const endDate = (league.end_date || league.deadline || null) as string | null;
      return {
        id: String(league.id),
        name: String(league.name ?? "").trim(),
        endDate,
        weeksLeft: weeksRemaining(endDate),
        enrichment,
        stillToPlay: opponentNames(opponents),
      } satisfies HomeSeason;
    }),
  );

  return built
    .filter((r): r is PromiseFulfilledResult<HomeSeason> => r.status === "fulfilled")
    .map((r) => r.value);
};

/**
 * The player's running seasons, nearest deadline first.
 *
 * Progress comes from utils/leagueSeason, shared with the leagues page, so the
 * two screens can never disagree about how far through a season someone is.
 */
/**
 * Keyed on the viewer's identities, not the whole user object.
 *
 * The default serializer would stringify `user` entire, and the stored user
 * carries the session tokens — which rotate on every refresh. That made a
 * refreshed session look like new params and refetch the seasons, and this
 * fetcher fans out per league, so a request that 401'd could refresh, rotate,
 * refetch and 401 again until the browser ran out of sockets.
 *
 * The identities are what the fetcher actually reads, so they are the honest
 * cache key: they change when the viewer changes, and not when a token does.
 */
const seasonsParamsKey = (params: { user: unknown }) =>
  // buildViewerIdentities returns a Set, not an array. Sorted so the key cannot
  // depend on insertion order.
  [...buildViewerIdentities(params.user, null)].sort().join("|");

export function useActiveSeasons(user: unknown, skip = false) {
  const params = useMemo(() => ({ user }), [user]);
  const { data, loading, error } = useApiRequest(seasonsFetcher, params, {
    skip,
    paramsSerializer: seasonsParamsKey,
  });

  return { loading, error, seasons: data ?? [] };
}


const tipFetcher = async (): Promise<TipVideo[]> => {
  // The tip cannot change before midnight, so a second call today would spend
  // quota for an answer we already have.
  const cached = readCachedTips();
  if (cached) return cached;

  const videos = await fetchTipVideos();
  if (videos.length) writeCachedTips(videos);
  return videos;
};

/**
 * The day's coaching video, or null.
 *
 * Skipped entirely without a YouTube key, so the section is simply absent rather
 * than failing — which is also how this ships safely before the variable is set.
 */
export function useTipOfDay(skip = false) {
  const { data, loading } = useApiRequest(tipFetcher, NO_PARAMS, { skip: skip || !hasYouTubeKey() });
  const tip = useMemo(() => pickTipOfDay(data ?? []), [data]);

  return { loading, tip };
}
