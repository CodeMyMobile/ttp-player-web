const feedBaseUrl = "https://www.youtube.com/feeds/videos.xml?playlist_id=";

const normaliseProxyBase = (value) => {
  if (!value) {
    return "";
  }

  return value.endsWith("?") ? value : `${value}?`;
};

const corsProxyBaseUrl = normaliseProxyBase(
  import.meta?.env?.VITE_YOUTUBE_FEED_PROXY ?? "https://corsproxy.io/?",
);

const formatDurationFromSeconds = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${`${remaining}`.padStart(2, "0")}`;
};

const deriveSkillLevel = (keywords) => {
  const keywordMatch = keywords.find((keyword) =>
    /beginner|intermediate|advanced/i.test(keyword),
  );

  if (!keywordMatch) {
    return "All levels";
  }

  const normalized = keywordMatch.trim().toLowerCase();

  if (normalized.includes("beginner")) {
    return "Beginner";
  }

  if (normalized.includes("intermediate")) {
    return "Intermediate";
  }

  if (normalized.includes("advanced")) {
    return "Advanced";
  }

  return "All levels";
};

const extractKeywords = (entry) => {
  const keywordsNode = entry.querySelector("media\\:keywords");

  if (!keywordsNode) {
    return [];
  }

  return keywordsNode.textContent
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
};

const parseDurationSeconds = (entry) => {
  const durationNode = entry.querySelector("yt\\:duration");

  if (!durationNode) {
    return null;
  }

  const secondsValue = Number.parseInt(durationNode.getAttribute("seconds"), 10);
  return Number.isFinite(secondsValue) ? secondsValue : null;
};

const transformEntryToVideo = (entry, playlist, index) => {
  const videoId = entry.querySelector("yt\\:videoId")?.textContent?.trim();

  if (!videoId) {
    return null;
  }

  const keywords = extractKeywords(entry);
  const focusTags = keywords.length > 0 ? keywords : playlist.focus ? [playlist.focus] : [];
  const durationSeconds = parseDurationSeconds(entry);
  const description = entry.querySelector("media\\:description")?.textContent?.trim() ?? "";

  const publishedAt = entry.querySelector("published")?.textContent ?? null;

  return {
    id: `${playlist.id}::${videoId}`,
    videoId,
    title: entry.querySelector("title")?.textContent?.trim() ?? "Untitled session",
    description,
    focus: focusTags,
    skillLevel: deriveSkillLevel(keywords),
    durationSeconds,
    durationLabel: formatDurationFromSeconds(durationSeconds) ?? "—",
    playlistKey: playlist.id,
    playlistIndex: index,
    playlistTitle: playlist.title,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?list=${playlist.playlistId}&index=${index}`,
    publishedAt,
  };
};

const buildPlaylistFeedUrl = (playlistId) => `${feedBaseUrl}${playlistId}`;

const buildPlaylistFeedCandidates = (playlistId) => {
  const targetUrl = buildPlaylistFeedUrl(playlistId);

  if (!corsProxyBaseUrl) {
    return [targetUrl];
  }

  const candidates = [];

  if (corsProxyBaseUrl.includes("{{ENCODED_URL}}")) {
    candidates.push(corsProxyBaseUrl.replace("{{ENCODED_URL}}", encodeURIComponent(targetUrl)));
  } else if (corsProxyBaseUrl.includes("{{URL}}")) {
    candidates.push(corsProxyBaseUrl.replace("{{URL}}", targetUrl));
  } else {
    const encodedVariant = `${corsProxyBaseUrl}${encodeURIComponent(targetUrl)}`;
    candidates.push(encodedVariant);

    const rawVariant = `${corsProxyBaseUrl}${targetUrl}`;

    if (rawVariant !== encodedVariant) {
      candidates.push(rawVariant);
    }
  }

  candidates.push(targetUrl);

  return Array.from(new Set(candidates));
};

const parsePlaylistFeed = (text) => {
  if (!text || text.trim().length === 0) {
    throw new Error("Playlist feed returned no data");
  }

  const parser = new window.DOMParser();
  const document = parser.parseFromString(text, "application/xml");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    const message = parserError.textContent?.replace(/\s+/g, " ").trim();
    throw new Error(message || "Unable to parse playlist feed");
  }

  const entries = Array.from(document.getElementsByTagName("entry"));

  if (entries.length === 0) {
    throw new Error("Playlist did not include any videos");
  }

  return entries;
};

export const fetchTrainingPlaylistVideos = async (playlist) => {
  if (!playlist?.playlistId) {
    throw new Error("Playlist metadata is missing an identifier");
  }

  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    throw new Error("Cannot parse playlist feeds in the current environment");
  }

  const candidateUrls = buildPlaylistFeedCandidates(playlist.playlistId);
  let lastError = null;

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const entries = parsePlaylistFeed(await response.text());

      return entries
        .map((entry, index) => transformEntryToVideo(entry, playlist, index))
        .filter((video) => video !== null);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError?.message || `Unable to load playlist: ${playlist.title ?? playlist.id}`,
  );
};

export const trainingVideoFilters = [
  { id: "all", label: "All content" },
  { id: "saved", label: "Saved sessions" },
  {
    id: "quick",
    label: "Under 12 min",
    predicate: (video) => typeof video.durationSeconds === "number" && video.durationSeconds < 12 * 60,
  },
  {
    id: "intermediate",
    label: "Intermediate focus",
    predicate: (video) => video.skillLevel?.toLowerCase().includes("intermediate"),
  },
];
