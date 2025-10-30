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
  page?: number;
  perPage?: number;
}

export interface PlayerFutureLessonsParams extends PaginationParams {
  token: string;
}

export const getPlayerFutureLessons = async ({ token, perPage, page }: PlayerFutureLessonsParams) =>
  request<PaginatedResponse<LessonSummary>>("/player/future_lessons", {
    token,
    query: {
      ...(typeof perPage === "number" ? { per_page: perPage } : {}),
      ...(typeof page === "number" ? { page } : {}),
    },
  });

export interface PlayerFutureGroupLessonsParams {
  token: string;
  pagination?: PaginationParams;
  search?: string;
  position?: string;
  filters?: Record<string, string | number | boolean | Array<string | number | boolean>>;
}

export const getPlayerFutureGroupLessons = async ({
  token,
  pagination,
  search,
  position,
  filters,
}: PlayerFutureGroupLessonsParams) =>
  request<PaginatedResponse<LessonSummary>>("/player/group_lessons/future", {
    token,
    query: {
      ...(pagination?.perPage ? { per_page: pagination.perPage } : {}),
      ...(pagination?.page ? { page: pagination.page } : {}),
      ...(search ? { search } : {}),
      ...(position ? { position } : {}),
      ...(filters ? filters : {}),
    },
  });

export interface PlayerExternalLesson extends LessonSummary {
  provider?: string;
  url?: string;
}

export const getPlayerExternalLessons = async (token: string) =>
  request<PaginatedResponse<PlayerExternalLesson>>("/player/external_lessons", {
    token,
  });

export const getPlayerExternalLessonById = async (token: string, lessonId: number | string) =>
  request<PlayerExternalLesson>(`/player/external_lessons/${lessonId}`, {
    token,
  });

export const getPlayerUpcomingLessonsHub = async (token: string) =>
  request<PaginatedResponse<LessonSummary>>("/player/lessons/hub", {
    token,
  });

export interface PlayerCoachesParams extends PaginationParams {
  token: string;
  search?: string;
  positions?: string[];
  filters?: Record<string, string | number | boolean | Array<string | number | boolean>>;
}

export const getPlayerCoaches = async ({ token, perPage, page, search, positions, filters }: PlayerCoachesParams) =>
  request<PaginatedResponse<CoachSummary>>("/player/coaches", {
    token,
    query: {
      ...(perPage ? { per_page: perPage } : {}),
      ...(page ? { page } : {}),
      ...(search ? { search } : {}),
      ...(positions && positions.length ? { positions } : {}),
      ...(filters ? filters : {}),
    },
  });

export const fetchCoachDetailsById = async (token: string, coachId: number | string) =>
  request<CoachSummary>(`/player/coaches/${coachId}`, {
    token,
  });

export const getNearestCoaches = async (token: string) =>
  request<PaginatedResponse<CoachSummary>>("/player/coaches/nearest", {
    token,
  });

export const getAllLocation = async (token: string) =>
  request<Record<string, unknown>>("/player/locations", {
    token,
  });

export interface RecordExternalLessonClickParams {
  token: string;
  lessonId: number | string;
  clickPayload: Record<string, unknown>;
}

export const recordExternalLessonClick = async ({ token, lessonId, clickPayload }: RecordExternalLessonClickParams) =>
  request<Record<string, unknown>>(`/player/external_lessons/${lessonId}/clicks`, {
    method: "POST",
    token,
    body: clickPayload,
  });

export interface UpdatePlayerFutureLessonsParams {
  token: string;
  lessonId: number | string;
  status: string;
}

export const updatePlayerFutureLessons = async ({ token, lessonId, status }: UpdatePlayerFutureLessonsParams) =>
  request<LessonSummary>(`/player/future_lessons/${lessonId}`, {
    method: "PATCH",
    token,
    body: { status },
  });

export interface UpdateCoachStatusParams {
  token: string;
  coachId: number | string;
  isActive: boolean;
}

export const updateCoachStatus = async ({ token, coachId, isActive }: UpdateCoachStatusParams) =>
  request<CoachSummary>(`/player/coaches/${coachId}`, {
    method: "PATCH",
    token,
    body: { is_active: isActive },
  });

export interface RequestCoachPlayerParams {
  token: string;
  coachId: number | string;
  status: string;
}

export const requestCoachPlayer = async ({ token, coachId, status }: RequestCoachPlayerParams) =>
  request<Record<string, unknown>>(`/player/coaches/${coachId}/request`, {
    method: "POST",
    token,
    body: { status },
  });

export const getCheckLocation = async (token: string) =>
  request<Record<string, unknown>>("/player/check_location", {
    token,
  });

export const fetchPlayerDetails = async (token: string) =>
  request<Record<string, unknown>>("/player/details", {
    token,
  });

export const getSuggestedPlayerCheckLocation = async (token: string) =>
  request<Record<string, unknown>>("/player/check_location/suggested", {
    token,
  });

export interface FavoriteCoachParams {
  token: string;
  coachId: number | string;
}

export const addFavorite = async ({ token, coachId }: FavoriteCoachParams) =>
  request<Record<string, unknown>>("/player/favorites", {
    method: "POST",
    token,
    body: { coach_id: coachId },
  });

export const removeFavorite = async ({ token, coachId }: FavoriteCoachParams) =>
  request<void>(`/player/favorites/${coachId}`, {
    method: "DELETE",
    token,
  });

export const listFavorites = async (token: string) =>
  request<PaginatedResponse<CoachSummary>>("/player/favorites", {
    token,
  });

export const getUserVerificationLevel = async (token: string) =>
  request<Record<string, unknown>>("/player/verification_level", {
    token,
  });

export interface VerifyUserLevelParams {
  token: string;
  payload: Record<string, unknown>;
}

export const verifyUserLevel = async ({ token, payload }: VerifyUserLevelParams) =>
  request<Record<string, unknown>>("/player/verification_level", {
    method: "POST",
    token,
    body: payload,
  });

export interface CoachScheduleParams {
  token: string;
  coachId?: number | string;
  date?: string;
  filters?: Record<string, string | number | boolean>;
}

export const getAllCoachesSchedules = async ({ token, coachId, date, filters }: CoachScheduleParams) =>
  request<Record<string, unknown>>("/player/coaches/schedules", {
    token,
    query: {
      ...(coachId ? { coach_id: coachId } : {}),
      ...(date ? { date } : {}),
      ...(filters ? filters : {}),
    },
  });

export interface BlockPlayerParams {
  token: string;
  playerId: number | string;
  reason?: string;
}

export const blockPlayer = async ({ token, playerId, reason }: BlockPlayerParams) =>
  request<Record<string, unknown>>("/player/blocked_players", {
    method: "POST",
    token,
    body: {
      player_id: playerId,
      ...(reason ? { reason } : {}),
    },
  });

export const unblockPlayer = async ({ token, playerId }: BlockPlayerParams) =>
  request<void>(`/player/blocked_players/${playerId}`, {
    method: "DELETE",
    token,
  });

export const fetchBlockedPlayers = async (token: string) =>
  request<PaginatedResponse<Record<string, unknown>>>("/player/blocked_players", {
    token,
  });
