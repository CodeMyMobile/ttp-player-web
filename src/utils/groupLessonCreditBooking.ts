import type { ConsumePackageCreditsParams } from "../api/playerPackages";

export const buildGroupLessonCreditConsumeParams = ({
  token,
  coachId,
  lessonId,
  purchaseId,
  participantId,
}: Omit<ConsumePackageCreditsParams, "lessonType">): ConsumePackageCreditsParams => ({
  token,
  coachId,
  lessonType: "group",
  lessonId,
  purchaseId,
  ...(participantId != null ? { participantId } : {}),
});
