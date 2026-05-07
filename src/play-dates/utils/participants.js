import { getPhoneDigits } from "../services/phone";

const PARTICIPANT_IDENTITY_KEYS = [
  "match_participant_id",
  "matchParticipantId",
  "participant_id",
  "participantId",
  "player_id",
  "playerId",
  "invitee_id",
  "inviteeId",
  "id",
  "profile.id",
  "profile.player_id",
  "profile.playerId",
  "profile.user_id",
  "profile.userId",
  "player.id",
  "player.player_id",
  "player.playerId",
];

const INVITE_IDENTITY_KEYS = [
  "invitee_id",
  "inviteeId",
  "player_id",
  "playerId",
  "participant_id",
  "participantId",
  "id",
  "profile.id",
  "profile.player_id",
  "profile.playerId",
];

const DEFAULT_IDENTITY_KEYS = PARTICIPANT_IDENTITY_KEYS;

const PHONE_KEYS = [
  "phone",
  "phone_number",
  "phoneNumber",
  "contact_phone",
  "contactPhone",
  "mobile",
  "mobile_phone",
  "mobilePhone",
  "cell",
  "cell_phone",
  "cellPhone",
  "primary_phone",
  "primaryPhone",
];

const toNonEmptyPhoneString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return getPhoneDigits(trimmed) ? trimmed : "";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    const str = value.toString();
    return getPhoneDigits(str) ? str : "";
  }
  if (typeof value === "bigint") {
    const str = value.toString();
    return getPhoneDigits(str) ? str : "";
  }
  if (typeof value === "object" && typeof value.toString === "function") {
    const str = value.toString();
    if (typeof str === "string") {
      const trimmed = str.trim();
      if (!trimmed) return "";
      return getPhoneDigits(trimmed) ? trimmed : "";
    }
  }
  return "";
};

export const getParticipantPhone = (participant) => {
  if (!participant || typeof participant !== "object") {
    return "";
  }

  const sources = [
    participant,
    participant.profile,
    participant.player,
    participant.contact,
    participant.invitee,
    participant.user,
  ].filter((source) => source && typeof source === "object");

  for (const source of sources) {
    for (const key of PHONE_KEYS) {
      const value = source[key];
      const phone = toNonEmptyPhoneString(value);
      if (phone) {
        return phone;
      }
    }
  }

  return "";
};

const getValueByKeyPath = (item, key) => {
  if (!item || typeof item !== "object") return undefined;
  if (Array.isArray(key)) {
    return getValueByKeyPath(item, key.join("."));
  }
  if (typeof key !== "string" || key.length === 0) return undefined;
  if (!key.includes(".")) {
    return item[key];
  }
  const segments = key.split(".");
  let current = item;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const normalizeIdentityValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
    return trimmed;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return null;
};

const buildIdentity = (item, keys = DEFAULT_IDENTITY_KEYS) => {
  for (const key of keys) {
    const identity = normalizeIdentityValue(getValueByKeyPath(item, key));
    if (identity !== null) {
      const label = Array.isArray(key) ? key.join(".") : key;
      return `${label}:${identity}`;
    }
  }
  return null;
};

const hasIdentity = (item, keys = DEFAULT_IDENTITY_KEYS) => {
  if (!item || typeof item !== "object") return false;
  return buildIdentity(item, keys) !== null;
};

export const dedupeByIdentity = (items = [], keys = DEFAULT_IDENTITY_KEYS) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const identity = buildIdentity(item, keys);
    if (!identity) continue;
    if (seen.has(identity)) continue;
    seen.add(identity);
    deduped.push(item);
  }
  return deduped;
};

export const uniqueParticipants = (participants = []) => {
  if (!Array.isArray(participants)) return [];
  const identityKeys = PARTICIPANT_IDENTITY_KEYS;
  const withIdentity = participants.filter((participant) =>
    hasIdentity(participant, identityKeys),
  );
  const deduped = dedupeByIdentity(withIdentity, identityKeys);
  if (deduped.length === participants.length) {
    return deduped;
  }
  const withoutIdentity = participants.filter(
    (participant) => !hasIdentity(participant, identityKeys),
  );
  return [...deduped, ...withoutIdentity];
};

const isParticipantActive = (participant) => {
  if (!participant || typeof participant !== "object") return false;

  if (participant.is_active === false || participant.active === false) {
    return false;
  }

  const statusCandidates = [
    participant.status,
    participant.participant_status,
    participant.participantStatus,
    participant.status_reason,
    participant.statusReason,
  ];
  if (statusCandidates.some((value) => isInactiveStatus(value))) {
    return false;
  }

  if (
    hasAnyValue(participant, [
      "left_at",
      "leftAt",
      "removed_at",
      "removedAt",
      "cancelled_at",
      "cancelledAt",
      "canceled_at",
      "canceledAt",
      "declined_at",
      "declinedAt",
      "withdrawn_at",
      "withdrawnAt",
    ])
  ) {
    return false;
  }

  return true;
};

export const uniqueActiveParticipants = (participants = []) =>
  uniqueParticipants(participants).filter(isParticipantActive);

export const countUniqueActiveParticipants = (participants = []) =>
  uniqueActiveParticipants(participants).length;

export const uniqueMatchOccupants = (
  participants = [],
  invitees = [],
) => {
  const activeParticipants = uniqueActiveParticipants(participants);
  const acceptedInvitees = uniqueAcceptedInvitees(invitees);

  if (acceptedInvitees.length === 0) {
    return activeParticipants;
  }

  if (activeParticipants.length === 0) {
    return acceptedInvitees;
  }

  return dedupeByIdentity(
    [...activeParticipants, ...acceptedInvitees],
    PARTICIPANT_IDENTITY_KEYS,
  );
};

export const countUniqueMatchOccupants = (participants = [], invitees = []) =>
  uniqueMatchOccupants(participants, invitees).length;

export const uniqueInvitees = (invitees = []) => {
  if (!Array.isArray(invitees)) return [];
  const identityKeys = INVITE_IDENTITY_KEYS;
  return dedupeByIdentity(
    invitees.filter((invite) => hasIdentity(invite, identityKeys)),
    identityKeys,
  );
};

const hasAnyValue = (item, keys = []) => {
  if (!item) return false;
  return keys.some((key) => {
    if (!Object.prototype.hasOwnProperty.call(item, key)) return false;
    const value = item[key];
    if (value === undefined || value === null) return false;
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (typeof value === "number") {
      return Number.isFinite(value);
    }
    if (value instanceof Date) {
      return !Number.isNaN(value.getTime());
    }
    return true;
  });
};

const isInactiveStatus = (value) => {
  if (!value) return false;
  const normalized = value.toString().trim().toLowerCase();
  return [
    "left",
    "removed",
    "cancelled",
    "canceled",
    "declined",
    "rejected",
    "withdrawn",
    "expired",
    "pending",
    "invited",
  ].includes(normalized);
};

const CONFIRMED_STATUS_TOKENS = new Set(["confirm", "confirmed"]);

const isConfirmedStatus = (value) => {
  if (!value) return false;
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) return false;
  if (isInactiveStatus(normalized)) return false;
  if (normalized.includes("unconfirm")) return false;
  if (normalized === "confirm" || normalized === "confirmed") {
    return true;
  }

  const tokens = normalized.split(/[^a-z0-9]+/i).filter(Boolean);
  if (tokens.some((token) => CONFIRMED_STATUS_TOKENS.has(token))) {
    return true;
  }

  return false;
};

const hasConfirmedIndicator = (invite) => {
  if (!invite || typeof invite !== "object") return false;

  const statusCandidates = [
    invite.status,
    invite.invite_status,
    invite.inviteStatus,
    invite.invitation_status,
    invite.invitationStatus,
    invite.state,
    invite.participant_status,
    invite.participantStatus,
    invite.status_reason,
    invite.statusReason,
  ];

  if (statusCandidates.some((candidate) => isConfirmedStatus(candidate))) {
    return true;
  }

  const confirmedFlags = [
    invite.confirmed,
    invite.is_confirmed,
    invite.isConfirmed,
    invite.has_confirmed,
    invite.hasConfirmed,
  ];

  if (confirmedFlags.some((value) => value === true)) {
    return true;
  }

  return hasAnyValue(invite, [
    "confirmed_at",
    "confirmedAt",
    "confirmed_on",
    "confirmedOn",
    "rsvp_confirmed_at",
    "rsvpConfirmedAt",
  ]);
};

const isInviteActive = (invite) => {
  if (!invite || typeof invite !== "object") return false;
  if (!hasConfirmedIndicator(invite)) {
    return false;
  }

  if (invite.is_active === false || invite.active === false) {
    return false;
  }

  const participantStatus = invite.participant_status
    ? invite.participant_status.toString().trim().toLowerCase()
    : invite.participantStatus
    ? invite.participantStatus.toString().trim().toLowerCase()
    : "";
  if (isInactiveStatus(participantStatus)) {
    return false;
  }

  if (
    hasAnyValue(invite, [
      "left_at",
      "leftAt",
      "removed_at",
      "removedAt",
      "cancelled_at",
      "cancelledAt",
      "canceled_at",
      "canceledAt",
      "declined_at",
      "declinedAt",
      "withdrawn_at",
      "withdrawnAt",
    ])
  ) {
    return false;
  }

  const statusReason = invite.status_reason
    ? invite.status_reason.toString().trim().toLowerCase()
    : invite.statusReason
    ? invite.statusReason.toString().trim().toLowerCase()
    : "";
  if (isInactiveStatus(statusReason)) {
    return false;
  }

  return true;
};

export const uniqueAcceptedInvitees = (invitees = []) => {
  if (!Array.isArray(invitees) || invitees.length === 0) return [];
  const identityKeys = INVITE_IDENTITY_KEYS;
  const activeInvitees = invitees.filter((invite) => isInviteActive(invite));
  const withIdentity = activeInvitees.filter((invite) =>
    hasIdentity(invite, identityKeys),
  );
  const deduped = dedupeByIdentity(withIdentity, identityKeys);
  if (deduped.length === activeInvitees.length) {
    return deduped;
  }
  const withoutIdentity = activeInvitees.filter(
    (invite) => !hasIdentity(invite, identityKeys),
  );
  return [...deduped, ...withoutIdentity];
};

export const countUniqueAcceptedInvitees = (invitees = []) =>
  uniqueAcceptedInvitees(invitees).length;

const normalizeForComparison = (value) => {
  const normalized = normalizeIdentityValue(value);
  if (typeof normalized === "string") {
    return normalized.toLowerCase();
  }
  return normalized;
};

export const idsMatch = (a, b) => {
  const left = normalizeForComparison(a);
  const right = normalizeForComparison(b);
  if (left === null || right === null) return false;
  return left === right;
};

const matchesMemberIdentity = (value, memberIdentity) => {
  if (memberIdentity === null || memberIdentity === undefined) return false;
  if (Array.isArray(memberIdentity)) {
    return memberIdentity.some((candidate) => idsMatch(value, candidate));
  }
  return idsMatch(value, memberIdentity);
};

const pruneItemsByIdentity = (items, memberIdentity) => {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => {
    if (!item || typeof item !== "object") return true;
    const candidates = [
      item.player_id,
      item.playerId,
      item.match_participant_id,
      item.matchParticipantId,
      item.participant_id,
      item.participantId,
      item.invitee_id,
      item.inviteeId,
      item.id,
      item.profile?.id,
      item.profile?.player_id,
      item.profile?.playerId,
    ];
    return !candidates.some((value) => matchesMemberIdentity(value, memberIdentity));
  });
};

const JOIN_METADATA_KEYS = [
  "joined_at",
  "joinedAt",
  "joined",
  "joined_on",
  "joinedOn",
  "joined_by_player_id",
  "joinedByPlayerId",
  "joined_player_id",
  "joinedPlayerId",
  "joined_status",
  "joinedStatus",
  "is_joined",
  "isJoined",
];

const clearJoinMetadata = (target) => {
  if (!target || typeof target !== "object") return target;
  for (const key of JOIN_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      delete target[key];
    }
  }
  return target;
};

const pruneParticipantCollections = (target, memberIdentity, seen) => {
  if (!target || typeof target !== "object") return target;
  if (seen.has(target)) return target;
  seen.add(target);

  const next = clearJoinMetadata({ ...target });

  if (Array.isArray(next.participants)) {
    next.participants = pruneItemsByIdentity(next.participants, memberIdentity);
  }

  if (Array.isArray(next.invitees)) {
    next.invitees = pruneItemsByIdentity(next.invitees, memberIdentity);
  }

  if (next.match && typeof next.match === "object") {
    next.match = pruneParticipantCollections(next.match, memberIdentity, seen);
    clearJoinMetadata(next.match);
  }

  return next;
};

export const pruneParticipantFromMatchData = (data, memberIdentity) => {
  if (memberIdentity === null || memberIdentity === undefined) return data;
  if (Array.isArray(memberIdentity) && memberIdentity.length === 0) return data;
  if (!data || typeof data !== "object") return data;
  const seen = new WeakSet();
  return pruneParticipantCollections(data, memberIdentity, seen);
};
