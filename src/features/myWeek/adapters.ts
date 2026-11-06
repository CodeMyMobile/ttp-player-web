import { holdsGroupSpot } from "../../api/groupLessons";
import { isCancelledGroupLessonRecord } from "../../utils/groupLessonCancellation";
import { matchesViewer } from "../../utils/leagueSeason";
import { isInWeek, isWallClockLessonType, readLessonStart, readStart, type WeekDay } from "../../utils/weekDays";
import type { WeekDayItems, WeekItem, WeekPerson } from "./types";

/**
 * Turns each My Week source into WeekItems. Pure: the loader fetches, these decide.
 *
 * The viewer is matched by id, name or email (buildViewerIdentities), not by id alone: a
 * participant's player_id and the account id aren't always the same number.
 */

const HOUR_MS = 60 * 60 * 1000;
// A sent invite needs a nudge once it has waited this long, or once the match is this close.
export const STALE_INVITE_AFTER_MS = 48 * HOUR_MS;
export const STALE_INVITE_BEFORE_START_MS = 24 * HOUR_MS;
// League fixtures are due in the league's final week: end_date within the next 7 days.
const ACTIVE_PARTICIPANT_STATUSES = new Set(["hosting", "confirmed"]);

type Row = Record<string, unknown>;

const asRows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object") : [];

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const idOf = (value: unknown): string | null =>
  value === null || value === undefined || value === "" ? null : String(value);

const profileOf = (row: Row): Row => (row.profile && typeof row.profile === "object" ? (row.profile as Row) : {});

const personFrom = (row: Row, idKey: string): WeekPerson | null => {
  const profile = profileOf(row);
  const name = text(profile.full_name) ?? text(row.full_name) ?? text(row.name);
  if (!name) return null;
  return {
    id: idOf(row[idKey]),
    name,
    photoUrl: text(profile.profile_picture) ?? text(row.profile_picture),
  };
};

const isMe = (identities: Set<string>, row: Row, idKey: string) => {
  const profile = profileOf(row);
  return matchesViewer(identities, row[idKey], row.email, profile.email, row.full_name, profile.full_name);
};

const firstName = (name: string) => name.split(/\s+/)[0] || name;

const shortDay = (dayKey: string) =>
  new Date(`${dayKey}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

// --- lessons ----------------------------------------------------------------------------

/**
 * /player/upcoming_lessons. Private and semi-private lessons (types 1 and 2) count once the
 * coach confirms them (status 1). Group classes (3 and 4) count when this player's own place
 * holds a spot and the coach hasn't cancelled the class.
 */
export const lessonsToWeekItems = (rows: unknown, identities: Set<string>, days: WeekDay[]): WeekItem[] =>
  asRows(rows).flatMap((row): WeekItem[] => {
    if (row.is_deleted === true) return [];
    const start = readLessonStart(row);
    if (!start || !isInWeek(start.dayKey, days)) return [];

    const groupClass = isWallClockLessonType(row.lessontype_id);
    const players = asRows(row.group_players);
    if (groupClass) {
      if (isCancelledGroupLessonRecord(row)) return [];
      const mine = players.find((player) => isMe(identities, player, "player_id"));
      if (!mine) return [];
      if (!holdsGroupSpot(mine.status as number, mine.payment_status as number, mine.payment_method as string)) {
        return [];
      }
    } else if (Number(row.status) !== 1) {
      return [];
    }

    const coach = text(row.full_name);
    const kind = text(row.lesson_type_name) ?? (groupClass ? "Group lesson" : "Lesson");
    return [
      {
        id: `${groupClass ? "groupLesson" : "lesson"}:${row.id}`,
        source: groupClass ? "groupLesson" : "lesson",
        type: "lesson",
        state: "booked",
        needsResponse: false,
        dayKey: start.dayKey,
        time: { kind: "fixed", startsAt: start.startsAt },
        title: coach ? `${kind} with ${coach}` : kind,
        subtitle: text(row.location),
        people: players
          .filter((player) => !isMe(identities, player, "player_id"))
          .map((player) => personFrom(player, "player_id"))
          .filter((person): person is WeekPerson => Boolean(person)),
        reason: null,
        actions: ["open"],
        href: `/player/lesson/${row.id}`,
        raw: row,
      },
    ];
  });

// --- matches ----------------------------------------------------------------------------

/**
 * Whether this player is still in a match from GET /matches?filter=my. That list joins
 * participants without checking their status, so a match the player left still comes back.
 * When their own row can't be found the server's scoping is trusted, as on Home.
 */
export const isActiveInMatch = (match: Row, identities: Set<string>): boolean => {
  const mine = asRows(match.participants).find((participant) => isMe(identities, participant, "player_id"));
  if (mine) return ACTIVE_PARTICIPANT_STATUSES.has(String(mine.status));
  return !["cancelled", "completed"].includes(String(match.status));
};

const matchTitle = (match: Row) => {
  if (match.is_league_match === true) return "League match";
  const location = text(match.location_text) ?? text(match.location);
  return location ? `Match at ${location}` : "Match";
};

/** Matches this player is hosting or playing in, this week. */
export const myMatchesToWeekItems = (rows: unknown, identities: Set<string>, days: WeekDay[]): WeekItem[] =>
  asRows(rows).flatMap((match): WeekItem[] => {
    if (!isActiveInMatch(match, identities)) return [];
    const start = readStart(match.start_date_time, "instant");
    if (!start || !isInWeek(start.dayKey, days)) return [];
    return [
      {
        id: `match:${match.id}`,
        source: "match",
        type: "match",
        state: "booked",
        needsResponse: false,
        dayKey: start.dayKey,
        time: { kind: "fixed", startsAt: start.startsAt },
        title: matchTitle(match),
        subtitle: match.is_league_match === true ? text(match.location_text) : text(match.format) ?? text(match.match_format),
        people: asRows(match.participants)
          .filter((participant) => ACTIVE_PARTICIPANT_STATUSES.has(String(participant.status)))
          .filter((participant) => !isMe(identities, participant, "player_id"))
          .map((participant) => personFrom(participant, "player_id"))
          .filter((person): person is WeekPerson => Boolean(person)),
        reason: null,
        actions: ["open"],
        href: `/matches/${match.id}`,
        raw: match,
      },
    ];
  });

/** Whether a sent invite has waited 48 hours, or the match starts within 24 hours. */
export const isStaleSentInvite = (invite: Row, matchStartsAt: number, now: number): boolean => {
  const sentAt = Date.parse(String(invite.created_at ?? ""));
  const waitedTooLong = Number.isFinite(sentAt) && now - sentAt >= STALE_INVITE_AFTER_MS;
  return waitedTooLong || matchStartsAt - now <= STALE_INVITE_BEFORE_START_MS;
};

const waitedLabel = (invite: Row, now: number) => {
  const sentAt = Date.parse(String(invite.created_at ?? ""));
  if (!Number.isFinite(sentAt)) return null;
  const hours = Math.floor((now - sentAt) / HOUR_MS);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  const daysWaited = Math.floor(hours / 24);
  return `${daysWaited} day${daysWaited === 1 ? "" : "s"}`;
};

/**
 * Invites this player sent that haven't been answered, one item per match. It needs a response
 * (a nudge) once any of them is stale.
 */
export const sentInvitesToWeekItems = (
  rows: unknown,
  identities: Set<string>,
  days: WeekDay[],
  now: number,
): WeekItem[] =>
  asRows(rows).flatMap((match): WeekItem[] => {
    if (!isActiveInMatch(match, identities)) return [];
    const start = readStart(match.start_date_time, "instant");
    if (!start || !isInWeek(start.dayKey, days) || start.startsAt <= now) return [];

    const iHost = matchesViewer(identities, match.host_id);
    const waiting = asRows(match.invitees).filter((invite) => {
      if (String(invite.status ?? "pending") !== "pending" || invite.joined === true) return false;
      const expires = Date.parse(String(invite.expires_at ?? ""));
      if (Number.isFinite(expires) && expires <= now) return false;
      return invite.inviter_id !== undefined && invite.inviter_id !== null
        ? matchesViewer(identities, invite.inviter_id)
        : iHost;
    });
    if (!waiting.length) return [];

    const people = waiting
      .map((invite) => personFrom(invite, "invitee_id"))
      .filter((person): person is WeekPerson => Boolean(person));
    const stale = waiting.some((invite) => isStaleSentInvite(invite, start.startsAt, now));
    const oldest = waiting.reduce((a, b) =>
      Date.parse(String(a.created_at ?? "")) <= Date.parse(String(b.created_at ?? "")) ? a : b,
    );
    const who =
      people.length === 1 ? firstName(people[0].name) : people.length > 1 ? `${people.length} players` : "your invite";
    const waited = waitedLabel(oldest, now);
    return [
      {
        id: `sentInvite:${match.id}`,
        source: "sentInvite",
        type: "match",
        state: "pending",
        needsResponse: stale,
        dayKey: start.dayKey,
        time: { kind: "fixed", startsAt: start.startsAt },
        title: matchTitle(match),
        subtitle: null,
        people,
        reason: `Waiting on ${who}${waited ? ` · ${waited}` : ""}`,
        actions: stale ? ["nudge", "open"] : ["open"],
        href: `/matches/${match.id}`,
        raw: { match, invites: waiting },
      },
    ];
  });

/** Invites to this player's week, waiting for their yes or no. */
export const receivedInvitesToWeekItems = (rows: unknown, days: WeekDay[], now: number): WeekItem[] =>
  asRows(rows).flatMap((invite): WeekItem[] => {
    if (String(invite.status ?? "pending") !== "pending") return [];
    const expires = Date.parse(String(invite.expires_at ?? ""));
    if (Number.isFinite(expires) && expires <= now) return [];
    const match = invite.match && typeof invite.match === "object" ? (invite.match as Row) : null;
    if (!match || match.archived === true) return [];
    const start = readStart(match.start_date_time, "instant");
    if (!start || !isInWeek(start.dayKey, days) || start.startsAt <= now) return [];

    const inviter = invite.inviter && typeof invite.inviter === "object" ? (invite.inviter as Row) : {};
    const inviterName = text(inviter.full_name);
    const token = text(invite.token);
    return [
      {
        id: `invite:${invite.id ?? match.id}`,
        source: "invite",
        type: "match",
        state: "pending",
        needsResponse: true,
        dayKey: start.dayKey,
        time: { kind: "fixed", startsAt: start.startsAt },
        title: matchTitle(match),
        subtitle: text(match.location_text),
        // Name and photo only, whatever else the API sends about the inviter.
        people: inviterName
          ? [{ id: idOf(inviter.user_id ?? invite.inviter_id), name: inviterName, photoUrl: text(inviter.profile_picture) }]
          : [],
        reason: inviterName ? `${firstName(inviterName)} invited you` : "You're invited",
        actions: ["accept", "decline", "open"],
        href: token ? `/invites/${token}` : `/matches/${match.id}`,
        raw: invite,
      },
    ];
  });

// --- leagues ----------------------------------------------------------------------------

export interface LeagueWithFixtures {
  league: Row;
  fixtures: unknown;
}

/** A league's end_date as a local day key, or null. Dates come as "2026-11-10" or "…T00:00:00Z". */
export const leagueEndDayKey = (league: Row): string | null => {
  const value = text(league.end_date);
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
};

/**
 * Unplayed fixtures in a league ending this week: due before end_date. A fixture already
 * booked as a league match against the same opponent isn't due; it's on the week as that match.
 */
export const leagueDueToWeekItems = (
  leagues: LeagueWithFixtures[],
  identities: Set<string>,
  days: WeekDay[],
  bookedMatches: unknown,
): WeekItem[] => {
  const booked = asRows(bookedMatches).filter((match) => match.is_league_match === true);
  return leagues.flatMap(({ league, fixtures }) => {
    const endDay = leagueEndDayKey(league);
    if (!endDay || !isInWeek(endDay, days)) return [];
    const leagueName = text(league.name);
    return asRows(fixtures).flatMap((fixture): WeekItem[] => {
      const status = String(fixture.status ?? "scheduled");
      if (status !== "scheduled" || fixture.match_result_id || fixture.played_date || text(fixture.score)) return [];

      const iAmPlayer1 = matchesViewer(identities, fixture.player1_id, fixture.player1_name);
      const opponentId = iAmPlayer1 ? fixture.player2_id : fixture.player1_id;
      const opponentName = text(iAmPlayer1 ? fixture.player2_name : fixture.player1_name);

      const alreadyBooked = booked.some(
        (match) =>
          String(match.league_id) === String(league.id) &&
          asRows(match.participants).some((participant) =>
            matchesViewer(
              new Set([String(opponentId ?? ""), (opponentName ?? "").toLowerCase()].filter(Boolean)),
              participant.player_id,
              profileOf(participant).full_name,
            ),
          ),
      );
      if (alreadyBooked) return [];

      return [
        {
          id: `leagueDue:${fixture.id}`,
          source: "leagueDue",
          type: "match",
          state: "pending",
          needsResponse: true,
          dayKey: endDay,
          time: { kind: "flexible", label: `Due by ${shortDay(endDay)}` },
          title: opponentName ? `League match vs ${opponentName}` : "League match to play",
          subtitle: leagueName,
          people: opponentName ? [{ id: idOf(opponentId), name: opponentName, photoUrl: null }] : [],
          reason: `${leagueName ?? "The league"} ends ${shortDay(endDay)}`,
          actions: ["schedule", "open"],
          href: `/leagues/${league.id}/dashboard`,
          raw: { league, fixture },
        },
      ];
    });
  });
};

// --- the week ---------------------------------------------------------------------------

const sortKey = (item: WeekItem) => (item.time.kind === "fixed" ? item.time.startsAt : Number.MAX_SAFE_INTEGER);

/**
 * Groups items into the week's days, dropping duplicates by id, and an invite for a match
 * that's already on the week as a booking.
 */
export const groupWeek = (items: WeekItem[], days: WeekDay[]): WeekDayItems[] => {
  const seen = new Set<string>();
  const bookedMatchIds = new Set(
    items.filter((item) => item.source === "match").map((item) => item.id.slice("match:".length)),
  );
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    if (item.source === "invite") {
      const match = (item.raw as Row)?.match as Row | undefined;
      if (match && bookedMatchIds.has(String(match.id))) return false;
    }
    return true;
  });

  return days.map(({ dayKey }) => {
    const dayItems = unique.filter((item) => item.dayKey === dayKey).sort((a, b) => sortKey(a) - sortKey(b));
    return {
      dayKey,
      items: dayItems,
      load: dayItems.filter((item) => item.state !== "suggested").length,
      hasWaiting: dayItems.some((item) => item.needsResponse),
    };
  });
};

/** What the My Week badge shows. */
export const countNeedsResponse = (days: WeekDayItems[]): number =>
  days.reduce((sum, day) => sum + day.items.filter((item) => item.needsResponse).length, 0);
