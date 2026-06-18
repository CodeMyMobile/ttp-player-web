import { buildApiUrl } from "../api/config";
import { getStoredAuthToken, normalizeAuthToken } from "./authToken";

const api = (path, options = {}) => {
  const {
    headers: optionHeaders = {},
    body: providedBody,
    json,
    authSchemePreference = "token",
    authToken,
    credentials: providedCredentials,
    ...rest
  } = options;

  const hasAuthTokenOption = Object.prototype.hasOwnProperty.call(
    options,
    "authToken",
  );
  const token = hasAuthTokenOption
    ? normalizeAuthToken(authToken, { preferScheme: authSchemePreference })
    : getStoredAuthToken({ preferScheme: authSchemePreference });

  const headers = {
    Accept: "application/json",
    ...optionHeaders,
  };

  let body = providedBody;

  if (json !== undefined) {
    body = JSON.stringify(json);
    if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }
  }

  const hasBody = body !== undefined && body !== null && body !== "";
  const isStringBody = typeof body === "string";
  if (
    hasBody &&
    isStringBody &&
    json === undefined &&
    !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
  ) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers.Authorization = token;
  const url = buildApiUrl(path);
  // Default to no cookies to avoid CORS credential restrictions unless explicitly requested
  const credentials = providedCredentials ?? "omit";
  return fetch(url, {
    ...rest,
    credentials,
    headers,
    ...(hasBody ? { body } : {}),
  });
};

const getErrorMessage = (payload, fallback) => {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (!payload || typeof payload !== "object") return fallback;

  const candidates = [payload.detail, payload.message, payload.error];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
    if (candidate && typeof candidate === "object") {
      if (typeof candidate.message === "string" && candidate.message.trim()) {
        return candidate.message;
      }
      if (typeof candidate.detail === "string" && candidate.detail.trim()) {
        return candidate.detail;
      }
    }
  }

  return fallback;
};

export const unwrap = (p) =>
  p.then(async (r) => {
    let data = null;
    try {
      data = await r.json();
    } catch {
      // ignore non-JSON responses
    }
    if (!r.ok) {
      const msg = getErrorMessage(data, r.statusText || "API_ERROR");
      const error = new Error(msg);
      error.status = r.status;
      error.data = data;
      error.response = {
        data,
        status: r.status,
        statusText: r.statusText,
      };
      throw error;
    }
    return data;
  });

export default api;
