import { API_BASE_URL } from "../api/config";

const normalizeBaseUrl = (base: string) => {
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export const API_URL = normalizeBaseUrl(API_BASE_URL);

export default API_URL;
