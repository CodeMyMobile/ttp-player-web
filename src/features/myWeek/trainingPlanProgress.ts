import { toLocalYmd } from "../../utils/dateTime";

/**
 * The player's progress through the 7-day off-court plan, kept on this device only (v1):
 * the day they started, and which days they ticked as done. Day 1 is the start date; the plan
 * repeats after day 7, so every date maps to a plan day. Day 7 is the rest day.
 */

export const TRAINING_PLAN_KEY = "ttp_training_plan";
export const PLAN_LENGTH = 7;
export const REST_DAY = 7;

export interface TrainingPlanProgress {
  /** YYYY-MM-DD, local. */
  startedOn: string;
  /** Day keys ticked done. */
  done: Record<string, true>;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): StorageLike | null => {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

const isDayKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const readPlanProgress = (storage: StorageLike | null = browserStorage()): TrainingPlanProgress | null => {
  try {
    const parsed = JSON.parse(storage?.getItem(TRAINING_PLAN_KEY) ?? "null");
    if (!parsed || !isDayKey(parsed.startedOn)) return null;
    const done: Record<string, true> = {};
    for (const key of Object.keys(parsed.done ?? {})) if (isDayKey(key)) done[key] = true;
    return { startedOn: parsed.startedOn, done };
  } catch {
    return null;
  }
};

const write = (progress: TrainingPlanProgress, storage: StorageLike | null) => {
  try {
    storage?.setItem(TRAINING_PLAN_KEY, JSON.stringify(progress));
  } catch {
    // No storage: the plan just isn't remembered on this device.
  }
};

/** Starts the plan today (day 1), forgetting any earlier run. */
export const startPlan = (now: Date = new Date(), storage: StorageLike | null = browserStorage()): TrainingPlanProgress => {
  const progress = { startedOn: toLocalYmd(now), done: {} };
  write(progress, storage);
  return progress;
};

/** Ticks or unticks a day. */
export const setDayDone = (
  dayKey: string,
  done: boolean,
  storage: StorageLike | null = browserStorage(),
): TrainingPlanProgress | null => {
  const progress = readPlanProgress(storage);
  if (!progress) return null;
  const next = { ...progress, done: { ...progress.done } };
  if (done) next.done[dayKey] = true;
  else delete next.done[dayKey];
  write(next, storage);
  return next;
};

const dayIndex = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  // UTC arithmetic on the calendar date: no daylight saving hour to round away.
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
};

/** The plan day (1–7) a date falls on, or null before the start. Repeats after day 7. */
export const planDayFor = (dayKey: string, startedOn: string): number | null => {
  const offset = dayIndex(dayKey) - dayIndex(startedOn);
  if (offset < 0) return null;
  return (offset % PLAN_LENGTH) + 1;
};
