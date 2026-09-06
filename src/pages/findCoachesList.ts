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

/* ── card display strings ──
   Here rather than in the card component because they are string rules with real edge
   cases, and here rather than in utils/venueLabel because they are specific to a card
   in a list. normalizeVenueLabel is shared with the profile header and the booking
   slot list, where "Where you'll play" has to stay findable — abbreviating there would
   make a venue harder to identify, not easier. */

/**
 * Day parts for the card's availability strip.
 *
 * Caps at two and counts the rest. The API's vocabulary is four values (Weekday
 * Mornings / Afternoons / Evenings, Weekends) and coaches publish up to three, so the
 * uncapped string ran to "Weekends, weekday mornings, weekday evenings" — two lines on
 * desktop beside a venue name, and the tallest thing on the mobile card. Two parts plus
 * a count says the same thing: this coach is broadly available.
 *
 * Sentence case, because it reads as a phrase rather than a label.
 */
export const formatAvailabilityPhrase = (windows: string[] | undefined, limit = 2): string => {
  const parts = (windows ?? [])
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (parts.length === 0) return "";

  const shown = parts.slice(0, limit);
  const sentence = shown
    .map((value, index) =>
      index === 0 ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value.toLowerCase(),
    )
    .join(", ");

  const hidden = parts.length - shown.length;
  return hidden > 0 ? `${sentence} +${hidden}` : sentence;
};

/**
 * Shortens the two long facility words that actually occur in the roster. Applied after
 * normalizeVenueLabel, on the card only.
 *
 * Deliberately not a general abbreviation pass: every rule here is one someone can read
 * back to the venue it came from ("Penmar Recreation Center", "Culver City High School"
 * — both live in the current data). Guessing at others would produce labels that no
 * longer match what a player sees on arrival.
 */
export const abbreviateVenueLabel = (label: string | null | undefined): string =>
  (label ?? "")
    .replace(/\bRecreation Center\b/gi, "Rec Center")
    .replace(/\bHigh School\b/gi, "HS")
    .trim();

/**
 * The three rungs of the skill ladder. `competitive` is a fourth value the API sends, but
 * it describes what a coach runs rather than who they will take, so it does not count
 * toward "teaches everyone".
 */
const SKILL_TIERS = ["beginner", "intermediate", "advanced"];

/**
 * One pill summarising the levels a coach teaches — or nothing, when the answer is
 * "everyone".
 *
 * A coach covering all three skill tiers tells a player nothing they can act on: 13 of
 * the 15 coaches who publish levels at all are in that group, so the pill was a
 * full-width element repeating the same non-fact down the list. It earns its place only
 * when the range is narrow ("Levels Beginner, Intermediate"), which is the case a player
 * can actually use to rule a coach in or out.
 *
 * Numeric levels collapse to a range, named levels are listed. Display-only — nothing is
 * inferred that the data does not say.
 */
export const formatLevelsPill = (levels: string[] | undefined): string | null => {
  const clean = (levels ?? []).map((level) => level.trim()).filter(Boolean);
  if (clean.length === 0) return null;

  const lowered = clean.map((level) => level.toLowerCase());
  if (SKILL_TIERS.every((tier) => lowered.some((level) => level.includes(tier)))) return null;
  const numbers = clean
    .map((level) => Number(level.match(/\d+(?:\.\d+)?/)?.[0]))
    .filter((value) => Number.isFinite(value));
  if (numbers.length >= 2) {
    return `Levels ${Math.min(...numbers)}–${Math.max(...numbers)}`;
  }
  return clean.length === 1 ? `Level ${clean[0]}` : `Levels ${clean.slice(0, 3).join(", ")}`;
};

/**
 * How many of a coach's group sessions fall in the next seven days.
 *
 * The card says "Also runs N weekly group sessions", so N has to be a week's worth. The
 * endpoint is not week-scoped: it returns every upcoming session, and one coach's eleven
 * were the same 10:00 Saturday class repeating from September to late November. The card
 * promised eleven, the player followed the link, and the group-lessons page — which does
 * bound to the week — showed one. The link looked broken; the number was.
 *
 * Counts sessions, not distinct classes: two different classes this week is genuinely two
 * things to choose between, and the card is offering a choice.
 *
 * Compares the date half of the timestamp as a string. These stamps are venue-local wall
 * clock with a Z suffix (see utils/floatingTime), so converting them to a Date and doing
 * arithmetic would shift the day for anyone east or west of the venue. The day is already
 * written in the string; read it rather than recompute it.
 */
export const countSessionsThisWeek = (
  startDateTimes: Array<string | null | undefined>,
  todayIso: string,
): number => {
  if (!todayIso) return 0;
  const end = new Date(`${todayIso}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return 0;
  end.setUTCDate(end.getUTCDate() + 6);
  const endIso = end.toISOString().slice(0, 10);
  return startDateTimes.reduce<number>((count, value) => {
    const day = typeof value === "string" ? value.slice(0, 10) : "";
    return day && day >= todayIso && day <= endIso ? count + 1 : count;
  }, 0);
};
