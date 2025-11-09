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

const buildProxiedFeedUrl = (playlistId) => {
  const targetUrl = buildPlaylistFeedUrl(playlistId);

  if (!corsProxyBaseUrl) {
    return targetUrl;
  }

  if (corsProxyBaseUrl.includes("{{ENCODED_URL}}")) {
    return corsProxyBaseUrl.replace("{{ENCODED_URL}}", encodeURIComponent(targetUrl));
  }

  if (corsProxyBaseUrl.includes("{{URL}}")) {
    return corsProxyBaseUrl.replace("{{URL}}", targetUrl);
  }

  const shouldEncode = /[=&]$/.test(corsProxyBaseUrl);
  return `${corsProxyBaseUrl}${shouldEncode ? encodeURIComponent(targetUrl) : targetUrl}`;
};

export const fetchTrainingPlaylistVideos = async (playlist) => {
  if (!playlist?.playlistId) {
    throw new Error("Playlist metadata is missing an identifier");
  }

  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    throw new Error("Cannot parse playlist feeds in the current environment");
  }

  const response = await fetch(buildProxiedFeedUrl(playlist.playlistId));

  if (!response.ok) {
    throw new Error(`Failed to load playlist: ${playlist.title ?? playlist.id}`);
  }

  const text = await response.text();
  const parser = new window.DOMParser();
  const document = parser.parseFromString(text, "application/xml");
  const entries = Array.from(document.getElementsByTagName("entry"));

  return entries
    .map((entry, index) => transformEntryToVideo(entry, playlist, index))
    .filter((video) => video !== null);
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
