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
  summariseWeekBookings,
  type WeekBooking,
} from "../utils/weekBookings";
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

/** Confirmed bookings in the next 7 days, plus the soonest. */
export function useWeekBookings(skip = false) {
  const { data, loading, error } = useApiRequest(bookingsFetcher, NO_PARAMS, { skip });
  const summary = useMemo(() => summariseWeekBookings(data ?? []), [data]);

  return {
    loading,
    error,
    count: summary.count,
    nextLabel: nextBookingLabel(summary.next),
  };
}
