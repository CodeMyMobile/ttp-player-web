import type { GroupLesson } from "../api/groupLessons";

export const getGroupLessonWaitlistState = (
  lesson: Pick<GroupLesson, "lessonTypeId" | "waitlistPosition" | "cancelled">,
  isFull: boolean,
  isUpcoming: boolean,
) => {
  const isWaitlisted = lesson.waitlistPosition != null;
  return {
    isWaitlisted,
    shouldShowStatus: isWaitlisted,
    canLeave: isWaitlisted,
    canJoin: lesson.lessonTypeId === 3 && isFull && isUpcoming && !lesson.cancelled && !isWaitlisted,
    canBook: !isFull && !lesson.cancelled,
  };
};

export const runGroupLessonWaitlistAction = async <T>({ mutate, applySuccess, refresh }: {
  mutate: () => Promise<T>;
  applySuccess: (response: T) => void;
  refresh: () => Promise<unknown>;
}) => {
  const response = await mutate();
  applySuccess(response);
  try {
    await refresh();
    return { refreshFailed: false };
  } catch {
    return { refreshFailed: true };
  }
};
