import { request } from "./http";
import type { MatchesResponse } from "../types/match";

const normalizeEndpoint = (value: string) => `/${value.replace(/^\/+/, "")}`;

const matchesEndpointCandidates = (() => {
  const primary = import.meta.env.VITE_PLAYER_MATCHES_ENDPOINT ?? "/player/matches";
  const fallbacks = (import.meta.env.VITE_PLAYER_MATCHES_FALLBACK_ENDPOINTS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const defaults = ["/player/upcoming_matches", "/matches", "/player/matches/list"];

  const normalized = [primary, ...fallbacks, ...defaults].map(normalizeEndpoint);

  return Array.from(new Set(normalized));
})();
const MATCHES_METHOD = (import.meta.env.VITE_PLAYER_MATCHES_METHOD ?? "POST").toUpperCase();

export interface GetMatchesParams {
  token?: string | null;
  perPage?: number;
  page?: number;
  signal?: AbortSignal;
  /**
   * Optional payload forwarded to the API for filtering/sorting server-side.
   */
  filters?: Record<string, unknown>;
}

const shouldRetryWithGet = (error: unknown) => {
  const status = (error as { status?: number })?.status;
  const message = (error as Error)?.message?.toLowerCase();
  return status === 404 || message?.includes("cannot get");
};

export const getBrowseMatches = async ({
  token,
  perPage = 20,
  page = 1,
  signal,
  filters = {},
}: GetMatchesParams = {}) => {
  const requestOptions = {
    token: token ?? undefined,
    query: {
      perPage,
      page,
    },
    body: MATCHES_METHOD === "GET" ? undefined : filters,
    signal,
  } satisfies Omit<GetMatchesParams, "filters"> & {
    query: { perPage: number; page: number };
    body?: Record<string, unknown> | undefined;
  };

  let lastError: unknown;

  for (const endpoint of matchesEndpointCandidates) {
    try {
      return await request<MatchesResponse>(endpoint, {
        ...requestOptions,
        method: MATCHES_METHOD,
      });
    } catch (error) {
      if (MATCHES_METHOD !== "GET" && shouldRetryWithGet(error)) {
        try {
          return await request<MatchesResponse>(endpoint, {
            ...requestOptions,
            method: "GET",
            body: undefined,
          });
        } catch (getError) {
          lastError = getError;
        }
      } else if (!shouldRetryWithGet(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to load matches.");
};

export const extractMatches = (payload: MatchesResponse): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
};
