// Shared match host-id resolution + loose id comparison. Used by both the
// open-match card (isHost) and the visitor-profile feed guard so the two can't
// drift. Moved verbatim from OpenMatchPlayCard.tsx — no behavior change.
type MatchRecord = Record<string, unknown>;

const asRecord = (value: unknown): MatchRecord =>
  value && typeof value === "object" ? (value as MatchRecord) : {};

// Loose id comparison (ids arrive as number or string across the API).
export const idsMatch = (a: unknown, b: unknown): boolean => {
  if (a === undefined || a === null || b === undefined || b === null) {
    return false;
  }
  return String(a).trim() === String(b).trim();
};

export const getMatchHostId = (match: MatchRecord): unknown => {
  const host = asRecord(match.host);
  const creator = asRecord(match.creator);
  return (
    match.host_id ??
    match.hostId ??
    match.created_by ??
    match.createdBy ??
    match.creator_id ??
    match.creatorId ??
    host.id ??
    host.user_id ??
    creator.id ??
    null
  );
};
