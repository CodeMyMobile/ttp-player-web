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
  | "findMatch";

export interface PlusAction {
  key: PlusActionKey;
  label: string;
  /** The My Week item type whose colour the icon chip takes; null keeps the sheet's default. */
  type: WeekItemType | null;
}

export const plusSheetActions = (myWeek: boolean): PlusAction[] =>
  myWeek
    ? [
        { key: "newMatch", label: "New match", type: "match" },
        { key: "findPlayers", label: "Find players", type: "players" },
        { key: "bookLesson", label: "Book a lesson", type: "lesson" },
        { key: "addWorkout", label: "Add a workout", type: "workout" },
      ]
    : [
        { key: "createMatch", label: "Create a Match", type: null },
        { key: "logScore", label: "Log a Score", type: null },
        { key: "findMatch", label: "Find a Match", type: null },
      ];

/** Fixed destinations; Book a lesson and Add a workout are worked out when tapped. */
export const PLUS_ACTION_PATHS: Partial<Record<PlusActionKey, string>> = {
  newMatch: "/create",
  createMatch: "/create",
  findPlayers: "/find-players",
  logScore: "/log-result",
  findMatch: "/matches",
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
