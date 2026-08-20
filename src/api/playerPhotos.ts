import { buildApiUrl } from "./config";
import { usableAvatar } from "../utils/avatar";

/**
 * Profile photos for the ladder, one player at a time.
 *
 * The rankings endpoint (`/match-results/rankings`) returns no image field —
 * verified 2026-08-20 against all 1223 rows — so the only way to put a face on a
 * ladder row today is `/public/players/:user_id`, which does carry
 * `profile_picture` and needs no token. The ranking `user_id` is the right key:
 * that endpoint echoes back the same `user_id` and a matching `full_name`.
 *
 * This is a request per player, so it is deliberately lazy and cached: rows ask
 * only once they scroll into view (see the ladder's Avatar), each id is fetched
 * at most once per page load, and no more than a few are in flight at a time.
 *
 * When the backend adds `profile_picture` to the rankings response this whole
 * module can go — decorateRankings already reads the field if it is there.
 */

/** ~15% of players have a real photo; the rest hold a bare bucket root. */
const cache = new Map<string, Promise<string | null>>();

const MAX_IN_FLIGHT = 6;
let inFlight = 0;
const waiting: Array<() => void> = [];

const acquire = () =>
  new Promise<void>((resolve) => {
    if (inFlight < MAX_IN_FLIGHT) {
      inFlight += 1;
      resolve();
      return;
    }
    waiting.push(() => {
      inFlight += 1;
      resolve();
    });
  });

const release = () => {
  inFlight -= 1;
  waiting.shift()?.();
};

/**
 * The photo out of a `/public/players/:id` payload, or null.
 *
 * `usableAvatar` is what rejects the bare bucket root
 * ("https://ttp-avatars-production.s3.amazonaws.com/") that most players have
 * where a picture should be — a non-empty string that would render as a broken
 * image instead of falling back to initials.
 */
export const extractPlayerPhoto = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const player = (payload as { player?: unknown }).player;
  const record = (player && typeof player === "object" ? player : payload) as Record<string, unknown>;
  const raw = record.profile_picture ?? record.profileImage ?? record.profile_image ?? record.avatar_url;
  return typeof raw === "string" ? usableAvatar(raw) : null;
};

export const fetchPlayerPhoto = (userId: number | string): Promise<string | null> => {
  const key = String(userId);
  if (!key || key === "undefined" || key === "null") return Promise.resolve(null);

  const cached = cache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    await acquire();
    try {
      const response = await fetch(buildApiUrl(`/public/players/${encodeURIComponent(key)}`));
      if (!response.ok) return null;
      return extractPlayerPhoto(await response.json());
    } catch {
      // A missing photo is not worth surfacing — the row already has initials.
      return null;
    } finally {
      release();
    }
  })();

  cache.set(key, pending);
  return pending;
};
