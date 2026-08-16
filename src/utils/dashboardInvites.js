import moment from "moment";

const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const parseNumber = (...values) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const parseNearbyMoment = (...values) => {
  for (const value of values) {
    if (!value) continue;
    const parsed = moment.parseZone(value);
    if (parsed.isValid()) return parsed;
  }
  return null;
};

const formatDisplayLocation = (value) => {
  const label = pickString(value);
  if (!label) return "Location TBD";

  if (/^\d/.test(label)) {
    return label.split(",")[0]?.trim() || label;
  }

  const trimmedName = label.replace(/\s+\d{1,6}\b.*$/, "").trim();
  if (trimmedName) return trimmedName;

  return label.split(",")[0]?.trim() || label;
};

const formatMoney = (value) => {
  const amount = parseNumber(value);
  return amount === null ? null : `$${amount.toFixed(0)}`;
};

// Kept alongside the copy in DashboardPage rather than shared: that file uses it
// for coach records and lesson metadata too, and the four helpers above are
// already duplicated across the pair. Following the existing arrangement beats
// starting a third one in a move that is meant to change nothing.
const firstObject = (...values) =>
  values.find((value) => value && typeof value === "object" && !Array.isArray(value)) ?? null;

const formatInviteExpiry = (value) => {
  const parsed = parseNearbyMoment(value) ?? (value ? moment(value) : null);
  if (!parsed?.isValid()) return null;
  const now = moment();
  if (parsed.isBefore(now)) return "Expired";
  return parsed.fromNow();
};

const toInitials = (value, fallback = "TP") => {
  const label = pickString(value);
  if (!label) return fallback;
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || fallback
  );
};

export const collectDashboardIdentityValues = (record) => {
  if (!record || typeof record !== "object") return [];

  return [
    record.id,
    record.user_id,
    record.userId,
    record.player_id,
    record.playerId,
    record.profile_id,
    record.profileId,
    record.coach_id,
    record.coachId,
    record.email,
    record.user_email,
    record.phone,
    record.phone_number,
  ]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
};

export const getStoredDashboardUserIdentity = () => {
  if (typeof window === "undefined") return null;

  try {
    const loginRaw = window.localStorage.getItem("authLoginResponse");
    const profileRaw = window.localStorage.getItem("playerPersonalDetails");
    const login = loginRaw ? JSON.parse(loginRaw) : null;
    const profile = profileRaw ? JSON.parse(profileRaw) : null;
    const session = login?.session && typeof login.session === "object" ? login.session : null;

    return {
      id:
        login?.user_id ??
        login?.id ??
        login?.player_id ??
        login?.profile?.user_id ??
        login?.profile?.id ??
        profile?.user_id ??
        profile?.id ??
        session?.user_id ??
        session?.id,
      user_id: login?.user_id ?? profile?.user_id ?? session?.user_id,
      player_id: login?.player_id ?? profile?.player_id ?? profile?.id,
      email: login?.email ?? profile?.email ?? session?.email,
      phone: login?.phone ?? profile?.phone ?? session?.phone,
    };
  } catch {
    return null;
  }
};

export const getDashboardUserIdentityRecord = (currentUser) => {
  const sessionRecord =
    currentUser?.session && typeof currentUser.session === "object" ? currentUser.session : null;
  return {
    ...(getStoredDashboardUserIdentity() ?? {}),
    ...(sessionRecord ?? {}),
    ...((currentUser && typeof currentUser === "object") ? currentUser : {}),
  };
};

const isPendingValue = (value) => {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "number") return value === 0;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "0" || normalized.includes("pending") || normalized.includes("invite") || normalized.includes("requested");
};

const isConfirmedValue = (value) => {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "number") return value === 1;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized.includes("confirmed") || normalized.includes("paid") || normalized.includes("accepted");
};

const getParticipantStatus = (participant) =>
  participant?.status ??
  participant?.booking_status ??
  participant?.bookingStatus ??
  participant?.lesson_status ??
  participant?.lessonStatus;

const getParticipantPaymentStatus = (participant) =>
  participant?.payment_status ?? participant?.paymentStatus;

const isConfirmedGroupParticipant = (participant) =>
  isConfirmedValue(getParticipantStatus(participant)) && isConfirmedValue(getParticipantPaymentStatus(participant));

const isPendingGroupParticipant = (participant) => {
  const status = getParticipantStatus(participant);
  const paymentStatus = getParticipantPaymentStatus(participant);
  return isPendingValue(status) || isPendingValue(paymentStatus);
};

const resolveInviteLessonLabel = (lesson) => {
  const typeId = parseNumber(lesson.lessontype_id, lesson.lesson_type_id, lesson.lessonTypeId);
  const typeName = (pickString(lesson.lesson_type_name, lesson.lesson_type, lesson.type) || "").toLowerCase();
  if (typeId === 2 || typeName.includes("semi")) return "semi-private lesson";
  if (typeId === 3 || typeId === 4 || typeName.includes("group")) return "group lesson";
  return "private lesson";
};

const resolveCoachInviteLessonDestination = (lessonId, lesson) => {
  if (lessonId == null) return "/notifications";

  const typeId = parseNumber(lesson.lessontype_id, lesson.lesson_type_id, lesson.lessonTypeId);
  const typeName = (pickString(lesson.lesson_type_name, lesson.lesson_type, lesson.type) || "").toLowerCase();
  const isSemiPrivate = typeId === 2 || typeName.includes("semi");
  const isGroupLesson = typeId === 3 || typeId === 4 || typeName.includes("group");

  return isGroupLesson && !isSemiPrivate ? `/group-lessons/${lessonId}` : `/player/lesson/${lessonId}`;
};

/**
 * Normalises a /invites record into the shape the invite UI consumes.
 *
 * Moved here from DashboardPage so the v2 home card and the legacy dashboard
 * share one set of field-fallback chains. Two chains over the same payload
 * would drift, and the drift would be invisible until one screen disagreed
 * with the other.
 */
export const buildPlayerInviteItems = (records = []) =>
  records
    .map((record, index) => {
      const match = firstObject(record.match, record.match_play);
      const senderProfile = firstObject(
        record.profile,
        record.sender,
        record.inviter,
        record.actor,
        match?.host,
      );
      const senderName =
        pickString(
          record.sender_name,
          record.inviter_name,
          record.coach_name,
          record.host_name,
          record.full_name,
          senderProfile?.full_name,
          senderProfile?.name,
          match?.host_name,
        ) || "Player invite";
      const startMoment =
        parseNearbyMoment(
          record.start_date_time,
          record.start_at,
          match?.start_date_time,
          match?.start_at,
        ) ?? null;
      const location = formatDisplayLocation(
        pickString(
          record.location,
          record.location_name,
          match?.location_text,
          match?.location,
        ) || "Location TBD",
      );
      const matchLevel = pickString(
        record.skill_level,
        record.level,
        match?.skill_level_min && match?.skill_level_max
          ? `${match.skill_level_min}-${match.skill_level_max}`
          : match?.skill_level_min,
      );
      const formatWord = pickString(match?.match_format, record.match_format)?.toLowerCase();
      const description = formatWord ? `Invited you to a ${formatWord} match` : "Invited you to a match";
      // Render the event time in the viewer's LOCAL zone (parseZone keeps the source
      // UTC offset, which showed e.g. 10pm-UTC instead of 3pm-PDT).
      const startLocal = startMoment?.isValid() ? startMoment.clone().local() : null;
      const whenLabel = startLocal ? startLocal.format("ddd MMM D, h:mm A") : null;
      const chips = [
        startLocal ? `📅 ${startLocal.format("ddd MMM D")}` : null,
        startLocal ? `⏰ ${startLocal.format("h:mm A")}` : null,
        location ? `📍 ${location}` : null,
        matchLevel ? `⭐ ${matchLevel}` : null,
      ].filter(Boolean);
      const destinationId = record.entity_id ?? match?.id ?? record.match_id ?? null;
      const destination = destinationId != null ? `/matches/${destinationId}` : "/notifications";

      return {
        id: record.id ?? `player-invite-${index}`,
        token: pickString(record.token, record.invite_token),
        type: "player",
        senderName,
        initials: toInitials(senderName, "PL"),
        avatarUrl: pickString(record.profile_picture, record.profile_url, senderProfile?.profile_picture, senderProfile?.profile_url),
        typeLabel: "Player",
        description,
        chips,
        whenLabel,
        // Raw epoch ms alongside the formatted label: the home card sorts
        // soonest-first, and a formatted string cannot be ordered. Null when the
        // record carries no parseable start. DashboardPage ignores this.
        startsAt: startLocal?.isValid() ? startLocal.valueOf() : null,
        locationLabel: location || null,
        isLeague: Boolean(match?.is_league_match ?? record.is_league_match),
        leagueId: match?.league_id ?? record.league_id ?? null,
        expiresLabel: formatInviteExpiry(record.expires_at ?? record.expiresAt),
        deadlineAt: record.expires_at ?? record.expiresAt ?? null,
        ctaHint: "Tap for details →",
        accentClassName: "player",
        destination,
        inviteKind: "player",
      };
    })
    .filter(Boolean);

export const buildCoachInviteItems = (records = [], currentUser) => {
  const userIdentities = new Set(collectDashboardIdentityValues(currentUser));

  return records
    .filter((lesson) => {
      if (!lesson || typeof lesson !== "object") return false;
      if (userIdentities.size === 0) return false;

      const lessonStatus = lesson.payment_status ?? lesson.paymentStatus ?? lesson.status ?? lesson.booking_status ?? lesson.lesson_status;
      const participantRecords = [
        ...(Array.isArray(lesson.participants) ? lesson.participants : []),
        ...(Array.isArray(lesson.group_players) ? lesson.group_players : []),
      ];
      const createdBy = lesson.created_by ?? lesson.createdBy;
      const coachId = lesson.coach_id ?? lesson.coachId;
      const lessonPlayerIdentities = collectDashboardIdentityValues({
        player_id: lesson.player_id,
        user_id: lesson.user_id,
        email: lesson.email,
      });
      const isCurrentPlayerAssigned =
        lessonPlayerIdentities.length > 0 &&
        lessonPlayerIdentities.some((value) => userIdentities.has(value));
      const matchingParticipant = participantRecords.find((participant) =>
        collectDashboardIdentityValues(participant).some((value) => userIdentities.has(value)),
      );
      const isCurrentPlayerParticipant = Boolean(matchingParticipant);
      const participantPending = matchingParticipant ? isPendingGroupParticipant(matchingParticipant) : false;
      const participantConfirmed = matchingParticipant ? isConfirmedGroupParticipant(matchingParticipant) : false;
      const lessonPending = isPendingValue(lessonStatus);
      const createdByCoach =
        createdBy !== null && createdBy !== undefined
          ? coachId !== null && coachId !== undefined
            ? String(createdBy) === String(coachId)
            : !userIdentities.has(String(createdBy).trim().toLowerCase())
          : false;

      if (!createdByCoach) return false;
      if (participantConfirmed) return false;

      const assignedPending = isCurrentPlayerAssigned && lessonPending;
      const participantInvitePending = isCurrentPlayerParticipant && participantPending;

      return assignedPending || participantInvitePending;
    })
    .map((lesson, index) => {
      const senderName =
        pickString(lesson.full_name, lesson.coach_name, lesson.coachName, lesson?.coach?.name) || "Coach invite";
      const startMoment =
        parseNearbyMoment(
          lesson.startTime ??
            lesson.start_time ??
            lesson.start_at ??
            lesson.start ??
            lesson.startDate ??
            lesson.starts_at ??
            lesson.start_date_time,
        ) ?? null;
      const location = formatDisplayLocation(
        pickString(
          lesson.location_name,
          lesson.locationName,
          lesson.location,
          lesson.location_label,
          lesson.court_name,
          lesson.facility_name,
        ) || "Location TBD",
      );
      const lessonType = resolveInviteLessonLabel(lesson);
      const priceLabel = formatMoney(
        lesson.price_per_person ?? lesson.group_price_per_person ?? lesson.price ?? lesson.hourly_rate ?? lesson.lesson_price,
      );
      const chips = [
        startMoment?.isValid() ? `📅 ${startMoment.format("ddd MMM D")}` : null,
        startMoment?.isValid() ? `⏰ ${startMoment.format("h:mm A")}` : null,
        location ? `📍 ${location}` : null,
        priceLabel ? `💵 ${priceLabel}` : null,
      ].filter(Boolean);
      const lessonId = lesson.id ?? lesson.lesson_id ?? lesson.lessonId ?? lesson.booking_id ?? null;

      return {
        id: lessonId ?? `coach-invite-${index}`,
        lessonId,
        type: "coach",
        senderName,
        initials: toInitials(senderName, "CO"),
        avatarUrl: pickString(lesson.profile_picture, lesson?.coach?.profile_picture, lesson?.coach?.avatarUrl),
        typeLabel: "Coach",
        description: `Invited you to a ${lessonType}`,
        chips,
        expiresLabel: startMoment?.isValid() ? `starts ${startMoment.fromNow()}` : null,
        ctaHint: "Tap for details →",
        accentClassName: "coach",
        destination: resolveCoachInviteLessonDestination(lessonId, lesson),
        inviteKind: "coach",
      };
    });
};
