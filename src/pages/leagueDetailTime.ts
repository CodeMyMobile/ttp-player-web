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
