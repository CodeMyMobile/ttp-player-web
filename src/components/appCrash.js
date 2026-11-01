// What the crash screen shows and reports. Pure, so it can be tested without React.
//
// Privacy, as for all analytics (see utils/analytics.ts): nothing about the player. The route
// is reduced to its pattern (ids become ":id"), and component names are code, not data.

const MAX_MESSAGE = 300;
const MAX_COMPONENTS = 6;

/** "#/matches/477/invite?x=1" -> "/matches/:id/invite" */
export const routePattern = (hash = "") => {
  const path = String(hash).replace(/^#/, "").split("?")[0] || "/";
  return path
    .split("/")
    .map((segment) => (/\d/.test(segment) || segment.length > 24 ? ":id" : segment))
    .join("/");
};

/** The innermost components named in React's component stack, closest first. */
export const crashComponents = (componentStack = "") =>
  String(componentStack)
    .split("\n")
    .map((line) => line.trim().match(/^at ([A-Z][A-Za-z0-9_$]*)/)?.[1] || null)
    .filter(Boolean)
    .slice(0, MAX_COMPONENTS);

export const crashMessage = (error) => {
  const text = error && typeof error === "object" ? `${error.name || "Error"}: ${error.message || ""}` : String(error);
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE)}…` : text;
};

/** The details a player can copy or screenshot for support. */
export const crashDetails = ({ error, componentStack, hash, at = new Date(), userAgent = "" }) =>
  [
    crashMessage(error),
    `Page: ${routePattern(hash)}`,
    `In: ${crashComponents(componentStack).join(" < ") || "unknown"}`,
    `When: ${at.toISOString()}`,
    userAgent ? `Browser: ${userAgent}` : null,
  ]
    .filter(Boolean)
    .join("\n");

/** The analytics event's properties. */
export const crashEventProps = ({ error, componentStack, hash }) => ({
  message: crashMessage(error),
  route: routePattern(hash),
  components: crashComponents(componentStack).join(" < ") || null,
});
