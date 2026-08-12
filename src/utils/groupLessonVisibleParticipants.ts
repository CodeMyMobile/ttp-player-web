import { holdsGroupSpot, type GroupLesson } from "../api/groupLessons";

export type VisibleGroupLessonParticipantRow = GroupLesson["participants"][number];

export const buildVisibleGroupLessonParticipantRows = (
  lesson: Pick<GroupLesson, "participants">,
): VisibleGroupLessonParticipantRow[] =>
  lesson.participants.filter((participant) =>
    holdsGroupSpot(
      participant.status,
      participant.paymentStatus,
      participant.paymentMethod,
    ),
  );
