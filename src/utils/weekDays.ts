import { toLocalYmd } from "./dateTime";
import { parseFloatingLocal } from "./floatingTime";

/**
 * Days of the rolling week, and which day an item starts on.
 *
 * Start times reach the app in two kinds, and reading one as the other moves an item by the
 * venue's UTC offset, which for an evening item is a whole day:
 *
 *   - instants: real UTC times. Matches, and private or semi-private lessons'
 *     start_date_time. Their day is the viewer's local day.
 *   - wall clocks: the clock time at the venue, stored with a misleading trailing Z. Open
 *     group lessons (types 3 and 4) and private lessons' start_date_time_tz. Their day is
 *     the date written in them, read with parseFloatingLocal and never with new Date().
 *
 * Day keys are YYYY-MM-DD in the viewer's local time. The week is built with local
 * setDate(), so a daylight saving change inside the week still yields seven calendar days.
 */

export const WEEK_LENGTH = 7;

export interface WeekDay {
  /** YYYY-MM-DD, local. */
  dayKey: string;
  /** Local midnight that starts the day. */
  start: Date;
}

/** Today and the six days after it. */
export const weekDays = (now: Date = new Date()): WeekDay[] =>
  Array.from({ length: WEEK_LENGTH }, (_, offset) => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return { dayKey: toLocalYmd(start), start };
  });

/** Local midnight today, and local midnight after the last day: [start, end). */
export const weekBounds = (now: Date = new Date()): { start: Date; end: Date } => ({
  start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + WEEK_LENGTH),
});

export type TimeKind = "instant" | "wallClock";

export interface ReadStart {
  /** Epoch ms, comparable with Date.now(). */
  startsAt: number;
  dayKey: string;
}

/** Reads a start time of the given kind. Null when it isn't a time. */
export const readStart = (value: unknown, kind: TimeKind): ReadStart | null => {
  if (kind === "wallClock") {
    const local = parseFloatingLocal(value);
    return local ? { startsAt: local.getTime(), dayKey: toLocalYmd(local) } : null;
  }
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : { startsAt: instant.getTime(), dayKey: toLocalYmd(instant) };
};

/** Open group lessons. Their start_date_time is a wall clock. */
export const isWallClockLessonType = (lessonTypeId: unknown): boolean => {
  const type = Number(lessonTypeId);
  return type === 3 || type === 4;
};

/**
 * A lesson row's start from /player/upcoming_lessons (or anywhere with the same fields),
 * using the right reading for its type.
 */
export const readLessonStart = (row: {
  lessontype_id?: unknown;
  start_date_time?: unknown;
  start_date_time_tz?: unknown;
}): ReadStart | null => {
  if (isWallClockLessonType(row.lessontype_id)) return readStart(row.start_date_time, "wallClock");
  return readStart(row.start_date_time_tz, "wallClock") ?? readStart(row.start_date_time, "instant");
};

/** Whether `dayKey` is one of the week's days. */
export const isInWeek = (dayKey: string, days: WeekDay[]): boolean => days.some((day) => day.dayKey === dayKey);
