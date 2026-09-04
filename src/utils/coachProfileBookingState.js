const normalizeString = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const normalizePhone = (value) => (typeof value === "string" ? value.replace(/\D/g, "") : "");

const collectIdentityValues = (record, keys, normalize = normalizeString) => {
  if (!record || typeof record !== "object") return new Set();

  return keys.reduce((values, key) => {
    const value = record[key];
    if (value !== undefined && value !== null) {
      const normalized = normalize(String(value));
      if (normalized) values.add(normalized);
    }
    return values;
  }, new Set());
};

const getNestedRecord = (record, key) => {
  const value = record && typeof record === "object" ? record[key] : null;
  return value && typeof value === "object" ? value : null;
};

const parseStatusCode = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const userIdKeys = ["id", "user_id", "userId", "player_id", "playerId", "participant_id", "participantId"];
const participantIdKeys = [
  "id",
  "user_id",
  "userId",
  "player_id",
  "playerId",
  "participant_id",
  "participantId",
  "player_user_id",
  "playerUserId",
];
const emailKeys = ["email", "email_address", "emailAddress"];
const phoneKeys = ["phone", "phone_number", "phoneNumber", "contact_phone", "contactPhone"];

export const doesGroupParticipantMatchUser = (participant, currentUser) => {
  if (!participant || typeof participant !== "object" || !currentUser || typeof currentUser !== "object") {
    return false;
  }

  const userProfile = getNestedRecord(currentUser, "profile") ?? getNestedRecord(currentUser, "user");
  const participantProfile = getNestedRecord(participant, "profile") ?? getNestedRecord(participant, "player");

  const userIds = new Set([
    ...collectIdentityValues(currentUser, userIdKeys),
    ...collectIdentityValues(userProfile, userIdKeys),
  ]);
  const participantIds = new Set([
    ...collectIdentityValues(participant, participantIdKeys),
    ...collectIdentityValues(participantProfile, participantIdKeys),
  ]);

  for (const id of participantIds) {
    if (userIds.has(id)) return true;
  }

  const userEmails = new Set([
    ...collectIdentityValues(currentUser, emailKeys),
    ...collectIdentityValues(userProfile, emailKeys),
  ]);
  const participantEmails = new Set([
    ...collectIdentityValues(participant, emailKeys),
    ...collectIdentityValues(participantProfile, emailKeys),
  ]);

  for (const email of participantEmails) {
    if (userEmails.has(email)) return true;
  }

  const userPhones = new Set([
    ...collectIdentityValues(currentUser, phoneKeys, normalizePhone),
    ...collectIdentityValues(userProfile, phoneKeys, normalizePhone),
  ]);
  const participantPhones = new Set([
    ...collectIdentityValues(participant, phoneKeys, normalizePhone),
    ...collectIdentityValues(participantProfile, phoneKeys, normalizePhone),
  ]);

  for (const phone of participantPhones) {
    if (phone && userPhones.has(phone)) return true;
  }

  return false;
};

export const getGroupParticipantBookingState = (groupPlayers, currentUser) => {
  if (!Array.isArray(groupPlayers) || !groupPlayers.length) return null;

  const participant = groupPlayers.find((entry) => doesGroupParticipantMatchUser(entry, currentUser));
  if (!participant) return null;

  const status = parseStatusCode(participant.status);
  const paymentStatus = parseStatusCode(participant.payment_status ?? participant.paymentStatus);
  const paymentMethod = normalizeString(participant.payment_method ?? participant.paymentMethod);

  if (status === 2 || paymentStatus === 2) return null;
  if (paymentMethod === "comped") return "confirmed";
  if (status === 1 && paymentStatus === 1) return "confirmed";
  return "pending";
};

export const findUpcomingLessonForSlot = ({ slot, upcomingLessons, currentUser, getLessonRange, overlapsRange }) => {
  if (!slot || !Array.isArray(upcomingLessons)) return null;

  if (slot.type === "group") {
    const sourceLessonId = slot.sourceLessonId == null ? "" : String(slot.sourceLessonId);
    if (!sourceLessonId) return null;

    return (
      upcomingLessons.find((lesson) => {
        const lessonId = lesson?.id == null ? "" : String(lesson.id);
        if (lessonId !== sourceLessonId) return false;
        return getGroupParticipantBookingState(lesson.group_players, currentUser) != null;
      }) ?? null
    );
  }

  return (
    upcomingLessons.find((lesson) => {
      const range = getLessonRange(lesson);
      return range ? overlapsRange(range) : false;
    }) ?? null
  );
};
