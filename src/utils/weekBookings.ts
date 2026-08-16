// Bookings this week, unioned client-side.
//
// There is no aggregate endpoint, so the tile merges the sources that carry a
// real start time. League fixtures are deliberately NOT one of them: a
// LeagueFixture records who owes whom a match plus played_date (when it was
// played), not a scheduled slot — so it cannot answer "next Sat 10 AM". A
// league match becomes a booking here once it is arranged as an actual match,
// which comes through the matches source.

export type BookingKind = "lesson" | "group" | "match";

export interface WeekBooking {
  id: string;
  kind: BookingKind;
  /** Epoch ms. */
  startsAt: number;
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
    return [{ id: String(row.id ?? startsAt), kind: "lesson" as const, startsAt }];
  });

/**
 * Group lessons. Takes the mapped GroupLesson shape and the caller's own
 * "does this player hold a spot" test, so the confirmed rule stays in
 * api/groupLessons rather than being restated here.
 */
export const groupLessonsToBookings = (
  lessons: Array<{ id?: unknown; startDateTime?: string | null }>,
  holdsSpot: (lesson: unknown) => boolean,
): WeekBooking[] =>
  (Array.isArray(lessons) ? lessons : []).flatMap((lesson) => {
    const startsAt = toEpoch(lesson?.startDateTime);
    if (startsAt === null) return [];
    if (!holdsSpot(lesson)) return [];
    return [{ id: String(lesson.id ?? startsAt), kind: "group" as const, startsAt }];
  });

/**
 * Matches. Confirmed means the viewer is hosting or participating — a pending
 * invite has neither, which is how invites stay out of the count.
 */
export const matchesToBookings = (
  matches: Array<{ id?: unknown; relationship?: string; startDateTimeIso?: string | null }>,
): WeekBooking[] =>
  (Array.isArray(matches) ? matches : []).flatMap((match) => {
    const startsAt = toEpoch(match?.startDateTimeIso);
    if (startsAt === null) return [];
    if (match.relationship !== "host" && match.relationship !== "participant") return [];
    return [{ id: String(match.id ?? startsAt), kind: "match" as const, startsAt }];
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
