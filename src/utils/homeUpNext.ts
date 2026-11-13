/**
 * "Up next" on home: the next booked thing as a hero card, then the rest of the week's bookings
 * as a short list. Built from My Week's days (features/myWeek), the same list the My Week tab
 * and the "You're in" pills read, so the three can't disagree.
 *
 * Pure, so it's tested without rendering.
 */
import { timeLabel } from "../features/myWeek/screenModel";
import type { WeekDayItems, WeekItem } from "../features/myWeek/types";
import { normalizeVenueLabel } from "./venueLabel";

export interface UpNextEntry {
  item: WeekItem;
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
  // The full address stays for directions; the card shows the venue's name.
  const address = item.subtitle?.trim() || null;
  return {
    item,
    tag: TAGS[tone],
    tone,
    when: `${day} · ${timeLabel(item)}`,
    dayShort: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    dayNumber: date.getDate(),
    venue: address ? normalizeVenueLabel(address) || address : null,
    directionsUrl: directionsUrl(address),
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
