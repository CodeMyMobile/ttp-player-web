// Helpers for "Share my profile" and the public /p/:slug page. Plain JS so they can be
// tested with node --test.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REF_STORAGE_KEY = "ttp:profile-ref";
// A saved referral older than this is dropped rather than credited.
const REF_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeProfileSlug(value) {
  const slug = String(value ?? "").trim().toLowerCase();
  return slug.length <= 64 && SLUG.test(slug) ? slug : null;
}

/**
 * The link people share. A real path, not a #/ route: link-preview crawlers never see
 * the fragment, and the edge function at /p/* serves the preview and forwards on.
 */
export function buildProfileUrl(slug, origin) {
  const clean = normalizeProfileSlug(slug);
  if (!clean) return "";
  const base =
    origin || (typeof window !== "undefined" && window.location?.origin) || "https://app.thetennisplan.com";
  return `${String(base).replace(/\/+$/, "")}/p/${clean}`;
}

/** "Penmar & Fox Hills", or "Penmar, Fox Hills & Mar Vista". */
export function joinCourts(courts = []) {
  const names = courts.filter(Boolean);
  if (names.length <= 1) return names[0] || "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** "Want to hit? Here's my Tennis Plan profile (4.5, usually at Penmar & Fox Hills)". */
export function buildShareText({ rating, homeCourts } = {}) {
  const courts = joinCourts(homeCourts || []);
  const details = [rating, courts ? `usually at ${courts}` : ""].filter(Boolean).join(", ");
  return `Want to hit? Here's my Tennis Plan profile${details ? ` (${details})` : ""}`;
}

/** Remembers which profile link a signed-out visitor came from, for after they sign up. */
export function rememberProfileRef(slug, storage = globalThis.localStorage, now = Date.now()) {
  const clean = normalizeProfileSlug(slug);
  if (!clean || !storage) return;
  try {
    storage.setItem(REF_STORAGE_KEY, JSON.stringify({ ref: clean, at: now }));
  } catch {
    // Storage blocked (private mode): the referral just isn't credited.
  }
}

export function readProfileRef(storage = globalThis.localStorage, now = Date.now()) {
  if (!storage) return null;
  try {
    const saved = JSON.parse(storage.getItem(REF_STORAGE_KEY) || "null");
    const ref = normalizeProfileSlug(saved?.ref);
    if (!ref || !(now - Number(saved.at) <= REF_MAX_AGE_MS)) return null;
    return ref;
  } catch {
    return null;
  }
}

export function forgetProfileRef(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(REF_STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
