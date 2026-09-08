import { isDeliberatelyExcluded, normalizeVenueLabel, VENUES, type Venue } from "./venues.ts";

export type Coach = {
  slug: string;
  name: string;
  photo: string | null;
  privateRate: number | null;
  groupRate: number | null;
  bio: string;
  /** Card copy: emoji stripped, clamped. `bio` stays whole for the profile page. */
  excerpt: string;
  focus: string[];
  certifications: string[];
  students: number | null;
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
  certifications?: unknown;
  student_count?: unknown;
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

      const courts = (Array.isArray(record.courts) ? record.courts : [])
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
      const bio = textOrEmpty(record.bio);

      return {
        slug,
        name: textOrEmpty(record.name),
        photo: textOrEmpty(record.photo_url) || null,
        privateRate: numberOrNull(record.rate_private),
        groupRate: numberOrNull(record.rate_group),
        bio,
        excerpt: excerptFrom(bio),
        focus: strings(record.focus_areas).slice(0, MAX_FOCUS),
        certifications: strings(record.certifications),
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
  return complete;
}
