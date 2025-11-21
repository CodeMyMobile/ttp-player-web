const collapseRepeatedScheme = (scheme, value) => {
  if (!scheme || !value) return value?.trim() || "";
  const pattern = new RegExp(String.raw`^${scheme}\s+`, "i");
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

  // When a preference is provided, honor it even if the stored token already has a scheme.
  if (normalizedPrefer) {
    return normalizedPrefer;
  }

  if (normalizedDetected) {
    return normalizedDetected;
  }

  return canonicalizeScheme(defaultScheme);
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
  try {
    const stored = localStorage.getItem("authToken");
    const session = sessionStorage.getItem("authToken");
    return normalizeAuthToken(stored ?? session, options);
  } catch {
    return null;
  }
};
