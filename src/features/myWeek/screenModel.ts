import type { WeekDayItems, WeekItem, WeekItemType } from "./types";

/**
 * How the My Week screen lays the week out. Pure, so it's tested without rendering.
 */

/** One card on the screen: an item, and for a match, the invites the player sent for it. */
export interface WeekCard {
  item: WeekItem;
  /** The sentInvite item for this match: shown on the card as waiting avatars, not as a card. */
  waiting: WeekItem | null;
}

/**
 * The day's cards. A sent-invite item joins its match's card. When that match isn't on the
 * day (it shouldn't happen: they come from the same rows), it stays a card of its own, so
 * nothing that needs a nudge goes missing.
 */
export const dayCards = (items: WeekItem[]): WeekCard[] => {
  const matchIds = new Set(items.filter((item) => item.source === "match").map((item) => item.id.slice("match:".length)));
  const waitingByMatch = new Map(
    items
      .filter((item) => item.source === "sentInvite")
      .map((item) => [item.id.slice("sentInvite:".length), item] as const),
  );
  return items.flatMap((item): WeekCard[] => {
    if (item.source === "sentInvite") {
      return matchIds.has(item.id.slice("sentInvite:".length)) ? [] : [{ item, waiting: null }];
    }
    if (item.source === "match") {
      return [{ item, waiting: waitingByMatch.get(item.id.slice("match:".length)) ?? null }];
    }
    return [{ item, waiting: null }];
  });
};

const atNoon = (dayKey: string) => new Date(`${dayKey}T12:00:00`);

/** "Today", "Tomorrow", or "Sun 8 Nov". */
export const dayHeading = (dayKey: string, todayKey: string, tomorrowKey: string): string => {
  if (dayKey === todayKey) return "Today";
  if (dayKey === tomorrowKey) return "Tomorrow";
  const date = atNoon(dayKey);
  return `${date.toLocaleDateString("en-US", { weekday: "short" })} ${date.getDate()} ${date.toLocaleDateString("en-US", { month: "short" })}`;
};

/** The strip's two lines: "Today" or "Sat", and the day of the month. */
export const stripLabel = (dayKey: string, index: number): { top: string; date: number } => {
  const date = atNoon(dayKey);
  return { top: index === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" }), date: date.getDate() };
};

/** "Fri 6 – Thu 12 Nov", or across months "Mon 30 Nov – Sun 6 Dec". */
export const weekRangeLabel = (days: WeekDayItems[]): string => {
  if (!days.length) return "";
  const first = atNoon(days[0].dayKey);
  const last = atNoon(days[days.length - 1].dayKey);
  const weekday = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short" });
  const month = (date: Date) => date.toLocaleDateString("en-US", { month: "short" });
  const sameMonth = first.getMonth() === last.getMonth();
  return `${weekday(first)} ${first.getDate()}${sameMonth ? "" : ` ${month(first)}`} – ${weekday(last)} ${last.getDate()} ${month(last)}`;
};

/** "7:30 PM", or the flexible label ("Due by Tue"). */
export const timeLabel = (item: WeekItem): string =>
  item.time.kind === "fixed"
    ? new Date(item.time.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : item.time.label;

/** "Sat 15 Nov, 9:00 AM", for the later row. */
export const laterLabel = (item: WeekItem): string => {
  if (item.time.kind !== "fixed") return item.time.label;
  const date = new Date(item.time.startsAt);
  return `${date.toLocaleDateString("en-US", { weekday: "short" })} ${date.getDate()} ${date.toLocaleDateString("en-US", { month: "short" })}, ${timeLabel(item)}`;
};

export const MAX_LOAD_DOTS = 3;

/** One dot per booked or pending card that day, by type, at most three. */
export const loadDots = (day: WeekDayItems): WeekItemType[] =>
  dayCards(day.items)
    .filter(({ item }) => item.state !== "suggested")
    .slice(0, MAX_LOAD_DOTS)
    .map(({ item }) => item.type);

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
