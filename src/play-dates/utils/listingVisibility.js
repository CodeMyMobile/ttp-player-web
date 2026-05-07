const LINK_ONLY_VALUES = new Set([
  "link_only",
  "link-only",
  "link only",
  "linkonly",
  "unlisted",
  "hidden",
  "url-only",
  "url_only",
  "url only",
]);

const LISTED_VALUES = new Set([
  "listed",
  "public",
  "open",
  "visible",
  "default",
  "public_listed",
  "public-listed",
  "public listed",
]);

const HIDDEN_KEYS = [
  "hidden",
  "is_hidden",
  "isHidden",
  "linkOnly",
  "link_only",
  "linkOnlyMatch",
  "link_only_match",
  "linkonly",
  "visibilityHidden",
  "visibility_hidden",
];

const normalizeListingVisibility = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") {
    return value ? "listed" : "link_only";
  }
  if (typeof value === "number") {
    if (value === 0) return "link_only";
    if (value === 1) return "listed";
  }
  const stringValue = value.toString().trim().toLowerCase();
  if (!stringValue) return "";
  if (stringValue === "0") return "link_only";
  if (stringValue === "1") return "listed";
  if (stringValue === "false") return "link_only";
  if (stringValue === "true") return "listed";
  if (LINK_ONLY_VALUES.has(stringValue)) return "link_only";
  if (LISTED_VALUES.has(stringValue)) return "listed";
  return stringValue;
};

const LISTING_KEYS = [
  "listing_visibility",
  "listingVisibility",
  "visibility",
  "visibility_status",
  "visibilityStatus",
  "listing_status",
  "listingStatus",
  "listing",
  "match_visibility",
  "matchVisibility",
  "public_listing",
  "publicListing",
];

const BOOLEAN_KEYS = ["is_listed", "listed", "public", "isPublic", "is_listed_public"];

const NESTED_KEYS = [
  "match",
  "meta",
  "context",
  "details",
  "settings",
  "data",
  "attributes",
  "payload",
];

const interpretHiddenValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 0) return false;
    if (value === 1) return true;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === "0") return false;
    if (normalized === "1") return true;
    if (normalized === "false" || normalized === "no") return false;
    if (normalized === "true" || normalized === "yes") return true;
    if (LISTED_VALUES.has(normalized)) return false;
    if (LINK_ONLY_VALUES.has(normalized)) return true;
  }
  return null;
};

const deriveListingVisibilityFromObject = (object) => {
  if (!object || typeof object !== "object") return "";
  for (const key of HIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      const interpreted = interpretHiddenValue(object[key]);
      if (interpreted === true) return "link_only";
      if (interpreted === false) return "listed";
    }
  }
  for (const key of LISTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      const normalized = normalizeListingVisibility(object[key]);
      if (normalized) return normalized;
    }
  }
  for (const key of BOOLEAN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      const normalized = normalizeListingVisibility(object[key]);
      if (normalized) return normalized;
    }
  }
  return "";
};

const deriveListingVisibility = (...sources) => {
  const queue = [...sources];
  while (queue.length > 0) {
    const source = queue.shift();
    if (source === undefined || source === null) continue;
    if (typeof source === "string" || typeof source === "number" || typeof source === "boolean") {
      const normalized = normalizeListingVisibility(source);
      if (normalized) return normalized;
      continue;
    }
    if (Array.isArray(source)) {
      queue.unshift(...source);
      continue;
    }
    if (typeof source === "object") {
      const direct = deriveListingVisibilityFromObject(source);
      if (direct) return direct;
      for (const nestedKey of NESTED_KEYS) {
        if (Object.prototype.hasOwnProperty.call(source, nestedKey)) {
          queue.unshift(source[nestedKey]);
        }
      }
    }
  }
  return "";
};

const isLinkOnlyVisibility = (...sources) => {
  if (sources.length === 1 && typeof sources[0] === "string") {
    return normalizeListingVisibility(sources[0]) === "link_only";
  }
  const visibility = deriveListingVisibility(...sources);
  return normalizeListingVisibility(visibility) === "link_only";
};

export { normalizeListingVisibility, deriveListingVisibility, isLinkOnlyVisibility };
