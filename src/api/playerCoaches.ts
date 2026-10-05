import { request } from "./http";

export interface PlayerCoachRoster {
  id?: number;
  coach_id?: number;
  user_id?: number;
  status?: number | string;
  status_text?: string;
  player_status?: number | string;
  player_coach_status?: number | string;
  coach_status?: number | string;
  [key: string]: unknown;
}

type PlayerCoachCollection =
  | PlayerCoachRoster[]
  | {
      data?: PlayerCoachRoster[];
      results?: PlayerCoachRoster[];
      coaches?: PlayerCoachRoster[];
      items?: PlayerCoachRoster[];
    }
  | null
  | undefined;

const extractCoachArray = (payload: PlayerCoachCollection): PlayerCoachRoster[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload.data && Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload.results && Array.isArray(payload.results)) {
    return payload.results;
  }
  if (payload.coaches && Array.isArray(payload.coaches)) {
    return payload.coaches;
  }
  if (payload.items && Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
};

export interface FetchPlayerCoachesParams {
  token: string;
  perPage?: number;
  page?: number;
  search?: string;
  location?: string;
}

export const fetchPlayerCoaches = async ({
  token,
  perPage = 25,
  page = 1,
  search = "",
  location = "",
}: FetchPlayerCoachesParams) => {
  const response = await request<PlayerCoachCollection>("/player/coaches", {
    token,
    query: {
      perPage,
      page,
      search,
      locationSearch: location,
    },
  });
  return extractCoachArray(response);
};

export interface RequestCoachPlayerParams {
  token: string;
  coachId: number;
  status?: string;
}

export const requestCoachPlayer = ({ token, coachId, status = "PENDING" }: RequestCoachPlayerParams) =>
  request<Record<string, unknown>>("/player/request/coach", {
    method: "POST",
    token,
    body: {
      coach_id: coachId,
      status,
    },
  });

// "Message coach" opens the player's own texting app, so the app can't see the message itself.
// Record the tap instead; it feeds the admin coach funnel. Best effort: never blocks the tap.
export const recordCoachMessageTap = ({ token, coachId }: { token: string; coachId: number | string }) =>
  request<Record<string, unknown>>(`/player/coaches/${encodeURIComponent(String(coachId))}/contact-events`, {
    method: "POST",
    token,
    body: { kind: "message_tap", source: "web" },
  }).catch(() => null);
