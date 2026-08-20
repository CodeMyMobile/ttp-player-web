// Bookings this week, unioned client-side.
//
// There is no aggregate endpoint, so the tile merges the sources that carry a
// real start time. League fixtures are deliberately NOT one of them: a
// LeagueFixture records who owes whom a match plus played_date (when it was
// played), not a scheduled slot — so it cannot answer "next Sat 10 AM". A
// league match becomes a booking here once it is arranged as an actual match,
// which comes through the matches source.

import { parseFloatingLocal } from "./floatingTime";

export type BookingKind = "lesson" | "group" | "match";

export interface WeekBooking {
  id: string;
  kind: BookingKind;
  /** Epoch ms. */
  startsAt: number;
  /**
   * Both optional and both genuinely absent for some sources — the today row
   * needs "Cardio tennis · Penmar", but only group lessons and matches carry
   * the parts. Null means we could not read it, never "" or a placeholder, so
   * the row can omit the line rather than render a gap.
   */
  title?: string | null;
  location?: string | null;
}

export interface WeekBookingsSummary {
  count: number;
  next: WeekBooking | null;
}

const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

const toEpoch = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const numeric = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Trim to a usable string, or null. Keeps "" and whitespace out of labels. */
const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const pick = (source: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (value != null && value !== "") return value;
  }
  return null;
};

/**
 * Rolling 7 days from now, anchored to the viewer's local timezone.
 *
 * The backend's anchor is only confirmed for lessons (America/Los_Angeles, via
 * utils/lessonTime); matches and fixtures are unconfirmed — see question 2 for
 * Sahil in docs/home-backend-audit-v2.md. Local is the honest default until
 * that is answered: it is right for the common case of a player in their own
 * timezone, and wrong in a way that is visible rather than silent.
 */
export const isWithinWeek = (startsAt: number, now: number) =>
  startsAt >= now && startsAt < now + WEEK_MS;

/**
 * Same local-timezone anchor as isWithinWeek, and for the today row it is the
 * whole point: a lesson at 11pm local is today, while the same instant is
 * already tomorrow in UTC. Comparing calendar parts rather than a ms window
 * keeps that correct across a DST boundary, where a "day" is 23 or 25 hours.
 */
export const isLocalToday = (startsAt: number, now: number) => {
  const at = new Date(startsAt);
  const today = new Date(now);
  return (
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate()
  );
};

/**
 * The soonest booking still to come today, or null. Null is the only "nothing
 * today" answer — never a zero-ish booking — so the row renders or it doesn't.
 */
export const nextTodayBooking = (
  bookings: WeekBooking[],
  now: number = Date.now(),
): WeekBooking | null => {
  const today = (Array.isArray(bookings) ? bookings : [])
    .filter(
      (booking) =>
        Number.isFinite(booking?.startsAt) &&
        booking.startsAt >= now &&
        isLocalToday(booking.startsAt, now),
    )
    .sort((a, b) => a.startsAt - b.startsAt);

  return today[0] ?? null;
};

/**
 * "Today, 6:00 PM" — the today row's headline.
 *
 * Minutes are always shown, unlike nextBookingLabel above, which drops ":00".
 * That is not an inconsistency to tidy away: the mockups use both forms, the
 * compact "Next Sat 10 AM" in the tile and the full "Today, 6:00 PM" here.
 */
export const todayTimeLabel = (booking: WeekBooking | null) => {
  if (!booking) return null;
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(booking.startsAt));
  return `Today, ${time}`;
};

/**
 * "Cardio tennis · Penmar", or just one part, or null when we have neither.
 * Never a bare separator.
 */
export const bookingMetaLabel = (booking: WeekBooking | null) => {
  if (!booking) return null;
  const parts = [booking.title, booking.location].filter(
    (part): part is string => typeof part === "string" && part.trim() !== "",
  );
  return parts.length ? parts.join(" · ") : null;
};

export const summariseWeekBookings = (
  bookings: WeekBooking[],
  now: number = Date.now(),
): WeekBookingsSummary => {
  const upcoming = bookings
    .filter((booking) => Number.isFinite(booking.startsAt) && isWithinWeek(booking.startsAt, now))
    .sort((a, b) => a.startsAt - b.startsAt);

  // De-duplicate: a league match can surface as both a match and a fixture.
  const seen = new Set<string>();
  const unique = upcoming.filter((booking) => {
    const key = `${booking.kind}:${booking.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { count: unique.length, next: unique[0] ?? null };
};

// --- adapters ---------------------------------------------------------------

/**
 * Private lessons. Confirmed is status 1 AND payment_status 1, matching the
 * numeric convention the group-lesson helpers already use.
 */
export const lessonsToBookings = (rows: unknown[]): WeekBooking[] =>
  (Array.isArray(rows) ? rows : []).flatMap((raw) => {
    const row = raw as Record<string, unknown>;
    const startsAt = toEpoch(
      pick(row, ["start_date_time_tz", "start_date_time", "startTime"]),
    );
    if (startsAt === null) return [];
    if (numeric(row.status) !== 1) return [];
    if (numeric(row.payment_status) !== 1) return [];
    // PlayerLesson declares only id/status/startTime/endTime/coachId — a title
    // and venue are not part of the contract, so probe and accept null. A 1:1
    // lesson today then shows its time with no sub-line, which is honest.
    return [
      {
        id: String(row.id ?? startsAt),
        kind: "lesson" as const,
        startsAt,
        title: text(pick(row, ["lesson_type_name", "title", "name"])),
        location: text(pick(row, ["location_name", "location", "venue"])),
      },
    ];
  });

/**
 * Group lessons. Takes the mapped GroupLesson shape and the caller's own
 * "does this player hold a spot" test, so the confirmed rule stays in
 * api/groupLessons rather than being restated here.
 */
export const groupLessonsToBookings = (
  lessons: Array<{
    id?: unknown;
    startDateTime?: string | null;
    title?: string | null;
    locationName?: string | null;
  }>,
  holdsSpot: (lesson: unknown) => boolean,
): WeekBooking[] =>
  (Array.isArray(lessons) ? lessons : []).flatMap((lesson) => {
    // startDateTime here is the raw start_date_time, which is a venue wall
    // clock stamped Z rather than a real instant — verified against production:
    // a 9am class comes back as "2026-08-20T09:00:00.000Z". Reading it with
    // toEpoch honours that fictional Z, which moved the tile by the venue's
    // offset and pushed evening classes into the following day entirely.
    //
    // Only this source is treated as floating. The 1:1 lesson and match
    // sources still use toEpoch, because their payloads have not been seen and
    // assuming they match would risk breaking two that may be correct.
    const floating = parseFloatingLocal(lesson?.startDateTime);
    const startsAt = floating ? floating.getTime() : toEpoch(lesson?.startDateTime);
    if (startsAt === null) return [];
    if (!holdsSpot(lesson)) return [];
    // title and locationName are both declared on the mapped GroupLesson.
    return [
      {
        id: String(lesson.id ?? startsAt),
        kind: "group" as const,
        startsAt,
        title: text(lesson.title),
        location: text(lesson.locationName),
      },
    ];
  });

/**
 * Matches. Confirmed means the viewer is hosting or participating — a pending
 * invite has neither, which is how invites stay out of the count.
 */
export const matchesToBookings = (
  matches: Array<{
    id?: unknown;
    relationship?: string;
    startDateTimeIso?: string | null;
    format?: string | null;
    location?: string | null;
  }>,
): WeekBooking[] =>
  (Array.isArray(matches) ? matches : []).flatMap((match) => {
    const startsAt = toEpoch(match?.startDateTimeIso);
    if (startsAt === null) return [];
    if (match.relationship !== "host" && match.relationship !== "participant") return [];
    // format and location both come off normalizeMatchRecord — utils/homeAlerts
    // already reads the same two fields for the legacy dashboard alerts.
    return [
      {
        id: String(match.id ?? startsAt),
        kind: "match" as const,
        startsAt,
        title: text(match.format),
        location: text(match.location),
      },
    ];
  });

/** "Next Sat 10 AM" — the tile's sub-line. */
export const nextBookingLabel = (booking: WeekBooking | null, now: number = Date.now()) => {
  if (!booking) return null;
  const date = new Date(booking.startsAt);
  const today = new Date(now);
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: date.getMinutes() ? "2-digit" : undefined,
  }).format(date);

  if (sameDay) return `Next today, ${time}`;
  const day = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
  return `Next ${day} ${time}`;
};
