import { request } from "./http";
import { getStoredAuthToken } from "../services/authToken";
import type { CircleListResponse, CircleMember, CircleSearchResponse } from "../utils/circleMembers";

// The player's own tennis circle: the people and coaches they picked as their go-to group.
// Only they see it, and the people in it aren't told. See utils/circleMembers.ts.

const ownToken = () => getStoredAuthToken({ preferScheme: "token" }) ?? undefined;

export const getMyCircle = ({ signal }: { signal?: AbortSignal } = {}) =>
  request<CircleListResponse>("/player/circle", { token: ownToken(), signal });

/** Players to add, by name (at least 3 characters): up to ten, never anyone private or blocked. */
export const searchCircle = (query: string, { signal }: { signal?: AbortSignal } = {}) =>
  request<CircleSearchResponse>("/player/circle/search", { token: ownToken(), signal, query: { q: query } });

export const addToCircle = (userId: number) =>
  request<{ member: CircleMember }, { user_id: number }>("/player/circle", {
    method: "POST",
    token: ownToken(),
    body: { user_id: userId },
  });

export const removeFromCircle = (userId: number) =>
  request<{ removed: boolean }>(`/player/circle/${encodeURIComponent(String(userId))}`, {
    method: "DELETE",
    token: ownToken(),
  });

/** The Monday email about what the circle has on. On unless the player turned it off. */
export const setCircleWeeklyEmail = (enabled: boolean) =>
  request<{ weekly_email: boolean }, { enabled: boolean }>("/player/circle/weekly-email", {
    method: "PUT",
    token: ownToken(),
    body: { enabled },
  });
