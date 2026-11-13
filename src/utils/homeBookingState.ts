/**
 * Whether the player is already in, or is the coach of, something a home discovery list offers.
 *
 * "Play this week" lists nearby matches and classes, and the player's own bookings are among
 * them. Those must read "You're in", not Join or Book; a coach browsing as a player must see
 * "You're coaching" on their own classes rather than an offer to book themselves.
 *
 * What the player is in comes from the same source as My Week (features/myWeek, or
 * useWeekBookings while My Week is off), keyed "<kind>:<id>" so both sources and the feed agree.
 */
import type { WeekItem } from "../features/myWeek/types";
import type { WeekBooking } from "./weekBookings";

export type BookedKind = "match" | "group" | "lesson";
export type ViewerState = "in" | "coaching" | null;

const key = (kind: BookedKind, id: unknown): string | null => {
  const value = String(id ?? "").trim();
  return value ? `${kind}:${value}` : null;
};

const WEEK_SOURCE_KINDS: Partial<Record<WeekItem["source"], BookedKind>> = {
  match: "match",
  groupLesson: "group",
  lesson: "lesson",
};

/** Booked items from My Week. Invites and suggestions are not bookings. */
export const bookedKeysFromWeekItems = (items: WeekItem[]): Set<string> => {
  const keys = new Set<string>();
  for (const item of items) {
    const kind = WEEK_SOURCE_KINDS[item.source];
    if (!kind || item.state !== "booked") continue;
    const k = key(kind, item.id.slice(item.id.indexOf(":") + 1));
    if (k) keys.add(k);
  }
  return keys;
};

/** Bookings from useWeekBookings, the source while My Week is off. */
export const bookedKeysFromBookings = (bookings: WeekBooking[]): Set<string> => {
  const keys = new Set<string>();
  for (const booking of bookings) {
    const k = key(booking.kind, booking.id);
    if (k) keys.add(k);
  }
  return keys;
};

interface FeedItemLike {
  type?: unknown;
  source?: unknown;
  lessonId?: unknown;
  coachId?: unknown;
}

/** The key a feed item would have as a booking. Coach availability and external lessons have none. */
export const feedItemBookedKey = (item: FeedItemLike): string | null => {
  if (item.source === "coach_availability") return null;
  if (item.type === "match") return key("match", item.lessonId);
  if (item.type === "group") return key("group", item.lessonId);
  if (item.type === "private") return key("lesson", item.lessonId);
  return null;
};

const sameId = (a: unknown, b: unknown) => {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const left = Number(a);
  return Number.isFinite(left) && left === Number(b);
};

/** "coaching" ahead of "in": a coach is never booked into their own class. */
export const feedItemViewerState = (
  item: FeedItemLike,
  { bookedKeys, viewerId }: { bookedKeys: Set<string>; viewerId: number | null },
): ViewerState => {
  if (item.type !== "match" && item.type !== "external" && sameId(item.coachId, viewerId)) return "coaching";
  const k = feedItemBookedKey(item);
  return k && bookedKeys.has(k) ? "in" : null;
};
