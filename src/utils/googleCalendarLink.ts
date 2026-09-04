/**
 * Builds a Google Calendar "add event" URL.
 *
 * Google wants UTC basic-format timestamps — YYYYMMDDTHHMMSSZ — separated by a slash.
 * It silently ignores a `dates` value it cannot parse and opens an empty event form, so
 * a formatting slip here does not error, it just quietly loses the date. Hence the tests.
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** 20260910T180000Z — Google's basic format, always UTC. */
const toGoogleStamp = (date: Date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T` +
  `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

/**
 * League scheduling matches carry a start but no end — nothing in the flow asks how long
 * a match will run. 90 minutes is the same assumption the group-lesson default uses and
 * is a realistic singles match; the player can adjust it in Google before saving.
 */
export const DEFAULT_MATCH_MINUTES = 90;

export const buildGoogleCalendarUrl = ({
  title,
  startDateTime,
  location,
  details,
  durationMinutes = DEFAULT_MATCH_MINUTES,
}: {
  title: string;
  startDateTime: string | null | undefined;
  location?: string | null;
  details?: string | null;
  durationMinutes?: number;
}): string | null => {
  if (!startDateTime) return null;
  const start = new Date(startDateTime);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toGoogleStamp(start)}/${toGoogleStamp(end)}`,
  });
  if (location) params.set("location", location);
  if (details) params.set("details", details);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
