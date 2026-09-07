import { VENUES, type Venue } from "./venues.ts";

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

export const buildPublicCoaches = (records: ApiCoach[], venues: Record<string, Venue> = VENUES): Coach[] =>
  records
    .map((record) => {
      const slug = textOrEmpty(record.slug);
      if (!slug) throw new Error("Public coach is missing a stored slug — aborting build");

      const courts = (Array.isArray(record.courts) ? record.courts : [])
        .map((court) => textOrEmpty(court?.name))
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
        indexable: bio.split(/\s+/).filter(Boolean).length >= 60,
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
  const coaches = buildPublicCoaches(payload as ApiCoach[]);
  if (!coaches.length) throw new Error("Coach API returned no public coaches");
  return coaches;
}
