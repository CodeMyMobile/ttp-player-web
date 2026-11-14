import { request } from "./http";

/** A played singles match nobody has logged a score for (ttp-api GET /match-results/awaiting). */
export interface AwaitingScore {
  match_id: number;
  start_date_time: string;
  timezone: string | null;
  location_text: string | null;
  league_id: number | null;
  league_match_id: number | null;
  opponent: { id: number; name: string | null };
}

export const getAwaitingScores = ({ token, signal }: { token?: string; signal?: AbortSignal } = {}) =>
  request<{ matches: AwaitingScore[] }>("/match-results/awaiting", { token, signal });
