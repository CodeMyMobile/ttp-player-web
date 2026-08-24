import API_URL from "../constants/urls";
import { normalizeAuthToken } from "../services/authToken";
import { getAccessToken, getRefreshToken, removeTokens, storeTokens } from "./tokenHelper";

const buildEndpoint = (path: string) => {
  if (!API_URL) {
    throw new Error("API_URL is not configured");
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("/")) {
    return `${API_URL}${path}`;
  }
  return `${API_URL}/${path}`;
};

const buildAuthHeader = (token?: string | null) =>
  normalizeAuthToken(token, { defaultScheme: "token", preferScheme: "token" }) ?? undefined;

export const apiRequest = async (url: string, options: RequestInit = {}) => {
  let accessToken = await getAccessToken();

  const headers = new Headers(options.headers ?? {});
  const authHeaderValue = buildAuthHeader(accessToken);
  if (authHeaderValue) {
    headers.set("Authorization", authHeaderValue);
  }

  const endpoint = buildEndpoint(url);
  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  let response = await fetch(endpoint, fetchOptions);

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      await removeTokens();
      return response;
    }
    accessToken = refreshed.access_token;
    const refreshedHeader = buildAuthHeader(accessToken);
    if (refreshedHeader) {
      headers.set("Authorization", refreshedHeader);
    }
    response = await fetch(endpoint, { ...fetchOptions, headers });
  }

  return response;
};

const refreshAccessToken = async () => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_URL}/auth/refresh-token`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: buildAuthHeader(refreshToken) ?? "",
    },
  });

  if (!response.ok) {
    await removeTokens();
    return null;
  }

  const data = await response.json();
  if (data?.access_token) {
    await storeTokens(data.access_token, data.refresh_token);
  }
  return data;
};

export default apiRequest;
