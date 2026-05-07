import { idsMatch } from "./participants";

const MEMBER_ID_KEYS = [
  "id",
  "user_id",
  "userId",
  "player_id",
  "playerId",
  "member_id",
  "memberId",
  "matchplay_member_id",
  "matchplayMemberId",
  "matchplay_player_id",
  "matchplayPlayerId",
  "account.id",
  "account.user_id",
  "account.userId",
  "account.player_id",
  "account.playerId",
  "account.member_id",
  "account.memberId",
  "profile.id",
  "profile.user_id",
  "profile.userId",
  "profile.player_id",
  "profile.playerId",
  "profile.member_id",
  "profile.memberId",
  "profile.matchplay_member_id",
  "profile.matchplayMemberId",
  "profile.matchplay_player_id",
  "profile.matchplayPlayerId",
  "person.id",
  "person.user_id",
  "person.userId",
  "person.player_id",
  "person.playerId",
  "person.member_id",
  "person.memberId",
  "person.matchplay_member_id",
  "person.matchplayMemberId",
  "person.matchplay_player_id",
  "person.matchplayPlayerId",
  "member.id",
  "member.user_id",
  "member.userId",
  "member.player_id",
  "member.playerId",
  "member.member_id",
  "member.memberId",
  "member.matchplay_member_id",
  "member.matchplayMemberId",
  "member.matchplay_player_id",
  "member.matchplayPlayerId",
  "user.id",
  "user.user_id",
  "user.userId",
  "user.player_id",
  "user.playerId",
  "user.member_id",
  "user.memberId",
  "user.matchplay_member_id",
  "user.matchplayMemberId",
  "user.matchplay_player_id",
  "user.matchplayPlayerId",
];

const MEMBERSHIP_ID_KEYS = [
  "id",
  "membership_id",
  "membershipId",
  "member_id",
  "memberId",
  "player_id",
  "playerId",
  "user_id",
  "userId",
  "matchplay_member_id",
  "matchplayMemberId",
  "matchplay_player_id",
  "matchplayPlayerId",
];

const PARTICIPANT_ID_KEYS = [
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
  "profile.user_id",
  "profile.userId",
  "profile.player_id",
  "profile.playerId",
  "profile.member_id",
  "profile.memberId",
  "player.id",
  "player.user_id",
  "player.userId",
  "player.player_id",
  "player.playerId",
  "player.member_id",
  "player.memberId",
];

const INVITE_ID_KEYS = [
  "invitee_id",
  "inviteeId",
  "player_id",
  "playerId",
  "participant_id",
  "participantId",
  "id",
  "profile.id",
  "profile.user_id",
  "profile.userId",
  "profile.player_id",
  "profile.playerId",
  "profile.member_id",
  "profile.memberId",
  "player.id",
  "player.user_id",
  "player.userId",
  "player.player_id",
  "player.playerId",
  "player.member_id",
  "player.memberId",
];

const HOST_ID_KEYS = [
  "host_id",
  "hostId",
  "host_user_id",
  "hostUserId",
  "host_player_id",
  "hostPlayerId",
  "host_member_id",
  "hostMemberId",
  "host_profile_id",
  "hostProfileId",
  "host_participant_id",
  "hostParticipantId",
  "organizer_id",
  "organizerId",
  "organiser_id",
  "organiserId",
  "host_identity",
  "hostIdentity",
  "host_identity_id",
  "hostIdentityId",
  "organizer_identity",
  "organizerIdentity",
  "organiser_identity",
  "organiserIdentity",
  "organizer_user_id",
  "organizerUserId",
  "organizer_player_id",
  "organizerPlayerId",
  "organizer_member_id",
  "organizerMemberId",
  "organizer_profile_id",
  "organizerProfileId",
  "creator_id",
  "creatorId",
  "creator_identity",
  "creatorIdentity",
  "created_by",
  "createdBy",
  "created_by_id",
  "createdById",
  "created_by_identity",
  "createdByIdentity",
  "owner_id",
  "ownerId",
  "owner_identity",
  "ownerIdentity",
  "owner_user_id",
  "ownerUserId",
  "owner_player_id",
  "ownerPlayerId",
  "owner_member_id",
  "ownerMemberId",
];

const HOST_ASSOCIATED_OBJECT_KEYS = [
  "host",
  "host_profile",
  "hostProfile",
  "organizer",
  "organiser",
  "organizer_profile",
  "organizerProfile",
  "organiser_profile",
  "organiserProfile",
  "creator",
  "owner",
  "created_by",
  "createdBy",
  "organized_by",
  "organizedBy",
  "organised_by",
  "organisedBy",
];

const HOST_STATUS_VALUES = new Set(["hosting", "host"]);

const getValueByPath = (subject, path) => {
  if (!subject || typeof subject !== "object") return undefined;
  if (typeof path !== "string" || path.length === 0) return undefined;
  if (!path.includes(".")) {
    return subject[path];
  }
  const segments = path.split(".");
  let current = subject;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const gatherValues = (source, keys) => {
  if (!source) return [];
  const items = Array.isArray(source) ? source : [source];
  const results = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    for (const key of keys) {
      const value = getValueByPath(item, key);
      if (value === undefined || value === null) continue;
      results.push(value);
    }
  }
  return results;
};

const dedupeValues = (values) => {
  if (!Array.isArray(values) || values.length === 0) return [];
  const deduped = [];
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (deduped.some((existing) => idsMatch(existing, value))) continue;
    deduped.push(value);
  }
  return deduped;
};

const gatherIdentityHints = (...sources) => {
  if (!sources || sources.length === 0) return [];
  const results = [];
  const visit = (value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      results.push(...collectValues(value, MEMBER_ID_KEYS));
      results.push(...collectValues(value, MEMBERSHIP_ID_KEYS));
      return;
    }
    results.push(value);
  };
  sources.forEach(visit);
  return dedupeValues(results);
};

const isHostingParticipant = (participant) => {
  if (!participant || typeof participant !== "object") return false;
  const statusCandidates = [
    participant.status,
    participant.participant_status,
    participant.participantStatus,
    participant.role,
  ];
  return statusCandidates.some((status) => {
    if (!status) return false;
    const normalized = status.toString().trim().toLowerCase();
    return HOST_STATUS_VALUES.has(normalized);
  });
};

const collectValues = (source, keys) => dedupeValues(gatherValues(source, keys));

export const collectMemberIds = (member) => {
  if (!member || typeof member !== "object") return [];
  if (Array.isArray(member.identityIds) && member.identityIds.length > 0) {
    return dedupeValues(member.identityIds);
  }
  const baseValues = collectValues(member, MEMBER_ID_KEYS);
  const membershipSources = [
    member.memberships,
    member.membership,
    member.profile?.memberships,
    member.profile?.membership,
    member.profile?.member,
    member.account?.memberships,
    member.account?.membership,
    member.account?.member,
    member.person?.memberships,
    member.person?.membership,
    member.person?.member,
    member.member?.memberships,
    member.member?.membership,
    member.user?.memberships,
    member.user?.membership,
    member.user?.member,
    member.userRecord?.memberships,
    member.userRecord?.membership,
    member.userRecord?.member,
  ];
  const membershipValues = dedupeValues(
    membershipSources.flatMap((source) => collectValues(source, MEMBERSHIP_ID_KEYS)),
  );
  const additionalValues = gatherIdentityHints(
    member.identityIds,
    member.identity_ids,
    member.identity,
    member.identityId,
    member.identityHints,
    member.identities,
    member.memberIds,
    member.member_ids,
    member.matchplayIds,
    member.matchplay_ids,
    member.authIds,
    member.auth_ids,
    member.profile?.identityIds,
    member.profile?.identity_ids,
    member.profile?.identityHints,
    member.profile?.identities,
    member.account?.identityIds,
    member.account?.identity_ids,
    member.account?.identityHints,
    member.account?.identities,
    member.person?.identityIds,
    member.person?.identity_ids,
    member.person?.identityHints,
    member.person?.identities,
    member.member?.identityIds,
    member.member?.identity_ids,
    member.member?.identityHints,
    member.member?.identities,
    member.user?.identityIds,
    member.user?.identity_ids,
    member.user?.identityHints,
    member.user?.identities,
    member.userRecord?.identityIds,
    member.userRecord?.identity_ids,
    member.userRecord?.identityHints,
    member.userRecord?.identities,
  );
  return dedupeValues([...baseValues, ...membershipValues, ...additionalValues]);
};

const ensureMemberIds = (member, precomputedIds) => {
  if (Array.isArray(precomputedIds) && precomputedIds.length > 0) {
    return dedupeValues(precomputedIds);
  }
  return collectMemberIds(member);
};

export const memberMatchesParticipant = (member, participant, precomputedIds) => {
  const memberIds = ensureMemberIds(member, precomputedIds);
  if (memberIds.length === 0) return false;
  const participantIds = collectValues(participant, PARTICIPANT_ID_KEYS);
  if (participantIds.length === 0) return false;
  return participantIds.some((participantId) =>
    memberIds.some((memberId) => idsMatch(memberId, participantId)),
  );
};

export const memberMatchesInvite = (member, invite, precomputedIds) => {
  const memberIds = ensureMemberIds(member, precomputedIds);
  if (memberIds.length === 0) return false;
  const inviteIds = collectValues(invite, INVITE_ID_KEYS);
  if (inviteIds.length === 0) return false;
  return inviteIds.some((inviteId) =>
    memberIds.some((memberId) => idsMatch(memberId, inviteId)),
  );
};

export const collectMatchHostIds = (match) => {
  if (!match || typeof match !== "object") return [];
  const hostIds = [
    ...collectValues(match, HOST_ID_KEYS),
    ...gatherIdentityHints(
      match.host_identity,
      match.hostIdentity,
      match.host_identity_id,
      match.hostIdentityId,
      match.organizer_identity,
      match.organizerIdentity,
      match.organiser_identity,
      match.organiserIdentity,
      match.creator_identity,
      match.creatorIdentity,
      match.created_by_identity,
      match.createdByIdentity,
      match.owner_identity,
      match.ownerIdentity,
    ),
  ];
  for (const key of HOST_ASSOCIATED_OBJECT_KEYS) {
    const candidate = getValueByPath(match, key);
    if (candidate) {
      hostIds.push(...collectMemberIds(candidate));
    }
  }
  if (Array.isArray(match.participants)) {
    const hostParticipant = match.participants.find(isHostingParticipant);
    if (hostParticipant) {
      hostIds.push(...collectValues(hostParticipant, PARTICIPANT_ID_KEYS));
      hostIds.push(...collectValues(hostParticipant.profile || {}, MEMBER_ID_KEYS));
      hostIds.push(
        ...gatherIdentityHints(
          hostParticipant.identity,
          hostParticipant.identityId,
          hostParticipant.identity_ids,
          hostParticipant.identityIds,
          hostParticipant.identityHints,
          hostParticipant.profile?.identity,
          hostParticipant.profile?.identityId,
          hostParticipant.profile?.identity_ids,
          hostParticipant.profile?.identityIds,
          hostParticipant.profile?.identityHints,
        ),
      );
    }
  }
  return dedupeValues(hostIds);
};

export const memberIsMatchHost = (member, match, precomputedIds) => {
  const memberIds = ensureMemberIds(member, precomputedIds);
  if (memberIds.length === 0) return false;
  const hostIds = collectMatchHostIds(match);
  if (hostIds.length === 0) return false;
  return hostIds.some((hostId) => memberIds.some((memberId) => idsMatch(memberId, hostId)));
};

export const memberMatchesAnyId = (member, candidates, precomputedIds) => {
  const memberIds = ensureMemberIds(member, precomputedIds);
  if (memberIds.length === 0) return false;
  const values = Array.isArray(candidates) ? candidates : [candidates];
  const normalized = dedupeValues(values);
  if (normalized.length === 0) return false;
  return normalized.some((candidate) =>
    memberIds.some((memberId) => idsMatch(memberId, candidate)),
  );
};

export const buildIdentityMatcher = (member) => {
  const memberIds = collectMemberIds(member);
  return {
    ids: memberIds,
    matchesValue: (value) => memberIds.some((memberId) => idsMatch(memberId, value)),
    matchesParticipant: (participant) => memberMatchesParticipant(member, participant, memberIds),
    matchesInvite: (invite) => memberMatchesInvite(member, invite, memberIds),
    isHost: (match) => memberIsMatchHost(member, match, memberIds),
  };
};

export const hasMemberIdentity = (member) => collectMemberIds(member).length > 0;

