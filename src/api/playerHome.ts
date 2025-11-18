import { request } from "./http";
import type { AuthScheme } from "./http";
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
  position?: PositionPayload | null;
  authScheme?: AuthScheme;
}

export const fetchPlayerDetails = async ({ token, userId, position, authScheme }: FetchPlayerDetailsParams) =>
  request<Record<string, unknown>>(
    "/player/surveys/getchecklocation/specific_user",
    {
      method: position ? "POST" : "GET",
      token,
      authScheme,
      query: {
        userId,
      },
      body: position ? buildBody({ position }) : undefined,
    },
  );

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
  level: string | boolean;
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
