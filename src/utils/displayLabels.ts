// Shared display-label humanizers.
// Extracted verbatim from FindCoaches.tsx so the Coach Recommendations page can reuse
// the exact same normalization (no behavior change to Find a Coach).

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  zh: "Chinese",
};

export const toTitleCase = (value: string) =>
  value
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

export const normalizeDisplayLabel = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  if (LANGUAGE_LABELS[lower]) return LANGUAGE_LABELS[lower];
  if (lower === "semi") return "Semi-Private";
  if (lower === "semi private") return "Semi-Private";
  if (lower === "weekday_mornings") return "Weekday Mornings";
  if (lower === "weekday_afternoons") return "Weekday Afternoons";
  if (lower === "weekday_evenings") return "Weekday Evenings";

  return toTitleCase(normalized);
};

export const normalizeDisplayArray = (values: string[]) =>
  values
    .map((value) => normalizeDisplayLabel(value))
    .filter(Boolean);
