// Copy for the v2 "Play this week" cards.
//
// Separate from utils/activityFeed, which is the shared normalisation the legacy
// dashboard also uses. This module is v2 presentation only: the mockups use a
// different type vocabulary ("Match play", sentence case) from getTypeConfig's
// ("Match", title case), and the legacy dashboard still renders the latter.

export type FeedType = "private" | "group" | "external" | "match";

export interface FeedItem {
  type?: string;
  title?: string | null;
  /** "h:mm A", already formatted by the builders. */
  time?: string | null;
  dayKey?: string | null;
  location?: string | null;
  /** Distance, e.g. "7.7 mi" — and for group lessons, the coach name too. */
  secondaryMeta?: string | null;
  price?: number | null;
  /** Set when a collapsed card's slots disagree on price. */
  priceFrom?: boolean;
  /** How many open slots this card stands for. */
  slotCount?: number;
  destination?: string | null;
  [key: string]: unknown;
}

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const TYPE_LABELS: Record<string, string> = {
  private: "Private lesson",
  group: "Group lesson",
  external: "External lesson",
  match: "Match play",
};

/** Sentence case, per the mockups. Unknown types fall back rather than blank. */
export const feedTypeLabel = (type: unknown): string =>
  TYPE_LABELS[String(type ?? "")] ?? "Session";

/** Matches are joined, everything else is booked. */
export const feedCtaLabel = (type: unknown): string =>
  String(type ?? "") === "match" ? "Join" : "Book";

const localDayKey = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * "Today" / "Tomorrow" / "Sat 8 Aug".
 *
 * Compared as local calendar days rather than by subtracting milliseconds, so a
 * late-evening session is still "Today" and a DST boundary cannot shift it.
 */
export const feedDayLabel = (dayKey: unknown, now: Date = new Date()): string | null => {
  const key = text(dayKey);
  if (!key) return null;

  if (key === localDayKey(now)) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === localDayKey(tomorrow)) return "Tomorrow";

  const parts = key.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(date.valueOf())) return null;

  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(date);
};

/**
 * "Today · 12:00 PM", or for a coach with several open slots that day,
 * "Today · 4 slots from 9:00 AM". Falls back to whichever half exists.
 */
export const feedTimeLabel = (item: FeedItem | null, now: Date = new Date()): string | null => {
  const time = text(item?.time);
  const slots = typeof item?.slotCount === "number" ? item.slotCount : 1;
  const clock = time && slots > 1 ? `${slots} slots from ${time}` : time;

  const parts = [feedDayLabel(item?.dayKey, now), clock].filter(
    (part): part is string => part !== null && part !== undefined,
  );
  return parts.length ? parts.join(" · ") : null;
};

/** "1880 Loma Vista Dr · 7.7 mi", or one half, or nothing. Never a bare separator. */
export const feedMetaLabel = (item: FeedItem | null): string | null => {
  const parts = [text(item?.location), text(item?.secondaryMeta)].filter(
    (part): part is string => part !== null,
  );
  return parts.length ? parts.join(" · ") : null;
};

/**
 * "Free" for a genuine zero, "$25" for a price, and null when we simply don't
 * know — an unknown price must not render as "Free". This is the zero-versus-null
 * rule that has already caused two bugs on this screen.
 */
export const feedPriceLabel = (price: unknown, from = false): string | null => {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (price <= 0) return "Free";
  const amount = `$${Number.isInteger(price) ? price : price.toFixed(2)}`;
  // A collapsed coach card covers slots that may not share a price, so it says
  // "From $80" rather than quoting a figure the player might not be able to book.
  return from ? `From ${amount}` : amount;
};

/**
 * Initials only when they are genuinely initials.
 *
 * The builders put a coach's initials here for private lessons but an emoji
 * badge ("👥", "🏆", "↗") for everything else — a placeholder from the legacy
 * card, not something the mockups draw. Anything that is not one to three
 * letters is treated as no initials, so the card falls through to its type icon
 * instead of rendering an arrow glyph in a circle.
 */
export const feedInitials = (avatar: unknown): string | null => {
  const value = text(avatar);
  if (!value) return null;
  return /^[A-Za-z]{1,3}$/.test(value) ? value.toUpperCase() : null;
};
