import { normalizeVenueLabel, VENUES, type Venue } from "./venues.ts";

export type Coach = {
  slug: string;
  name: string;
  photo: string | null;
  privateRate: number | null;
  groupRate: number | null;
  bio: string;
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
          if (!venue && name) console.warn(`Dropping unapproved coach venue: ${name}`);
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
        focus: strings(record.focus_areas),
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
