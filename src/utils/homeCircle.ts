// "Your tennis circle" on home: open matches people the player knows are in, and classes
// from their coaches. Who is in it is decided by the API (GET /matches/circle); this turns
// its answer into the rows the section draws.
//
// All the wording lives here rather than in the component, so it is tested: there is no
// React test harness in this repo.

export interface CirclePerson {
  id: number;
  full_name: string | null;
  profile_picture: string | null;
  is_host: boolean;
}

export interface CircleMatch {
  match_id: number;
  when_label: string | null;
  location: string | null;
  format: string | null;
  spots_open: number | null;
  host: { id: number; full_name: string | null } | null;
  people: CirclePerson[];
}

export interface CircleClass {
  lesson_id: number;
  title: string | null;
  coach_name: string | null;
  coach_picture: string | null;
  location: string | null;
  when_label: string | null;
  price_per_person: number | null;
  spots_left: number | null;
  at_your_level: boolean;
}

export interface CircleResponse {
  matches?: CircleMatch[];
  group_lessons?: CircleClass[];
}

export interface CircleRow {
  key: string;
  kind: "match" | "class";
  eyebrow: string;
  title: string;
  when: string | null;
  detail: string | null;
  /** A short highlight beside the eyebrow, e.g. "At your level". */
  chip: string | null;
  avatarUrl: string | null;
  initials: string;
  href: string;
  cta: string;
}

const clean = (value: unknown): string => String(value ?? "").trim();

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const initialsOf = (name: unknown): string =>
  clean(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** "Casey Morgan", "Casey Morgan and Alex Rivera", "Casey Morgan and 2 others". */
export const peopleLabel = (people: CirclePerson[]): string => {
  const names = people.map((person) => clean(person.full_name)).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "Someone you know";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} others`;
};

/** "Tue, Nov 3 · 9:00 AM at Penmar Recreation Center" */
export const whenWhere = (when: unknown, where: unknown): string | null => {
  const parts = [clean(when), clean(where)];
  if (parts[0] && parts[1]) return `${parts[0]} at ${parts[1]}`;
  return parts[0] || parts[1] || null;
};

/** "$35", "$37.50". Null when there's no price: an unpriced class must not read as free. */
export const priceLabel = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
};

const matchRow = (match: CircleMatch): CircleRow => {
  const people = Array.isArray(match.people) ? match.people : [];
  const hostIsKnown = people.some((person) => person.is_host);
  const hostName = clean(match.host?.full_name);
  const spots = Number(match.spots_open);
  const detail = [
    clean(match.format),
    Number.isFinite(spots) && spots > 0 ? plural(spots, "spot open", "spots open") : "",
    // When it's not their match, say whose it is.
    !hostIsKnown && hostName ? `Hosted by ${hostName}` : "",
  ].filter(Boolean);
  const lead = people[0];

  return {
    key: `match-${match.match_id}`,
    kind: "match",
    eyebrow: hostIsKnown ? "Looking to hit" : "Needs players",
    title: peopleLabel(people),
    when: whenWhere(match.when_label, match.location),
    detail: detail.length ? detail.join(" · ") : null,
    chip: null,
    avatarUrl: lead?.profile_picture || null,
    initials: initialsOf(lead?.full_name),
    href: `/matches/${match.match_id}`,
    cta: "View",
  };
};

const classRow = (lesson: CircleClass): CircleRow => {
  const spots = lesson.spots_left === null || lesson.spots_left === undefined ? NaN : Number(lesson.spots_left);
  const detail = [
    clean(lesson.coach_name) ? `With ${clean(lesson.coach_name)}` : "",
    priceLabel(lesson.price_per_person) ?? "",
    Number.isFinite(spots) && spots > 0 ? plural(spots, "spot left", "spots left") : "",
  ].filter(Boolean);

  return {
    key: `class-${lesson.lesson_id}`,
    kind: "class",
    eyebrow: "From your coach",
    title: clean(lesson.title) || "Group lesson",
    when: whenWhere(lesson.when_label, lesson.location),
    detail: detail.length ? detail.join(" · ") : null,
    // Only claimed when the API knew both levels, not just because nothing ruled it out.
    chip: lesson.at_your_level ? "At your level" : null,
    avatarUrl: lesson.coach_picture || null,
    initials: initialsOf(lesson.coach_name),
    href: `/group-lessons/${lesson.lesson_id}`,
    cta: "View",
  };
};

/**
 * Matches first, then classes, each soonest first as the API sends them. People come
 * before classes because finding someone to play with is what the section is for.
 */
export const buildCircleRows = (response: CircleResponse | null | undefined): CircleRow[] => [
  ...(Array.isArray(response?.matches) ? response!.matches.filter(Boolean).map(matchRow) : []),
  ...(Array.isArray(response?.group_lessons) ? response!.group_lessons.filter(Boolean).map(classRow) : []),
];
