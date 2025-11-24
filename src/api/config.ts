const DEFAULT_API_BASE_URL = "https://ttp-api.codemymobile.com/api";

const normalizeBaseUrl = (base?: string) => {
  if (!base) return "";
  return base.replace(/\/+$/, "");
};

const rawBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  DEFAULT_API_BASE_URL;

export const API_BASE_URL = normalizeBaseUrl(rawBaseUrl) || DEFAULT_API_BASE_URL;

export const buildApiUrl = (path: string) => {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const DEFAULT_AUTH_SCHEME = "token";
