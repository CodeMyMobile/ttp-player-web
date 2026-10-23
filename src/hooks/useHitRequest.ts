import { useCallback, useState } from "react";

import { sendHitRequest } from "../api/hitRequests";

/** "connected" = they had already asked you, so asking back connected you at once. */
export type HitRequestSendStatus = "idle" | "sending" | "sent" | "connected" | "error";

/** Whether the API says it can text this player a hit request. Never true without its say-so. */
export const canReceiveHitRequest = (raw: { can_receive_hit_request?: unknown } | null | undefined): boolean =>
  raw?.can_receive_hit_request === true;

/** The error code from an API failure, if there is one. */
export const hitRequestErrorCode = (caught: unknown): unknown =>
  (caught as { data?: { error?: unknown } } | null)?.data?.error;

/** What to tell the sender when the API refuses, by its error code. */
export const hitRequestErrorMessage = (code: unknown, playerName: string): string => {
  switch (code) {
    case "hit_request_recent":
      return `You asked ${playerName} recently. Give them a few days.`;
    case "already_connected":
      return `You're already connected with ${playerName}. Check your texts for their number.`;
    case "hit_request_limit_reached":
      return "You've sent 10 requests today. Try again tomorrow.";
    case "sender_phone_required":
      return "Add a mobile number to your profile first, so we can text you theirs when they accept.";
    case "player_phone_unavailable":
      return `${playerName} can't get texts yet. Send a MatchPlay invite instead.`;
    case "player_not_found":
      return "This player isn't available.";
    default:
      return "Couldn't send the request. Please try again.";
  }
};

/**
 * Sends a hit request: the API texts the player a link to accept or decline, and
 * on accept texts each of you the other's number. The browser never needs either
 * number. One player at a time: `reset` when the Connect sheet opens for someone else.
 */
export default function useHitRequest() {
  const [status, setStatus] = useState<HitRequestSendStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  const send = useCallback(async ({ token, playerId, playerName }: { token: string; playerId: string; playerName: string }) => {
    setStatus("sending");
    setError(null);
    try {
      const result = await sendHitRequest({ token, playerId });
      setStatus(result?.status === "accepted" ? "connected" : "sent");
      return true;
    } catch (caught) {
      setError(hitRequestErrorMessage(hitRequestErrorCode(caught), playerName));
      setStatus("error");
      return false;
    }
  }, []);

  return { status, error, send, reset };
}
