import { request } from "./http";
import { DEFAULT_POSITION, getStoredLocation } from "../utils/userLocation";
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

export type Coordinates = { latitude: number; longitude: number };
export type PositionPayload = Record<string, unknown> | Coordinates;
export type FiltersPayload = Record<string, unknown>;

type RequestBody<TPayload extends Record<string, unknown>> = Partial<TPayload>;

const buildBody = <TPayload extends Record<string, unknown>>(payload: RequestBody<TPayload>) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as TPayload;

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizePosition = (
  position?: PositionPayload | null,
  fallback?: PositionPayload | null,
): Coordinates | undefined => {
  const candidates = [position, (position as Record<string, unknown>)?.coords, fallback] as Array<
    PositionPayload | null | undefined
  >;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const lat = toNumber((candidate as Record<string, unknown>).latitude ?? (candidate as Record<string, unknown>).lat);
    const lng = toNumber(
      (candidate as Record<string, unknown>).longitude ??
        (candidate as Record<string, unknown>).lng ??
        (candidate as Record<string, unknown>).lon,
    );
    if (lat !== null && lng !== null) {
      return { latitude: lat, longitude: lng };
    }
  }
  return undefined;
};

export interface PlayerFutureLessonsParams extends PaginationParams {
  token: string;
  lessonsPerPage?: number;
  signal?: AbortSignal;
}

export interface PlayerDiscoverNearbyFilters {
  startDate?: string;
  endDate?: string;
  level?: string;
  [key: string]: unknown;
}

export interface PlayerDiscoverNearbyParams {
  token: string;
  location?: PositionPayload;
  radius?: number;
  filters?: PlayerDiscoverNearbyFilters;
  search?: string;
  matchSearch?: string;
  coachesPage?: number;
  coachesPerPage?: number;
  lessonsPage?: number;
  lessonsPerPage?: number;
  matchesPage?: number;
  matchesPerPage?: number;
  signal?: AbortSignal;
}

export interface PlayerDiscoverNearbyResponse {
  search_area?: unknown;
  coaches_availability?: {
    data?: LessonSummary[] | Record<string, unknown>[];
    pagination?: Record<string, unknown>;
  };
  group_lessons?: {
    data?: LessonSummary[] | Record<string, unknown>[];
    pagination?: Record<string, unknown>;
  };
  match_play?: {
    data?: Record<string, unknown>[];
    pagination?: Record<string, unknown>;
  };
  [key: string]: unknown;
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

export interface PlayerPastLessonsParams extends PaginationParams {
  token: string;
  lessonsPerPage?: number;
  signal?: AbortSignal;
}

export const getPlayerPastLessons = async ({
  token,
  perPage,
  lessonsPerPage,
  page = 1,
  signal,
}: PlayerPastLessonsParams) => {
  const finalPerPage = perPage ?? lessonsPerPage ?? 25;
  return request<PaginatedResponse<LessonSummary>>("/player/past_lessons", {
    token,
    signal,
    query: {
      perPage: finalPerPage,
      page,
    },
  });
};

export const getPlayerDiscoverNearby = async ({
  token,
  location,
  radius = 5,
  filters = {},
  search = "",
  matchSearch = "",
  coachesPage = 1,
  coachesPerPage = 10,
  lessonsPage = 1,
  lessonsPerPage = 10,
  matchesPage = 1,
  matchesPerPage = 10,
  signal,
}: PlayerDiscoverNearbyParams) => {
  const finalLocation = normalizePosition(location, getStoredLocation() ?? DEFAULT_POSITION) ?? DEFAULT_POSITION;

  return request<PlayerDiscoverNearbyResponse>("/player/discover/nearby", {
    method: "POST",
    token,
    signal,
    body: buildBody({
      location: finalLocation,
      radius,
      filters,
      search,
      matchSearch,
      coachesPage,
      coachesPerPage,
      lessonsPage,
      lessonsPerPage,
      matchesPage,
      matchesPerPage,
    }),
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
  const normalizedPosition = normalizePosition(
    position,
    (filters as Record<string, unknown>)?.position ?? (filters as PositionPayload),
  );
  const finalPosition = normalizedPosition ?? getStoredLocation() ?? DEFAULT_POSITION;
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
      position: finalPosition,
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
  signal?: AbortSignal;
}

export const getPlayerExternalLessons = async ({
  token,
  perPage = 5,
  page = 1,
  search = "",
  position,
  filters = {},
  signal,
}: PlayerExternalLessonsParams) =>
  request<PaginatedResponse<PlayerExternalLesson>>("/player/upcoming_external_lessons", {
    method: "POST",
    token,
    signal,
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
  signal?: AbortSignal;
}

export const getPlayerExternalLessonById = async ({ token, lessonId, signal }: PlayerExternalLessonByIdParams) =>
  request<PlayerExternalLesson>(`/player/upcoming_external_lessons/${lessonId}`, {
    token,
    signal,
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

export interface SurveyOptionGroupDetails {
  id: number | null;
  name: string | null;
}

export interface SurveyQuestionOption {
  id?: number | string;
  optionText?: string;
  optionDescription?: string;
  label?: string;
  description?: string;
  value?: unknown;
  [key: string]: unknown;
}

export interface SurveyQuestion {
  id: number | string;
  survey_section_id?: number | string;
  input_type_id?: number | string;
  question_subtext?: string | null;
  question_text?: string | Record<string, unknown> | null;
  answer_required?: boolean;
  option_group_id?: number | string | null;
  allow_multiple_option_answers?: boolean | null;
  sort_order?: number;
  status?: number;
  created_at?: string;
  updated_at?: string;
  placeholder_text?: string | null;
  question_code?: string | null;
  questionType: string;
  placeholderText?: string | null;
  optiongroupdetails?: SurveyOptionGroupDetails;
  options?: SurveyQuestionOption[];
  answerText?: unknown;
  answerMetadata?: Record<string, unknown> | null;
  defaultValue?: unknown;
  questionSettings?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SurveyQuestionListResponse {
  total?: string | number;
  perPage?: string | number;
  currentPage?: string | number;
  totalPages?: string | number;
  questions?: SurveyQuestion[];
  [key: string]: unknown;
}

export interface SurveyAnsweredResponse {
  questions?: SurveyQuestion[];
  answers?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface SubmitSurveyAnswersParams extends PlayerTokenOnlyParams {
  surveyAnswers: Record<string, unknown> | Array<Record<string, unknown>>;
}

export const getAllLocation = async ({ token }: PlayerTokenOnlyParams) =>
  request<Record<string, unknown>>("/player/locations-geojson", {
    token,
  });

export const submitSurveyAnswers = async ({
  token,
  surveyAnswers,
}: SubmitSurveyAnswersParams) =>
  request<Record<string, unknown>>("/player/surveys/submit", {
    method: "POST",
    token,
    body: surveyAnswers,
  });

export const getAllSurveyQuestion = async ({ token }: PlayerTokenOnlyParams) =>
  request<SurveyQuestionListResponse>("/player/surveys/questions", {
    token,
  });

export const getAllSurveyQuestionAnswered = async ({ token }: PlayerTokenOnlyParams) =>
  request<SurveyAnsweredResponse>("/player/surveys/answered", {
    token,
  });

export const getCoachMatchSurveyQuestions = async ({ token }: PlayerTokenOnlyParams) =>
  request<SurveyQuestionListResponse>("/player/surveys/coach-match/questions", {
    token,
  });

export interface SubmitCoachMatchSurveyAnswersParams extends PlayerTokenOnlyParams {
  surveyAnswers: Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface CoachMatchRecommendationBreakdown {
  level?: number;
  goals?: number;
  format?: number;
  schedule?: number;
  budget?: number;
  bonus?: number;
  [key: string]: unknown;
}

export interface CoachMatchRecommendationPrices {
  private?: number | null;
  semi?: number | null;
  group?: number | null;
  [key: string]: unknown;
}

export interface CoachMatchRecommendationDistance {
  miles?: number | null;
  location_id?: number | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: unknown;
}

export interface CoachMatchRecommendationItem {
  coach_id: number;
  name?: string;
  profileImage?: string;
  bio?: string;
  experience_years?: string;
  levels?: string[];
  specialties?: string[];
  formats?: string[];
  prices?: CoachMatchRecommendationPrices;
  languages?: string[];
  home_courts?: string[];
  distance?: CoachMatchRecommendationDistance | null;
  charges_enabled?: boolean;
  score?: number;
  breakdown?: CoachMatchRecommendationBreakdown;
  reasons?: string[];
  [key: string]: unknown;
}

export interface CoachMatchRecommendationsResponse {
  total?: number;
  perPage?: number;
  currentPage?: number;
  totalPages?: number;
  recommendations?: CoachMatchRecommendationItem[];
  [key: string]: unknown;
}

export interface GetCoachMatchRecommendationsParams extends PlayerTokenOnlyParams {
  perPage?: number;
  page?: number;
  search?: string;
  latitude?: number;
  longitude?: number;
}

export const submitCoachMatchSurveyAnswers = async ({
  token,
  surveyAnswers,
}: SubmitCoachMatchSurveyAnswersParams) =>
  request<Record<string, unknown>>("/player/surveys/coach-match/submit", {
    method: "POST",
    token,
    body: surveyAnswers,
  });

export const clearCoachMatchSurveyAnswers = async ({ token }: PlayerTokenOnlyParams) =>
  request<Record<string, unknown>>("/player/surveys/coach-match/clear-all", {
    method: "DELETE",
    token,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
    },
  });

export const getCoachMatchRecommendations = async ({
  token,
  perPage = 10,
  page = 1,
  search = "",
  latitude,
  longitude,
}: GetCoachMatchRecommendationsParams) =>
  request<CoachMatchRecommendationsResponse>("/player/coach-match/recommendations", {
    token,
    query: {
      perPage,
      page,
      search,
      latitude,
      longitude,
    },
  });

export const deleteUserAnswers = async ({ token }: PlayerTokenOnlyParams) =>
  request<Record<string, unknown>>("/player/answers/remove", {
    method: "DELETE",
    token,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
    },
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

export const fetchPlayerDetails = async ({ token, userId }: FetchPlayerDetailsParams) =>
  request<Record<string, unknown>>(
    "/player/surveys/getchecklocation/specific_user",
    {
      token,
      query: {
        userId,
      },
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
