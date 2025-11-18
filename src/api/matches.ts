import { request } from "./http";
import type { MatchesResponse } from "../types/match";

const MATCHES_ENDPOINT =
  import.meta.env.VITE_PLAYER_MATCHES_ENDPOINT ?? "/player/matches";

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

export const getBrowseMatches = async ({
  token,
  perPage = 20,
  page = 1,
  signal,
  filters = {},
}: GetMatchesParams = {}) =>
  request<MatchesResponse>(MATCHES_ENDPOINT, {
    method: "POST",
    token: token ?? undefined,
    query: {
      perPage,
      page,
    },
    body: filters,
    signal,
  });

export const extractMatches = (payload: MatchesResponse): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
};
