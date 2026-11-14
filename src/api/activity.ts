import { request } from "./http";

/** Matches and lessons played since a date (ttp-api GET /players/me/activity-count). */
export const getActivityCount = ({ since, token, signal }: { since: string; token?: string; signal?: AbortSignal }) =>
  request<{ since: string; matches: number; lessons: number }>("/players/me/activity-count", {
    token,
    signal,
    query: { since },
  });
