// Activity feed normalisation — the "Play this week" sources.
//
// Moved verbatim out of DashboardPage so the redesigned home and the legacy
// dashboard share one set of field-fallback chains over the same four API
// shapes. Two chains would drift, and the drift would stay invisible until one
// screen disagreed with the other.
//
// Nothing here was rewritten in the move; see the PR for the byte-for-byte diff.

import moment from "moment";
import { normalizeMatchRecord } from "../api/matches";

export const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

export const parseDate = (value) => {
  if (!value) return null;
  const date = moment(value);
  return date.isValid() ? date.toDate() : null;
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

export const firstObject = (...values) => values.find((value) => value && typeof value === "object" && !Array.isArray(value)) ?? null;

export const resolveLessonKind = (lesson) => {
  if (lesson?.metadata?.externalUrl) return "external";
  const limit = parseNumber(lesson.player_limit, lesson.playerLimit, lesson.max_players, lesson.player_capacity);
  const typeId = parseNumber(lesson.lessontype_id, lesson.lesson_type_id, lesson.lessonTypeId);
  const typeValue = pickString(lesson.lesson_type_name, lesson.type, lesson.lesson_type, lesson.program_type) || "";
  if (typeId === 3 || typeId === 4) return "group";
  if (limit && limit > 1) return "group";
  if (/\b(group|semi|clinic|camp)\b/i.test(typeValue)) return "group";
  return "private";
};

export const formatStatusLabel = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (value === 0) return "Pending";
    if (value === 1) return "Confirmed";
    if (value === 2) return "Cancelled";
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized === "0") return "Pending";
    if (normalized === "1") return "Confirmed";
    if (normalized === "2") return "Cancelled";
  }
  return value
    .toString()
    .replace(/[_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const getTypeConfig = (type) => {
  if (type === "group") {
    return {
      badge: "👥",
      label: "Group Lesson",
      className: "group",
      availability: "Open spots",
    };
  }

  if (type === "match") {
    return {
      badge: "🏆",
      label: "Match",
      className: "match",
      availability: "Open",
    };
  }

  if (type === "external") {
    return {
      badge: "↗",
      label: "External Lesson",
      className: "external",
      availability: "External booking",
    };
  }

  return {
    badge: "🎾",
    label: "Private Lesson",
    className: "lesson",
    availability: "Available",
  };
};

export const parseNearbyDate = (...values) => {
  for (const value of values) {
    const parsed = parseDate(value);
    if (parsed) return parsed;
  }
  return null;
};

export const parseNearbyMoment = (...values) => {
  for (const value of values) {
    if (!value) continue;
    const parsed = moment.parseZone(value);
    if (parsed.isValid()) return parsed;
  }
  return null;
};

const toLocalDayKey = (zonedStart, fallbackDate) =>
  (zonedStart ? zonedStart.clone().local() : moment(fallbackDate)).format("YYYY-MM-DD");

export const formatDisplayLocation = (value) => {
  const label = pickString(value);
  if (!label) return "Location TBD";

  if (/^\d/.test(label)) {
    return label.split(",")[0]?.trim() || label;
  }

  const trimmedName = label.replace(/\s+\d{1,6}\b.*$/, "").trim();
  if (trimmedName) return trimmedName;

  return label.split(",")[0]?.trim() || label;
};

const formatDistance = (value) => {
  const distance = parseNumber(value);
  return distance === null ? null : `${distance.toFixed(distance < 10 ? 1 : 0)} mi`;
};

const formatClockTime = (value) => {
  if (!value) return null;
  const parsed = moment(value, ["HH:mm:ss", "HH:mm"], true);
  return parsed.isValid() ? parsed.format("h A") : null;
};

const isConfirmedValue = (value) => {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "number") return value === 1;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized.includes("confirmed") || normalized.includes("paid") || normalized.includes("accepted");
};

const getParticipantStatusValue = (participant) =>
  participant?.payment_status ??
  participant?.paymentStatus ??
  participant?.status ??
  participant?.booking_status ??
  participant?.bookingStatus ??
  participant?.lesson_status ??
  participant?.lessonStatus;

const isActiveGroupParticipant = (participant) => {
  const status = getParticipantStatusValue(participant);
  if (status === null || status === undefined || status === "") return true;
  return isConfirmedValue(status);
};

const getActiveGroupParticipantCount = (lesson) => {
  const participantRecords = [
    ...(Array.isArray(lesson?.participants) ? lesson.participants : []),
    ...(Array.isArray(lesson?.group_players) ? lesson.group_players : []),
  ];
  if (participantRecords.length === 0) return null;

  const seen = new Set();
  return participantRecords.reduce((count, participant, index) => {
    if (!participant || typeof participant !== "object") return count;
    const key =
      participant.participant_id ??
      participant.participantId ??
      participant.group_player_id ??
      participant.groupPlayerId ??
      participant.player_id ??
      participant.playerId ??
      participant.user_id ??
      participant.userId ??
      participant.id ??
      index;
    const normalizedKey = String(key);
    if (seen.has(normalizedKey)) return count;
    seen.add(normalizedKey);
    return isActiveGroupParticipant(participant) ? count + 1 : count;
  }, 0);
};

export const isFutureNearbyActivity = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return false;
  return moment(date).isSameOrAfter(moment(), "minute");
};

const weekdayIndexMap = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const buildDateFromAvailability = (dayName, fromTime) => {
  const weekdayIndex = weekdayIndexMap[(dayName || "").toUpperCase()];
  if (weekdayIndex === undefined || !fromTime) return null;

  const [hours = "0", minutes = "0", seconds = "0"] = String(fromTime).split(":");
  const target = moment().day(weekdayIndex).hour(Number(hours)).minute(Number(minutes)).second(Number(seconds));

  if (target.isBefore(moment())) {
    target.add(7, "days");
  }

  return target.toDate();
};

const formatCoachTitle = (record) => {
  const coachName = pickString(
    record.full_name,
    record.coach_name,
    record.coachName,
    record.name,
    record.title,
    record?.coach?.name,
  );
  return coachName ? `Coach ${coachName}` : "Private Lesson";
};

export const buildCoachActivities = (records = []) =>
  records
    .flatMap((record) => {
      const coach = firstObject(record.coach, record.coach_profile, record.profile);
      const coachId = record.coach_id ?? record.coachId ?? coach?.id ?? record.id ?? null;
      const coachName = pickString(
        record.full_name,
        record.coach_name,
        record.coachName,
        coach?.name,
        [coach?.firstName, coach?.lastName].filter(Boolean).join(" "),
      );
      const initials = coachName
        ? coachName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((name) => name.charAt(0).toUpperCase())
            .join("")
        : "TP";
      const rating = parseNumber(record.rating, record.coach_rating, coach?.rating);
      const availabilityWindows = Array.isArray(record.availability) ? record.availability : [];

      return availabilityWindows
        .map((slot, index) => {
          const zonedStart =
            parseNearbyMoment(
              slot.start_date_time,
              slot.start_time,
              slot.startTime,
              slot.start_at,
              slot.date_time,
            );
          const startAt = zonedStart?.toDate() || buildDateFromAvailability(slot.day, slot.from);

          if (!startAt) return null;
          if (!isFutureNearbyActivity(startAt)) return null;

          const locationLabel =
            pickString(
              slot.location_name,
              slot.locationName,
              record.location_name,
              record.locationName,
              record.location,
              coach?.location,
            ) || "Location TBD";
          const location = formatDisplayLocation(locationLabel);
          const distanceLabel = formatDistance(slot.distance_miles ?? record.distance_miles ?? coach?.distance);
          const availabilityText =
            slot.from && slot.to
              ? `Available ${formatClockTime(slot.from) ?? slot.from} – ${formatClockTime(slot.to) ?? slot.to}`
              : null;

          return {
            id: `coach-${coachId ?? "unknown"}-${index}-${startAt.toISOString()}`,
            lessonId: coachId != null ? String(coachId) : null,
            type: "private",
            label: "Private Lesson",
            typeClassName: "lesson",
            title: formatCoachTitle({ ...record, coach }),
            time: zonedStart ? zonedStart.format("h:mm A") : moment(startAt).format("h:mm A"),
            dayKey: slot.date || toLocalDayKey(zonedStart, startAt),
            startTime: zonedStart ? zonedStart.toISOString() : startAt.toISOString(),
            location,
            secondaryMeta: distanceLabel,
            availabilityText,
            rating,
            price: parseNumber(record.price_per_person, record.hourly_rate, record.price, coach?.hourlyRate),
            status:
              pickString(
                record.availability_status,
                record.status,
                "Available",
              ) || "Available",
            remainingSpots: null,
            avatar: initials,
            avatarUrl: pickString(record.profile_picture, coach?.profile_picture, coach?.avatarUrl),
            avatarBadge: "🎾",
            destination: coachId != null ? `/coaches/${coachId}` : null,
          };
        })
        .filter(Boolean);
    })
    .sort(
      (a, b) =>
        moment(`${a.dayKey} ${a.time}`, "YYYY-MM-DD h:mm A").valueOf() -
        moment(`${b.dayKey} ${b.time}`, "YYYY-MM-DD h:mm A").valueOf(),
    );

export const buildActivityItems = (lessons = []) =>
  lessons
    .map((lesson) => {
      const zonedStart = parseNearbyMoment(
        lesson.startTime ??
          lesson.start_time ??
          lesson.start_at ??
          lesson.start ??
          lesson.startDate ??
          lesson.starts_at ??
          lesson.start_date_time,
      );
      const startAt = zonedStart?.toDate() ?? parseDate(
        lesson.startTime ??
          lesson.start_time ??
          lesson.start_at ??
          lesson.start ??
          lesson.startDate ??
          lesson.starts_at ??
          lesson.start_date_time,
      );
      if (!startAt) return null;
      if (!isFutureNearbyActivity(startAt)) return null;

      const type = resolveLessonKind(lesson);
      const lessonId = lesson.id ?? lesson.lesson_id ?? lesson.lessonId ?? lesson.booking_id ?? lesson.uuid ?? null;
      const coachName = pickString(lesson.full_name, lesson.coach_name, lesson.coachName, lesson?.coach?.name);
      const title =
        pickString(
          lesson.title,
          lesson.lesson_title,
          lesson.name,
          lesson.lesson_name,
          lesson.program_name,
          lesson?.metadata?.title,
        ) ||
        (type === "group" ? "Intermediate Drills" : coachName ? `Coach ${coachName}` : "Private Lesson");
      const typeConfig = getTypeConfig(type);
      const rating = parseNumber(lesson.rating, lesson.coach_rating, lesson?.coach?.rating);
      const capacity = parseNumber(lesson.player_limit, lesson.playerLimit, lesson.max_players, lesson.player_capacity);
      const participantBookedCount = type === "group" ? getActiveGroupParticipantCount(lesson) : null;
      const booked = parseNumber(
        participantBookedCount,
        lesson.booked_players,
        lesson.bookedPlayers,
        lesson.players_booked,
        lesson.player_count,
      );
      const remainingSpots =
        capacity !== null && booked !== null ? Math.max(capacity - booked, 0) : null;
      const initials = coachName
        ? coachName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((name) => name.charAt(0).toUpperCase())
            .join("")
        : "TP";
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
      const distanceLabel = formatDistance(lesson.distance_miles ?? lesson.distanceMiles ?? lesson.distance);
      const secondaryMeta =
        type === "group"
          ? [coachName ? `Coach ${coachName}` : null, distanceLabel].filter(Boolean).join(" · ")
          : distanceLabel;

      return {
        id: `act-${lessonId ?? startAt.toISOString()}`,
        lessonId: lessonId != null ? String(lessonId) : null,
        type,
        label: typeConfig.label,
        typeClassName: typeConfig.className,
        title,
        time: zonedStart ? zonedStart.format("h:mm A") : moment(startAt).format("h:mm A"),
        dayKey: toLocalDayKey(zonedStart, startAt),
        startTime: zonedStart ? zonedStart.toISOString() : startAt.toISOString(),
        location,
        secondaryMeta,
        coachName,
        rating,
        price: parseNumber(lesson.price_per_person, lesson.group_price_per_person, lesson.price, lesson.lesson_price),
        status: formatStatusLabel(lesson.payment_status ?? lesson.paymentStatus ?? lesson.status ?? lesson.booking_status ?? lesson.lesson_status),
        remainingSpots,
        avatar: type === "private" ? initials : typeConfig.badge,
        avatarUrl: pickString(lesson.profile_picture, lesson?.coach?.profile_picture, lesson?.coach?.avatarUrl),
        avatarBadge: typeConfig.badge,
        extraMeta:
          type === "group" && remainingSpots !== null
            ? `${remainingSpots} spot${remainingSpots === 1 ? "" : "s"} left`
            : null,
        destination:
          lessonId != null
            ? type === "group"
              ? `/group-lessons/${lessonId}`
              : `/player/lesson/${lessonId}`
            : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => moment(a.dayKey).valueOf() - moment(b.dayKey).valueOf());

export const buildExternalLessonActivities = (lessons = []) =>
  lessons
    .map((lesson) => {
      const metadata = firstObject(lesson.metadata) || {};
      const externalUrl = pickString(metadata.externalUrl);
      if (!externalUrl) return null;

      const zonedStart = parseNearbyMoment(
        lesson.startTime ??
          lesson.start_time ??
          lesson.start_at ??
          lesson.start ??
          lesson.startDate ??
          lesson.starts_at ??
          lesson.start_date_time,
      );
      const startAt = zonedStart?.toDate() ?? parseDate(
        lesson.startTime ??
          lesson.start_time ??
          lesson.start_at ??
          lesson.start ??
          lesson.startDate ??
          lesson.starts_at ??
          lesson.start_date_time,
      );
      if (!startAt) return null;
      if (!isFutureNearbyActivity(startAt)) return null;

      const lessonId = lesson.id ?? lesson.lesson_id ?? lesson.lessonId ?? lesson.uuid ?? null;
      const providerName =
        pickString(lesson.full_name, lesson.provider, lesson.provider_name, lesson.coach_name) || "External provider";
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
      const typeConfig = getTypeConfig("external");

      return {
        id: `external-${lessonId ?? startAt.toISOString()}`,
        lessonId: lessonId != null ? String(lessonId) : null,
        type: "external",
        label: typeConfig.label,
        typeClassName: typeConfig.className,
        title:
          pickString(metadata.title, lesson.title, lesson.lesson_title, lesson.name, lesson.lesson_name) ||
          "External lesson",
        time: zonedStart ? zonedStart.format("h:mm A") : moment(startAt).format("h:mm A"),
        dayKey: toLocalDayKey(zonedStart, startAt),
        startTime: zonedStart ? zonedStart.toISOString() : startAt.toISOString(),
        location,
        secondaryMeta: providerName,
        rating: null,
        price: null,
        status: "External booking",
        remainingSpots: null,
        avatar: typeConfig.badge,
        avatarUrl: pickString(lesson.profile_picture, lesson.logo_url, lesson.image_url),
        avatarBadge: typeConfig.badge,
        extraMeta: pickString(metadata.level) ? `Level ${metadata.level}` : null,
        highlight: "Book offsite",
        destination: lessonId != null ? `/lessons/external/${lessonId}` : "/group-lessons",
      };
    })
    .filter(Boolean)
    .sort((a, b) => moment(a.dayKey).valueOf() - moment(b.dayKey).valueOf());

export const buildMatchActivities = (records = []) =>
  records
    .map((record) => {
      const zonedStart = parseNearbyMoment(
        record.match_date_time,
        record.start_date_time,
        record.start_time,
        record.startTime,
        record.start_at,
        record.date_time,
        record.match_date,
        record.scheduled_at,
      );
      const startAt = zonedStart?.toDate() ?? parseNearbyDate(
        record.match_date_time,
        record.start_date_time,
        record.start_time,
        record.startTime,
        record.start_at,
        record.date_time,
        record.match_date,
        record.scheduled_at,
      );
      if (!startAt) return null;
      if (!isFutureNearbyActivity(startAt)) return null;

      const normalizedMatch = normalizeMatchRecord(record);
      const matchId = record.id ?? record.match_id ?? record.matchId ?? normalizedMatch.id ?? null;
      const playersJoined = normalizedMatch.playersJoined ?? 0;
      const totalSpots = normalizedMatch.totalSpots ?? playersJoined;
      const remainingSpots = normalizedMatch.playersNeeded ?? Math.max(totalSpots - playersJoined, 0);
      const availabilityLabel =
        totalSpots > 0
          ? remainingSpots === 0
            ? "Match is full"
            : `${remainingSpots} spot${remainingSpots === 1 ? "" : "s"} available`
          : "Spots available";
      const playersLabel =
        totalSpots > 0
          ? `${playersJoined}/${totalSpots} players`
          : `${playersJoined} player${playersJoined === 1 ? "" : "s"}`;

      return {
        id: `match-${matchId ?? startAt.toISOString()}`,
        lessonId: matchId != null ? String(matchId) : null,
        type: "match",
        label: normalizedMatch.access ? `${normalizedMatch.access} Match` : "Match",
        typeClassName: "match",
        title: normalizedMatch.format ? `${normalizedMatch.format} Match` : "Open Match",
        time: zonedStart ? zonedStart.format("h:mm A") : moment(startAt).format("h:mm A"),
        dayKey: toLocalDayKey(zonedStart, startAt),
        startTime: zonedStart ? zonedStart.toISOString() : startAt.toISOString(),
        location: formatDisplayLocation(normalizedMatch.location || "Location TBD"),
        secondaryMeta: normalizedMatch.level?.summary || normalizedMatch.distance || null,
        rating: null,
        price: null,
        status: availabilityLabel,
        remainingSpots,
        avatar: "🏆",
        avatarBadge: "🏆",
        extraMeta: playersLabel,
        highlight: formatStatusLabel(record.status) || "Open",
        destination: matchId != null ? `/matches/${matchId}` : null,
      };
    })
    .filter(Boolean);

// --- view derivations -------------------------------------------------------
//
// Lifted out of DashboardPage's useMemos so the chip rows can be tested at all —
// this repo has no React test harness, so logic left inside a component is logic
// with no coverage. Behaviour is unchanged; `now` is injectable only so "Today"
// can be pinned in a test.

export const matchesActivityTypeFilter = (item, selectedType) => {
  if (selectedType === "all") return true;
  if (selectedType === "group") return item.type === "group" || item.type === "external";
  return item.type === selectedType;
};

/** The day chips: an "All / Wk" chip, then one per day in the window. */
export const buildDayTabs = ({ items = [], windowStart, windowEnd, now = null }) => {
  const today = now ? moment(now) : moment();
  const start = moment(windowStart, "YYYY-MM-DD", true);
  const end = moment(windowEnd, "YYYY-MM-DD", true);
  const safeEnd = end.isBefore(start, "day") ? start.clone() : end;
  const dayCount = Math.max(safeEnd.startOf("day").diff(start.startOf("day"), "days") + 1, 1);

  const tabs = [
    {
      key: "all",
      label: "All",
      fullDate:
        start.isSame(safeEnd, "day")
          ? start.format("MMM D")
          : `${start.format("MMM D")} - ${safeEnd.format("MMM D")}`,
      date: "Wk",
      count: items.length,
    },
  ];

  return [
    ...tabs,
    ...Array.from({ length: dayCount }).map((_, index) => {
      const day = moment(windowStart, "YYYY-MM-DD").add(index, "days");
      const key = day.format("YYYY-MM-DD");
      const count = items.filter((item) => item.dayKey === key).length;
      return {
        key,
        label: day.isSame(today, "day") ? "Today" : day.format("ddd"),
        fullDate: day.format("MMM D"),
        date: day.format("D"),
        count,
      };
    }),
  ];
};

/** Day filter, then type filter. "all" means no filtering on that axis. */
export const filterActivities = ({ items = [], selectedDay, selectedType }) =>
  items
    .filter((item) => (selectedDay === "all" ? true : item.dayKey === selectedDay))
    .filter((item) => matchesActivityTypeFilter(item, selectedType));

/**
 * The type chips. Counted AFTER the day filter, so the four numbers sum to the
 * selected day chip's own count rather than to the whole window.
 */
export const typeCounts = ({ items = [], selectedDay }) => {
  const sameDay = items.filter((item) => (selectedDay === "all" ? true : item.dayKey === selectedDay));
  return {
    all: sameDay.length,
    private: sameDay.filter((item) => item.type === "private").length,
    group: sameDay.filter((item) => item.type === "group" || item.type === "external").length,
    match: sameDay.filter((item) => item.type === "match").length,
  };
};
