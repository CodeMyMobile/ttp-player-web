import React from "react";
import type { GroupLesson } from "../api/groupLessons";

export const GroupLessonWaitlistStatus = ({ lesson, pending, onLeave }: {
  lesson: Pick<GroupLesson, "waitlistPosition" | "waitlistCount">;
  pending: boolean;
  onLeave: () => void;
}) => lesson.waitlistPosition == null ? null : (
  <section className="group-lesson-details__section" aria-label="Your waitlist status">
    <p>You&apos;re #{lesson.waitlistPosition} on waitlist · {lesson.waitlistCount ?? 0} waiting</p>
    <button type="button" className="group-lesson-details__checkout-action" disabled={pending} onClick={onLeave}>
      {pending ? "Leaving waitlist..." : "Leave waitlist"}
    </button>
  </section>
);
