import { useEffect, useState } from "react";

import { getActivityCount } from "../api/activity";
import { getStoredAuthToken } from "../services/authToken";
import { lastRestrungAt, type PlayedSinceRestring } from "../utils/homeActionNeeded";

/**
 * Matches and lessons since the player's last restring, for the restring nudge's 20-match rule.
 * Null until loaded, with no restring on record, while one is still at the shop, or on failure:
 * the nudge then falls back to its 8-week rule alone.
 */
export const useRestringActivity = (restringOrders: unknown[]): PlayedSinceRestring | null => {
  const last = lastRestrungAt(restringOrders);
  const since = typeof last === "number" ? new Date(last).toISOString() : null;
  const [played, setPlayed] = useState<PlayedSinceRestring | null>(null);
  useEffect(() => {
    setPlayed(null);
    if (!since) return undefined;
    const controller = new AbortController();
    getActivityCount({ since, token: getStoredAuthToken() ?? undefined, signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) setPlayed({ matches: Number(res.matches) || 0, lessons: Number(res.lessons) || 0 });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [since]);
  return played;
};
