export const DEFAULT_LEAGUE_TIMEZONE = "America/Los_Angeles";

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timeOnlyPattern = /^\d{2}:\d{2}$/;

const normalizeTimezone = (value?: unknown) => {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_LEAGUE_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_LEAGUE_TIMEZONE;
  }
};

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const parseTimeOnly = (value: string) => new Date(`2000-01-01T${value}:00`);

export const formatLeagueDate = (value?: string | null, timezone?: unknown) => {
  if (!value) return "Date TBD";
  const date = dateOnlyPattern.test(value) ? parseDateOnly(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (!dateOnlyPattern.test(value)) options.timeZone = normalizeTimezone(timezone);

  return date.toLocaleDateString("en-US", options);
};

export const formatLeagueTime = (value?: string | null, timezone?: unknown) => {
  if (!value) return "Time TBD";
  const date = timeOnlyPattern.test(value) ? parseTimeOnly(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  if (!timeOnlyPattern.test(value)) options.timeZone = normalizeTimezone(timezone);

  return date.toLocaleTimeString("en-US", options);
};

// True when a match is today or later. Needs carry `start_date_time` (ISO/UTC);
// suggestions carry `match_date` + `match_time`; some rows use start_at/date. We:
//  - compare against the START OF TODAY (local) so same-day matches still show, and
//  - FAIL OPEN (return true) when no date can be parsed, so an unexpected field
//    shape never silently hides real rows.
export const isFutureLeagueItem = (item: {
  start_date_time?: string | null;
  start_at?: string | null;
  match_date?: string | null;
  match_time?: string | null;
  date?: string | null;
  time?: string | null;
}): boolean => {
  const raw = item.start_date_time || item.start_at || item.match_date || item.date;
  if (!raw) return true; // no date to judge → show it
  const value = String(raw);
  const dt = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T${item.match_time || item.time || "23:59"}`);
  if (Number.isNaN(dt.getTime())) return true; // unparseable → show it
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return dt.getTime() >= startOfToday;
};
