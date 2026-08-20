// Tip-of-the-day videos, straight from the YouTube Data API.
//
// No backend involved: ttp-rn-app has done this since launch against the same
// curated playlists. This mirrors it, with two corrections.

import { parseIsoDuration, type TipVideo } from "../utils/tipOfDay";

// The "All" playlist from ttp-rn-app's EducationSection.
const ALL_PLAYLIST_ID = "PLKffdR1pHOgVEZMCGpHkrVF_b67YUZYmF";
const MAX_RESULTS = 25;

/**
 * Deliberately its own key rather than VITE_GOOGLE_API_KEY, which is the Places
 * key used by AddressPicker and AppNav. A web key is readable in the bundle by
 * anyone who looks, so widening that one to YouTube would mean a single scraped
 * key spends both quotas.
 */
const apiKey = () => import.meta.env?.VITE_YOUTUBE_API_KEY || null;

export const hasYouTubeKey = () => Boolean(apiKey());

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** Durations live on a separate endpoint; batched, since it takes up to 50 ids. */
const fetchDurations = async (ids: string[], key: string): Promise<Record<string, string>> => {
  if (!ids.length) return {};
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.slice(0, 50).join(",")}&key=${key}`,
  );
  if (!response.ok) return {};

  const data = await response.json();
  const out: Record<string, string> = {};
  for (const item of data?.items ?? []) {
    const duration = parseIsoDuration(item?.contentDetails?.duration);
    if (item?.id && duration) out[String(item.id)] = duration;
  }
  return out;
};

/**
 * The playlist, newest first, with durations attached.
 *
 * Returns [] on any failure. A tip that cannot be fetched must leave the home
 * page exactly as it was — this is the least important thing on the screen and
 * has no business breaking anything above it.
 */
export const fetchTipVideos = async (): Promise<TipVideo[]> => {
  const key = apiKey();
  if (!key) return [];

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${MAX_RESULTS}` +
        `&playlistId=${ALL_PLAYLIST_ID}&key=${key}`,
    );
    if (!response.ok) return [];

    const data = await response.json();
    const videos: TipVideo[] = (data?.items ?? [])
      .map((item: Record<string, any>) => {
        const snippet = item?.snippet ?? {};
        const videoId = asString(snippet?.resourceId?.videoId);
        const title = asString(snippet?.title);
        if (!videoId || !title) return null;

        return {
          videoId,
          title,
          thumbnail:
            asString(snippet?.thumbnails?.medium?.url) ?? asString(snippet?.thumbnails?.high?.url),
          // videoOwnerChannelTitle, NOT channelTitle: on a playlist item the
          // latter is the playlist's owner, so it would print the same name on
          // every video regardless of who made it.
          channel: asString(snippet?.videoOwnerChannelTitle),
        } satisfies TipVideo;
      })
      .filter(Boolean) as TipVideo[];

    if (!videos.length) return [];

    // Durations are cosmetic — the card is fine without the badge.
    const durations = await fetchDurations(
      videos.map((video) => video.videoId),
      key,
    ).catch(() => ({}));

    return videos.map((video) => ({ ...video, duration: durations[video.videoId] ?? null }));
  } catch {
    return [];
  }
};
