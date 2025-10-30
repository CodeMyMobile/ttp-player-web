import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPlayerFutureGroupLessons,
  getPlayerFutureLessons,
  updatePlayerFutureLessons,
  type FiltersPayload,
  type LessonSummary,
  type PositionPayload,
} from "../api/playerHome";
import type { PaginatedResponse } from "../api/player";
import { getStoredAuthToken } from "../services/authToken";

type UnknownRecord = Record<string, unknown>;

type PaginatedLessonsResponse<TLesson> =
  | PaginatedResponse<TLesson>
  | (UnknownRecord & { data?: TLesson[]; results?: TLesson[]; items?: TLesson[] });

type UpcomingLessonsState<TLesson> = {
  data: TLesson[];
  loading: boolean;
  page: number;
  isEnd: boolean;
  total: number | null;
  perPage: number | null;
  error: Error | null;
};

const DEFAULT_STATE: UpcomingLessonsState<LessonSummary> = {
  data: [],
  loading: false,
  page: 0,
  isEnd: false,
  total: null,
  perPage: null,
  error: null,
};

type FetchUpcomingLessonsArgs = {
  lessonsPerPage?: number;
  page?: number;
  token?: string;
  signal?: AbortSignal;
  /**
   * When true, the hook will replace the cached lessons instead of appending when page > 1.
   */
  replace?: boolean;
};

type FetchUpcomingGroupLessonsArgs = FetchUpcomingLessonsArgs & {
  search?: string;
  position?: PositionPayload;
  filters?: FiltersPayload;
};

type UpdateLessonStatusOptions = {
  token?: string;
};

type UpdateLessonStatusResult<TLesson> = {
  status: number;
  data?: TLesson;
  error?: Error;
  raw?: unknown;
};

const extractLessons = <TLesson,>(response?: PaginatedLessonsResponse<TLesson>) => {
  if (!response) return [] as TLesson[];
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray((response as UnknownRecord).results)) {
    return ((response as UnknownRecord).results ?? []) as TLesson[];
  }
  if (Array.isArray((response as UnknownRecord).items)) {
    return ((response as UnknownRecord).items ?? []) as TLesson[];
  }
  return [] as TLesson[];
};

const extractPagination = <TLesson,>(
  response: PaginatedLessonsResponse<TLesson> | undefined,
  fallback: { page: number; perPage?: number },
) => {
  const meta = (response as UnknownRecord)?.meta ?? {};
  const pagination =
    (meta as UnknownRecord)?.pagination ??
    meta ??
    (response as UnknownRecord)?.pagination ??
    (response as UnknownRecord);

  const total =
    typeof (pagination as UnknownRecord)?.total === "number"
      ? ((pagination as UnknownRecord)?.total as number)
      : typeof (meta as UnknownRecord)?.total === "number"
        ? ((meta as UnknownRecord)?.total as number)
        : typeof (response as UnknownRecord)?.total === "number"
          ? ((response as UnknownRecord)?.total as number)
          : null;

  const perPage =
    typeof (pagination as UnknownRecord)?.per_page === "number"
      ? ((pagination as UnknownRecord)?.per_page as number)
      : typeof (pagination as UnknownRecord)?.perPage === "number"
        ? ((pagination as UnknownRecord)?.perPage as number)
        : typeof (response as UnknownRecord)?.per_page === "number"
          ? ((response as UnknownRecord)?.per_page as number)
          : typeof (response as UnknownRecord)?.perPage === "number"
            ? ((response as UnknownRecord)?.perPage as number)
            : fallback.perPage ?? null;

  const currentPage =
    typeof (pagination as UnknownRecord)?.current_page === "number"
      ? ((pagination as UnknownRecord)?.current_page as number)
      : typeof (pagination as UnknownRecord)?.currentPage === "number"
        ? ((pagination as UnknownRecord)?.currentPage as number)
        : typeof (pagination as UnknownRecord)?.page === "number"
          ? ((pagination as UnknownRecord)?.page as number)
          : typeof (response as UnknownRecord)?.current_page === "number"
            ? ((response as UnknownRecord)?.current_page as number)
            : typeof (response as UnknownRecord)?.page === "number"
              ? ((response as UnknownRecord)?.page as number)
              : fallback.page;

  const totalPages =
    typeof (pagination as UnknownRecord)?.total_pages === "number"
      ? ((pagination as UnknownRecord)?.total_pages as number)
      : typeof (pagination as UnknownRecord)?.totalPages === "number"
        ? ((pagination as UnknownRecord)?.totalPages as number)
        : typeof (pagination as UnknownRecord)?.last_page === "number"
          ? ((pagination as UnknownRecord)?.last_page as number)
          : typeof (response as UnknownRecord)?.total_pages === "number"
            ? ((response as UnknownRecord)?.total_pages as number)
            : typeof (response as UnknownRecord)?.last_page === "number"
              ? ((response as UnknownRecord)?.last_page as number)
              : null;

  const explicitIsEnd = (response as UnknownRecord)?.is_end ?? (response as UnknownRecord)?.isEnd;

  return {
    total,
    perPage,
    currentPage,
    totalPages,
    explicitIsEnd: typeof explicitIsEnd === "boolean" ? (explicitIsEnd as boolean) : null,
  };
};

const computeIsEnd = ({
  explicitIsEnd,
  totalPages,
  currentPage,
  perPage,
  lessons,
}: {
  explicitIsEnd: boolean | null;
  totalPages: number | null;
  currentPage: number;
  perPage: number | null;
  lessons: unknown[];
}) => {
  if (typeof explicitIsEnd === "boolean") {
    return explicitIsEnd;
  }
  if (typeof totalPages === "number" && totalPages > 0) {
    return currentPage >= totalPages;
  }
  if (typeof perPage === "number" && perPage > 0) {
    return lessons.length < perPage;
  }
  return lessons.length === 0 && currentPage > 1;
};

const normalizeLessonId = (value: string | number | undefined) => {
  if (value === undefined || value === null) return null;
  return String(value);
};

export const usePlayerUpcomingLessons = (options: { token?: string; defaultPerPage?: number } = {}) => {
  const { token: initialToken, defaultPerPage } = options;
  const tokenRef = useRef<string | undefined>(initialToken ?? undefined);
  const [upcomingLessons, setUpcomingLessons] =
    useState<UpcomingLessonsState<LessonSummary>>(DEFAULT_STATE);

  useEffect(() => {
    if (initialToken) {
      tokenRef.current = initialToken;
    }
  }, [initialToken]);

  const resolveToken = useCallback(
    (providedToken?: string) => {
      if (providedToken) {
        tokenRef.current = providedToken;
        return providedToken;
      }
      if (tokenRef.current) {
        return tokenRef.current;
      }
      const stored = getStoredAuthToken({ preferScheme: "token" }) ?? undefined;
      tokenRef.current = stored ?? undefined;
      return tokenRef.current;
    },
    [],
  );

  const resetUpcomingLessons = useCallback(() => {
    setUpcomingLessons(DEFAULT_STATE);
  }, []);

  const fetchUpcomingLessons = useCallback(
    async (args: FetchUpcomingLessonsArgs = {}) => {
      const {
        lessonsPerPage = defaultPerPage,
        page = 1,
        token,
        signal,
        replace,
      } = args;
      const authToken = resolveToken(token);
      if (!authToken) {
        throw new Error("Missing authentication token for upcoming lessons request");
      }

      setUpcomingLessons((prev) => ({
        ...prev,
        loading: true,
        error: null,
        ...(page <= 1 || replace ? { data: page <= 1 || replace ? [] : prev.data } : {}),
      }));

      try {
        const response = await getPlayerFutureLessons({
          token: authToken,
          lessonsPerPage,
          page,
          signal,
        });

        const lessons = extractLessons<LessonSummary>(response);
        const { total, perPage, currentPage, totalPages, explicitIsEnd } = extractPagination(
          response,
          { page, perPage: lessonsPerPage },
        );

        const isEnd = computeIsEnd({
          explicitIsEnd,
          totalPages,
          currentPage,
          perPage,
          lessons,
        });

        setUpcomingLessons((prev) => {
          const shouldAppend = currentPage > 1 && !replace;
          const nextData = shouldAppend ? [...prev.data, ...lessons] : lessons;
          return {
            data: nextData,
            loading: false,
            page: currentPage,
            isEnd,
            total,
            perPage: perPage ?? lessonsPerPage ?? null,
            error: null,
          };
        });

        return response;
      } catch (error) {
        setUpcomingLessons((prev) => ({
          ...prev,
          loading: false,
          error: error as Error,
        }));
        throw error;
      }
    },
    [defaultPerPage, resolveToken],
  );

  const fetchUpcomingGroupLessons = useCallback(
    async (args: FetchUpcomingGroupLessonsArgs) => {
      const {
        lessonsPerPage = defaultPerPage,
        page = 1,
        token,
        signal,
        search = "",
        position,
        filters = {},
      } = args ?? {};
      const authToken = resolveToken(token);
      if (!authToken) {
        throw new Error("Missing authentication token for upcoming group lessons request");
      }

      const response = await getPlayerFutureGroupLessons({
        token: authToken,
        lessonsPerPage,
        page,
        search,
        position,
        filters,
        signal,
      });

      return response;
    },
    [defaultPerPage, resolveToken],
  );

  const updateLessonStatus = useCallback(
    async (
      lessonId: number | string,
      status: string,
      options: UpdateLessonStatusOptions = {},
    ): Promise<UpdateLessonStatusResult<LessonSummary>> => {
      const authToken = resolveToken(options.token);
      if (!authToken) {
        return { status: 401, error: new Error("Missing authentication token"), raw: null };
      }

      try {
        const updatedLesson = await updatePlayerFutureLessons({
          token: authToken,
          lessonId,
          status,
        });

        const normalizedTargetId = normalizeLessonId(lessonId);
        setUpcomingLessons((prev) => ({
          ...prev,
          data: prev.data.map((lesson) => {
            const currentId = normalizeLessonId((lesson as UnknownRecord)?.id as string | number | undefined);
            if (normalizedTargetId && currentId === normalizedTargetId) {
              return {
                ...lesson,
                status,
                ...updatedLesson,
              } as LessonSummary;
            }
            return lesson;
          }),
        }));

        return {
          status: 200,
          data: updatedLesson,
          raw: updatedLesson,
        };
      } catch (error) {
        const err = error as Error & { status?: number };
        return {
          status: err?.status ?? 500,
          error: err,
          raw: err,
        };
      }
    },
    [resolveToken],
  );

  return {
    upcomingLessons,
    fetchUpcomingLessons,
    fetchUpcomingGroupLessons,
    updateLessonStatus,
    resetUpcomingLessons,
  } as const;
};

export type {
  FetchUpcomingLessonsArgs,
  FetchUpcomingGroupLessonsArgs,
  UpcomingLessonsState,
  UpdateLessonStatusOptions,
  UpdateLessonStatusResult,
};
