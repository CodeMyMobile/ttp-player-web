import { buildApiUrl } from "./config";

const normalizeTokenHeader = (token?: string | null) => {
  if (!token) return undefined;
  if (/^\s*([A-Za-z]+)\s+/i.test(token)) return token;
  return `token ${token}`;
};

export const getReverseCodeLocation = async (
  latitude: number,
  longitude: number,
  token?: string | null,
) => {
  if (!latitude || !longitude) {
    throw new Error("Latitude and longitude are required");
  }

  const url = buildApiUrl(`/reverse-geocode?latitude=${latitude}&longitude=${longitude}`);
  const headers: Record<string, string> = {};
  const authHeader = normalizeTokenHeader(token);
  if (authHeader) headers.Authorization = authHeader;

  return fetch(url, {
    method: "GET",
    headers,
  });
};
