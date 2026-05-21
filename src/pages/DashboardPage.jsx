import moment from "moment";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronRight, MapPin, Plus, Star } from "lucide-react";
import Autocomplete from "react-google-autocomplete";
import { Link, useNavigate } from "react-router-dom";
import { normalizeMatchRecord } from "../api/matches";
import { useAuth } from "../context/AuthContext";
import {
  getPlayerDiscoverNearby,
  getPlayerExternalLessons,
  getPlayerFutureLessons,
  updatePlayerFutureLessons,
} from "../api/playerHome";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";
import { acceptInvite, listInvites, rejectInvite } from "../services/invites";
import {
  DEFAULT_POSITION,
  getStoredLocation,
  getStoredLocationLabel,
  getStoredLocationRadius,
  storeLocation,
  storeLocationLabel,
  USER_LOCATION_CHANGED_EVENT,
} from "../utils/userLocation";
import AppNav from "../components/AppNav";
import MobileHomeBottomNav from "../components/MobileHomeBottomNav";
import "./DashboardPage.css";

const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const parseDate = (value) => {
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

const firstObject = (...values) => values.find((value) => value && typeof value === "object" && !Array.isArray(value)) ?? null;

const extractCollection = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.items)) return value.items;
  return [];
};

const extractLessons = (response) => {
  if (!response) return [];
  if (Array.isArray(response.lessons)) return response.lessons;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.items)) return response.items;
  return [];
};

const resolveLessonKind = (lesson) => {
  if (lesson?.metadata?.externalUrl) return "external";
  const limit = parseNumber(lesson.player_limit, lesson.playerLimit, lesson.max_players, lesson.player_capacity);
  const typeId = parseNumber(lesson.lessontype_id, lesson.lesson_type_id, lesson.lessonTypeId);
  const typeValue = pickString(lesson.lesson_type_name, lesson.type, lesson.lesson_type, lesson.program_type) || "";
  if (typeId === 3 || typeId === 4) return "group";
  if (limit && limit > 1) return "group";
  if (/\b(group|semi|clinic|camp)\b/i.test(typeValue)) return "group";
  return "private";
};

const formatStatusLabel = (value) => {
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

const getTypeConfig = (type) => {
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

const parseNearbyDate = (...values) => {
  for (const value of values) {
    const parsed = parseDate(value);
    if (parsed) return parsed;
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

const getApiDayKey = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const shouldPreserveActivityZone = (activity) =>
  activity?.type === "group" || activity?.type === "external";

const matchesActivityTypeFilter = (item, selectedType) => {
  if (selectedType === "all") return true;
  if (selectedType === "group") return item.type === "group" || item.type === "external";
  return item.type === selectedType;
};

const formatActivityTimeLabel = (activity, includeDate = false) => {
  if (shouldPreserveActivityZone(activity)) {
    const dateLabel = moment(activity.dayKey, "YYYY-MM-DD", true).isValid()
      ? moment(activity.dayKey, "YYYY-MM-DD").format("ddd, MMM D")
      : moment(activity.startTime).format("ddd, MMM D");
    return includeDate ? `${dateLabel} · ${activity.time}` : activity.time;
  }

  return moment(activity.startTime).format(includeDate ? "ddd, MMM D · h:mm A" : "h:mm A");
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

const formatDistance = (value) => {
  const distance = parseNumber(value);
  return distance === null ? null : `${distance.toFixed(distance < 10 ? 1 : 0)} mi`;
};

const formatClockTime = (value) => {
  if (!value) return null;
  const parsed = moment(value, ["HH:mm:ss", "HH:mm"], true);
  return parsed.isValid() ? parsed.format("h A") : null;
};

const formatMoney = (value) => {
  const amount = parseNumber(value);
  return amount === null ? null : `$${amount.toFixed(0)}`;
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

const formatInviteExpiry = (value) => {
  const parsed = parseNearbyMoment(value) ?? (value ? moment(value) : null);
  if (!parsed?.isValid()) return null;
  const now = moment();
  if (parsed.isBefore(now)) return "Expired";
  return parsed.fromNow();
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

const extractInvites = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.invites)) return response.invites;
  if (Array.isArray(response.items)) return response.items;
  return [];
};

const collectIdentityValues = (record) => {
  if (!record || typeof record !== "object") return [];

  return [
    record.id,
    record.user_id,
    record.userId,
    record.player_id,
    record.playerId,
    record.coach_id,
    record.coachId,
    record.email,
  ]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
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

const buildPlayerInviteItems = (records = []) =>
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
      const description = `Invited you to a ${pickString(match?.match_format, record.match_format)?.toLowerCase() || "match"}`;
      const chips = [
        startMoment?.isValid() ? `📅 ${startMoment.format("ddd MMM D")}` : null,
        startMoment?.isValid() ? `⏰ ${startMoment.format("h:mm A")}` : null,
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
        expiresLabel: formatInviteExpiry(record.expires_at ?? record.expiresAt),
        ctaHint: "Tap for details →",
        accentClassName: "player",
        destination,
        inviteKind: "player",
      };
    })
    .filter(Boolean);

const buildCoachInviteItems = (records = [], currentUser) => {
  const userIdentities = new Set(collectIdentityValues(currentUser));

  return records
    .filter((lesson) => {
      if (!lesson || typeof lesson !== "object") return false;

      const lessonStatus = lesson.payment_status ?? lesson.paymentStatus ?? lesson.status ?? lesson.booking_status ?? lesson.lesson_status;
      const participantRecords = [
        ...(Array.isArray(lesson.participants) ? lesson.participants : []),
        ...(Array.isArray(lesson.group_players) ? lesson.group_players : []),
      ];
      const createdBy = lesson.created_by ?? lesson.createdBy;
      const coachId = lesson.coach_id ?? lesson.coachId;
      const lessonPlayerIdentities = collectIdentityValues({
        player_id: lesson.player_id,
        user_id: lesson.user_id,
        email: lesson.email,
      });
      const isCurrentPlayerAssigned =
        lessonPlayerIdentities.length > 0 &&
        (userIdentities.size === 0 || lessonPlayerIdentities.some((value) => userIdentities.has(value)));
      const matchingParticipant =
        userIdentities.size === 0
          ? participantRecords.find((participant) =>
              isPendingValue(participant.payment_status ?? participant.paymentStatus ?? participant.status ?? participant.booking_status ?? participant.lesson_status),
            ) ?? participantRecords[0]
          : participantRecords.find((participant) =>
              collectIdentityValues(participant).some((value) => userIdentities.has(value)),
            );
      const isCurrentPlayerParticipant = Boolean(matchingParticipant);
      const participantPending = matchingParticipant
        ? isPendingValue(
            matchingParticipant.payment_status ??
              matchingParticipant.paymentStatus ??
              matchingParticipant.status ??
              matchingParticipant.booking_status ??
              matchingParticipant.lesson_status,
          )
        : participantRecords.some((participant) =>
            isPendingValue(
              participant.payment_status ?? participant.paymentStatus ?? participant.status ?? participant.booking_status ?? participant.lesson_status,
            ),
          );
      const participantConfirmed = matchingParticipant
        ? isConfirmedValue(
            matchingParticipant.payment_status ??
              matchingParticipant.paymentStatus ??
              matchingParticipant.status ??
              matchingParticipant.booking_status ??
              matchingParticipant.lesson_status,
          )
        : false;
      const lessonPending = isPendingValue(lessonStatus);
      const createdByCoach =
        createdBy !== null && createdBy !== undefined
          ? coachId !== null && coachId !== undefined
            ? String(createdBy) === String(coachId)
            : userIdentities.size > 0
              ? !userIdentities.has(String(createdBy).trim().toLowerCase())
              : true
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

const isFutureNearbyActivity = (date) => {
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

const buildCoachActivities = (records = []) =>
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
            dayKey: slot.date || (zonedStart ? zonedStart.format("YYYY-MM-DD") : moment(startAt).format("YYYY-MM-DD")),
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

const buildScheduleItems = (lessons = []) =>
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

      const lessonId = lesson.id ?? lesson.lesson_id ?? lesson.lessonId ?? lesson.booking_id ?? lesson.uuid ?? null;
      const type = resolveLessonKind(lesson);
      const coachName = pickString(lesson.full_name, lesson.coach_name, lesson.coachName, lesson?.coach?.name);
      const title =
        pickString(lesson.title, lesson.lesson_title, lesson.name, lesson.lesson_name, lesson.program_name) ||
        (type === "group" ? "Group Session" : coachName ? `Lesson with Coach ${coachName}` : "Private Lesson");

      return {
        id: `${type}-${lessonId ?? startAt.toISOString()}`,
        lessonId: lessonId != null ? String(lessonId) : null,
        type,
        time: moment(startAt).calendar(null, {
          sameDay: "[Today] · h:mm A",
          nextDay: "[Tomorrow] · h:mm A",
          nextWeek: "ddd · h:mm A",
          sameElse: "ddd · h:mm A",
        }),
        title,
        location:
          pickString(
            lesson.location_name,
            lesson.locationName,
            lesson.location,
            lesson.location_label,
            lesson.court_name,
            lesson.facility_name,
          ) || "Location TBD",
        status: formatStatusLabel(lesson.payment_status ?? lesson.paymentStatus ?? lesson.status ?? lesson.booking_status ?? lesson.lesson_status),
        startTime: startAt.toISOString(),
        icon: getTypeConfig(type).badge,
      };
    })
    .filter(Boolean)
    .sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());

const buildActivityItems = (lessons = []) =>
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
      const booked = parseNumber(
        lesson.booked_players,
        lesson.bookedPlayers,
        lesson.players_booked,
        lesson.player_count,
        Array.isArray(lesson.group_players) ? lesson.group_players.length : null,
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
        dayKey: zonedStart ? zonedStart.format("YYYY-MM-DD") : moment(startAt).format("YYYY-MM-DD"),
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

const buildExternalLessonActivities = (lessons = []) =>
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
        dayKey: zonedStart ? zonedStart.format("YYYY-MM-DD") : moment(startAt).format("YYYY-MM-DD"),
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

const buildMatchActivities = (records = []) =>
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
        dayKey: zonedStart ? zonedStart.format("YYYY-MM-DD") : moment(startAt).format("YYYY-MM-DD"),
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

const quickActions = [
  { icon: "👤", label: "Find a Coach", labelShort: "Find a\nCoach", to: "/find-coaches" },
  { icon: "👥", label: "Group Lessons", labelShort: "Group\nLessons", to: "/group-lessons" },
  { icon: "🏆", label: "Match Play", labelShort: "Match\nPlay", to: "/matches" },
  { icon: "🔍", label: "Find Players", labelShort: "Find\nPlayers", to: "/find-players" },
];

const locationItems = [
  {
    name: "Venice, CA",
    detail: "Using your device location",
    distance: "Current",
    current: true,
    icon: "📍",
    latitude: 33.985,
    longitude: -118.4695,
  },
  { name: "Penmar Recreation Center", detail: "1341 Lake St, Venice", distance: "0.8 mi", icon: "🎾", latitude: 34.0016, longitude: -118.4602 },
  { name: "Venice Beach Courts", detail: "Ocean Front Walk", distance: "1.2 mi", icon: "🎾", latitude: 33.9863, longitude: -118.4721 },
  { name: "Mar Vista Recreation Center", detail: "11430 Woodbine St", distance: "2.1 mi", icon: "🎾", latitude: 34.0037, longitude: -118.4298 },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { displayName } = usePlayerIdentity();
  const firstName = displayName?.split(" ")?.[0] || "Player";
  const [scheduleState, setScheduleState] = useState({ status: "idle", items: [], error: null });
  const [activityState, setActivityState] = useState({ status: "idle", items: [], error: null });
  const [inviteState, setInviteState] = useState({ status: "idle", items: [], error: null });
  const [selectedType, setSelectedType] = useState("all");
  const [selectedDay, setSelectedDay] = useState(moment().format("YYYY-MM-DD"));
  const [activityWindowStart, setActivityWindowStart] = useState(moment().format("YYYY-MM-DD"));
  const [activityWindowEnd, setActivityWindowEnd] = useState(moment().add(6, "days").format("YYYY-MM-DD"));
  const [activityFilterStart, setActivityFilterStart] = useState(moment().format("YYYY-MM-DD"));
  const [activityFilterEnd, setActivityFilterEnd] = useState(moment().add(6, "days").format("YYYY-MM-DD"));
  const [draftRangeStart, setDraftRangeStart] = useState(moment().format("YYYY-MM-DD"));
  const [draftRangeEnd, setDraftRangeEnd] = useState(moment().add(6, "days").format("YYYY-MM-DD"));
  const [, setLocationName] = useState(getStoredLocationLabel() || "Venice, CA");
  const [locationPosition, setLocationPosition] = useState(getStoredLocation() ?? DEFAULT_POSITION);
  const [searchRadius, setSearchRadius] = useState(getStoredLocationRadius() ?? 5);
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [locationError, setLocationError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const hasRequestedInitialLocationRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadHome = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setScheduleState({ status: "unauthenticated", items: [], error: null });
        setActivityState({ status: "unauthenticated", items: [], error: null });
        setInviteState({ status: "unauthenticated", items: [], error: null });
        return;
      }

      setScheduleState((prev) => ({ ...prev, status: "loading", error: null }));
      setActivityState((prev) => ({ ...prev, status: "loading", error: null }));
      setInviteState((prev) => ({ ...prev, status: "loading", error: null }));

      const [futureLessonsResult, nearbyResult, externalLessonsResult, invitesResult] = await Promise.allSettled([
        getPlayerFutureLessons({ token, page: 1, perPage: 25, signal: controller.signal }),
        getPlayerDiscoverNearby({
          token,
          location: locationPosition,
          radius: searchRadius,
          filters: {
            startDate: activityFilterStart,
            endDate: activityFilterEnd,
            level: "All",
          },
          search: "",
          matchSearch: "",
          coachesPage: 1,
          coachesPerPage: 12,
          lessonsPage: 1,
          lessonsPerPage: 12,
          matchesPage: 1,
          matchesPerPage: 12,
          signal: controller.signal,
        }),
        getPlayerExternalLessons({
          token,
          page: 1,
          perPage: 50,
          search: "",
          position: locationPosition,
          filters: {
            radius: searchRadius,
            date: activityFilterStart === activityFilterEnd ? activityFilterStart : "",
            startDate: activityFilterStart,
            endDate: activityFilterEnd,
          },
          signal: controller.signal,
        }),
        listInvites({ status: "pending", page: 1, perPage: 5, filter: "pending" }),
      ]);
      if (cancelled) return;

      if (futureLessonsResult.status === "fulfilled") {
        const lessons = extractLessons(futureLessonsResult.value);
        setScheduleState({ status: "ready", items: buildScheduleItems(lessons), error: null });
        const coachInviteItems = buildCoachInviteItems(lessons, user);

        if (invitesResult.status === "fulfilled") {
          setInviteState({
            status: "ready",
            items: [...coachInviteItems, ...buildPlayerInviteItems(extractInvites(invitesResult.value))],
            error: null,
          });
        } else {
          setInviteState({
            status: "ready",
            items: coachInviteItems,
            error: invitesResult.reason instanceof Error ? invitesResult.reason.message : "Unable to load player invites.",
          });
        }
      } else {
        const scheduleMessage =
          futureLessonsResult.reason instanceof Error
            ? futureLessonsResult.reason.message
            : "Unable to load your schedule.";
        setScheduleState({ status: "error", items: [], error: scheduleMessage });
        if (invitesResult.status === "fulfilled") {
          setInviteState({
            status: "ready",
            items: buildPlayerInviteItems(extractInvites(invitesResult.value)),
            error: null,
          });
        } else {
          setInviteState({
            status: "error",
            items: [],
            error: invitesResult.reason instanceof Error ? invitesResult.reason.message : "Unable to load invites.",
          });
        }
      }

      if (nearbyResult.status === "fulfilled") {
        const nearbyResponse = nearbyResult.value;
        const coachActivities = buildCoachActivities(extractCollection(nearbyResponse?.coaches_availability));
        const groupActivities = buildActivityItems(extractCollection(nearbyResponse?.group_lessons));
        const matchActivities = buildMatchActivities(extractCollection(nearbyResponse?.match_play));
        const externalActivities =
          externalLessonsResult.status === "fulfilled"
            ? buildExternalLessonActivities(extractLessons(externalLessonsResult.value))
            : [];
        const nextActivities = [...coachActivities, ...groupActivities, ...externalActivities, ...matchActivities].sort(
          (a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf(),
        );
        const nextWindowStart =
          getApiDayKey(nearbyResponse?.search_area?.window_start) ??
          activityFilterStart ??
          nextActivities[0]?.dayKey ??
          moment().format("YYYY-MM-DD");
        const nextWindowEnd =
          getApiDayKey(nearbyResponse?.search_area?.window_end) ??
          activityFilterEnd ??
          moment(nextWindowStart, "YYYY-MM-DD").add(6, "days").format("YYYY-MM-DD");
        const todayKey = moment().format("YYYY-MM-DD");
        const hasTodayActivities = nextActivities.some((item) => item.dayKey === todayKey);
        const nextSelectedDay =
          hasTodayActivities
            ? todayKey
            : "all";

        setActivityWindowStart(nextWindowStart);
        setActivityWindowEnd(nextWindowEnd);
        setSelectedDay(nextSelectedDay);
        setActivityState({
          status: "ready",
          items: nextActivities,
          error: null,
        });
      } else {
        const activityMessage =
          nearbyResult.reason instanceof Error ? nearbyResult.reason.message : "Unable to load nearby activities.";
        setActivityState({ status: "error", items: [], error: activityMessage });
      }
    };

    loadHome();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activityFilterEnd, activityFilterStart, locationPosition, searchRadius, user]);

  const dayTabs = useMemo(
    () => {
      const start = moment(activityWindowStart, "YYYY-MM-DD", true);
      const end = moment(activityWindowEnd, "YYYY-MM-DD", true);
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
          count: activityState.items.length,
        },
      ];

      return [
        ...tabs,
        ...Array.from({ length: dayCount }).map((_, index) => {
        const day = moment(activityWindowStart, "YYYY-MM-DD").add(index, "days");
        const key = day.format("YYYY-MM-DD");
        const count = activityState.items.filter((item) => item.dayKey === key).length;
        return {
          key,
          label: day.isSame(moment(), "day") ? "Today" : day.format("ddd"),
          fullDate: day.format("MMM D"),
          date: day.format("D"),
          count,
        };
        }),
      ];
    },
    [activityState.items, activityWindowEnd, activityWindowStart],
  );

  const filteredActivities = useMemo(
    () =>
      activityState.items
        .filter((item) => (selectedDay === "all" ? true : item.dayKey === selectedDay))
        .filter((item) => matchesActivityTypeFilter(item, selectedType)),
    [activityState.items, selectedDay, selectedType],
  );

  const counts = useMemo(() => {
    const sameDay = activityState.items.filter((item) => (selectedDay === "all" ? true : item.dayKey === selectedDay));
    return {
      all: sameDay.length,
      private: sameDay.filter((item) => item.type === "private").length,
      group: sameDay.filter((item) => item.type === "group" || item.type === "external").length,
      match: sameDay.filter((item) => item.type === "match").length,
    };
  }, [activityState.items, selectedDay]);

  const selectedDayLabel =
    dayTabs.find((day) => day.key === selectedDay)?.fullDate ??
    (selectedDay === "all" ? dayTabs[0]?.fullDate : moment(selectedDay).format("MMM D"));
  const scheduleItems = scheduleState.items;
  const hasSchedule = scheduleState.status === "ready" && scheduleItems.length > 0;
  const inviteItems = inviteState.items;
  const hasInvites = inviteState.status === "ready" && inviteItems.length > 0;
  const welcomeHeadline = `Hi ${firstName} 👋`;
  const welcomeSubtitle = hasSchedule
    ? `You have ${scheduleItems.length} session${scheduleItems.length === 1 ? "" : "s"} this week`
    : `${activityState.items.length} nearby option${activityState.items.length === 1 ? "" : "s"} across lessons, groups, and matches`;

  const onOpenActivity = (activity) => {
    if (!activity.destination) return;
    navigate(activity.destination);
  };

  const handleHostMatch = () => {
    navigate("/matches", { state: { openNewMatch: true } });
  };

  const handleInviteAction = async (invite, action) => {
    if (invite?.inviteKind === "coach") {
      if (action === "accept") {
        navigate(invite?.destination || "/notifications");
        return;
      }

      if (!invite?.lessonId) {
        navigate(invite?.destination || "/notifications");
        return;
      }

      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        navigate(invite?.destination || "/notifications");
        return;
      }

      setInviteState((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === invite.id ? { ...item, pendingAction: action } : item)),
        error: null,
      }));

      try {
        await updatePlayerFutureLessons({
          token,
          lessonId: invite.lessonId,
          status: "declined",
        });

        setInviteState((prev) => ({
          ...prev,
          items: prev.items.filter((item) => item.id !== invite.id),
        }));
      } catch (error) {
        setInviteState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.id === invite.id ? { ...item, pendingAction: null } : item,
          ),
          error: error instanceof Error ? error.message : `Unable to ${action} invite.`,
        }));
      }
      return;
    }

    if (!invite?.token) {
      navigate(invite?.destination || "/notifications");
      return;
    }

    setInviteState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === invite.id ? { ...item, pendingAction: action } : item)),
      error: null,
    }));

    try {
      if (action === "accept") {
        await acceptInvite(invite.token);
      } else {
        await rejectInvite(invite.token);
      }

      setInviteState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== invite.id),
      }));
    } catch (error) {
      setInviteState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === invite.id ? { ...item, pendingAction: null } : item,
        ),
        error: error instanceof Error ? error.message : `Unable to ${action} invite.`,
      }));
    }
  };

  const applyLocationSelection = ({ label, latitude, longitude }) => {
    const nextPosition = { latitude, longitude };
    setLocationName(label);
    setLocationPosition(nextPosition);
    setLocationSearchTerm(label);
    setLocationError("");
    storeLocation(nextPosition);
    storeLocationLabel(label);
    setIsLocationOpen(false);
  };

  const applyDateRange = () => {
    const start = moment(draftRangeStart, "YYYY-MM-DD", true);
    const end = moment(draftRangeEnd, "YYYY-MM-DD", true);
    if (!start.isValid() || !end.isValid()) return;

    const normalizedStart = start.format("YYYY-MM-DD");
    const normalizedEnd = (end.isBefore(start, "day") ? start : end).format("YYYY-MM-DD");

    setActivityFilterStart(normalizedStart);
    setActivityFilterEnd(normalizedEnd);
    setActivityWindowStart(normalizedStart);
    setActivityWindowEnd(normalizedEnd);
    setSelectedDay(normalizedStart);
    setIsDateRangeOpen(false);
  };

  const openDateRangePicker = () => {
    setDraftRangeStart(activityFilterStart);
    setDraftRangeEnd(activityFilterEnd);
    setIsDateRangeOpen(true);
  };

  const handlePlaceSelected = (place) => {
    if (!place) {
      setLocationError("Please choose a location from the suggestions.");
      return;
    }

    const latitude = place.geometry?.location?.lat?.();
    const longitude = place.geometry?.location?.lng?.();
    const label = pickString(place?.formatted_address, place?.name, locationSearchTerm);

    if (
      !label ||
      typeof latitude !== "number" ||
      Number.isNaN(latitude) ||
      typeof longitude !== "number" ||
      Number.isNaN(longitude)
    ) {
      setLocationError("We couldn't read that location. Try another search result.");
      return;
    }

    applyLocationSelection({ label, latitude, longitude });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is unavailable in this browser.");
      return;
    }

    setIsDetectingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyLocationSelection({
          label: "Current location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsDetectingLocation(false);
      },
      () => {
        setIsDetectingLocation(false);
        setLocationError("We couldn't access your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  useEffect(() => {
    if (hasRequestedInitialLocationRef.current) return;
    if (!navigator.geolocation) return;

    hasRequestedInitialLocationRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyLocationSelection({
          label: "Current location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        // Keep the stored/default location if permission is unavailable on initial load.
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    const syncLocationSettings = () => {
      const nextLocation = getStoredLocation();
      const nextLabel = getStoredLocationLabel();
      const nextRadius = getStoredLocationRadius();

      if (nextLocation) {
        setLocationPosition(nextLocation);
      }
      if (nextLabel) {
        setLocationName(nextLabel);
      }
      if (typeof nextRadius === "number" && Number.isFinite(nextRadius)) {
        setSearchRadius(nextRadius);
      }
    };

    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncLocationSettings);
    return () => window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncLocationSettings);
  }, []);

  const renderLocationPicker = () => (
    <div className="ph-location-sheet" onClick={(event) => event.stopPropagation()}>
      <div className="ph-location-handle" />
      <h3 className="ph-location-title">Choose Location</h3>

      <p className="ph-location-section-title">Use Current Location</p>
      <button
        type="button"
        className="ph-location-current"
        onClick={handleUseCurrentLocation}
      >
        <span className="ph-location-current-icon">📍</span>
        <span className="ph-location-current-copy">
          <strong>{isDetectingLocation ? "Detecting location..." : "Use my current location"}</strong>
          <small>{isDetectingLocation ? "Checking your device coordinates" : "Update results around your device"}</small>
        </span>
        <span className="ph-location-check">✓</span>
      </button>

      <p className="ph-location-section-title">Enter a Location</p>
      <div className="ph-location-search">
        <Search size={16} />
        <Autocomplete
          apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
          placeholder="City, neighborhood or zip code..."
          className="ph-location-search-input"
          value={locationSearchTerm}
          onChange={(event) => {
            setLocationSearchTerm(event.target.value);
            if (locationError) setLocationError("");
          }}
          onPlaceSelected={handlePlaceSelected}
          options={{
            types: ["geocode", "establishment"],
            fields: ["formatted_address", "geometry", "name", "address_components"],
          }}
        />
      </div>

      <div className="ph-location-list">
        {locationItems.slice(1).map((item) => (
          <button
            key={item.name}
            type="button"
            className="ph-location-item"
            onClick={() =>
              applyLocationSelection({
                label: item.name,
                latitude: item.latitude,
                longitude: item.longitude,
              })
            }
          >
            <span className="ph-location-item-icon">{item.icon}</span>
            <span className="ph-location-item-copy">
              <strong>{item.name}</strong>
              <small>{item.detail}</small>
            </span>
            <span className="ph-location-item-distance">{item.distance}</span>
          </button>
        ))}
      </div>

      {locationError ? <p className="ph-location-error">{locationError}</p> : null}
      {!import.meta.env.VITE_GOOGLE_API_KEY ? (
        <p className="ph-location-tip">Add `VITE_GOOGLE_API_KEY` to enable Google location suggestions.</p>
      ) : null}

      <div className="ph-location-radius">
        <div className="ph-location-radius-head">
          <span>Search Radius</span>
          <strong>{searchRadius} miles</strong>
        </div>
        <input
          type="range"
          min="1"
          max="25"
          step="1"
          value={searchRadius}
          onChange={(event) => setSearchRadius(Number(event.target.value))}
          className="ph-location-slider-input"
          aria-label="Search Radius"
          style={{
            background: `linear-gradient(90deg, var(--ph-purple) 0%, var(--ph-purple) ${((searchRadius - 1) / 24) * 100}%, var(--ph-border) ${((searchRadius - 1) / 24) * 100}%, var(--ph-border) 100%)`,
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="player-home">
      <AppNav hideMobileNewMatch hideMobileNotifications />

      <main className="ph-main">
        <section className="ph-welcome">
          <h1>{welcomeHeadline}</h1>
          <p>{welcomeSubtitle}</p>
        </section>

        {hasInvites ? (
          <section className="ph-invite-banner" aria-labelledby="ph-invite-banner-title">
            <div className="ph-invite-banner-head">
              <span className="ph-invite-banner-dot" aria-hidden="true" />
              <h2 id="ph-invite-banner-title">You've Been Invited — Action Required</h2>
            </div>

            {inviteItems.map((invite) => (
              <article key={invite.id} className="ph-invite-item">
                <button
                  type="button"
                  className="ph-invite-body"
                  onClick={() => navigate(invite.destination)}
                >
                  <span className={`ph-invite-avatar ${invite.accentClassName}`}>
                    {invite.avatarUrl ? (
                      <img src={invite.avatarUrl} alt={invite.senderName} />
                    ) : (
                      <span>{invite.initials}</span>
                    )}
                    <span className="ph-invite-avatar-badge">{invite.type === "coach" ? "👤" : "🎾"}</span>
                  </span>

                  <span className="ph-invite-copy">
                    <strong>{invite.senderName}</strong>
                    <span className={`ph-invite-tag ${invite.accentClassName}`}>{invite.typeLabel}</span>
                    <span className="ph-invite-description">{invite.description}</span>
                    <span className="ph-invite-chips">
                      {invite.chips.map((chip) => (
                        <span key={chip} className="ph-invite-chip">
                          {chip}
                        </span>
                      ))}
                    </span>
                    <span className={`ph-invite-hint ${invite.accentClassName}`}>{invite.ctaHint}</span>
                    {invite.expiresLabel ? (
                      <span className="ph-invite-expiry">
                        Invitation expires <span>{invite.expiresLabel}</span>
                      </span>
                    ) : null}
                  </span>
                </button>

                <span className="ph-invite-actions">
                  <button
                    type="button"
                    className={`ph-invite-accept ${invite.accentClassName}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleInviteAction(invite, "accept");
                    }}
                    disabled={Boolean(invite.pendingAction)}
                  >
                    {invite.pendingAction === "accept" ? "Saving…" : "✓ Accept"}
                  </button>
                  <button
                    type="button"
                    className="ph-invite-decline"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleInviteAction(invite, "decline");
                    }}
                    disabled={Boolean(invite.pendingAction)}
                  >
                    {invite.pendingAction === "decline" ? "Saving…" : "✕ Decline"}
                  </button>
                </span>
              </article>
            ))}
          </section>
        ) : null}

        {inviteState.status === "error" ? <p className="ph-invite-error">{inviteState.error}</p> : null}

        <section className="ph-quick-actions" aria-label="Quick actions">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.to} className="ph-quick-action">
              <span className="ph-quick-action-icon">{action.icon}</span>
              <span className="ph-quick-action-label">
                <span className="desktop-copy">{action.label}</span>
                <span className="mobile-copy">
                  {action.labelShort.split("\n").map((segment) => (
                    <span key={segment}>{segment}</span>
                  ))}
                </span>
              </span>
            </Link>
          ))}
        </section>

        <section className="ph-content-grid">
          {hasSchedule ? (
            <aside className="ph-schedule">
              <div className="ph-section-head">
                <h2>📅 My Schedule</h2>
                <Link to="/player/calendar" className="ph-section-head-link">
                  View All →
                </Link>
              </div>

              {scheduleItems.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="ph-schedule-item"
                  onClick={() =>
                    item.lessonId &&
                    navigate(item.type === "group" ? `/group-lessons/${item.lessonId}` : `/player/lesson/${item.lessonId}`)
                  }
                >
                  <span className="ph-schedule-icon">{item.icon}</span>
                  <span className="ph-schedule-copy">
                    <small>{item.time}</small>
                    <strong>{item.title}</strong>
                    <span>📍 {item.location}</span>
                  </span>
                  <ChevronRight size={18} className="ph-schedule-arrow" />
                </button>
              ))}
            </aside>
          ) : null}

          <section className="ph-play-today">
            <div className="ph-play-head">
              <div className="ph-play-head-copy">
                <h2>Play Today</h2>
                <span>{selectedDayLabel}</span>
              </div>
              <button type="button" className="ph-play-head-action" onClick={handleHostMatch}>
                <Plus size={16} />
                <span>Host match</span>
              </button>
            </div>

            <div className="ph-day-tabs" aria-label="Available days">
              {dayTabs.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={`ph-day-tab${selectedDay === day.key ? " active" : ""}`}
                  onClick={() => setSelectedDay(day.key)}
                >
                  <span className="ph-day-tab-label">{day.label}</span>
                  <strong>{day.date}</strong>
                  <small>{day.count}</small>
                </button>
              ))}

              <button type="button" className="ph-day-tab picker" onClick={openDateRangePicker}>
                <span className="ph-picker-icon">
                  <CalendarDays size={15} />
                </span>
                <strong>Pick</strong>
              </button>
            </div>

            <div className="ph-type-tabs" aria-label="Activity type filters">
              <button type="button" className={selectedType === "all" ? "active" : ""} onClick={() => setSelectedType("all")}>
                <span>All</span>
                <small>{counts.all}</small>
              </button>
              <button type="button" className={selectedType === "private" ? "active" : ""} onClick={() => setSelectedType("private")}>
                <span>Lessons</span>
                <small>{counts.private}</small>
              </button>
              <button type="button" className={selectedType === "group" ? "active" : ""} onClick={() => setSelectedType("group")}>
                <span>Groups</span>
                <small>{counts.group}</small>
              </button>
              <button type="button" className={selectedType === "match" ? "active" : ""} onClick={() => setSelectedType("match")}>
                <span>Matches</span>
                <small>{counts.match}</small>
              </button>
            </div>

            {activityState.status === "loading" || activityState.status === "idle" ? (
              <div className="ph-feedback">Loading activities…</div>
            ) : activityState.status === "error" ? (
              <div className="ph-feedback">{activityState.error || "Unable to load activities."}</div>
            ) : filteredActivities.length === 0 ? (
              <div className="ph-empty">
                <div className="ph-empty-icon">📅</div>
                <h3>No activities for this date</h3>
                <p>Try another day or create your own match listing.</p>
                <button type="button" onClick={handleHostMatch}>
                  🏆 Post a Match
                </button>
              </div>
            ) : (
              <div className="ph-activities">
                {filteredActivities.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    className={`ph-activity ${activity.typeClassName}`}
                    onClick={() => onOpenActivity(activity)}
                  >
                    <span className="ph-activity-avatar">
                      {activity.avatarUrl ? (
                        <img src={activity.avatarUrl} alt={activity.title} />
                      ) : (
                        <span>{activity.avatar}</span>
                      )}
                      <span className="ph-activity-avatar-badge">{activity.avatarBadge}</span>
                    </span>

                    <span className="ph-activity-copy">
                      <span className="ph-activity-topline">
                        <span className={`ph-activity-label ${activity.typeClassName}`}>{activity.label}</span>
                        {selectedDay === "all" ? (
                          <span className="ph-activity-time">
                            {formatActivityTimeLabel(activity, true)}
                          </span>
                        ) : activity.type !== "private" ? (
                          <span className="ph-activity-time">{formatActivityTimeLabel(activity)}</span>
                        ) : null}
                      </span>
                      <strong>{activity.title}</strong>
                      {activity.type === "private" && activity.availabilityText ? (
                        <span className="ph-activity-availability">{activity.availabilityText}</span>
                      ) : activity.type === "private" && selectedDay === "all" ? (
                        <span className="ph-activity-availability">{moment(activity.startTime).format("ddd, MMM D · h:mm A")}</span>
                      ) : null}
                      <span className="ph-activity-meta">
                        <MapPin size={12} />
                        <span>{activity.location}</span>
                        {activity.rating ? (
                          <>
                            <span className="ph-activity-meta-sep">·</span>
                            <Star size={12} fill="currentColor" />
                            <span>{activity.rating.toFixed(1)}</span>
                          </>
                        ) : activity.secondaryMeta ? (
                          <>
                            <span className="ph-activity-meta-sep">·</span>
                            <span>{activity.secondaryMeta}</span>
                          </>
                        ) : null}
                      </span>
                      {activity.extraMeta ? <span className="ph-activity-extra">{activity.extraMeta}</span> : null}
                    </span>

                    <span className="ph-activity-side">
                      <strong>
                        {activity.highlight || (activity.price ? `$${activity.price}` : activity.type === "match" ? "Open" : "Free")}
                      </strong>
                      <small>
                        {activity.remainingSpots !== null
                          ? `${activity.remainingSpots} spot${activity.remainingSpots === 1 ? "" : "s"}`
                          : activity.status || getTypeConfig(activity.type).availability}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>

      <MobileHomeBottomNav />

      {isLocationOpen ? (
        <div className="ph-location-overlay" onClick={() => setIsLocationOpen(false)}>
          {renderLocationPicker()}
        </div>
      ) : null}

      {isDateRangeOpen ? (
        <div className="ph-date-range-overlay" onClick={() => setIsDateRangeOpen(false)}>
          <div className="ph-date-range-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="ph-date-range-handle" />
            <h3>Choose Date Range</h3>
            <p>Update the day tabs from a start date to an end date.</p>

            <label className="ph-date-range-field">
              <span>From</span>
              <input
                type="date"
                value={draftRangeStart}
                max={draftRangeEnd}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraftRangeStart(nextValue);
                  if (moment(draftRangeEnd).isBefore(moment(nextValue), "day")) {
                    setDraftRangeEnd(nextValue);
                  }
                }}
              />
            </label>

            <label className="ph-date-range-field">
              <span>To</span>
              <input
                type="date"
                value={draftRangeEnd}
                min={draftRangeStart}
                onChange={(event) => setDraftRangeEnd(event.target.value)}
              />
            </label>

            <div className="ph-date-range-actions">
              <button
                type="button"
                className="ph-date-range-clear"
                onClick={() => {
                  const defaultStart = moment().format("YYYY-MM-DD");
                  const defaultEnd = moment().add(6, "days").format("YYYY-MM-DD");
                  setDraftRangeStart(defaultStart);
                  setDraftRangeEnd(defaultEnd);
                  setActivityFilterStart(defaultStart);
                  setActivityFilterEnd(defaultEnd);
                  setActivityWindowStart(defaultStart);
                  setActivityWindowEnd(defaultEnd);
                  setSelectedDay(defaultStart);
                  setIsDateRangeOpen(false);
                }}
              >
                Reset
              </button>
              <button type="button" className="ph-date-range-apply" onClick={applyDateRange}>
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;
