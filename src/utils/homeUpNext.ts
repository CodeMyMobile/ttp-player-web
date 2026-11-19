/**
 * "Up next" on home: the next booked thing as a hero card, then the rest of the week's bookings
 * as a short list. Built from My Week's days (features/myWeek), the same list the My Week tab
 * and the "You're in" pills read, so the three can't disagree.
 *
 * Pure, so it's tested without rendering.
 */
import { timeLabel } from "../features/myWeek/screenModel";
import type { WeekDayItems, WeekItem, WeekPerson } from "../features/myWeek/types";
import { normalizeVenueLabel } from "./venueLabel";

export interface UpNextEntry {
  item: WeekItem;
  /** The card's title: a friendly match names its venue, not the full address. */
  title: string;
  /** "MATCH PLAY", "GROUP LESSON", "LESSON". */
  tag: string;
  /** "group" | "match" | "lesson", for the tag's color. */
  tone: "match" | "group" | "lesson";
  /** "Today · 12:00 PM", "Tomorrow · 9:00 AM", "Sat · 9:00 AM". */
  when: string;
  /** "SAT", and the date, for the compact list. */
  dayShort: string;
  dayNumber: number;
  venue: string | null;
  /** A maps search for the venue, or null with no venue. */
  directionsUrl: string | null;
  /** For a match: the others confirmed in it (hosting or confirmed). Empty otherwise. */
  players: WeekPerson[];
  /** For a match: "With Alex and Sam", or that nobody else is in yet. Null otherwise. */
  playersLabel: string | null;
  /** For a match: "Doubles · 3 of 4 in · 1 spot open", as much as the match says. */
  lineup: string | null;
}

export interface UpNext {
  hero: UpNextEntry | null;
  rest: UpNextEntry[];
}

const TONES: Partial<Record<WeekItem["source"], UpNextEntry["tone"]>> = {
  match: "match",
  groupLesson: "group",
  lesson: "lesson",
};

const TAGS: Record<UpNextEntry["tone"], string> = {
  match: "Match play",
  group: "Group lesson",
  lesson: "Lesson",
};

type Row = Record<string, unknown>;

const matchRow = (item: WeekItem): Row | null =>
  item.source === "match" && item.raw && typeof item.raw === "object" ? (item.raw as Row) : null;

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const playersLabel = (players: WeekPerson[]): string => {
  if (!players.length) return "No one else is in yet";
  if (players.length === 1) return `With ${players[0].name}`;
  const names = players.map((person) => firstName(person.name));
  if (players.length === 2) return `With ${names[0]} and ${names[1]}`;
  return `With ${names[0]}, ${names[1]} +${players.length - 2}`;
};

const formatLabel = (value: unknown) => {
  const format = typeof value === "string" ? value.trim().replace(/_/g, " ") : "";
  return format ? format.charAt(0).toUpperCase() + format.slice(1) : null;
};

/** "Doubles · 3 of 4 in · 1 spot open". The viewer is in, so they count too. */
export const matchLineup = (match: Row, players: WeekPerson[]): string | null => {
  const format = match.is_league_match === true ? null : formatLabel(match.match_format ?? match.format);
  const limit = Number(match.player_limit);
  const inCount = players.length + 1;
  const open = Number.isFinite(limit) && limit > 0 ? Math.max(0, limit - inCount) : 0;
  const parts = [
    format,
    Number.isFinite(limit) && limit > 0 ? `${Math.min(inCount, limit)} of ${limit} in` : null,
    open ? `${open} spot${open === 1 ? "" : "s"} open` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};

const dateOf = (dayKey: string) => new Date(`${dayKey}T12:00:00`);

export const directionsUrl = (venue: string | null | undefined): string | null => {
  const query = String(venue ?? "").trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
};

const entry = (item: WeekItem, todayKey: string, tomorrowKey: string | undefined): UpNextEntry => {
  const tone = TONES[item.source] ?? "lesson";
  const day =
    item.dayKey === todayKey
      ? "Today"
      : item.dayKey === tomorrowKey
        ? "Tomorrow"
        : dateOf(item.dayKey).toLocaleDateString("en-US", { weekday: "short" });
  const date = dateOf(item.dayKey);
  // The full address stays for directions; the card shows the venue's name. A friendly
  // match's subtitle is its format, so its address comes from the match itself.
  const match = matchRow(item);
  const matchAddress = match && typeof match.location_text === "string" ? match.location_text.trim() : "";
  const address = (match ? matchAddress : item.subtitle?.trim()) || null;
  const venue = address ? normalizeVenueLabel(address) || address : null;
  // "Match at <full address>" would say the venue twice; the card names it once.
  const friendlyMatchVenue = match && match.is_league_match !== true && venue;
  return {
    item,
    title: friendlyMatchVenue ? `Match at ${venue}` : item.title,
    tag: TAGS[tone],
    tone,
    when: `${day} · ${timeLabel(item)}`,
    dayShort: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    dayNumber: date.getDate(),
    venue: friendlyMatchVenue ? null : venue,
    directionsUrl: directionsUrl(address),
    players: match ? item.people : [],
    playersLabel: match ? playersLabel(item.people) : null,
    lineup: match ? matchLineup(match, item.people) : null,
  };
};

/**
 * Booked items still to come this week, soonest first. Booked only: an invite isn't a plan
 * yet (it's in Action needed). `days[0]` is today.
 */
export const buildUpNext = (days: WeekDayItems[], now: number): UpNext => {
  const todayKey = days[0]?.dayKey ?? "";
  const tomorrowKey = days[1]?.dayKey;
  const booked = days
    .flatMap((day) => day.items)
    .filter((item) => item.state === "booked" && TONES[item.source])
    .filter((item) => item.time.kind !== "fixed" || item.time.startsAt >= now)
    .sort((a, b) => {
      const at = a.time.kind === "fixed" ? a.time.startsAt : Infinity;
      const bt = b.time.kind === "fixed" ? b.time.startsAt : Infinity;
      return a.dayKey.localeCompare(b.dayKey) || at - bt;
    })
    .map((item) => entry(item, todayKey, tomorrowKey));
  return { hero: booked[0] ?? null, rest: booked.slice(1) };
};
