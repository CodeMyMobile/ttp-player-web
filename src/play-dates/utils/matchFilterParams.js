// Pure mappers from URL query-param values to the Match Play browse screen's
// internal filter representations.
//
// The browse screen stores filters as Title Case label strings (e.g. "Singles",
// "Men's") and a numeric distance, while shareable URLs use lowercase slugs
// (e.g. ?format=singles&distance=10). Each mapper returns the internal value
// when the param is present and valid, or null when it is absent/invalid — the
// caller then applies the existing useState default. Kept dependency-free so it
// can be unit tested in isolation with `node --test`.

const LEVEL_VALUES = new Set(["2.5", "3.0", "3.5", "4.0", "4.5+"]);

export const levelFromParam = (raw) => {
  if (raw == null) return null;
  const value = String(raw).trim();
  // The top NTRP bucket is "4.5+" internally; URLs express it as 4.5.
  if (value === "4.5" || value === "4.5+") return "4.5+";
  return LEVEL_VALUES.has(value) ? value : null;
};

const FORMAT_MAP = {
  singles: "Singles",
  doubles: "Doubles",
  "round-robin": "Round Robin",
  dingles: "Dingles",
  other: "Other",
};

export const formatFromParam = (raw) => {
  if (raw == null) return null;
  const key = String(raw).trim().toLowerCase();
  return FORMAT_MAP[key] ?? null;
};

const GENDER_MAP = {
  mens: "Men's",
  womens: "Women's",
  mixed: "Mixed",
};

export const genderFromParam = (raw) => {
  if (raw == null) return null;
  const key = String(raw).trim().toLowerCase();
  return GENDER_MAP[key] ?? null;
};

const DISTANCE_VALUES = new Set([5, 10, 20, 50]);

export const distanceFromParam = (raw) => {
  if (raw == null) return null;
  const value = Number(String(raw).trim());
  return DISTANCE_VALUES.has(value) ? value : null;
};

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// `day=all` clears the day filter ("" = whole week). A YYYY-MM-DD only seeds the
// filter when it matches one of the day-strip keys currently rendered, so a
// well-formed but off-strip date never filters the list to an empty state.
export const dayFromParam = (raw, validDayKeys = []) => {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (value.toLowerCase() === "all") return "";
  if (!DAY_KEY_PATTERN.test(value)) return null;
  return validDayKeys.includes(value) ? value : null;
};
