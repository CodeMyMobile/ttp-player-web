// Tip of the day: which video, how long it runs, and not asking YouTube twice a
// page load for an answer that only changes at midnight.

export interface TipVideo {
  videoId: string;
  title: string;
  thumbnail: string | null;
  channel: string | null;
  /** "4:12", once the durations call has landed. */
  duration?: string | null;
}

const DAY_MS = 86_400_000;

/**
 * The same tip all day, a different one tomorrow.
 *
 * Indexed by local days-since-epoch rather than picked at random: "of the day"
 * has to mean something, and a fresh video on every render would make it a lie —
 * as well as changing under someone mid-scroll.
 */
export const pickTipOfDay = <T>(videos: T[], now: Date = new Date()): T | null => {
  const list = Array.isArray(videos) ? videos.filter(Boolean) : [];
  if (!list.length) return null;

  // Local midnight, so the tip turns over at the player's midnight rather than UTC's.
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayIndex = Math.floor(localMidnight / DAY_MS);
  return list[((dayIndex % list.length) + list.length) % list.length];
};

/**
 * ISO-8601 duration to a clock reading: PT4M12S → "4:12", PT1H2M3S → "1:02:03".
 *
 * Ported from ttp-rn-app rather than reused, since that copy is a regex chain
 * over the raw string and this needs to survive the shapes it does not handle
 * (PT45S, PT1H, missing values) without producing something like ":45".
 */
export const parseIsoDuration = (iso: unknown): string | null => {
  if (typeof iso !== "string") return null;
  const match = iso.trim().match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;

  const [, h, m, s] = match;
  const hours = Number(h ?? 0);
  const minutes = Number(m ?? 0);
  const seconds = Number(s ?? 0);
  if (!hours && !minutes && !seconds) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

// --- day cache --------------------------------------------------------------

const CACHE_KEY = "player:web:tip-of-day";

const localDayKey = (now: Date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * The playlist, cached for the local day.
 *
 * The tip cannot change before midnight, so spending two YouTube calls on every
 * page load would buy nothing and spend quota. Returns null on a different day,
 * a missing entry, or unparseable JSON — all of which simply mean "fetch it".
 */
export const readCachedTips = (now: Date = new Date()): TipVideo[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { day?: string; videos?: TipVideo[] };
    if (parsed?.day !== localDayKey(now)) return null;
    return Array.isArray(parsed.videos) && parsed.videos.length ? parsed.videos : null;
  } catch {
    return null;
  }
};

export const writeCachedTips = (videos: TipVideo[], now: Date = new Date()) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ day: localDayKey(now), videos }));
  } catch {
    // A full or unavailable localStorage costs a refetch tomorrow, nothing more.
  }
};
