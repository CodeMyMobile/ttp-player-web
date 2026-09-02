export const withCookieSensitiveHeaders = (sourceHeaders) => {
  const headers = new Headers(sourceHeaders);
  const existingVary = headers.get("vary");
  const varyValues = existingVary ? existingVary.split(",").map((value) => value.trim()).filter(Boolean) : [];

  if (!varyValues.some((value) => value.toLowerCase() === "cookie")) {
    varyValues.push("Cookie");
  }

  headers.set("vary", varyValues.join(", "));
  headers.set("cache-control", "no-store");
  return headers;
};

export const withLegacySessionCookieCleanup = (sourceHeaders) => {
  const headers = new Headers(sourceHeaders);
  for (const name of ["authToken", "refreshToken"]) {
    headers.append(
      "set-cookie",
      `${name}=; Domain=.thetennisplan.com; Path=/; Max-Age=0; SameSite=Lax; Secure`,
    );
  }
  return headers;
};
