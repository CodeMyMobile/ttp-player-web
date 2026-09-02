const hasCookie = (cookie, name, value) =>
  String(cookie || "")
    .split(";")
    .some((part) => part.trim() === `${name}=${value}`);

export const shouldRedirectReturningUser = ({ pathname, search, cookie }) => {
  if (pathname !== "/") return false;

  const searchParams = new URLSearchParams(search || "");
  if (searchParams.get("stay") === "1") return false;

  return hasCookie(cookie, "tp_returning", "1");
};

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
