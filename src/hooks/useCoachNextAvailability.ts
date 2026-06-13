import { useEffect, useState } from "react";
import moment from "moment";

import {
  getCoachLessonsById,
  getCoachScheduleById,
  type CoachScheduleEntry,
} from "../api/playerCalendar";
import type { Lesson } from "../api/playerLessons";

const WINDOW_DAYS = 7;
const SLOT_MINUTES = 60;

export type AvailabilityBucket = "soon" | "later";

export interface CoachAvailabilitySlot {
  /** "Today" | "Tomorrow" | "Thu, Jun 18" */
  whenLabel: string;
  /** "9:00 AM" */
  timeLabel: string;
  /** "soon" = today/tomorrow (green), "later" = further out (amber) */
  bucket: AvailabilityBucket;
  iso: string;
}

export interface CoachAvailabilityState {
  loading: boolean;
  /** null once loaded means no open slot within the window */
  slot: CoachAvailabilitySlot | null;
}

// Same parsing the coach profile page uses for schedule clock strings.
const parseClock = (isoDate: string, value?: string) => {
  if (!value) return null;
  const parsed = moment(
    `${isoDate} ${value}`,
    ["YYYY-MM-DD h:mm A", "YYYY-MM-DD HH:mm", moment.ISO_8601],
    true,
  );
  return parsed.isValid() ? parsed : null;
};

const buildWhenLabel = (slotStart: moment.Moment) => {
  const daysOut = slotStart.clone().startOf("day").diff(moment().startOf("day"), "days");
  if (daysOut <= 0) return "Today";
  if (daysOut === 1) return "Tomorrow";
  return slotStart.format("ddd, MMM D");
};

/**
 * Computes a coach's next open 1-hour slot over the next 7 days by combining
 * their recurring schedule (getCoachScheduleById) with booked lessons
 * (getCoachLessonsById). Walks day-by-day and returns the first free, future
 * slot it finds (early exit). Modeled on the coach profile page's availability
 * logic, but self-contained and read-only — it does not touch booking/payment.
 *
 * Each card calls this independently, so lookups parallelize across cards and
 * fill in their own availability block as they resolve.
 */
export default function useCoachNextAvailability(
  coachId?: number | string | null,
): CoachAvailabilityState {
  const [state, setState] = useState<CoachAvailabilityState>({ loading: true, slot: null });

  useEffect(() => {
    if (coachId === null || coachId === undefined || coachId === "") {
      setState({ loading: false, slot: null });
      return;
    }

    let active = true;
    setState({ loading: true, slot: null });

    const run = async () => {
      const now = moment();
      const numericCoachId = Number(coachId);

      for (let offset = 0; offset < WINDOW_DAYS; offset += 1) {
        if (!active) return;

        const day = moment().add(offset, "days");
        const isoDate = day.format("YYYY-MM-DD");
        const weekday = day.format("dddd").toUpperCase();

        let scheduleEntries: CoachScheduleEntry[] = [];
        try {
          scheduleEntries = await getCoachScheduleById({ coachId: numericCoachId, day: weekday });
        } catch {
          scheduleEntries = [];
        }
        if (!active) return;
        if (!scheduleEntries.length) continue;

        let lessons: Lesson[] = [];
        try {
          lessons = await getCoachLessonsById({ coachId: numericCoachId, date: isoDate });
        } catch {
          lessons = [];
        }
        if (!active) return;

        const occupied = lessons
          .map((lesson) => ({
            start: moment.utc(lesson.start_date_time),
            end: moment.utc(lesson.end_date_time),
          }))
          .filter((range) => range.start.isValid() && range.end.isValid());

        for (const entry of scheduleEntries) {
          const start = parseClock(isoDate, String(entry.from ?? ""));
          const end = parseClock(isoDate, String(entry.to ?? ""));
          if (!start || !end || !end.isAfter(start)) continue;

          let cursor = start.clone();
          while (cursor.clone().add(SLOT_MINUTES, "minutes").isSameOrBefore(end)) {
            const slotEnd = cursor.clone().add(SLOT_MINUTES, "minutes");
            const inPast = cursor.isSameOrBefore(now);
            const overlaps = occupied.some(
              (range) => cursor.isBefore(range.end) && slotEnd.isAfter(range.start),
            );

            if (!inPast && !overlaps) {
              const daysOut = cursor.clone().startOf("day").diff(moment().startOf("day"), "days");
              setState({
                loading: false,
                slot: {
                  whenLabel: buildWhenLabel(cursor),
                  timeLabel: cursor.format("h:mm A"),
                  bucket: daysOut <= 1 ? "soon" : "later",
                  iso: cursor.toISOString(),
                },
              });
              return;
            }

            cursor = slotEnd;
          }
        }
      }

      if (active) setState({ loading: false, slot: null });
    };

    run();

    return () => {
      active = false;
    };
  }, [coachId]);

  return state;
}
