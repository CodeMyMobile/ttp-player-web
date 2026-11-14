import { request } from "./http";

// The pick-a-time link in a league proposal text (ttp-api #461). Public: the token in the link is
// the key, so these calls carry no sign-in.

export type PickStatus = "open" | "picked" | "none" | "expired" | "closed";

export interface PickLocation {
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PickPage {
  status: PickStatus;
  proposer_first_name: string | null;
  recipient_first_name: string | null;
  league: { id: number; name: string } | null;
  location: PickLocation;
  timezone: string | null;
  times: string[];
  start_date_time: string | null;
  match_id: number;
}

export interface PickResult {
  status: "picked";
  match_id: number;
  start_date_time: string;
  timezone: string | null;
  location: PickLocation;
}

const path = (token: string, suffix = "") => `/public/league-picks/${encodeURIComponent(token)}${suffix}`;

export const getPick = ({ token, signal }: { token: string; signal?: AbortSignal }) =>
  request<PickPage>(path(token), { signal });

export const pickTime = ({ token, time }: { token: string; time: string }) =>
  request<PickResult, { time: string }>(path(token, "/pick"), { method: "POST", body: { time } });

export const noneWork = ({ token, note }: { token: string; note?: string }) =>
  request<{ status: "none" }, { note?: string }>(path(token, "/none"), { method: "POST", body: { note } });
