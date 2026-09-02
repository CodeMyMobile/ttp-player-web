const APP_ROOT_URL = "https://app.thetennisplan.com/#/";

const hasReturningUserHint = (cookie) =>
  String(cookie || "")
    .split(";")
    .some((part) => part.trim() === "tp_returning=1");

export const appRedirectUrl = ({ hash, search, cookie }) => {
  if (new URLSearchParams(search || "").get("stay") === "1") return null;

  if (String(hash || "").startsWith("#/")) {
    return `https://app.thetennisplan.com/${hash}`;
  }

  return hasReturningUserHint(cookie) ? APP_ROOT_URL : null;
};
