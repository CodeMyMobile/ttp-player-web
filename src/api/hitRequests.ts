import { request } from "./http";

/**
 * Hit requests: one player asks another to hit. The API texts the other player a
 * link to /hit/:token, where they accept or decline without signing in; on
 * accept it texts each player the other's number. See ttp-api src/services/hitRequests.
 */

export type HitRequestStatus = "pending" | "accepted" | "declined" | "expired";

export interface HitRequestView {
  status: HitRequestStatus;
  sender: {
    name: string | null;
    level: string | null;
    profile_picture: string | null;
    profile_url: string;
  };
  recipient_first_name: string | null;
}

/** "pending" when the text went out; "accepted" when they had already asked you. */
export const sendHitRequest = ({ token, playerId }: { token: string; playerId: string }) =>
  request<{ status: "pending" | "accepted" }>(`/players/${encodeURIComponent(playerId)}/hit-request`, {
    method: "POST",
    token,
  });

export const getHitRequest = (linkToken: string) =>
  request<HitRequestView>(`/public/hit-requests/${encodeURIComponent(linkToken)}`);

export const answerHitRequest = (linkToken: string, action: "accept" | "decline") =>
  request<{ status: HitRequestStatus }>(`/public/hit-requests/${encodeURIComponent(linkToken)}/${action}`, {
    method: "POST",
  });
