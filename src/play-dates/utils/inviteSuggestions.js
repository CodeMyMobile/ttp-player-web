import { uniqueActiveParticipants } from "./participants";

const candidateIdKeys = [
  "player_id",
  "playerId",
  "user_id",
  "userId",
  "participant_id",
  "participantId",
  "match_participant_id",
  "matchParticipantId",
  "invitee_id",
  "inviteeId",
  "id",
  ["profile", "player_id"],
  ["profile", "playerId"],
  ["profile", "id"],
  ["player", "id"],
  ["player", "player_id"],
  ["player", "playerId"],
  ["player", "user_id"],
  ["player", "userId"],
  ["user", "id"],
  ["user", "user_id"],
  ["user", "userId"],
  ["user", "player_id"],
  ["user", "playerId"],
];

const readValue = (subject, key) => {
  if (!subject || typeof subject !== "object") return undefined;
  if (Array.isArray(key)) {
    return key.reduce((acc, segment) => {
      if (acc && typeof acc === "object") {
        return acc[segment];
      }
      return undefined;
    }, subject);
  }
  return subject[key];
};

const parseNumericId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const extractParticipantId = (participant) => {
  for (const key of candidateIdKeys) {
    const candidate = readValue(participant, key);
    const parsed = parseNumericId(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};

const buildParticipantName = (participant, fallbackId) => {
  if (!participant || typeof participant !== "object") {
    return fallbackId ? `Player ${fallbackId}` : "Unknown player";
  }
  const profile = participant.profile || {};
  const nameCandidates = [
    profile.full_name,
    profile.fullName,
    profile.display_name,
    profile.displayName,
    profile.name,
    [profile.first_name, profile.last_name]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" "),
    participant.full_name,
    participant.fullName,
    participant.display_name,
    participant.displayName,
    participant.name,
    participant.player_name,
    participant.playerName,
  ];

  for (const candidate of nameCandidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (fallbackId) {
    return `Player ${fallbackId}`;
  }
  return "Unknown player";
};

const candidateDateKeys = [
  "start_date_time",
  "startDateTime",
  "start_time",
  "startTime",
  "start_at",
  "startAt",
];

const extractMatchMoment = (match) => {
  if (!match || typeof match !== "object") {
    return { timestamp: null, iso: null };
  }
  const candidates = [];
  for (const key of candidateDateKeys) {
    if (Object.prototype.hasOwnProperty.call(match, key)) {
      candidates.push(match[key]);
    }
  }
  if (match.match && typeof match.match === "object") {
    for (const key of candidateDateKeys) {
      if (Object.prototype.hasOwnProperty.call(match.match, key)) {
        candidates.push(match.match[key]);
      }
    }
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = candidate instanceof Date ? candidate : new Date(candidate);
    if (Number.isNaN(date.getTime())) continue;
    return { timestamp: date.getTime(), iso: date.toISOString() };
  }
  return { timestamp: null, iso: null };
};

const toArrayOrNull = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value[Symbol.iterator] === "function") {
    return Array.from(value);
  }
  return null;
};

export const buildRecentPartnerSuggestions = ({
  matches = [],
  currentUser,
  memberIdentities,
} = {}) => {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  if (!currentUser && !memberIdentities) {
    return [];
  }

  const precomputedMemberIds = toArrayOrNull(memberIdentities);
  const suggestionMap = new Map();

  matches.forEach((match) => {
    const { timestamp, iso } = extractMatchMoment(match);
    const participants = uniqueActiveParticipants(match?.participants);
    if (participants.length === 0) return;

    const userIsInMatch =
      !!currentUser &&
      participants.some((participant) =>
        memberMatchesParticipant(currentUser, participant, precomputedMemberIds),
      );

    if (!userIsInMatch) return;

    participants.forEach((participant) => {
      const participantId = extractParticipantId(participant);
      if (!participantId) return;
      if (
        currentUser &&
        memberMatchesParticipant(currentUser, participant, precomputedMemberIds)
      ) {
        return;
      }

      const name = buildParticipantName(participant, participantId);
      const existing = suggestionMap.get(participantId);
      if (
        !existing ||
        ((timestamp ?? -Infinity) > (existing.lastPlayedTs ?? -Infinity))
      ) {
        suggestionMap.set(participantId, {
          user_id: participantId,
          full_name: name,
          lastPlayedAt: iso,
          lastPlayedTs: timestamp ?? null,
        });
      }
    });
  });

  return Array.from(suggestionMap.values())
    .sort(
      (a, b) => (b.lastPlayedTs ?? -Infinity) - (a.lastPlayedTs ?? -Infinity),
    )
    .map(({ lastPlayedTs, ...player }) => player);
};

export default buildRecentPartnerSuggestions;
