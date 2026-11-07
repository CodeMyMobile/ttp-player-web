import { isInWeek, weekBounds, weekDays } from "../../utils/weekDays";
import {
  leagueDueToWeekItems,
  leagueEndDayKey,
  lessonsToWeekItems,
  myMatchesToWeekItems,
  receivedInvitesToWeekItems,
  sentInvitesToWeekItems,
  type LeagueWithFixtures,
} from "./adapters";
import type { WeekItem, WeekItemSource } from "./types";

/**
 * Fetches the player's week and turns it into WeekItems: booked lessons and matches, invites
 * waiting both ways, and league fixtures due. Every source is fetched at once and fails on its
 * own: a source that fails is named in `errors` and the rest of the week still shows.
 *
 * The API calls are passed in, so this runs in tests without a network.
 */

type Row = Record<string, unknown>;

export interface MyWeekApi {
  upcomingLessons: (options: { to: string }) => Promise<unknown>;
  myMatches: (options: { from: string; to: string }) => Promise<{ matches: unknown[] }>;
  pendingInvites: () => Promise<unknown>;
  myLeagues: () => Promise<unknown>;
  leagueFixtures: (leagueId: string | number) => Promise<unknown>;
}

export type MyWeekErrorSource = Extract<WeekItemSource, "lesson" | "match" | "invite" | "leagueDue">;

export interface MyWeekLoad {
  items: WeekItem[];
  errors: Partial<Record<MyWeekErrorSource, unknown>>;
}

const statusOf = (error: unknown) => Number((error as { status?: unknown } | null)?.status);

const lessonRowsOf = (body: unknown): unknown[] => {
  const record = body as { lessons?: unknown; data?: unknown } | null;
  const rows = record?.lessons ?? record?.data ?? body;
  return Array.isArray(rows) ? rows : [];
};

const inviteRowsOf = (body: unknown): unknown[] => {
  const record = body as { invites?: unknown; data?: { invites?: unknown } } | null;
  const rows = record?.invites ?? record?.data?.invites ?? body;
  return Array.isArray(rows) ? rows : [];
};

/** The player's own leagues: sections.mine, which the API scopes to the player. */
const myLeagueRowsOf = (body: unknown): Row[] => {
  const record = body as { sections?: { mine?: unknown }; leagues?: unknown } | null;
  const rows = record?.sections?.mine ?? record?.leagues;
  return Array.isArray(rows) ? (rows.filter((row) => row && typeof row === "object") as Row[]) : [];
};

export const loadMyWeek = async (api: MyWeekApi, identities: Set<string>, now: Date = new Date()): Promise<MyWeekLoad> => {
  const days = weekDays(now);
  const { start, end } = weekBounds(now);
  const range = { from: start.toISOString(), to: end.toISOString() };
  const errors: MyWeekLoad["errors"] = {};

  const [lessons, matches, invites, leagues] = await Promise.allSettled([
    api.upcomingLessons({ to: range.to }),
    api.myMatches(range),
    api.pendingInvites(),
    api.myLeagues(),
  ]);

  // A 404 from /upcoming_lessons means "no lessons", not a failure.
  const lessonRows =
    lessons.status === "fulfilled" ? lessonRowsOf(lessons.value) : statusOf(lessons.reason) === 404 ? [] : null;
  if (lessonRows === null && lessons.status === "rejected") errors.lesson = lessons.reason;

  const matchRows = matches.status === "fulfilled" ? matches.value.matches ?? [] : [];
  if (matches.status === "rejected") errors.match = matches.reason;

  const inviteRows = invites.status === "fulfilled" ? inviteRowsOf(invites.value) : [];
  if (invites.status === "rejected") errors.invite = invites.reason;

  // Fixtures only for leagues ending this week: the rest have nothing due yet.
  let leagueFixtures: LeagueWithFixtures[] = [];
  if (leagues.status === "fulfilled") {
    const ending = myLeagueRowsOf(leagues.value).filter((league) => {
      const endDay = leagueEndDayKey(league);
      return endDay !== null && isInWeek(endDay, days);
    });
    const fixtures = await Promise.allSettled(ending.map((league) => api.leagueFixtures(league.id as string)));
    leagueFixtures = ending.flatMap((league, index) => {
      const result = fixtures[index];
      if (result.status === "rejected") {
        errors.leagueDue = result.reason;
        return [];
      }
      const body = result.value as { fixtures?: unknown } | null;
      return [{ league, fixtures: body?.fixtures ?? [] }];
    });
  } else {
    errors.leagueDue = leagues.reason;
  }

  const nowMs = now.getTime();
  const items: WeekItem[] = [
    ...lessonsToWeekItems(lessonRows ?? [], identities, days),
    ...myMatchesToWeekItems(matchRows, identities, days),
    ...sentInvitesToWeekItems(matchRows, identities, days, nowMs),
    ...receivedInvitesToWeekItems(inviteRows, days, nowMs),
    ...leagueDueToWeekItems(leagueFixtures, identities, days, matchRows),
  ];
  return { items, errors };
};
