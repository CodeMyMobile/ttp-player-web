const DATE_TIME_FIELDS = [
  "dateTime",
  "start_date_time",
  "startDateTime",
  "startsAt",
];

function getStartValue(match = {}) {
  for (const field of DATE_TIME_FIELDS) {
    if (match?.[field]) return match[field];
  }
  return null;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOffsetMinutes(match = {}) {
  const raw = match.utc_offset_minutes ?? match.utcOffsetMinutes;
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function validTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return null;
  }
}

function getFormatOptions(match = {}) {
  const timeZone = validTimeZone(match.timezone);
  if (timeZone) return { timeZone };
  const offsetMinutes = parseOffsetMinutes(match);
  if (offsetMinutes !== null) return { offsetMinutes };
  return {};
}

function formatDate(date, options, formatOptions) {
  if (!date) return "";
  const { offsetMinutes, timeZone } = options;
  if (timeZone) {
    return new Intl.DateTimeFormat("en-US", {
      ...formatOptions,
      timeZone,
    }).format(date);
  }
  if (offsetMinutes !== undefined) {
    return new Intl.DateTimeFormat("en-US", {
      ...formatOptions,
      timeZone: "UTC",
    }).format(new Date(date.getTime() + offsetMinutes * 60000));
  }
  return new Intl.DateTimeFormat("en-US", formatOptions).format(date);
}

export function getMatchWallDate(match = {}) {
  const date = parseDate(getStartValue(match));
  if (!date) return null;
  const { offsetMinutes, timeZone } = getFormatOptions(match);
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    ));
  }
  if (offsetMinutes !== undefined) {
    return new Date(date.getTime() + offsetMinutes * 60000);
  }
  return date;
}

export function formatMatchTimeForDisplay(match = {}) {
  const date = parseDate(getStartValue(match));
  return formatDate(date, getFormatOptions(match), {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMatchDateTimeForDisplay(match = {}) {
  const date = parseDate(getStartValue(match));
  return formatDate(date, getFormatOptions(match), {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
