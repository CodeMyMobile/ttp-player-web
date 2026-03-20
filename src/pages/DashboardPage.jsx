import moment from "moment";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, CreditCard, LogOut, MapPin, Search, ShieldX, Star, Target, UserRound } from "lucide-react";
import Autocomplete from "react-google-autocomplete";
import { Link, useNavigate } from "react-router-dom";
import { normalizeMatchRecord } from "../api/matches";
import { useAuth } from "../context/AuthContext";
import { getPlayerDiscoverNearby, getPlayerFutureLessons } from "../api/playerHome";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";
import {
  DEFAULT_POSITION,
  getStoredLocation,
  getStoredLocationLabel,
  storeLocation,
  storeLocationLabel,
} from "../utils/userLocation";
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
  const limit = parseNumber(lesson.player_limit, lesson.playerLimit, lesson.max_players, lesson.player_capacity);
  const typeValue = pickString(lesson.lesson_type_name, lesson.type, lesson.lesson_type, lesson.program_type) || "";
  if (limit && limit > 1) return "group";
  if (/\b(group|semi|clinic|camp)\b/i.test(typeValue)) return "group";
  return "private";
};

const formatStatusLabel = (value) => {
  if (value === null || value === undefined || value === "") return null;
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
        status: formatStatusLabel(lesson.status ?? lesson.booking_status ?? lesson.lesson_status),
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
        status: formatStatusLabel(lesson.status ?? lesson.booking_status ?? lesson.lesson_status),
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

const navItems = [
  { icon: "🏠", label: "Home", to: "/", active: true },
  { icon: "🏆", label: "Post Match", to: "/matches/create" },
  { icon: "🔔", label: "Alerts", to: "/notifications", badge: 2 },
  { icon: "👤", label: "Profile", to: "/settings/profile" },
];

const userMenuItems = [
  { label: "Player profile", to: "/settings/profile", icon: UserRound },
  { label: "Player match profile", to: "/settings/match-profile", icon: Target },
  { label: "Payment methods", to: "/settings/payment-methods", icon: CreditCard },
  { label: "Blocked users", to: "/settings/blocked-users", icon: ShieldX },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { displayName, initials, avatarUrl } = usePlayerIdentity();
  const firstName = displayName?.split(" ")?.[0] || "Player";
  const [scheduleState, setScheduleState] = useState({ status: "idle", items: [], error: null });
  const [activityState, setActivityState] = useState({ status: "idle", items: [], error: null });
  const [selectedType, setSelectedType] = useState("all");
  const [selectedDay, setSelectedDay] = useState(moment().format("YYYY-MM-DD"));
  const [activityWindowStart, setActivityWindowStart] = useState(moment().startOf("day").toISOString());
  const [locationName, setLocationName] = useState(getStoredLocationLabel() || "Venice, CA");
  const [locationPosition, setLocationPosition] = useState(getStoredLocation() ?? DEFAULT_POSITION);
  const [searchRadius, setSearchRadius] = useState(5);
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [locationError, setLocationError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadHome = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setScheduleState({ status: "unauthenticated", items: [], error: null });
        setActivityState({ status: "unauthenticated", items: [], error: null });
        return;
      }

      setScheduleState((prev) => ({ ...prev, status: "loading", error: null }));
      setActivityState((prev) => ({ ...prev, status: "loading", error: null }));

      const [futureLessonsResult, nearbyResult] = await Promise.allSettled([
        getPlayerFutureLessons({ token, page: 1, perPage: 25, signal: controller.signal }),
        getPlayerDiscoverNearby({
          token,
          location: locationPosition,
          radius: searchRadius,
          filters: {
            startDate: moment().format("YYYY-MM-DD"),
            endDate: moment().add(14, "days").format("YYYY-MM-DD"),
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
      ]);
      if (cancelled) return;

      if (futureLessonsResult.status === "fulfilled") {
        const lessons = extractLessons(futureLessonsResult.value);
        setScheduleState({ status: "ready", items: buildScheduleItems(lessons), error: null });
      } else {
        const scheduleMessage =
          futureLessonsResult.reason instanceof Error
            ? futureLessonsResult.reason.message
            : "Unable to load your schedule.";
        setScheduleState({ status: "error", items: [], error: scheduleMessage });
      }

      if (nearbyResult.status === "fulfilled") {
        const nearbyResponse = nearbyResult.value;
        const coachActivities = buildCoachActivities(extractCollection(nearbyResponse?.coaches_availability));
        const groupActivities = buildActivityItems(extractCollection(nearbyResponse?.group_lessons));
        const matchActivities = buildMatchActivities(extractCollection(nearbyResponse?.match_play));
        const nextActivities = [...coachActivities, ...groupActivities, ...matchActivities].sort(
          (a, b) =>
            moment(`${a.dayKey} ${a.time}`, "YYYY-MM-DD h:mm A").valueOf() -
            moment(`${b.dayKey} ${b.time}`, "YYYY-MM-DD h:mm A").valueOf(),
        );
        const nextWindowStart =
          parseNearbyDate(nearbyResponse?.search_area?.window_start) ??
          parseNearbyDate(nextActivities[0]?.startTime) ??
          moment().startOf("day").toDate();
        const nextSelectedDay =
          nextActivities.find((item) => moment(item.dayKey, "YYYY-MM-DD", true).isValid())?.dayKey ??
          moment(nextWindowStart).format("YYYY-MM-DD");

        setActivityWindowStart(moment(nextWindowStart).startOf("day").toISOString());
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
  }, [locationPosition, searchRadius]);

  const dayTabs = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, index) => {
        const day = moment(activityWindowStart).add(index, "days");
        const key = day.format("YYYY-MM-DD");
        const count = activityState.items.filter((item) => item.dayKey === key).length;
        return {
          key,
          label: index === 0 ? "Today" : day.format("ddd"),
          fullDate: day.format("MMM D"),
          date: day.format("D"),
          count,
        };
      }),
    [activityState.items, activityWindowStart],
  );

  useEffect(() => {
    if (activityState.status !== "ready" || activityState.items.length === 0) return;

    const selectedDayHasActivities = activityState.items.some((item) => item.dayKey === selectedDay);
    if (selectedDayHasActivities) return;

    const firstAvailableDay = dayTabs.find((day) => day.count > 0)?.key;
    if (firstAvailableDay && firstAvailableDay !== selectedDay) {
      setSelectedDay(firstAvailableDay);
    }
  }, [activityState.items, activityState.status, dayTabs, selectedDay]);

  const filteredActivities = useMemo(
    () =>
      activityState.items
        .filter((item) => item.dayKey === selectedDay)
        .filter((item) => (selectedType === "all" ? true : item.type === selectedType)),
    [activityState.items, selectedDay, selectedType],
  );

  const counts = useMemo(() => {
    const sameDay = activityState.items.filter((item) => item.dayKey === selectedDay);
    return {
      all: sameDay.length,
      private: sameDay.filter((item) => item.type === "private").length,
      group: sameDay.filter((item) => item.type === "group").length,
      match: sameDay.filter((item) => item.type === "match").length,
    };
  }, [activityState.items, selectedDay]);

  const selectedDayLabel =
    dayTabs.find((day) => day.key === selectedDay)?.fullDate ?? moment(selectedDay).format("MMM D");
  const scheduleItems = scheduleState.items;
  const hasSchedule = scheduleState.status === "ready" && scheduleItems.length > 0;
  const welcomeSubtitle = hasSchedule
    ? `You have ${scheduleItems.length} session${scheduleItems.length === 1 ? "" : "s"} this week`
    : `${activityState.items.length} nearby option${activityState.items.length === 1 ? "" : "s"} across lessons, groups, and matches`;

  const onOpenActivity = (activity) => {
    if (!activity.destination) return;
    navigate(activity.destination);
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
      <header className="ph-header">
        <div className="ph-header-left">
          <Link className="ph-brand" to="/">
            <span className="ph-brand-mark">🎾</span>
            <strong>
              The Tennis <em>Plan</em>
            </strong>
          </Link>

          <nav className="ph-nav-desktop" aria-label="Primary">
            {navItems.slice(0, 3).map((item) => (
              <Link key={item.label} className={item.active ? "active" : ""} to={item.to}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge ? <span className="badge">{item.badge}</span> : null}
              </Link>
            ))}
          </nav>
        </div>

        <div className="ph-header-right">
          <button
            className="ph-location"
            type="button"
            onClick={() => {
              setLocationSearchTerm(locationName);
              setLocationError("");
              setIsLocationOpen(true);
            }}
          >
            <MapPin size={14} />
            <span>{locationName}</span>
            <ChevronDown size={14} />
          </button>
          <div className="ph-user-menu" ref={userMenuRef}>
            <button
              className="ph-user-trigger"
              type="button"
              onClick={() => setIsUserMenuOpen((open) => !open)}
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              aria-label="Open profile menu"
            >
              <span className={`ph-avatar${avatarUrl ? " has-image" : ""}`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName ? `${displayName} profile` : "Player profile"} />
                ) : (
                  initials || "PC"
                )}
              </span>
              <span className="ph-user-copy">
                <strong>{firstName}</strong>
                <small>Settings</small>
              </span>
              <ChevronDown size={16} />
            </button>

            {isUserMenuOpen ? (
              <div className="ph-user-dropdown" role="menu">
                {userMenuItems.map(({ label, to, icon: Icon }) => (
                  <Link
                    key={label}
                    to={to}
                    className="ph-user-menu-item"
                    role="menuitem"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </Link>
                ))}

                <button
                  type="button"
                  className="ph-user-menu-item ph-user-menu-item-danger"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={16} />
                  <span>Log Out</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="ph-main">
        <section className="ph-welcome">
          <h1>Welcome back, {firstName}! 👋</h1>
          <p>{welcomeSubtitle}</p>
        </section>

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
                <Link to="/player/calendar">View All →</Link>
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
              <h2>Play Today</h2>
              <span>{selectedDayLabel}</span>
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

              <button type="button" className="ph-day-tab picker">
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
                <Link to="/matches/create">🏆 Post a Match</Link>
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
                        {activity.type !== "private" ? <span className="ph-activity-time">{activity.time}</span> : null}
                      </span>
                      <strong>{activity.title}</strong>
                      {activity.type === "private" && activity.availabilityText ? (
                        <span className="ph-activity-availability">{activity.availabilityText}</span>
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

      <nav className="ph-bottom-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <Link key={item.label} className={item.active ? "active" : ""} to={item.to}>
            <span className="ph-bottom-nav-icon">
              {item.icon}
              {item.badge ? <span className="ph-bottom-nav-badge">{item.badge}</span> : null}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {isLocationOpen ? (
        <div className="ph-location-overlay" onClick={() => setIsLocationOpen(false)}>
          {renderLocationPicker()}
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;
