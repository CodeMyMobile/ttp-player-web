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

const isAuthError = (error: unknown) => {
  const status = (error as { status?: number })?.status;
  return status === 401 || status === 403;
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
    signal,
  } satisfies Omit<GetMatchesParams, "filters" | "body"> & {
    query: { perPage: number; page: number };
  };

  let lastError: unknown;

  for (const endpoint of matchesEndpointCandidates) {
    const methodsToTry = MATCHES_METHOD === "GET" ? ["GET"] : [MATCHES_METHOD, "GET"];

    for (const method of methodsToTry) {
      try {
        return await request<MatchesResponse>(endpoint, {
          ...requestOptions,
          method,
          body: method === "GET" ? undefined : filters,
        });
      } catch (error) {
        if (isAuthError(error)) {
          throw error;
        }
        lastError = error;
      }
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
