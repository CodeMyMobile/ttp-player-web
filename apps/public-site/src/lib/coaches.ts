import { isDeliberatelyExcluded, normalizeVenueLabel, VENUES, type Venue } from "./venues.ts";

export type Coach = {
  slug: string;
  name: string;
  photo: string | null;
  /** `object-position` for the card crop. Null means the default centre. */
  photoFocus: string | null;
  /**
   * The coach's numeric id in the player app, which is what `#/coaches/:id` routes on.
   * Null when it could not be resolved — links fall back to the app root.
   */
  appId: number | null;
  privateRate: number | null;
  groupRate: number | null;
  bio: string;
  /** Card copy: emoji stripped, clamped. `bio` stays whole for the profile page. */
  excerpt: string;
  /** Lesson formats, display-cased and in a fixed order. */
  formats: string[];
  focus: string[];
  certifications: string[];
  students: number | null;
  /**
   * Not on /public/coaches yet. Read defensively and rendered conditionally, so the facts
   * row fills in when the endpoint carries them without another change here.
   */
  experienceYears: number | null;
  languages: string[];
  courts: Venue[];
  areas: string[];
  indexable: boolean;
};

type ApiCourt = { name?: unknown };
type ApiCoach = {
  slug?: unknown;
  name?: unknown;
  photo_url?: unknown;
  rate_private?: unknown;
  rate_group?: unknown;
  bio?: unknown;
  focus_areas?: unknown;
  formats?: unknown;
  certifications?: unknown;
  student_count?: unknown;
  experience_years?: unknown;
  languages?: unknown;
  courts?: ApiCourt[] | unknown;
};

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

const numberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const textOrEmpty = (value: unknown) => typeof value === "string" ? value.trim() : "";

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * Two floors, deliberately different.
 *
 * HUB_BIO_WORDS gets a coach onto the page at all. Below it the card is a placeholder —
 * "Great coach", or an empty bio rendering as "Public coach profile coming soon." — which
 * is worse for the reader and for us than not listing them yet.
 *
 * INDEXABLE_BIO_WORDS is a separate, higher bar for the sitemap. A coach between the two
 * gets a real card and a real profile; that profile just carries noindex until the bio
 * grows. Neither is a judgement about the coach, and both clear themselves with no code
 * change once the profile is filled in.
 */
/**
 * Per-coach crop overrides, keyed by slug.
 *
 * The cards frame photos 1:1 with `object-position: center`, which is right for the 20-odd
 * portrait and square sources on the roster. A few are composed such that centre is wrong —
 * a full-body shot where the subject sits low, a landscape frame where the subject is off
 * to one side. Those get an override here rather than a rule that would move everyone.
 *
 * This only shifts which part of the source is visible; it cannot zoom. A photo whose
 * problem is that the subject is small in a busy frame needs a new photo, not an entry here.
 */
const PHOTO_FOCUS: Record<string, string> = {
  // Full-body crouching shot: centre lands on her knees, so bias up to the head and torso.
  "makaela-moseley": "center 22%",
  // Landscape source in a square frame, so only the horizontal component does anything —
  // the full height is already shown. This pulls him off the left edge; the ceiling above
  // him is in the photo itself and needs a re-shoot, not a crop.
  "paul-cochrane-6": "35% center",
};

const HUB_BIO_WORDS = 25;

/**
 * Card bio length. Full bios run to 189 words on this roster, and a card carrying one
 * next to a 40-word card made heights vary by a factor of ten. The whole bio is on the
 * profile, which is the page that wants it.
 */
const EXCERPT_WORDS = 20;

/** Focus areas per card — a coach with ten should not turn the card into a keyword list. */
const MAX_FOCUS = 4;

/**
 * Lesson formats, in the order a player chooses between them — cheapest-to-most-personal
 * reversed, so the common case leads. Ordered explicitly rather than alphabetically
 * ("Clinics, Group, Hitting, Private, Semi-private" buries the one most people want) and
 * mapped explicitly rather than title-cased ("semi" is not a word, and "Semi-private" has
 * a hyphen no transform would guess).
 *
 * Anything the API sends that is not in this map is dropped rather than shown raw: an
 * unrecognised format on a public page is worse than a shorter list.
 */
const FORMAT_LABELS: Record<string, string> = {
  private: "Private",
  semi: "Semi-private",
  semi_private: "Semi-private",
  group: "Group",
  clinics: "Clinics",
  hitting: "Hitting",
};
const FORMAT_ORDER = ["Private", "Semi-private", "Group", "Clinics", "Hitting"];

export const formatLabels = (raw: unknown): string[] => {
  const seen = new Set(
    strings(raw)
      .map((value) => FORMAT_LABELS[value.trim().toLowerCase()])
      .filter(Boolean),
  );
  return FORMAT_ORDER.filter((label) => seen.has(label));
};

/**
 * Emoji and dingbats only.
 *
 * Two bios arrive with raw "✅ USPTA Certified Professional ✅ …" and 🎾 from the API,
 * which read as decoration in a card excerpt. The ranges deliberately exclude General
 * Punctuation (U+2000–U+206F): one of those same bios uses an em dash and a curly
 * apostrophe as ordinary writing, and stripping those would damage the prose.
 */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

export const stripEmoji = (text: string): string =>
  text.replace(EMOJI, "").replace(/\s{2,}/g, " ").trim();

/** First `limit` words, with an ellipsis only when something was actually cut. */
export const excerptFrom = (text: string, limit = EXCERPT_WORDS): string => {
  const clean = stripEmoji(text ?? "");
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length <= limit) return clean;
  return `${parts.slice(0, limit).join(" ").replace(/[,;:.\u2014-]+$/, "")}…`;
};
const INDEXABLE_BIO_WORDS = 60;

export type Incomplete = { name: string; slug: string; reasons: string[] };

/** Why a coach is not on the page yet — so it is obvious who needs chasing, and for what. */
export const incompleteReasons = (coach: Coach): string[] => {
  const reasons: string[] = [];
  const words = wordCount(coach.bio);
  if (words < HUB_BIO_WORDS) reasons.push(`bio ${words} words (needs ${HUB_BIO_WORDS})`);
  if (!coach.photo) reasons.push("no photo");
  if (coach.courts.length === 0) reasons.push("no approved court");
  return reasons;
};

export const isComplete = (coach: Coach) => incompleteReasons(coach).length === 0;

export const buildPublicCoaches = (records: ApiCoach[], venues: Record<string, Venue> = VENUES): Coach[] =>
  records
    .map((record) => {
      const slug = textOrEmpty(record.slug);
      if (!slug) throw new Error("Public coach is missing a stored slug — aborting build");

      const rawCourts = (Array.isArray(record.courts) ? record.courts : [])
        .map((court) => normalizeVenueLabel(textOrEmpty(court?.name)))
        .map((name) => {
          const venue = venues[name];
          // Quiet for the two expected cases — a residence (every bare street address
          // normalises to itself and matches nothing) and a venue already recorded in
          // venues.json's _excluded_* blocks. What is left is a label nobody has
          // classified, which is the only kind worth a maintainer's attention. A warning
          // that fires on every build is a warning nobody reads: before this, 29 lines
          // printed per build and all but two were deliberate.
          if (!venue && name && !/^\d/.test(name) && !isDeliberatelyExcluded(name)) {
            console.warn(`[venues] unclassified label dropped: ${name}`);
          }
          return venue;
        })
        .filter((venue): venue is Venue => Boolean(venue));
      // Deduped by name: normalisation is many-to-one, so a coach who listed the same
      // facility twice under different raw labels ("Cheviot Hills Tennis Center" and
      // "Cheviot Hills Tennis Ctr") resolved to the same venue twice and rendered it twice
      // on the card. Ilinca Stoica read "Cheviot Hills Tennis Center, Cheviot Hills Tennis
      // Center" on the live hub.
      const courts = [...new Map(rawCourts.map((venue) => [venue.name, venue])).values()];
      const bio = textOrEmpty(record.bio);

      return {
        slug,
        name: textOrEmpty(record.name),
        photo: textOrEmpty(record.photo_url) || null,
        photoFocus: PHOTO_FOCUS[slug] ?? null,
        appId: null,
        privateRate: numberOrNull(record.rate_private),
        groupRate: numberOrNull(record.rate_group),
        bio,
        excerpt: excerptFrom(bio),
        formats: formatLabels(record.formats),
        focus: strings(record.focus_areas).slice(0, MAX_FOCUS),
        certifications: strings(record.certifications),
        experienceYears: numberOrNull(record.experience_years),
        languages: strings(record.languages),
        students: numberOrNull(record.student_count),
        courts,
        areas: [...new Set(courts.map((court) => court.area))],
        indexable: wordCount(bio) >= INDEXABLE_BIO_WORDS,
      };
    });

export const getAreaCoaches = (coaches: Coach[]) => {
  const byArea = new Map<string, Coach[]>();
  for (const coach of coaches) {
    for (const area of coach.areas) {
      byArea.set(area, [...(byArea.get(area) ?? []), coach]);
    }
  }
  return new Map([...byArea.entries()].filter(([, list]) => list.length >= 3));
};

/**
 * Resolves each coach's numeric app id.
 *
 * `#/coaches/:id` in the player app routes on a numeric id, and `/public/coaches` does not
 * return one — its rows carry `slug` and nine other fields, no id. The slug does not encode
 * it either: `paul-cochrane-6` is coach 26, and `#/coaches/6` is a different coach entirely.
 * So a booking link built from the slug points at nothing.
 *
 * `/public/coaches/search` does return ids. Joining the two on name is a bridge, not the
 * fix — ask for `id` on `/public/coaches` and delete this. Until then:
 *
 *   - a name matched by more than one search row is skipped, never guessed. A wrong id
 *     sends someone to a different coach's booking page, which is worse than the fallback.
 *   - search being unreachable degrades to null ids and a warning. It enriches links; it
 *     must not be able to fail a build that the roster endpoint already satisfied.
 */
const SEARCH_API = "https://api.thetennisplan.com/api/public/coaches/search?perPage=200&page=1";
// Search requires a position. West LA, the area this site covers.
const SEARCH_ORIGIN = { latitude: 33.985, longitude: -118.4695 };

const resolveAppIds = async (coaches: Coach[]): Promise<void> => {
  let rows: Array<{ id?: unknown; full_name?: unknown; name?: unknown }> = [];
  try {
    const response = await fetch(SEARCH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: SEARCH_ORIGIN }),
    });
    if (!response.ok) throw new Error(`search ${response.status}`);
    const payload: unknown = await response.json();
    const list = (payload as { coaches?: unknown })?.coaches;
    rows = Array.isArray(list) ? (list as typeof rows) : [];
  } catch (error) {
    console.warn(`[coaches] could not resolve app ids (${String(error)}) — booking links fall back to the app root`);
    return;
  }

  const seen = new Map<string, number | null>();
  for (const row of rows) {
    const name = textOrEmpty(row.full_name) || textOrEmpty(row.name);
    const id = typeof row.id === "number" && Number.isFinite(row.id) ? row.id : null;
    if (!name || id === null) continue;
    const key = name.toLowerCase();
    // Second sighting of a name makes it ambiguous, and it stays that way.
    seen.set(key, seen.has(key) ? null : id);
  }

  for (const coach of coaches) {
    coach.appId = seen.get(coach.name.trim().toLowerCase()) ?? null;
  }

  const unresolved = coaches.filter((coach) => coach.appId === null);
  if (unresolved.length) {
    console.warn(
      `\n[coaches] ${unresolved.length} of ${coaches.length} have no app id — their booking links go to the app root:\n` +
        unresolved.map((coach) => `  - ${coach.name}`).join("\n") +
        "\n",
    );
  }
};

export async function getCoaches(): Promise<Coach[]> {
  const api = import.meta.env.COACH_API_URL || "https://api.thetennisplan.com/api/public/coaches";

  const response = await fetch(api);
  if (!response.ok) throw new Error(`Coach API ${response.status} — aborting build`);

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Coach API returned an invalid roster — aborting build");
  const all = buildPublicCoaches(payload as ApiCoach[]);
  if (!all.length) throw new Error("Coach API returned no public coaches");

  // Completeness gate. Filtered out entirely rather than greyed out or sorted last: a
  // half-built card is worse for a stranger from Google than one fewer card, and a
  // placeholder bio in indexable HTML is thin content we are asking to be judged on.
  const complete = all.filter(isComplete);
  const excluded = all.filter((coach) => !isComplete(coach));

  if (excluded.length) {
    console.warn(
      `\n[coaches] ${excluded.length} of ${all.length} withheld — incomplete profile:\n` +
        excluded
          .map((coach) => `  - ${coach.name.padEnd(24)} ${incompleteReasons(coach).join("; ")}`)
          .join("\n") +
        "\n",
    );
  }
  console.log(`[coaches] ${complete.length} of ${all.length} published`);

  if (!complete.length) throw new Error("No coach has a complete profile — aborting build");

  // Only the published set: the others render no page, so an id for them buys nothing and
  // would only pad the warning.
  await resolveAppIds(complete);
  return complete;
}
