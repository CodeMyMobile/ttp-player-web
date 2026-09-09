/**
 * Reads an in-app destination from a `?next=` query string.
 *
 * Only a same-app absolute path is accepted. Anything that could leave the origin is
 * dropped rather than corrected: a scheme, a protocol-relative `//host`, or a backslash,
 * which some browsers normalise to `/` and which is the usual way an open redirect slips
 * past a bare `startsWith("/")` check. This value arrives from a URL a stranger can craft,
 * and the page it gates is the one that has just issued a session.
 *
 * Lives here rather than inline in LoginPage so it can be tested without rendering.
 */
export const readNextParam = (search?: string | null): string | null => {
  let next: string | null;
  try {
    next = new URLSearchParams(search ?? "").get("next");
  } catch {
    return null;
  }
  if (!next) return null;

  let decoded = next;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    // A malformed escape means we cannot know what it resolves to; keep the raw value and
    // let the checks below reject it if it is not a plain path.
  }

  const trimmed = decoded.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\")) return null;
  return trimmed;
};
