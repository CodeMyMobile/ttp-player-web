/**
 * Real classes and leagues for /whats-on, fetched at build time.
 *
 * Both lists were hardcoded placeholders until now — invented coaches, invented
 * prices ("$5" against a league that costs $59.99). A public page quoting a
 * wrong price is worse than a page with fewer cards, so the mappers below drop
 * anything they cannot state truthfully rather than filling a gap with a guess.
 *
 * Lesson start times are floating venue wall clocks stamped `Z` — see
 * src/utils/floatingTime.ts in the app. Every time value here is read from the
 * digits and never through `new Date(string)`, which would shift a 6:30pm class
 * by the build machine's offset.
 */

const DEFAULT_LESSONS_API = "https://api.thetennisplan.com/api/player/upcoming_group_lessons";
const DEFAULT_LEAGUES_API = "https://api.thetennisplan.com/api/leagues";

/** Areas this site covers. Shared with the filter chips so both stay in step. */
export const AREAS: Array<[string, string]> = [
  ["any", "Any"],
  ["mar-vista", "Mar Vista"],
  ["cheviot-hills", "Cheviot Hills"],
  ["santa-monica", "Santa Monica"],
  ["culver-city", "Culver City"],
  ["venice", "Venice"],
  ["westwood", "Westwood"],
  ["west-la", "West LA"],
  ["del-rey", "Del Rey"],
];

export type PublicClass = {
  t: string;
  v: string;
  d: string;
  c: string;
  p: string;
  lvl: string | null;
  area: string | null;
  when: string | null;
  /** Fields below serve the dedicated /group-tennis-lessons pages. The
   *  /whats-on script reads only the short keys above. */
  id: number | null;
  startDateTime: string | null;
  dateLabel: string | null;
  /** How many future dates this class runs. 1 means a one-off. */
  occurrences: number;
};

export type PublicLeague = {
  t: string;
  lvl: string | null;
  div: string;
  spots: number;
  n: string;
};

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

export const readWallClock = (value: unknown): WallClock | null => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(WALL_CLOCK);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
};

/** "Thu 6:30pm" from the venue's own clock. */
export const formatDayTime = (value: unknown): string | null => {
  const clock = readWallClock(value);
  if (!clock) return null;
  // UTC accessors only: the digits are already venue-local, so any conversion
  // would be a second, wrong one.
  const weekday = DAYS[new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay()];
  const suffix = clock.hour < 12 ? "am" : "pm";
  const hour12 = clock.hour % 12 === 0 ? 12 : clock.hour % 12;
  const minute = String(clock.minute).padStart(2, "0");
  return `${weekday} ${hour12}:${minute}${suffix}`;
};

/** Which filter chip a class answers to. Weekends win over the time of day. */
export const bandOf = (value: unknown): string | null => {
  const clock = readWallClock(value);
  if (!clock) return null;
  const weekday = new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay();
  if (weekday === 0 || weekday === 6) return "weekends";
  if (clock.hour < 12) return "mornings";
  if (clock.hour >= 17) return "evenings";
  return null; // afternoons have no chip
};

/**
 * The level a coach typed, as a number.
 *
 * There is still no numeric level on a lesson — `metadata.level` is free text
 * ("Advanced Plus (NTRP 4.5)"), the same gap the booking page hit. A class that
 * states its level only in its title reads as null and shows unfiltered, which
 * is the honest answer to "we don't know".
 */
export const levelOf = (metadata: unknown): string | null => {
  const raw = (metadata as { level?: unknown })?.level;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const match = raw.match(/(\d\.\d)/);
  return match ? match[1] : null;
};

/**
 * "Culver City High School Tennis Court Culver City, CA" -> the court, once.
 *
 * Coaches type these by hand and Places fills the rest, so the raw strings
 * carry a doubled name ("17005 Palisades Cir 17005 Palisades Cir"), a dangling
 * conjunction from a cross-street ("Colorado Center Park Broadway &"), or the
 * area repeated after the venue. All three read as broken on a public card.
 */
export const venueOf = (location: unknown, areaLabel: string | null): string | null => {
  if (typeof location !== "string" || !location.trim()) return null;
  let head = location.split(",")[0].trim();
  if (!head) return null;

  if (areaLabel && head.toLowerCase().endsWith(` ${areaLabel.toLowerCase()}`)) {
    head = head.slice(0, head.length - areaLabel.length - 1).trim() || head;
  }

  const words = head.split(/\s+/);
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(" ");
    if (first.toLowerCase() === words.slice(half).join(" ").toLowerCase()) head = first;
  }

  head = head.replace(/[\s&,\-–—/]+$/, "").trim();
  return head || null;
};

export const areaOf = (location: unknown): [string, string] | [null, null] => {
  if (typeof location !== "string") return [null, null];
  const haystack = location.toLowerCase();
  for (const [id, label] of AREAS) {
    if (id === "any") continue;
    if (haystack.includes(label.toLowerCase())) return [id, label];
  }
  return [null, null];
};

const VENUE_TIME_ZONE = "America/Los_Angeles";

/**
 * A floating wall clock as a real instant, for schema.org `startDate`.
 *
 * Search engines read that field as an instant, so it needs the venue's offset
 * — and the offset depends on the date, since PDT and PST differ by an hour.
 * Asking Intl for the date in question is the only way to get that right
 * without a timezone database.
 */
export const venueOffsetIso = (value: unknown, timeZone = VENUE_TIME_ZONE): string | null => {
  const clock = readWallClock(value);
  if (!clock) return null;
  const probe = new Date(Date.UTC(clock.year, clock.month - 1, clock.day, 12));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(probe);
  const named = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const offset = named.replace(/^(GMT|UTC)/, "") || "-08:00";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${clock.year}-${pad(clock.month)}-${pad(clock.day)}T${pad(clock.hour)}:${pad(clock.minute)}:00${offset}`;
};

/** "Thu, Sep 17" from the venue's own clock. */
export const formatDate = (value: unknown): string | null => {
  const clock = readWallClock(value);
  if (!clock) return null;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekday = DAYS[new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay()];
  return `${weekday}, ${MONTHS[clock.month - 1]} ${clock.day}`;
};

const money = (value: unknown): string | null => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `$${amount.toFixed(2).replace(/\.00$/, "")}`;
};

export const buildPublicClasses = (records: unknown[]): PublicClass[] => {
  const out: PublicClass[] = [];
  const seen = new Map<string, number>();
  for (const record of Array.isArray(records) ? records : []) {
    const row = record as Record<string, unknown>;
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const title = typeof metadata.title === "string" ? metadata.title.trim() : "";
    const dayTime = formatDayTime(row.start_date_time);
    const coach = typeof row.full_name === "string" ? row.full_name.trim() : "";
    const price = money(row.group_price_per_person);
    const [area, areaLabel] = areaOf(row.location);
    const venue = venueOf(row.location, areaLabel);

    // A card with no title, time, coach or venue is not a listing, it is a
    // placeholder by another name.
    if (!title || !dayTime || !coach || !venue) continue;

    // A weekly class is many rows, one per date, and the card only says
    // "Fri 9:00am" — so every week after the first renders as a duplicate
    // listing. Keep the soonest occurrence and count the rest. Rows arrive
    // soonest-first.
    const key = `${title.toLowerCase()}|${venue.toLowerCase()}|${dayTime}`;
    const already = seen.get(key);
    if (already !== undefined) {
      out[already].occurrences += 1;
      continue;
    }
    seen.set(key, out.length);

    const id = Number(row.id);
    out.push({
      t: title,
      v: venue,
      d: dayTime,
      c: coach,
      p: price ?? "See price",
      lvl: levelOf(metadata),
      area,
      when: bandOf(row.start_date_time),
      id: Number.isFinite(id) ? id : null,
      startDateTime: typeof row.start_date_time === "string" ? row.start_date_time : null,
      dateLabel: formatDate(row.start_date_time),
      occurrences: 1,
    });
  }
  return out;
};

const DIVISIONS: Record<string, string> = { men: "mens", women: "womens", mixed: "any" };

const season = (start: unknown, end: unknown): string | null => {
  const from = readWallClock(start);
  const to = readWallClock(end);
  if (!from || !to) return null;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${MONTHS[from.month - 1]}-${MONTHS[to.month - 1]}`;
};

/**
 * Divisions someone can actually join today.
 *
 * Dropped: seasons that have ended (the API still calls a Spring league
 * "active", and `end_date` is the field that tells the truth), and divisions
 * with no seat left — the page promises "league divisions with spots left", so
 * a full one would make its own subheading false.
 */
export const buildPublicLeagues = (records: unknown[], today = new Date()): PublicLeague[] => {
  const out: PublicLeague[] = [];
  const todayIso = today.toISOString().slice(0, 10);

  for (const record of Array.isArray(records) ? records : []) {
    const row = record as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const endDate = typeof row.end_date === "string" ? row.end_date.slice(0, 10) : "";
    const spots = Number(row.spots_remaining);

    if (!name) continue;
    if (row.status !== "active") continue;
    if (!endDate || endDate < todayIso) continue;
    if (row.is_full === true || !Number.isFinite(spots) || spots <= 0) continue;

    const players = Number(row.total_players_allowed);
    const cost = money((Number(row.cost_cents) || 0) / 100);
    const deadline = typeof row.deadline === "string" ? row.deadline.slice(0, 10) : "";
    const parts = [
      Number.isFinite(players) && players > 0 ? `${players} players` : null,
      season(row.start_date, row.end_date),
      cost,
      // Only while it is still true.
      deadline && deadline >= todayIso ? `sign up by ${deadline.slice(5).replace("-", "/")}` : null,
    ].filter(Boolean);

    out.push({
      t: name,
      lvl: typeof row.skill_band === "string" ? row.skill_band : null,
      div: DIVISIONS[String(row.gender)] ?? "any",
      spots,
      n: parts.join(" · "),
    });
  }
  return out;
};

const fetchJson = async (url: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.json();
};

/**
 * Listings are the entire point of this page, so a failed fetch fails the
 * build, matching getCoaches(). A failed build leaves the last good deploy
 * serving real classes; a tolerated one would publish "No classes at any level
 * in West LA" during an outage, which reads as a fact about our supply.
 */
let cached: Promise<{ classes: PublicClass[]; leagues: PublicLeague[] }> | null = null;

export async function getWhatsOn(): Promise<{ classes: PublicClass[]; leagues: PublicLeague[] }> {
  // Four pages ask for this during one build. Without the cache that is four
  // identical round trips, and four chances for one of them to fail the build.
  cached ??= fetchWhatsOn();
  return cached;
}

async function fetchWhatsOn(): Promise<{ classes: PublicClass[]; leagues: PublicLeague[] }> {
  // Read inside the function: the mappers above are imported by plain node in
  // the tests, where `import.meta.env` does not exist.
  const lessonsApi = import.meta.env.WHATS_ON_LESSONS_API_URL || DEFAULT_LESSONS_API;
  const leaguesApi = import.meta.env.WHATS_ON_LEAGUES_API_URL || DEFAULT_LEAGUES_API;

  const [lessonPayload, leaguePayload] = await Promise.all([
    fetchJson(lessonsApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perPage: 60, page: 1 }),
    }).catch((error) => {
      throw new Error(`Group lesson API unreachable (${String(error)}) — aborting build`);
    }),
    fetchJson(leaguesApi).catch((error) => {
      throw new Error(`League API unreachable (${String(error)}) — aborting build`);
    }),
  ]);

  const lessonRows = (lessonPayload as { lessons?: unknown })?.lessons;
  const leagueRows = (leaguePayload as { leagues?: unknown })?.leagues;

  const classes = buildPublicClasses(Array.isArray(lessonRows) ? lessonRows : []);
  const leagues = buildPublicLeagues(Array.isArray(leagueRows) ? leagueRows : []);

  const lessonCount = Array.isArray(lessonRows) ? lessonRows.length : 0;
  const leagueCount = Array.isArray(leagueRows) ? leagueRows.length : 0;
  console.log(
    `[whats-on] ${classes.length} of ${lessonCount} classes, ${leagues.length} of ${leagueCount} divisions published`,
  );
  const unlevelled = classes.filter((item) => item.lvl === null).length;
  if (unlevelled) {
    console.warn(
      `[whats-on] ${unlevelled} classes state no NTRP level — they are hidden whenever a level chip is active`,
    );
  }

  return { classes, leagues };
}

/** Areas that actually have a class, busiest first. Alphabetical breaks ties so
 *  the chips do not reshuffle between builds when two areas are level. */
export const classAreas = (classes: PublicClass[]): string[] => {
  const counts = new Map<string, number>();
  for (const item of classes) {
    if (!item.area) continue;
    counts.set(item.area, (counts.get(item.area) ?? 0) + 1);
  }
  const labelOf = (id: string) => AREAS.find(([key]) => key === id)?.[1] ?? id;
  return [...counts.keys()].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || labelOf(a).localeCompare(labelOf(b)),
  );
};

/**
 * One class as schema.org. Only fields we hold are emitted — an absent level or
 * price is left out rather than guessed, since structured data that disagrees
 * with the page is worse than none.
 */
export const classSchema = (item: PublicClass): Record<string, unknown> => {
  const startDate = venueOffsetIso(item.startDateTime);
  const price = Number(item.p.replace(/[^0-9.]/g, ""));
  return {
    "@type": "SportsEvent",
    name: item.t,
    ...(startDate ? { startDate } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: item.v,
      address: {
        "@type": "PostalAddress",
        // Culver City and Santa Monica are their own cities, not Los Angeles.
        // Where we could not read an area, the locality is left out rather
        // than guessed — structured data that contradicts the page is worse
        // than structured data that says less.
        ...(item.area ? { addressLocality: AREAS.find(([key]) => key === item.area)?.[1] } : {}),
        addressRegion: "CA",
        addressCountry: "US",
      },
    },
    ...(item.c ? { performer: { "@type": "Person", name: item.c } } : {}),
    ...(Number.isFinite(price) && price > 0
      ? { offers: { "@type": "Offer", price: String(price), priceCurrency: "USD", availability: "https://schema.org/InStock", url: item.id ? `https://app.thetennisplan.com/#/group-lessons/${item.id}` : undefined } }
      : {}),
  };
};

/** Classes alone, for the dedicated pages. Shares the fetch policy below. */
export async function getPublicClasses(): Promise<PublicClass[]> {
  const { classes } = await getWhatsOn();
  return classes;
}
