// Shared lesson booking status helpers.
//
// Lesson booking status is a numeric code: 0 = Pending, 1 = Confirmed,
// 2 = Cancelled. The code can be carried on the lesson record under several
// field names; we read the *booking/lesson* status fields only and deliberately
// exclude the payment fields (`payment_status` / `paymentStatus`), which track
// payment/refund state rather than whether the booking itself was cancelled.
//
// For group lessons the class can remain active while an individual player's
// spot is cancelled, so the player's own row in `group_players[]` takes
// precedence over the lesson-level status.

export const CANCELLED_STATUS_CODE = 2;

// Lesson-status fields in precedence order. Payment fields are intentionally omitted.
const LESSON_STATUS_FIELDS = ["status", "booking_status", "lesson_status"] as const;

/** Coerce a status value to its numeric code, mirroring LessonDetailCard's parseStatusCode. */
export const parseStatusCode = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** First non-null status code across status → booking_status → lesson_status (no payment fields). */
export const getLessonStatusCode = (record: Record<string, unknown> | null | undefined): number | null => {
  if (!record || typeof record !== "object") return null;
  for (const field of LESSON_STATUS_FIELDS) {
    const code = parseStatusCode(record[field]);
    if (code !== null) return code;
  }
  return null;
};

const findGroupPlayerRow = (
  groupPlayers: unknown[],
  playerId: string | number | null | undefined,
): Record<string, unknown> | undefined => {
  if (playerId == null) return undefined;
  return groupPlayers.find((player) => {
    const row = player as Record<string, unknown>;
    const candidateId = row.player_id ?? row.id ?? row.user_id;
    return candidateId != null && String(candidateId) === String(playerId);
  }) as Record<string, unknown> | undefined;
};

/**
 * Whether a lesson booking is cancelled (status code 2).
 *
 * For group lessons, the current player's row in `group_players[]` takes
 * precedence (the class may be active while the player's spot is cancelled);
 * otherwise the lesson-level status fields are used.
 */
export const isLessonCancelled = (lesson: unknown, playerId?: string | number | null): boolean => {
  if (!lesson || typeof lesson !== "object") return false;
  const record = lesson as Record<string, unknown>;

  const groupPlayers = Array.isArray(record.group_players) ? record.group_players : null;
  if (groupPlayers) {
    const row = findGroupPlayerRow(groupPlayers, playerId);
    if (row) return getLessonStatusCode(row) === CANCELLED_STATUS_CODE;
  }

  return getLessonStatusCode(record) === CANCELLED_STATUS_CODE;
};
