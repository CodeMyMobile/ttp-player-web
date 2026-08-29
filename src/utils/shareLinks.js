const DEFAULT_SHARE_ORIGIN = "https://thetennisplan.com";

const SHARE_TYPE_TO_APP_ROUTE = {
  "group-lessons": "group-lessons",
  match: "matches",
  coach: "coaches",
};

function normalizeOrigin(origin) {
  const fallback =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : DEFAULT_SHARE_ORIGIN;
  return String(origin || fallback).replace(/\/+$/, "");
}

function normalizeShareId(id) {
  if (id === undefined || id === null) return null;
  const value = String(id).trim();
  return /^\d+$/.test(value) ? value : null;
}

export function isSupportedShareType(type) {
  return Object.prototype.hasOwnProperty.call(SHARE_TYPE_TO_APP_ROUTE, type);
}

/**
 * Which share types are allowed into search results.
 *
 * The test is value, not risk. A commercial shopfront benefits from being found —
 * that is the point of the page, and for a coach it is their living. Transient
 * logistics about identifiable people does not: nobody searches for a singles match
 * on a particular date, so the search value is zero while the disclosure is not, and
 * indexed pages persist — a year of match shares becomes a browsable record of when
 * and where a group plays.
 *
 * Allow-list, not a deny-list: a share type added later is NOT indexed until someone
 * makes that call deliberately.
 */
const INDEXABLE_SHARE_TYPES = new Set(["coach", "group-lessons"]);

export function isIndexableShareType(type) {
  return INDEXABLE_SHARE_TYPES.has(type);
}

export function buildGatewayShareUrl(type, id, options = {}) {
  const shareId = normalizeShareId(id);
  if (!isSupportedShareType(type) || !shareId) return "";
  return `${normalizeOrigin(options.origin)}/s/${type}/${shareId}`;
}

export function buildGroupLessonShareUrl(id, options = {}) {
  return buildGatewayShareUrl("group-lessons", id, options);
}

export function buildMatchShareUrl(id, options = {}) {
  return buildGatewayShareUrl("match", id, options);
}

export function buildCoachShareUrl(id, options = {}) {
  return buildGatewayShareUrl("coach", id, options);
}

export function buildAppHashPath(type, id) {
  const shareId = normalizeShareId(id);
  const appRoute = SHARE_TYPE_TO_APP_ROUTE[type];
  return appRoute && shareId ? `/${appRoute}/${shareId}` : "/";
}

export function buildAppRedirectUrl(type, id, options = {}) {
  return `${normalizeOrigin(options.origin)}/#${buildAppHashPath(type, id)}`;
}

// Street types, used only to confirm that what follows a number really is a street
// before we treat the number as the start of an address.
const STREET_TYPE = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|way|ln|lane|ct|court|pl|place|pkwy|parkway|hwy|highway|ter|terrace|cir|circle)\b\.?/i;

/**
 * Reduce a Google-formatted address to the venue name alone.
 *
 * Share previews are public, so the street line must not travel with them: it is
 * harmless for a public rec centre and not harmless at all if someone's stored venue
 * is their home. There is no structured venue-name column anywhere, so this derives
 * one — conservatively, returning the input unchanged when it cannot be sure.
 *
 *   "Penmar Recreation Center 1341 Lake St, Venice, CA 90291, USA" -> "Penmar Recreation Center"
 *   "Court 16 Tennis 123 Main St, Los Angeles, CA"                 -> "Court 16 Tennis"
 *   "1341 Lake St, Venice, CA"                                     -> ""   (address only)
 */
export function venueNameFromAddress(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  // Everything past the first comma is city / region / postcode / country.
  const head = text.split(",")[0].trim();

  // A bare street address with no venue name in front of it: nothing safe to show.
  if (/^\d/.test(head) && STREET_TYPE.test(head)) return "";

  // Greedy on purpose: cut at the LAST number, so venue names that contain their own
  // number ("Court 16") survive intact.
  const match = head.match(/^(.*)\s+\d+[A-Za-z]?\s+(.+)$/);
  if (match && STREET_TYPE.test(match[2]) && match[1].trim().length > 0) {
    return match[1].trim();
  }

  return head;
}

export function parseSharePath(pathname) {
  if (typeof pathname !== "string") return null;
  const match = pathname.match(/^\/s\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  const [, type, rawId] = match;
  const id = normalizeShareId(rawId);
  return isSupportedShareType(type) && id ? { type, id } : null;
}
