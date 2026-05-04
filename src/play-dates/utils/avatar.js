const PROFILE_IMAGE_KEYS = [
  "profile_picture",
  "profilePicture",
  "profile_picture_url",
  "profilePictureUrl",
  "profile_photo",
  "profilePhoto",
  "profile_image",
  "profileImage",
  "profile_image_url",
  "profileImageUrl",
  "photo_url",
  "photoUrl",
  "image_url",
  "imageUrl",
  "avatar_url",
  "avatarUrl",
  "avatar",
  "host_avatar",
  "hostAvatar",
  "picture",
  "photo",
];

const NESTED_IMAGE_KEYS = ["url", "href", "link", "src", "value", "original", "full"];

const sanitizeBaseUrl = (value) => {
  if (!value) return "";
  const str = typeof value === "string" ? value.trim() : String(value).trim();
  if (!str) return "";
  const normalized = /^https?:\/\//i.test(str)
    ? str
    : `https://${str.replace(/^\/+/, "")}`;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
};

const IMPORT_META_ENV = (() => {
  try {
    return import.meta?.env || {};
  } catch {
    return {};
  }
})();

const ENV_PROFILE_BASE_URL = (() => {
  const candidates = [
    IMPORT_META_ENV.VITE_PLAYER_PROFILE_BASE_URL,
    IMPORT_META_ENV.VITE_PLAYER_PORTAL_URL,
    IMPORT_META_ENV.VITE_PLAYER_APP_URL,
    IMPORT_META_ENV.VITE_APP_BASE_URL,
    IMPORT_META_ENV.VITE_APP_URL,
    IMPORT_META_ENV.VITE_API_BASE_URL,
    IMPORT_META_ENV.VITE_API_URL,
  ];
  for (const candidate of candidates) {
    const sanitized = sanitizeBaseUrl(candidate);
    if (sanitized) return sanitized;
  }
  return "";
})();

let cachedAvatarBaseUrl;

const resolveAvatarBaseUrl = () => {
  if (cachedAvatarBaseUrl !== undefined) return cachedAvatarBaseUrl;

  if (ENV_PROFILE_BASE_URL) {
    cachedAvatarBaseUrl = ENV_PROFILE_BASE_URL;
    return cachedAvatarBaseUrl;
  }

  if (typeof window !== "undefined") {
    const overrides = [
      window.__TTP_PLAYER_PROFILE_BASE_URL__,
      window.__PLAYER_PROFILE_BASE_URL__,
      window.__MATCH_PLAYER_PROFILE_BASE_URL__,
      window.__MATCHPLAY_ASSET_BASE_URL__,
      window.location?.origin,
    ];
    for (const override of overrides) {
      const sanitized = sanitizeBaseUrl(override);
      if (sanitized) {
        cachedAvatarBaseUrl = sanitized;
        return cachedAvatarBaseUrl;
      }
    }
  }

  cachedAvatarBaseUrl = "";
  return cachedAvatarBaseUrl;
};

const resolveAbsoluteUrl = (value) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate.length < 3) return "";

  if (/^data:/i.test(candidate)) {
    return candidate;
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  if (candidate.startsWith("//")) {
    return `https:${candidate}`;
  }

  const baseUrl = resolveAvatarBaseUrl();
  if (baseUrl) {
    try {
      return new URL(candidate, `${baseUrl}/`).toString();
    } catch {
      // fall through to return candidate as-is below
    }
  }

  if (candidate.startsWith("/")) {
    return candidate;
  }

  if (candidate.includes("/") || candidate.includes(".")) {
    return candidate;
  }

  return "";
};

const toNonEmptyString = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return "";
};

const normalizeAvatarUrl = (value) => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeAvatarUrl(entry);
      if (normalized) return normalized;
    }
    return "";
  }

  if (value && typeof value === "object") {
    for (const key of NESTED_IMAGE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const normalized = normalizeAvatarUrl(value[key]);
      if (normalized) return normalized;
    }
    return "";
  }

  const candidate = toNonEmptyString(value);
  if (!candidate) return "";
  return resolveAbsoluteUrl(candidate);
};

export const getProfileImageFromSource = (source) => {
  if (!source || typeof source !== "object") return "";
  for (const key of PROFILE_IMAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const candidate = normalizeAvatarUrl(source[key]);
    if (candidate) {
      return candidate;
    }
  }
  return "";
};

export const getAvatarUrlFromPlayer = (player) => {
  if (!player || typeof player !== "object") return "";
  const sources = [player.profile, player.player, player.user, player];
  for (const source of sources) {
    const url = getProfileImageFromSource(source);
    if (url) return url;
  }
  return "";
};

export const getAvatarInitials = (name, fallback) => {
  const source = (name || fallback || "").trim();
  if (!source) return "MP";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
