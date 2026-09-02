const RETURNING_USER_COOKIE = "tp_returning";
const RETURNING_USER_DOMAIN = ".thetennisplan.com";
const NINETY_DAYS_IN_SECONDS = 60 * 60 * 24 * 90;

const writeReturningUserCookie = (value, maxAge) => {
  if (typeof document === "undefined") return;

  document.cookie = [
    `${RETURNING_USER_COOKIE}=${value}`,
    `Domain=${RETURNING_USER_DOMAIN}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    "Secure",
  ].join("; ");
};

export const setReturningUserHint = () => {
  writeReturningUserCookie("1", NINETY_DAYS_IN_SECONDS);
};

export const clearReturningUserHint = () => {
  writeReturningUserCookie("", 0);
};
