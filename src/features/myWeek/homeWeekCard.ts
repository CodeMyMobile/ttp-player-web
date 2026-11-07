import type { WeekDayItems, WeekItem } from "./types";

/**
 * What the Home page's My Week card shows. Pure, so it's tested without rendering.
 */

/** Booked items this week: the "3 booked" in the header. */
export const bookedCount = (days: WeekDayItems[]): number =>
  days.reduce((sum, day) => sum + day.items.filter((item) => item.state === "booked").length, 0);

export interface NextUp {
  item: WeekItem;
  /** On today's date: the card says "Today" rather than naming the day. */
  isToday: boolean;
}

/**
 * The next booked item still to come this week: today's first, otherwise the soonest later in
 * the week. Booked only: an invite not yet accepted would read as a plan. Waiting items have
 * their own line (waitingLine). Null when nothing booked is ahead.
 */
export const nextUp = (days: WeekDayItems[], now: number): NextUp | null => {
  const todayKey = days[0]?.dayKey;
  for (const day of days) {
    const next = day.items
      .filter((item) => item.state === "booked" && item.time.kind === "fixed" && item.time.startsAt >= now)
      .sort((a, b) => (a.time.kind === "fixed" && b.time.kind === "fixed" ? a.time.startsAt - b.time.startsAt : 0))[0];
    if (next) return { item: next, isToday: day.dayKey === todayKey };
  }
  return null;
};

const tokenOf = (item: WeekItem): string | null => {
  const token = (item.raw as { token?: unknown } | null)?.token;
  return typeof token === "string" && token ? token : null;
};

/**
 * The red line under the strip, counting only what Home's invite card isn't already showing.
 *
 *   - The card shows the only thing waiting: no line.
 *   - The card shows one of several: "+2 more waiting on you".
 *   - No card (or it shows an invite My Week doesn't hold): "3 waiting on you".
 *
 * `waiting` is everything that needs an answer, this week and later.
 */
export const waitingLine = (waiting: WeekItem[], inviteCardToken: string | null | undefined): string | null => {
  const covered = Boolean(inviteCardToken) && waiting.some((item) => tokenOf(item) === inviteCardToken);
  const remaining = waiting.length - (covered ? 1 : 0);
  if (remaining <= 0) return null;
  return covered ? `+${remaining} more waiting on you` : `${remaining} waiting on you`;
};
