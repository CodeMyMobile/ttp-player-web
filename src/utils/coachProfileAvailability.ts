import moment from "moment";

export type CoachProfileAvailabilityPeriod = "morning" | "afternoon" | "evening";

export type CoachProfileAvailabilitySlot = {
  id: string;
  start: string;
  type?: string;
  locationId?: number | string | null;
  court?: string | number | null;
  courtValue?: string | number | null;
  sourceLessonId?: number;
};

export type CoachProfileAvailabilityDay<T extends CoachProfileAvailabilitySlot> = {
  isoDate: string;
  slots: T[];
};

const slotIdentity = (slot: CoachProfileAvailabilitySlot) => {
  if (slot.sourceLessonId != null) {
    return `${slot.type ?? "lesson"}:lesson:${slot.sourceLessonId}`;
  }
  const startTime = Date.parse(slot.start);
  if (Number.isFinite(startTime)) {
    const locationKey = slot.locationId ?? slot.courtValue ?? slot.court ?? "";
    return `${slot.type ?? "slot"}:time:${startTime}:location:${locationKey}`;
  }
  return slot.id;
};

const compareSlots = (a: CoachProfileAvailabilitySlot, b: CoachProfileAvailabilitySlot) => {
  const aTime = Date.parse(a.start);
  const bTime = Date.parse(b.start);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return aTime - bTime;
  }
  return a.id.localeCompare(b.id);
};

export const mergeAvailabilityDayGroups = <T extends CoachProfileAvailabilitySlot>(
  baseDays: Array<CoachProfileAvailabilityDay<T>>,
  additionalDays: Array<CoachProfileAvailabilityDay<T>>,
) => {
  const byDate = new Map<string, CoachProfileAvailabilityDay<T>>();

  [...baseDays, ...additionalDays].forEach((day) => {
    const existing = byDate.get(day.isoDate);
    if (!existing) {
      byDate.set(day.isoDate, { ...day, slots: [...day.slots].sort(compareSlots) });
      return;
    }

    const seen = new Set(existing.slots.map(slotIdentity));
    const nextSlots = [...existing.slots];
    day.slots.forEach((slot) => {
      const key = slotIdentity(slot);
      if (seen.has(key)) return;
      seen.add(key);
      nextSlots.push(slot);
    });
    byDate.set(day.isoDate, { ...existing, slots: nextSlots.sort(compareSlots) });
  });

  return Array.from(byDate.values()).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
};

export const isCancelledLessonStatus = (status: unknown) => {
  if (typeof status === "number") return status === 2;
  if (typeof status === "string") {
    const normalized = status.trim().toLowerCase();
    return normalized === "2" || normalized === "cancelled" || normalized === "canceled";
  }
  return false;
};

export const parseCoachAvailabilityClock = (isoDate: string, value?: string) => {
  if (!value) return null;
  const parsed = moment.utc(`${isoDate} ${value}`, ["YYYY-MM-DD h:mm A", "YYYY-MM-DD HH:mm", moment.ISO_8601], true);
  return parsed.isValid() ? parsed : null;
};

const parseHourFromLabel = (label: string): number => {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(label ?? "");
  if (!match) return 12;
  const ampm = match[3]?.toUpperCase();
  if (!ampm) return Number(match[1]);
  let hour = Number(match[1]) % 12;
  if (ampm === "PM") hour += 12;
  return hour;
};

export const getAvailabilitySlotPeriod = (timeLabel: string): CoachProfileAvailabilityPeriod => {
  const hour = parseHourFromLabel(timeLabel);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
};

/**
 * How many of a coach's open slots fall inside the next seven days.
 *
 * The profile renders this as "N slots available this week" beside the Book button, so
 * the number has to mean the week. The booking payload is not week-scoped — it runs
 * about a fortnight — and counting all of it under that label overstated supply by
 * roughly double on the profiles we checked.
 *
 * Bounds on ISO day strings rather than Date arithmetic, the same way
 * utils/activityFeed itemsWithinWindow bounds the home feed: the day keys are already
 * `YYYY-MM-DD`, so a lexical compare is the comparison, with no timezone to get wrong.
 *
 * The window is inclusive at both ends: today counts, and so does the seventh day.
 */
export const countSlotsInWindow = <T extends CoachProfileAvailabilitySlot>(
  days: Array<{ isoDate: string; slots: T[] }>,
  windowStart: string,
  windowEnd: string,
): number =>
  (days ?? []).reduce(
    (sum, day) =>
      typeof day?.isoDate === "string" && day.isoDate >= windowStart && day.isoDate <= windowEnd
        ? sum + (day.slots?.length ?? 0)
        : sum,
    0,
  );

/** Inclusive [today, today+6] as ISO day strings — the window countSlotsInWindow expects. */
export const currentWeekWindow = (now: moment.MomentInput = undefined) => {
  const start = now ? moment(now) : moment();
  return {
    windowStart: start.format("YYYY-MM-DD"),
    windowEnd: start.clone().add(6, "days").format("YYYY-MM-DD"),
  };
};
