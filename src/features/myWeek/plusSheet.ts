import type { WeekItemType } from "./types";
import { planDayFor, type TrainingPlanProgress } from "./trainingPlanProgress";

/**
 * The mobile + button's sheet. With My Week on: New match, Find players, Book a lesson, Add a
 * workout, each in its My Week colour (typeColors). Off: the original three. Log a Score lives
 * on the Play page once My Week is on, and the Play tab covers finding a match.
 */

export type PlusActionKey =
  | "newMatch"
  | "findPlayers"
  | "bookLesson"
  | "addWorkout"
  | "createMatch"
  | "logScore"
  | "findMatch"
  | "bookRestring"
  | "ladderChallenge";

export interface PlusAction {
  key: PlusActionKey;
  label: string;
  /** The My Week item type whose colour the icon chip takes; null keeps the sheet's default. */
  type: WeekItemType | null;
  /** The Plan sheet's second line (home v2); the older sheets have none. */
  subtitle?: string;
}

/**
 * The Plan sheet (home v2): only things the player starts. Joining or browsing (open matches,
 * group lessons, leagues, players) lives in the Play tab, so Find players is gone. The ladder
 * challenge is offered only to a player on the ladder.
 *
 * Log a score always reads "Enter a result": nothing yet says which played match is missing
 * its score (recreational results aren't linked to matches, league fixtures carry no time).
 */
export const planSheetActions = ({ onLadder }: { onLadder: boolean }): PlusAction[] => [
  { key: "newMatch", label: "New match", subtitle: "Post a time and invite players", type: null },
  { key: "bookLesson", label: "Book a lesson", subtitle: "Private or group, with a coach", type: null },
  { key: "bookRestring", label: "Book a restring", subtitle: "String, tension and drop-off time", type: null },
  { key: "logScore", label: "Log a score", subtitle: "Enter a result", type: null },
  { key: "addWorkout", label: "Add a workout", subtitle: "From your 7-day plan", type: null },
  ...(onLadder
    ? [{ key: "ladderChallenge" as const, label: "Challenge on the ladder", subtitle: "Pick a player to challenge", type: null }]
    : []),
];

export type NewMatchType = "friendly" | "league";

export interface NewMatchOption {
  key: string;
  type: NewMatchType;
  label: string;
  subtitle: string;
  path: string;
}

/**
 * New match's first step (home v2, §5): what kind. Friendly is the existing create flow; there's
 * one League match row per running league (utils/leagueSeason.activeSeasons), opening that
 * league. There's no Rated option: every confirmed result already counts toward the rating.
 * With no running league, Friendly is the only choice and the picker is skipped.
 */
export const newMatchOptions = (leagues: { id: number | string; name?: string | null }[]): NewMatchOption[] => [
  { key: "friendly", type: "friendly", label: "Friendly", subtitle: "Post a time and invite players", path: "/create" },
  ...leagues.map((league) => ({
    key: `league-${league.id}`,
    type: "league" as const,
    label: "League match",
    subtitle: league.name?.trim() || "Your league",
    path: `/leagues/${league.id}/dashboard`,
  })),
];

/** The + button's name for screen readers once its visible label is gone (home v2). */
export const PLAN_BUTTON_LABEL = "Plan: new match, book a lesson, book a restring, log a score, add a workout";

export const plusSheetActions = (myWeek: boolean): PlusAction[] =>
  myWeek
    ? [
        { key: "newMatch", label: "New match", type: "match" },
        { key: "findPlayers", label: "Find players", type: "players" },
        { key: "bookLesson", label: "Book a lesson", type: "lesson" },
        { key: "addWorkout", label: "Add a workout", type: "workout" },
      ]
    : [
        { key: "createMatch", label: "Create a match", type: null },
        { key: "logScore", label: "Log a score", type: null },
        { key: "findMatch", label: "Find a match", type: null },
      ];

/** Fixed destinations; Book a lesson and Add a workout are worked out when tapped. */
export const PLUS_ACTION_PATHS: Partial<Record<PlusActionKey, string>> = {
  newMatch: "/create",
  createMatch: "/create",
  findPlayers: "/find-players",
  logScore: "/log-result",
  findMatch: "/matches",
  bookRestring: "/restring",
  // The ladder lists everyone with a Challenge button; picking who is the first step.
  ladderChallenge: "/ladder",
};

type CoachEntry = Record<string, unknown>;

const ENDED_STATUSES = new Set(["2", "cancelled", "canceled", "declined", "removed"]);

const coachIdOf = (coach: CoachEntry) => coach.coach_id ?? coach.id ?? coach.user_id ?? coach.player_coach_id;

const isEnded = (coach: CoachEntry) =>
  [coach.status, coach.player_coach_status, coach.player_status, coach.status_text].some(
    (value) => value !== undefined && value !== null && ENDED_STATUSES.has(String(value).trim().toLowerCase()),
  );

/**
 * Book a lesson: one coach → straight to booking with them; several → My Coaches, which lists
 * each with its next open time and Book; none → Find a coach. A coach who ended the link
 * doesn't count. The list is GET /player/coaches, as My Coaches reads it.
 */
export const bookLessonDestination = (coaches: unknown): string => {
  const active = (Array.isArray(coaches) ? coaches : [])
    .filter((coach): coach is CoachEntry => Boolean(coach) && typeof coach === "object")
    .filter((coach) => !isEnded(coach) && coachIdOf(coach) != null);
  if (active.length === 1) return `/coaches/${encodeURIComponent(String(coachIdOf(active[0])))}/book`;
  return active.length > 1 ? "/my-coaches" : "/find-coaches";
};

/** Add a workout: today's session once the plan is started, else the plan page (Start plan). */
export const workoutDestination = (progress: TrainingPlanProgress | null, todayKey: string): string => {
  const day = progress ? planDayFor(todayKey, progress.startedOn) : null;
  return day ? `/training-plan?day=${day}` : "/training-plan";
};
