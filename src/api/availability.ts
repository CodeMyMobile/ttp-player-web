import { request } from "./http";

// Weekly availability and shared free time (ttp-api #456/#457). A slot is a weekday (0 = Sunday)
// and one of six times of day; windows come back as real instants plus the local date.

export type AvailabilityBucket = "early_morning" | "late_morning" | "afternoon" | "late_afternoon" | "evening" | "night";

export interface AvailabilitySlot {
  weekday: number;
  bucket: AvailabilityBucket;
}

export interface AvailabilityWindow {
  start: string;
  end: string;
  date: string;
  weekday: number;
  bucket: AvailabilityBucket;
}

export interface BestBet {
  player_id: number;
  name: string | null;
  has_availability: boolean;
  shared_count: number;
  shared_days: string[];
  windows: AvailabilityWindow[];
}

export interface BestBetsResponse {
  tz: string;
  has_availability: boolean;
  opponents: BestBet[];
}

export interface OverlapResponse {
  tz: string;
  has_availability: { you: boolean; them: boolean };
  shared: AvailabilitySlot[];
  windows: AvailabilityWindow[];
  shared_days: string[];
}

/** The browser's IANA timezone, which the API works out local times of day in. */
export const viewerTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

export const getMyAvailability = ({ token, signal }: { token?: string; signal?: AbortSignal } = {}) =>
  request<{ slots: AvailabilitySlot[] }>("/players/me/availability", { token, signal });

export const saveMyAvailability = ({ token, slots }: { token?: string; slots: AvailabilitySlot[] }) =>
  request<{ slots: AvailabilitySlot[] }, { slots: AvailabilitySlot[] }>("/players/me/availability", {
    method: "PUT",
    token,
    body: { slots },
  });

export const getAvailabilityOverlap = ({
  playerId,
  token,
  days = 7,
  signal,
}: {
  playerId: number | string;
  token?: string;
  days?: number;
  signal?: AbortSignal;
}) =>
  request<OverlapResponse>(`/players/${encodeURIComponent(String(playerId))}/availability-overlap`, {
    token,
    signal,
    query: { tz: viewerTimeZone(), days },
  });

export const getLeagueBestBets = ({
  leagueId,
  token,
  days = 7,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  days?: number;
  signal?: AbortSignal;
}) =>
  request<BestBetsResponse>(`/leagues/${encodeURIComponent(String(leagueId))}/best-bets`, {
    token,
    signal,
    query: { tz: viewerTimeZone(), days },
  });
