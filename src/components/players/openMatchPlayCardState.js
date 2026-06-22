const idsMatch = (a, b) => {
  if (a === undefined || a === null || b === undefined || b === null) {
    return false;
  }
  return String(a).trim() === String(b).trim();
};

const asRecord = (value) => (value && typeof value === "object" ? value : {});

const getMatchHostId = (match) => {
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

const inactiveStatuses = new Set([
  "cancelled",
  "canceled",
  "declined",
  "expired",
  "left",
  "removed",
  "revoked",
]);

const isActiveRecord = (record) => {
  const status = String(record.status ?? record.invite_status ?? record.inviteStatus ?? "")
    .trim()
    .toLowerCase();
  return !inactiveStatuses.has(status);
};

const getParticipantId = (participant) => {
  const profile = asRecord(participant.profile);
  const player = asRecord(participant.player);
  return (
    participant.player_id ??
    participant.playerId ??
    participant.user_id ??
    participant.userId ??
    participant.id ??
    player.id ??
    player.player_id ??
    profile.user_id ??
    profile.id ??
    null
  );
};

const inviteMatchesCurrentUser = (invite, currentUserId) => {
  if (!isActiveRecord(invite)) {
    return false;
  }
  if (invite.isCurrentUser === true || invite.is_current_user === true) {
    return true;
  }
  const profile = asRecord(invite.profile);
  const user = asRecord(invite.user);
  const invitee = asRecord(invite.invitee);
  const candidates = [
    invite.invitee_id,
    invite.inviteeId,
    invite.player_id,
    invite.playerId,
    invite.user_id,
    invite.userId,
    profile.user_id,
    profile.userId,
    profile.id,
    user.id,
    user.user_id,
    invitee.id,
    invitee.user_id,
  ];
  return candidates.some((candidate) => idsMatch(currentUserId, candidate));
};

export const isCurrentUserInMatch = (match, currentUserId, hostId = null) => {
  if (currentUserId === undefined || currentUserId === null) {
    return false;
  }
  const record = asRecord(match);
  if (idsMatch(currentUserId, getMatchHostId(record)) || idsMatch(currentUserId, hostId)) {
    return true;
  }

  const participants = Array.isArray(record.participants) ? record.participants : [];
  if (
    participants.some(
      (participant) =>
        participant &&
        typeof participant === "object" &&
        isActiveRecord(participant) &&
        idsMatch(currentUserId, getParticipantId(participant)),
    )
  ) {
    return true;
  }

  const invitees = Array.isArray(record.invitees) ? record.invitees : [];
  return invitees.some(
    (invite) => invite && typeof invite === "object" && inviteMatchesCurrentUser(invite, currentUserId),
  );
};

