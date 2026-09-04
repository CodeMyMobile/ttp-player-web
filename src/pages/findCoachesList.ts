/**
 * Filtering, sorting and grouping for the /find-coaches list.
 *
 * Kept out of the page component because these are the parts most likely to break
 * quietly: the chip mapping compares against a vocabulary nobody owns, and the divider
 * depends on the list already being distance-ordered.
 *
 * All client-side. The search endpoint takes a radius and a name search and nothing else
 * (see COACH_SEARCH_API_FINDINGS.md), and the whole roster is ~30 coaches, so filtering
 * and sorting here costs nothing and avoids an API round trip per chip.
 */

export type CoachSortKey = "nearest" | "price-low" | "students-high";

export interface CoachSortOption {
  key: CoachSortKey;
  label: string;
}

/** Order matters: the first is the default. */
export const COACH_SORT_OPTIONS: CoachSortOption[] = [
  { key: "nearest", label: "Nearest" },
  { key: "price-low", label: "Lowest price" },
  { key: "students-high", label: "Most students" },
];

export type CoachChipKey = "juniors" | "beginners" | "groups";

/**
 * The shape the chips read. A subset of the page's card model, so this file does not
 * depend on the whole of it.
 */
export interface CoachChipSource {
  specialties?: string[];
  levels?: string[];
  formats?: string[];
}

export interface CoachListItem extends CoachChipSource {
  distanceMiles?: number | null;
  hourlyRateValue?: number | null;
  studentCount?: number | null;
  availabilityWindows?: string[];
}

/**
 * Chip → field mapping.
 *
 * Compared case-insensitively on purpose. The API returns these lowercase — `juniors`,
 * `beginner`, `group` — but the page runs every specialty, level and format through
 * normalizeDisplayLabel, which title-cases them, so the card model holds `Juniors`,
 * `Beginner`, `Group`. A case-sensitive match here would find nothing and every chip
 * would silently return an empty list.
 *
 * The values themselves are a vocabulary nobody controls: they come from coach
 * onboarding, and a new specialty can appear without any code change here. That is what
 * the test alongside this file is guarding — not the filtering logic, which is trivial,
 * but the fact that these four strings still correspond to something real.
 */
const CHIP_MATCHERS: Record<CoachChipKey, { field: keyof CoachChipSource; values: string[] }> = {
  juniors: { field: "specialties", values: ["juniors"] },
  beginners: { field: "levels", values: ["beginner"] },
  groups: { field: "formats", values: ["group", "clinics"] },
};

export const COACH_CHIPS: Array<{ key: CoachChipKey; label: string }> = [
  { key: "juniors", label: "Juniors" },
  { key: "beginners", label: "Beginners" },
  { key: "groups", label: "Groups" },
];

const lower = (values: string[] | undefined) =>
  (values ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean);

export const coachMatchesChip = (coach: CoachChipSource, chip: CoachChipKey): boolean => {
  const matcher = CHIP_MATCHERS[chip];
  if (!matcher) return false;
  const present = lower(coach[matcher.field]);
  return matcher.values.some((value) => present.includes(value));
};

/** Chips are AND: every selected chip must match. An empty selection matches everything. */
export const coachMatchesChips = (
  coach: CoachChipSource,
  selected: Iterable<CoachChipKey>,
): boolean => {
  for (const chip of selected) {
    if (!coachMatchesChip(coach, chip)) return false;
  }
  return true;
};

/**
 * A coach with neither availability nor specialties has nothing to choose them on, so
 * they sort last under every order rather than taking a prime slot on distance alone.
 *
 * Deliberately not keyed on photo or bio: those are effectively universal (0 of 30 and
 * 1 of 30 empty on the current roster), so they would classify nobody.
 */
export const isThinCoachProfile = (coach: CoachListItem): boolean =>
  lower(coach.availabilityWindows).length === 0 && lower(coach.specialties).length === 0;

const numberOr = (value: number | null | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Sorts a copy. Thin profiles are pushed last regardless of the chosen order — the sort
 * runs first, then a stable pass moves them down, so their relative order is preserved.
 */
export const sortCoaches = <T extends CoachListItem>(coaches: T[], sort: CoachSortKey): T[] => {
  const compare: Record<CoachSortKey, (a: T, b: T) => number> = {
    // Unknown distance sorts last rather than to zero, which would put it first.
    nearest: (a, b) =>
      numberOr(a.distanceMiles, Number.POSITIVE_INFINITY) -
      numberOr(b.distanceMiles, Number.POSITIVE_INFINITY),
    "price-low": (a, b) =>
      numberOr(a.hourlyRateValue, Number.POSITIVE_INFINITY) -
      numberOr(b.hourlyRateValue, Number.POSITIVE_INFINITY),
    "students-high": (a, b) => numberOr(b.studentCount, -1) - numberOr(a.studentCount, -1),
  };

  return [...coaches]
    .sort(compare[sort] ?? compare.nearest)
    .sort((a, b) => Number(isThinCoachProfile(a)) - Number(isThinCoachProfile(b)));
};

/**
 * Where to draw the "further than N mi" rule.
 *
 * Returns the index of the first coach beyond the radius, or -1 for no divider. Only
 * meaningful when the list is distance-ordered, so it returns -1 under other sorts, and
 * -1 when every result is inside the radius — a rule with nothing below it is noise.
 */
export const findDistanceDividerIndex = (
  coaches: CoachListItem[],
  { sort, radiusMiles }: { sort: CoachSortKey; radiusMiles: number },
): number => {
  if (sort !== "nearest") return -1;
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) return -1;
  const index = coaches.findIndex(
    (coach) => numberOr(coach.distanceMiles, Number.POSITIVE_INFINITY) > radiusMiles,
  );
  return index <= 0 ? (index === 0 ? 0 : -1) : index;
};

/** How many of the results fall inside the radius. Drives the "N within X mi" count. */
export const countWithinRadius = (coaches: CoachListItem[], radiusMiles: number): number =>
  coaches.filter(
    (coach) => numberOr(coach.distanceMiles, Number.POSITIVE_INFINITY) <= radiusMiles,
  ).length;
