const padCalendarPart = (value) => String(value).padStart(2, "0");

const toUtcCalendarStamp = (date) =>
  [
    date.getUTCFullYear(),
    padCalendarPart(date.getUTCMonth() + 1),
    padCalendarPart(date.getUTCDate()),
  ].join("") +
  "T" +
  [
    padCalendarPart(date.getUTCHours()),
    padCalendarPart(date.getUTCMinutes()),
    padCalendarPart(date.getUTCSeconds()),
  ].join("") +
  "Z";

const toLocalCalendarStamp = (date) =>
  [
    date.getFullYear(),
    padCalendarPart(date.getMonth() + 1),
    padCalendarPart(date.getDate()),
  ].join("") +
  "T" +
  [
    padCalendarPart(date.getHours()),
    padCalendarPart(date.getMinutes()),
    padCalendarPart(date.getSeconds()),
  ].join("");

const sanitizeCalendarText = (value) =>
  (value || "")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,");

export const createIcsContent = ({
  title,
  description,
  location,
  start,
  end,
  uidPrefix = "match",
}) => {
  if (!(start instanceof Date)) {
    throw new Error("ICS start date must be a Date instance");
  }

  const endDate = end instanceof Date ? end : start;
  const summary = sanitizeCalendarText(title || "Tennis Match");
  const body = description ? sanitizeCalendarText(description) : "";
  const place = location ? sanitizeCalendarText(location) : "";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TTP Play Dates//Match Details//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uidPrefix}-${Date.now()}@ttp-play-dates`,
    `DTSTAMP:${toUtcCalendarStamp(new Date())}`,
    `DTSTART:${toLocalCalendarStamp(start)}`,
    `DTEND:${toLocalCalendarStamp(endDate)}`,
    `SUMMARY:${summary}`,
    body ? `DESCRIPTION:${body}` : null,
    place ? `LOCATION:${place}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\n");
};

export const downloadICSFile = (details, filename = "tennis-match.ics") => {
  try {
    const content = createIcsContent(details);
    const blob = new Blob([content], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to generate ICS file", error);
    throw error;
  }
};

const openWindow = (url) => {
  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (!newWindow) {
    throw new Error("Unable to open calendar window. Check pop-up blocker settings.");
  }
};

export const openGoogleCalendar = ({ title, description, location, start, end }) => {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    throw new Error("Missing event start time");
  }
  const endDate = end instanceof Date && !Number.isNaN(end.getTime()) ? end : start;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Tennis Match",
    dates: `${toLocalCalendarStamp(start)}/${toLocalCalendarStamp(endDate)}`,
  });
  if (description) params.set("details", description);
  if (location) params.set("location", location);
  openWindow(`https://calendar.google.com/calendar/render?${params.toString()}`);
};

export const openOutlookCalendar = ({ title, description, location, start, end }) => {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    throw new Error("Missing event start time");
  }
  const endDate = end instanceof Date && !Number.isNaN(end.getTime()) ? end : start;
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    startdt: start.toISOString(),
    enddt: endDate.toISOString(),
    subject: title || "Tennis Match",
  });
  if (description) params.set("body", description);
  if (location) params.set("location", location);
  openWindow(`https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`);
};

export const DEFAULT_EVENT_DURATION_MINUTES = 120;

export const ensureEventEnd = (start, end, fallbackMinutes = DEFAULT_EVENT_DURATION_MINUTES) => {
  if (end instanceof Date && !Number.isNaN(end.getTime())) return end;
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return null;
  const minutes = Number.isFinite(fallbackMinutes) && fallbackMinutes > 0 ? fallbackMinutes : DEFAULT_EVENT_DURATION_MINUTES;
  return new Date(start.getTime() + minutes * 60 * 1000);
};

export const calendarHelpers = {
  padCalendarPart,
  toUtcCalendarStamp,
  toLocalCalendarStamp,
};

export default {
  createIcsContent,
  downloadICSFile,
  openGoogleCalendar,
  openOutlookCalendar,
  ensureEventEnd,
  DEFAULT_EVENT_DURATION_MINUTES,
  calendarHelpers,
};
