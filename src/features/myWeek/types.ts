/**
 * One thing in the player's week. Every source (lessons, matches, invites, leagues, and later
 * suggestions) is turned into this shape by features/myWeek/adapters, so the screen, the Home
 * card and the tab badge read one list.
 */

export type WeekItemState = "booked" | "pending" | "suggested";
export type WeekItemType = "match" | "lesson" | "players" | "workout" | "watch";
export type WeekItemAction =
  | "open"
  | "accept"
  | "decline"
  | "nudge"
  | "add"
  | "skip"
  | "book"
  | "schedule";

export type WeekItemSource =
  | "lesson"
  | "groupLesson"
  | "match"
  | "invite"
  | "sentInvite"
  | "leagueDue";

export interface WeekPerson {
  id: string | null;
  name: string;
  photoUrl: string | null;
}

export type WeekItemTime =
  | { kind: "fixed"; startsAt: number }
  /** No set time: "Due by Sun". Shown on its day without a clock time. */
  | { kind: "flexible"; label: string };

export interface WeekItem {
  /** "<source>:<id>", unique across the week. */
  id: string;
  source: WeekItemSource;
  type: WeekItemType;
  state: WeekItemState;
  /** Counts toward the My Week badge: something only this player can answer. */
  needsResponse: boolean;
  /** YYYY-MM-DD in the viewer's local time (utils/weekDays). */
  dayKey: string;
  time: WeekItemTime;
  title: string;
  subtitle: string | null;
  people: WeekPerson[];
  /** Why it needs attention, e.g. "Waiting 2 days for Alex". Null for plain bookings. */
  reason: string | null;
  actions: WeekItemAction[];
  /** In-app route to open it. */
  href: string | null;
  /** The record it came from, for the action handlers. */
  raw: unknown;
}

export interface WeekDayItems {
  dayKey: string;
  items: WeekItem[];
  /** Booked or pending items that day, for the load dots. */
  load: number;
  /** Something that day needs this player's answer. */
  hasWaiting: boolean;
}
