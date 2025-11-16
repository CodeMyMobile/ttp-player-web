import { request } from "./http";
import type { PaginatedResponse } from "./player";

export interface CoachSummary {
  id: number;
  firstName?: string;
  lastName?: string;
  rating?: number;
  distance?: number;
  [key: string]: unknown;
}

export interface LessonSummary {
  id: number;
  title?: string;
  startTime?: string;
  endTime?: string;
  coach?: CoachSummary;
  [key: string]: unknown;
}

export interface PaginationParams {
  perPage?: number;
  page?: number;
}

export type PositionPayload = Record<string, unknown>;
export type FiltersPayload = Record<string, unknown>;

type RequestBody<TPayload extends Record<string, unknown>> = Partial<TPayload>;

const buildBody = <TPayload extends Record<string, unknown>>(payload: RequestBody<TPayload>) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as TPayload;

export interface PlayerFutureLessonsParams extends PaginationParams {
  token: string;
  lessonsPerPage?: number;
  signal?: AbortSignal;
}

export const getPlayerFutureLessons = async ({
  token,
  perPage,
  lessonsPerPage,
  page = 1,
  signal,
}: PlayerFutureLessonsParams) => {
  const finalPerPage = perPage ?? lessonsPerPage ?? 5;
  return request<PaginatedResponse<LessonSummary>>("/player/upcoming_lessons", {
    token,
    signal,
    query: {
      perPage: finalPerPage,
      page,
    },
  });
};

export interface PlayerFutureGroupLessonsParams extends PaginationParams {
  token: string;
  search?: string;
  position?: PositionPayload;
  filters?: FiltersPayload;
  lessonsPerPage?: number;
  signal?: AbortSignal;
}

export const getPlayerFutureGroupLessons = async ({
  token,
  perPage,
  lessonsPerPage,
  page = 1,
  search = "",
  position,
  filters = {},
  signal,
}: PlayerFutureGroupLessonsParams) => {
  const finalPerPage = perPage ?? lessonsPerPage ?? 5;
  return request<PaginatedResponse<LessonSummary>>("/player/upcoming_group_lessons", {
    method: "POST",
    token,
    signal,
    query: {
      perPage: finalPerPage,
      page,
    },
    body: buildBody({
      search,
      position,
      filters,
    }),
  });
};

export interface PlayerExternalLesson extends LessonSummary {
  provider?: string;
  url?: string;
}

export interface PlayerExternalLessonsParams extends PaginationParams {
  token: string;
  search?: string;
  position?: PositionPayload;
  filters?: FiltersPayload;
}

export const getPlayerExternalLessons = async ({
  token,
  perPage = 5,
  page = 1,
  search = "",
  position,
  filters = {},
}: PlayerExternalLessonsParams) =>
  request<PaginatedResponse<PlayerExternalLesson>>("/player/upcoming_external_lessons", {
    method: "POST",
    token,
    query: {
      perPage,
      page,
    },
    body: buildBody({
      search,
      position,
      filters,
    }),
  });

export interface PlayerExternalLessonByIdParams {
  token: string;
  lessonId: number | string;
}

export const getPlayerExternalLessonById = async ({ token, lessonId }: PlayerExternalLessonByIdParams) =>
  request<PlayerExternalLesson>(`/player/upcoming_external_lessons/${lessonId}`, {
    token,
  });

export interface PlayerUpcomingLessonsHubParams extends PaginationParams {
  token: string;
  search?: string;
  position?: PositionPayload;
  filters?: FiltersPayload;
  merge?: boolean;
}

export const getPlayerUpcomingLessonsHub = async ({
  token,
  perPage = 5,
  page = 1,
  search = "",
  position = {},
  filters = {},
  merge = true,
}: PlayerUpcomingLessonsHubParams) =>
  request<PaginatedResponse<LessonSummary>>("/player/lessonshub/upcoming", {
    method: "POST",
    token,
    query: {
      perPage,
      page,
    },
    body: buildBody({
      search,
      position,
      filters,
      merge,
    }),
  });

export interface PlayerCoachesParams extends PaginationParams {
  search?: string;
  location?: string;
}

export const getPlayerCoaches = async ({
  perPage = 5,
  page = 1,
  search = "",
  location = "",
}: PlayerCoachesParams = {}) =>
  request<PaginatedResponse<CoachSummary>>("/player/coaches", {
    query: buildBody({
      perPage,
      page,
      search,
      locationSearch: location,
    }),
  });

export interface FetchCoachDetailsByIdParams {
  token: string;
  coachId: number | string;
}

export const fetchCoachDetailsById = async ({ token, coachId }: FetchCoachDetailsByIdParams) =>
  request<CoachSummary>(`/player/coach/${coachId}`, {
    token,
    authScheme: "Bearer",
  });

export interface NearestCoachesParams extends PaginationParams {
  token: string;
  search?: string;
  location?: string;
}

export const getNearestCoaches = async ({
  token,
  perPage = 5,
  page = 1,
  search = "",
  location = "",
}: NearestCoachesParams) =>
  request<PaginatedResponse<CoachSummary>>("/player/in_proximity/coaches", {
    token,
    query: buildBody({
      perPage,
      page,
      search,
      locationSearch: location,
    }),
  });

export interface PlayerTokenOnlyParams {
  token: string;
}

export const getAllLocation = async ({ token }: PlayerTokenOnlyParams) =>
  request<Record<string, unknown>>("/player/locations-geojson", {
    token,
  });

export interface RecordExternalLessonClickParams extends PlayerTokenOnlyParams {
  lessonId: number | string;
  clickPayload: Record<string, unknown>;
}

export const recordExternalLessonClick = async ({
  token,
  lessonId,
  clickPayload,
}: RecordExternalLessonClickParams) =>
  request<Record<string, unknown>>(`/player/external-lessons/${lessonId}/clicks`, {
    method: "POST",
    token,
    body: clickPayload,
  });

export interface UpdatePlayerFutureLessonsParams extends PlayerTokenOnlyParams {
  lessonId: number | string;
  status: string;
}

export const updatePlayerFutureLessons = async ({
  token,
  lessonId,
  status,
}: UpdatePlayerFutureLessonsParams) =>
  request<LessonSummary>(`/player/upcoming_lessons/${lessonId}`, {
    method: "PATCH",
    token,
    body: { status },
  });

export interface UpdateCoachStatusParams extends PlayerTokenOnlyParams {
  coachId: number | string;
  isActive: boolean;
}

export const updateCoachStatus = async ({ token, coachId, isActive }: UpdateCoachStatusParams) =>
  request<CoachSummary>(`/player/coach/${coachId}`, {
    method: "PATCH",
    token,
    body: { is_active: isActive },
  });

export interface RequestCoachPlayerParams extends PlayerTokenOnlyParams {
  coachId: number | string;
  status?: string;
}

export const requestCoachPlayer = async ({
  token,
  coachId,
  status = "PENDING",
}: RequestCoachPlayerParams) =>
  request<Record<string, unknown>>("/player/request/coach", {
    method: "POST",
    token,
    body: {
      coach_id: coachId,
      status,
    },
  });

export interface GetCheckLocationParams extends PaginationParams {
  token: string;
  search?: string;
  location?: string;
  position?: PositionPayload;
  radius?: number;
}

export const getCheckLocation = async ({
  token,
  perPage = 5,
  page = 1,
  search = "",
  location = "",
  position,
  radius,
}: GetCheckLocationParams) =>
  request<Record<string, unknown>>("/player/getchecklocation", {
    method: "POST",
    token,
    query: buildBody({
      perPage,
      page,
      search,
      locationSearch: location,
      radius,
    }),
    body: buildBody({ position }),
  });

export interface FetchPlayerDetailsParams extends PlayerTokenOnlyParams {
  userId: number | string;
}

const MATCH_PROFILE_ROUTE_PREFIXES = ["/player/surveys", "/player"] as const;
const MATCH_PROFILE_ROUTE_RESOURCES = ["getchecklocation", "get-check-location", "get_check_location"] as const;
const MATCH_PROFILE_SPECIFIC_SEGMENTS = ["specific_user", "specific-user"] as const;

const MATCH_PROFILE_BASE_ROUTES = MATCH_PROFILE_ROUTE_PREFIXES.flatMap((prefix) =>
  MATCH_PROFILE_ROUTE_RESOURCES.map((resource) => `${prefix}/${resource}`),
);

const shouldRetryMatchProfileError = (error?: { status?: number }) =>
  error?.status === 404 || error?.status === 500;

export const fetchPlayerDetails = async ({ token, userId }: FetchPlayerDetailsParams) => {
  const userQuery = { userId, user_id: userId } as Record<string, string | number>;
  const userBody = { userId, user_id: userId };
  const encodedUserId = encodeURIComponent(userId);
  const attempts: Array<{
    path: string;
    method?: string;
    query?: Record<string, string | number>;
    body?: Record<string, unknown>;
  }> = [];

  for (const base of MATCH_PROFILE_BASE_ROUTES) {
    for (const specific of MATCH_PROFILE_SPECIFIC_SEGMENTS) {
      attempts.push({ path: `${base}/${specific}/${encodedUserId}` });
      attempts.push({ path: `${base}/${specific}`, query: userQuery });
    }
    attempts.push({ path: `${base}/${encodedUserId}` });
    attempts.push({ path: base, query: userQuery });
  }

  for (const base of MATCH_PROFILE_BASE_ROUTES) {
    attempts.push({ path: base, method: "POST", body: userBody });
    for (const specific of MATCH_PROFILE_SPECIFIC_SEGMENTS) {
      attempts.push({ path: `${base}/${specific}`, method: "POST", body: userBody });
      attempts.push({
        path: `${base}/${specific}`,
        method: "POST",
        query: userQuery,
        body: userBody,
      });
      attempts.push({ path: `${base}/${specific}/${encodedUserId}`, method: "POST", body: userBody });
    }
  }

  let lastError: Error & { status?: number } | undefined;

  for (const attempt of attempts) {
    try {
      return await request<Record<string, unknown>>(attempt.path, {
        method: attempt.method ?? "GET",
        token,
        query: attempt.query,
        body: attempt.body ? buildBody(attempt.body) : undefined,
      });
    } catch (error) {
      lastError = error as Error & { status?: number };
      if (!shouldRetryMatchProfileError(lastError)) {
        throw lastError;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to load match profile");
};

export interface PlayerMatchProfilePayload {
  about_me?: string;
  skillLevel?: string;
  lookingFor?: string[];
  availability?: string[];
  playerCourtLocations?: string[];
  gender?: string;
}

export interface SavePlayerMatchProfileParams extends PlayerTokenOnlyParams {
  userId: number | string;
  profile: PlayerMatchProfilePayload;
}

export const savePlayerMatchProfile = async ({
  token,
  userId,
  profile,
}: SavePlayerMatchProfileParams) => {
  const encodedUserId = encodeURIComponent(userId);
  const userQuery = { userId, user_id: userId } as Record<string, string | number>;
  const attempts: Array<{
    path: string;
    method?: string;
    query?: Record<string, string | number>;
    includeUserId?: boolean;
  }> = [];

  for (const base of MATCH_PROFILE_BASE_ROUTES) {
    attempts.push({ path: base, method: "POST", includeUserId: true });
    attempts.push({ path: `${base}/${encodedUserId}`, method: "POST", includeUserId: true });
    for (const specific of MATCH_PROFILE_SPECIFIC_SEGMENTS) {
      const specificPath = `${base}/${specific}`;
      attempts.push({ path: specificPath, method: "POST", includeUserId: true });
      attempts.push({
        path: specificPath,
        method: "POST",
        query: userQuery,
        includeUserId: true,
      });
      attempts.push({ path: `${specificPath}/${encodedUserId}`, method: "POST", includeUserId: true });
    }
    attempts.push({ path: `${base}/${encodedUserId}`, method: "PATCH", includeUserId: true });
  }

  let lastError: Error & { status?: number } | undefined;

  for (const attempt of attempts) {
    try {
      return await request<Record<string, unknown>>(attempt.path, {
        method: attempt.method ?? "POST",
        token,
        query: attempt.query,
        body: buildBody({
          ...(attempt.includeUserId
            ? {
                userId,
                user_id: userId,
              }
            : {}),
          ...profile,
        }),
      });
    } catch (error) {
      lastError = error as Error & { status?: number };
      if (!shouldRetryMatchProfileError(lastError)) {
        throw lastError;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to save match profile");
};

export interface SuggestedPlayerCheckLocationParams extends PaginationParams {
  token: string;
  search?: string;
  location?: string;
  position?: PositionPayload;
  radius?: number;
  filters?: FiltersPayload;
}

export const getSuggestedPlayerCheckLocation = async ({
  token,
  perPage = 5,
  page = 1,
  search = "",
  location = "",
  position,
  radius,
  filters = {},
}: SuggestedPlayerCheckLocationParams) => {
  const hasFilters = Boolean(filters && Object.keys(filters).length);

  return request<Record<string, unknown>>("/player/surveys/suggested/player/getchecklocation", {
    method: "POST",
    token,
    query: buildBody({
      perPage,
      page,
      search,
      locationSearch: location,
      radius,
    }),
    body: buildBody({
      position,
      filters: hasFilters ? filters : undefined,
    }),
  });
};

export interface FavoriteParams extends PlayerTokenOnlyParams {
  followeeId: number | string;
}

export const addFavorite = async ({ token, followeeId }: FavoriteParams) =>
  request<Record<string, unknown>>("/player/favorites/add", {
    method: "POST",
    token,
    body: { followeeId },
  });

export const removeFavorite = async ({ token, followeeId }: FavoriteParams) =>
  request<Record<string, unknown>>("/player/favorites/remove", {
    method: "DELETE",
    token,
    body: { followeeId },
  });

export interface ListFavoritesParams extends PaginationParams {
  token: string;
}

export const listFavorites = async ({ token, perPage = 5, page = 1 }: ListFavoritesParams) =>
  request<PaginatedResponse<Record<string, unknown>>>("/player/favorites", {
    token,
    query: {
      perPage,
      page,
    },
  });

export const getUserVerificationLevel = async ({ token }: PlayerTokenOnlyParams) =>
  request<Record<string, unknown>>("/player/verification-level", {
    token,
  });

export interface VerifyUserLevelParams extends PlayerTokenOnlyParams {
  userId: number | string;
  level: string;
}

export const verifyUserLevel = async ({ token, userId, level }: VerifyUserLevelParams) =>
  request<Record<string, unknown>>("/player/verify-level", {
    method: "POST",
    token,
    body: {
      userId,
      level,
    },
  });

export interface AllCoachesSchedulesParams extends PaginationParams {
  token: string;
  day?: string;
  locationId?: number | string;
}

export const getAllCoachesSchedules = async ({
  token,
  perPage = 10,
  page = 1,
  day,
  locationId,
}: AllCoachesSchedulesParams) =>
  request<Record<string, unknown>>("/player/coaches/schedules", {
    token,
    query: buildBody({
      perPage,
      page,
      ...(day ? { day } : {}),
      ...(locationId ? { location_id: locationId } : {}),
    }),
  });

export interface BlockPlayerParams extends PlayerTokenOnlyParams {
  blockedId: number | string;
  reason?: string;
}

export const blockPlayer = async ({ token, blockedId, reason }: BlockPlayerParams) =>
  request<Record<string, unknown>>("/player/blocks/add", {
    method: "POST",
    token,
    body: buildBody({
      blockedId,
      reason,
    }),
  });

export const unblockPlayer = async ({ token, blockedId }: BlockPlayerParams) =>
  request<Record<string, unknown>>("/player/blocks/remove", {
    method: "DELETE",
    token,
    body: { blockedId },
  });

export const fetchBlockedPlayers = async ({ token }: PlayerTokenOnlyParams) =>
  request<PaginatedResponse<Record<string, unknown>>>("/player/blocked", {
    token,
  });
