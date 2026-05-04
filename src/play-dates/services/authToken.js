const collapseRepeatedScheme = (scheme, value) => {
  if (!scheme || !value) return value?.trim() || "";
  const pattern = new RegExp(`^${scheme}\\s+`, "i");
  let trimmed = value.trim();
  while (pattern.test(trimmed)) {
    trimmed = trimmed.replace(pattern, "").trim();
  }
  return trimmed;
};

const canonicalizeScheme = (scheme) => {
  if (!scheme) return "";
  const lower = scheme.trim().toLowerCase();
  if (!lower) return "";
  if (lower === "bearer") return "Bearer";
  if (lower === "token") return "Token";
  return scheme.trim();
};

const pickScheme = (detected, { defaultScheme, preferScheme } = {}) => {
  const normalizedDetected = canonicalizeScheme(detected);
  const normalizedPrefer = canonicalizeScheme(preferScheme);
  if (normalizedDetected) {
    if (normalizedPrefer && normalizedPrefer === normalizedDetected) {
      return normalizedPrefer;
    }
    return normalizedDetected;
  }
  if (normalizedPrefer) {
    return normalizedPrefer;
  }
  return canonicalizeScheme(defaultScheme);
};

const canUseBrowserApis = () => typeof window !== "undefined" && typeof document !== "undefined";

const isLikelyIpAddress = (hostname) => /^(\d+\.){3}\d+$/.test(hostname);

const buildCookieDomains = () => {
  if (!canUseBrowserApis()) return [undefined];
  const { hostname } = window.location;
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return [undefined];
  }
  if (hostname === "[::1]" || isLikelyIpAddress(hostname)) {
    return [undefined];
  }

  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 1) {
    return [undefined];
  }

  const domains = new Set([undefined]);
  for (let i = 0; i <= parts.length - 2; i += 1) {
    const candidate = parts.slice(i).join(".");
    if (!candidate || !candidate.includes(".")) continue;
    domains.add(`.${candidate}`);
  }
  return Array.from(domains);
};

const secureCookieEnabled = () => {
  if (!canUseBrowserApis()) return false;
  return window.location.protocol === "https:";
};

const setCookieForDomain = (name, value, { domain, maxAgeDays = 30 } = {}) => {
  if (!canUseBrowserApis()) return;
  const encodedValue = encodeURIComponent(value);
  const path = "/";
  const sameSite = "Lax";
  const secureFlag = secureCookieEnabled() ? "; Secure" : "";
  const expires = new Date(Date.now() + maxAgeDays * 24 * 60 * 60 * 1000);
  const parts = [
    `${name}=${encodedValue}`,
    `Path=${path}`,
    `Expires=${expires.toUTCString()}`,
    `SameSite=${sameSite}`,
  ];
  if (domain) {
    parts.push(`Domain=${domain}`);
  }
  const cookieString = `${parts.join("; ")}${secureFlag}`;
  document.cookie = cookieString;
};

const clearCookieForDomain = (name, { domain } = {}) => {
  if (!canUseBrowserApis()) return;
  const parts = [
    `${name}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "SameSite=Lax",
  ];
  if (domain) {
    parts.push(`Domain=${domain}`);
  }
  const secureFlag = secureCookieEnabled() ? "; Secure" : "";
  document.cookie = `${parts.join("; ")}${secureFlag}`;
};

const readCookie = (name) => {
  if (!canUseBrowserApis()) return null;
  const cookies = (document.cookie || "").split(";");
  for (const cookie of cookies) {
    if (!cookie) continue;
    const [rawName, ...rest] = cookie.split("=");
    if (!rawName) continue;
    if (rawName.trim() !== name) continue;
    const value = rest.join("=");
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
};

const broadcastStorageUpdate = (key, value) => {
  if (!canUseBrowserApis()) return;
  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: value,
        storageArea: window.localStorage,
      }),
    );
  } catch {
    // Ignore browsers that don't allow manual StorageEvent dispatch
  }
};

const storeValue = (key, value, { maxAgeDays } = {}) => {
  if (!value) return;
  const trimmed = String(value).trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(key, trimmed);
  } catch {
    // ignore storage errors
  }
  for (const domain of buildCookieDomains()) {
    setCookieForDomain(key, trimmed, { domain, maxAgeDays });
  }
  broadcastStorageUpdate(key, trimmed);
};

const clearValue = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  for (const domain of buildCookieDomains()) {
    clearCookieForDomain(key, { domain });
  }
  broadcastStorageUpdate(key, null);
};

const getStoredValue = (key) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return stored;
  } catch {
    // ignore storage read errors
  }
  return readCookie(key);
};

export const normalizeAuthToken = (
  token,
  { defaultScheme = "Bearer", preferScheme } = {},
) => {
  if (token === null || token === undefined) return null;
  const raw = String(token).trim();
  if (!raw) return null;

  let scheme = null;
  let credentials = raw;

  const match = raw.match(/^([A-Za-z]+)\s+(.+)$/);
  if (match) {
    const [, detectedScheme, rest] = match;
    scheme = detectedScheme;
    credentials = collapseRepeatedScheme(detectedScheme, rest);
  }

  credentials = credentials.trim();
  if (!credentials) return null;

  const finalScheme = pickScheme(scheme, { defaultScheme, preferScheme });
  if (!finalScheme) {
    return credentials;
  }

  return `${finalScheme} ${credentials}`;
};

export const getStoredAuthToken = (options) => {
  const stored = getStoredValue("authToken");
  return normalizeAuthToken(stored, options);
};

export const getStoredRefreshToken = () => getStoredValue("refreshToken");

export const storeAuthToken = (token, options = {}) =>
  storeValue("authToken", token, options);

export const storeRefreshToken = (token, options = {}) =>
  storeValue("refreshToken", token, options);

export const clearStoredAuthToken = () => clearValue("authToken");

export const clearStoredRefreshToken = () => clearValue("refreshToken");
