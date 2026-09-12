/**
 * Whether applying credits to a group lesson needs the player to already hold a
 * participant row.
 *
 * For an OPEN group lesson (lessontype_id 3) it does not. The backend's confirm
 * step — PATCH /player/upcoming_lessons/:id with status CONFIRMED — looks the
 * credit usage up by lesson and player, checks capacity under a lock, and
 * creates the participant row itself (metadata status "booked_with_credit").
 * So consume-then-confirm is enough, and demanding a participant id up front
 * blocks every first-time booking of a class the player found themselves.
 *
 * For a RESTRICTED group lesson (lessontype_id 4) it does. That branch is keyed
 * on type 3 only, so nothing server-side would create the row: consuming first
 * would reserve a credit that confirm then refuses to finalise. Those players
 * are expected to already be on the lesson, by invitation.
 *
 * An unknown type is treated as restricted — the permissive path is only proven
 * for the one type the backend implements.
 */
const OPEN_GROUP_LESSON_TYPE = 3;

export const requiresExistingParticipantForCredits = (
  lessonTypeId?: number | string | null,
) => Number(lessonTypeId) !== OPEN_GROUP_LESSON_TYPE;
