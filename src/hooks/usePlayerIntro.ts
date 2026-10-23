import { useCallback, useState } from "react";

import { sendPlayerIntro } from "../api/playerHome";

export type IntroStatus = "idle" | "sending" | "sent" | "error";

/** Whether the API says it can text this player an intro. Never true without its say-so. */
export const canReceiveIntro = (raw: { can_receive_intro?: unknown } | null | undefined): boolean =>
  raw?.can_receive_intro === true;

/** What to tell the sender when the API refuses, by its error code. */
export const introErrorMessage = (code: unknown, playerName: string): string => {
  switch (code) {
    case "intro_already_sent":
      return `You already sent ${playerName} an intro this week.`;
    case "intro_limit_reached":
      return "You've sent 10 intros today. Try again tomorrow.";
    case "player_phone_unavailable":
      return `${playerName} can't get texts yet. Send a MatchPlay invite instead.`;
    case "player_not_found":
      return "This player isn't available.";
    default:
      return "Couldn't send the intro. Please try again.";
  }
};

/**
 * Sends a quick intro through the API, which texts the player from our number
 * with a link to the sender's profile; the browser never needs either number.
 * One player at a time: `reset` when the Connect sheet opens for someone else.
 */
export default function usePlayerIntro() {
  const [status, setStatus] = useState<IntroStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  const send = useCallback(async ({ token, playerId, playerName }: { token: string; playerId: string; playerName: string }) => {
    setStatus("sending");
    setError(null);
    try {
      await sendPlayerIntro({ token, playerId });
      setStatus("sent");
      return true;
    } catch (caught) {
      const code = (caught as { data?: { error?: unknown } } | null)?.data?.error;
      setError(introErrorMessage(code, playerName));
      setStatus("error");
      return false;
    }
  }, []);

  return { status, error, send, reset };
}
