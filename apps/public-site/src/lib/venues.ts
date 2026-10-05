import venueData from "../data/venues.json" with { type: "json" };

export type Venue = {
  name: string;
  area: string;
};

export const VENUES: Record<string, Venue> = venueData.venues as Record<string, Venue>;

/**
 * Venues considered and deliberately left out — unverified access, or outside West LA.
 * Separate from the allowlist so a maintainer can tell "not looked at yet" from "looked
 * at and rejected", and so the build only warns about the first kind.
 */
export const EXCLUDED_VENUES: Record<string, string> = {
  ...((venueData as Record<string, unknown>)._excluded_unverified as Record<string, string>),
  ...((venueData as Record<string, unknown>)._excluded_outside_area as Record<string, string>),
};

/** True when a dropped label was dropped on purpose. */
export const isDeliberatelyExcluded = (normalisedLabel: string): boolean =>
  Boolean(EXCLUDED_VENUES[normalisedLabel]);

export const normalizeVenueLabel = (raw: string) => {
  const head = raw.split(",")[0]?.trim() ?? "";
  const genericCourt = /\bTennis\s+Courts?\b/i.exec(head);
  if (genericCourt) return head.slice(0, genericCourt.index).trim();
  const street = /\s\d/.exec(head);
  return street ? head.slice(0, street.index).trim() : head;
};

/**
 * Display names for area slugs.
 *
 * A map, not a transform. Title-casing the slug produces "West La" and
 * "Marina Del Rey" — the first is wrong because LA is an initialism, the second
 * because "del" is a lowercase particle in the place's actual name. No general rule
 * derives both from their slugs, and the next area added will have its own exception.
 *
 * Drives the chips, the area-page H1, and the courts section headings, so all three
 * agree by construction rather than by three copies of the same casing logic.
 */
const AREA_LABELS: Record<string, string> = {
  brentwood: "Brentwood",
  "cheviot-hills": "Cheviot Hills",
  "culver-city": "Culver City",
  "mar-vista": "Mar Vista",
  "marina-del-rey": "Marina del Rey",
  "santa-monica": "Santa Monica",
  venice: "Venice",
  "west-la": "West LA",
  westwood: "Westwood",
};

/**
 * Falls back to title case for a slug nobody has named yet — wrong-looking rather than
 * blank, so a missing entry is visible on the page instead of silently empty.
 */
export const areaLabel = (area: string): string =>
  AREA_LABELS[area] ??
  area
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

/**
 * A location that names an area rather than a court — a coach whose location is just
 * "Marina del Rey". Coaches are not required to name a specific court, so these place the
 * coach in that area and show the area name where a court would go.
 *
 * Exact name only (any case, "Marina Del Rey" too). A street address that happens to be in
 * the area is not matched: normalizeVenueLabel cuts it at the house number, and a home
 * address must never place a coach on a public page.
 */
export const areaVenueForLabel = (normalisedLabel: string): Venue | null => {
  const wanted = normalisedLabel.trim().toLowerCase();
  if (!wanted) return null;
  const area = Object.keys(AREA_LABELS).find((slug) => AREA_LABELS[slug].toLowerCase() === wanted);
  return area ? { name: AREA_LABELS[area], area } : null;
};

/** Every slug that has a display name — the source for any generated list of areas. */
export const knownAreaSlugs = (): string[] => Object.keys(AREA_LABELS);
