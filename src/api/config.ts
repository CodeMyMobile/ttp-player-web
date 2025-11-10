const DEFAULT_API_BASE_URL = "https://ttp-api.codemymobile.com/api/";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  DEFAULT_API_BASE_URL;

export const DEFAULT_AUTH_SCHEME = "token";
