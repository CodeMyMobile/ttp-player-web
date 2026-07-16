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

export function parseSharePath(pathname) {
  if (typeof pathname !== "string") return null;
  const match = pathname.match(/^\/s\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  const [, type, rawId] = match;
  const id = normalizeShareId(rawId);
  return isSupportedShareType(type) && id ? { type, id } : null;
}

function compactShareMessage(text, url) {
  return [text, url].map(item => String(item || "").trim()).filter(Boolean).join(" ");
}

export function buildSocialShareTargets({ title = "", text = "", url = "" } = {}) {
  const message = compactShareMessage(text, url);
  const encodedMessage = encodeURIComponent(message);
  return {
    sms: `sms:?&body=${encodedMessage}`,
    whatsapp: `https://wa.me/?text=${encodedMessage}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodedMessage}`,
  };
}
