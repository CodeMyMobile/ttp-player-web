import { request } from "./http";

/**
 * Lesson requests: a player who isn't on a coach's roster asks for lessons through The
 * Tennis Plan instead of texting the coach. The API texts and emails the coach a link to
 * /coach-request/:token, where the coach sees the answers beside their open times. Saying
 * yes there needs the coach to confirm their calendar is up to date; it puts the player on
 * the roster and texts them the coach's profile and number. See ttp-api
 * src/services/coachLessonRequests.js.
 */

export type LessonRequestWhoFor = "myself" | "my_child" | "someone_else";
export type LessonRequestExperience = "new" | "beginner" | "intermediate" | "advanced" | "competitive";
export type LessonRequestGoal = "basics" | "technique" | "match_play" | "fitness" | "competition";
export type LessonRequestTimeOfDay = "weekday_mornings" | "weekday_afternoons" | "weekday_evenings" | "weekends";

// The API accepts exactly these keys; the labels are what both sides of the request read.
export const WHO_FOR_OPTIONS: { value: LessonRequestWhoFor; label: string }[] = [
  { value: "myself", label: "Me" },
  { value: "my_child", label: "My child" },
  { value: "someone_else", label: "Someone else" },
];
export const EXPERIENCE_OPTIONS: { value: LessonRequestExperience; label: string }[] = [
  { value: "new", label: "New to tennis" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "competitive", label: "Competitive" },
];
export const GOAL_OPTIONS: { value: LessonRequestGoal; label: string }[] = [
  { value: "basics", label: "Learn the basics" },
  { value: "technique", label: "Improve technique" },
  { value: "match_play", label: "Match play & strategy" },
  { value: "fitness", label: "Fitness & fun" },
  { value: "competition", label: "League or tournament prep" },
];
export const TIME_OF_DAY_OPTIONS: { value: LessonRequestTimeOfDay; label: string }[] = [
  { value: "weekday_mornings", label: "Weekday mornings" },
  { value: "weekday_afternoons", label: "Weekday afternoons" },
  { value: "weekday_evenings", label: "Weekday evenings" },
  { value: "weekends", label: "Weekends" },
];
export const NOTE_MAX_LENGTH = 500;

const labelFor = <T extends string>(options: { value: T; label: string }[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

export const whoForLabel = (value: string) => labelFor(WHO_FOR_OPTIONS, value);
export const experienceLabel = (value: string) => labelFor(EXPERIENCE_OPTIONS, value);
export const goalLabel = (value: string) => labelFor(GOAL_OPTIONS, value);
export const timeOfDayLabel = (value: string) => labelFor(TIME_OF_DAY_OPTIONS, value);

/** Where the signed-in player stands with a coach, from the coach profile's `connection`. */
export type CoachConnectionStatus = "connected" | "requested" | "declined" | "none";

export const readCoachConnection = (profile: unknown): CoachConnectionStatus | null => {
  const status = (profile as { connection?: { status?: unknown } } | null)?.connection?.status;
  return status === "connected" || status === "requested" || status === "declined" || status === "none" ? status : null;
};

export interface LessonRequestAnswers {
  who_for: LessonRequestWhoFor;
  experience: LessonRequestExperience;
  goals: LessonRequestGoal[];
  times_of_day: LessonRequestTimeOfDay[];
  note?: string;
}

export const sendCoachLessonRequest = ({
  token,
  coachId,
  answers,
}: {
  token: string;
  coachId: number | string;
  answers: LessonRequestAnswers;
}) =>
  request<{ status: "requested" }>(`/player/coaches/${encodeURIComponent(String(coachId))}/lesson-requests`, {
    method: "POST",
    token,
    body: answers,
  });

export const lessonRequestErrorCode = (caught: unknown): unknown =>
  (caught as { data?: { error?: unknown } } | null)?.data?.error;

/** What to tell the player when the API refuses, by its error code. */
export const lessonRequestErrorMessage = (code: unknown, coachFirstName: string): string => {
  switch (code) {
    case "player_phone_required":
      return `Add a mobile number to your profile so we can text you ${coachFirstName}'s reply.`;
    case "already_connected":
      return `You're already connected with ${coachFirstName}. Refresh the page to message them.`;
    case "lesson_request_declined":
      return `${coachFirstName} isn't taking new players right now.`;
    case "lesson_request_limit_reached":
      return "You've sent several requests today. Try again tomorrow.";
    case "coach_unreachable":
      return `We can't reach ${coachFirstName} right now. Try another coach.`;
    case "invalid_answers":
      return "Please answer each question.";
    default:
      return "Something went wrong. Please try again.";
  }
};

export type LessonRequestStatus = "pending" | "accepted" | "declined" | "expired";

export interface LessonRequestOpenTime {
  date: string;
  label: string;
  slots: { time: string; location: string | null; matches_preference: boolean }[];
}

export interface LessonRequestView {
  status: LessonRequestStatus;
  coach: { first_name: string | null; calendar_url: string };
  player: { name: string | null; profile_picture: string | null; phone: string | null };
  request: {
    who_for: LessonRequestWhoFor;
    experience: LessonRequestExperience;
    goals: LessonRequestGoal[];
    times_of_day: LessonRequestTimeOfDay[];
    note: string | null;
    created_at: string;
  };
  open_times: LessonRequestOpenTime[];
  open_count: number;
}

export const getCoachLessonRequest = (linkToken: string) =>
  request<LessonRequestView>(`/public/coach-requests/${encodeURIComponent(linkToken)}`);

export const answerCoachLessonRequest = (
  linkToken: string,
  action: "accept" | "decline",
  { calendarConfirmed = false }: { calendarConfirmed?: boolean } = {},
) =>
  request<{ status: LessonRequestStatus; player_phone?: string | null }>(
    `/public/coach-requests/${encodeURIComponent(linkToken)}/${action}`,
    {
      method: "POST",
      body: action === "accept" ? { calendar_confirmed: calendarConfirmed } : {},
    },
  );
