import { useMemo } from "react";
import {
  fetchRankings,
  isRatedInRankings,
  ladderPositionLabel,
  rankedPosition,
  type RankingRow,
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
  matchesToBookings,
  nextBookingLabel,
  nextTodayBooking,
  summariseWeekBookings,
  type WeekBooking,
} from "../utils/weekBookings";
import { listMyOrders } from "../restringing/restringingService";
import { listInvites } from "../services/invites";
import { buildPlayerInviteItems } from "../utils/dashboardInvites";

import { getPlayerDiscoverNearby, getPlayerExternalLessons } from "../api/playerHome";
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

/** Matches the identity fallback chain used elsewhere, e.g. LeagueDetailPage.tsx:438. */
export const readViewerId = (user: unknown): number | null => {
  const record = user as Record<string, unknown> | null | undefined;
  const profile = record?.profile as Record<string, unknown> | undefined;
  const candidate =
    record?.id ?? record?.user_id ?? record?.player_id ?? profile?.id ?? profile?.user_id;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
};

const rankingsFetcher = async ({
  nearLat,
  nearLng,
  radiusMiles,
}: {
  nearLat: number;
  nearLng: number;
  radiusMiles: number;
}) => {
  const response = await fetchRankings({
    token: getStoredAuthToken() ?? undefined,
    nearLat,
    nearLng,
    radiusMiles,
  });
  return Array.isArray(response?.rankings) ? response.rankings : ([] as RankingRow[]);
};

/**
 * Rating, nearby ladder position, and the rated gate — one call, three answers.
 * The gate is presence of a rated row here, not survey completion.
 */
export function useLadderStanding(viewerId: number | null) {
  const stored = getStoredLocation() ?? DEFAULT_POSITION;
  const params = useMemo(
    () => ({
      nearLat: stored.latitude,
      nearLng: stored.longitude,
      radiusMiles: getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES,
    }),
    [stored.latitude, stored.longitude],
  );

  const { data, loading, error } = useApiRequest(rankingsFetcher, params, {
    skip: viewerId === null,
  });

  const rankings = data ?? [];
  const viewerRow = rankings.find((row) => Number(row.user_id) === Number(viewerId));
  const ratingRaw = viewerRow?.current_rating;
  const rating = ratingRaw == null || ratingRaw === "" ? null : Number(ratingRaw);

  return {
    loading,
    error,
    isRated: isRatedInRankings(rankings, viewerId),
    rating: rating !== null && Number.isFinite(rating) ? rating : null,
    positionLabel: ladderPositionLabel(rankedPosition(rankings, viewerId)),
  };
}

const bookingsFetcher = async (): Promise<WeekBooking[]> => {
  const token = getStoredAuthToken() ?? undefined;
  const stored = getStoredLocation() ?? DEFAULT_POSITION;

  // Settled, not all — one failing source should degrade the count, not blank
  // the tile. A wrong-but-present number is worse than a smaller one, so a
  // rejected source contributes nothing rather than a guess.
  const [lessons, groups, matches] = await Promise.allSettled([
    token ? getPlayerUpcomingLessons(token) : Promise.resolve(null),
    fetchUpcomingGroupLessons({
      token,
      perPage: 50,
      page: 1,
      position: { latitude: stored.latitude, longitude: stored.longitude },
    }),
    listMatches({ token }),
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
        return Array.isArray(players)
          ? players.some((player) => {
              const record = player as Record<string, unknown>;
              return holdsGroupSpot(
                record.status as number,
                record.paymentStatus as number,
                record.paymentMethod as string,
              );
            })
          : false;
      }),
    );
  }

  if (matches.status === "fulfilled" && Array.isArray(matches.value)) {
    bookings.push(...matchesToBookings(matches.value));
  }

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
  const [nearby, external] = await Promise.allSettled([
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
  ].sort((a, b) => new Date(a.startTime).valueOf() - new Date(b.startTime).valueOf());

  const searchArea = response?.search_area as Record<string, unknown> | undefined;
  // Never earlier than today. The API has been seen returning a window that
  // opens yesterday, and "Play this week" must not offer a session that has
  // already happened — string comparison is safe here because both are
  // YYYY-MM-DD.
  const apiStart = getApiDayKey(searchArea?.window_start);
  const windowStart = apiStart && apiStart > start ? apiStart : start;
  const apiEnd = getApiDayKey(searchArea?.window_end);
  const windowEnd = apiEnd && apiEnd >= windowStart ? apiEnd : dayKey(FEED_WINDOW_DAYS - 1);

  return { items, windowStart, windowEnd };
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
  };
}
