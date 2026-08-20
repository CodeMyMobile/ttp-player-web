import moment from "moment";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, ChevronRight, MapPin, Plus, Star, UserPlus } from "lucide-react";
import Autocomplete from "react-google-autocomplete";
import { Link, useNavigate } from "react-router-dom";
import { listMatches, normalizeMatchRecord } from "../api/matches";
import { alertUrgency, deriveMatchNeedsAlerts, inviteToAlert, sortAlerts, summarizeWhen } from "../utils/homeAlerts";
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
  buildCoachInviteItems,
  buildPlayerInviteItems,
  getDashboardUserIdentityRecord,
} from "../utils/dashboardInvites";
import {
  DEFAULT_POSITION,
  DEFAULT_RADIUS_MILES,
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
import {
  buildActivityItems,
  buildDayTabs,
  buildCoachActivities,
  buildExternalLessonActivities,
  buildMatchActivities,
  filterActivities,
  formatDisplayLocation,
  formatStatusLabel,
  getTypeConfig,
  isFutureNearbyActivity,
  parseDate,
  parseNearbyDate,
  parseNearbyMoment,
  pickString,
  resolveLessonKind,
  typeCounts,
} from "../utils/activityFeed";


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


const getApiDayKey = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

// Bucket a class into the viewer's LOCAL calendar day — the same basis the day
// strip cells, "Today", and selectedDay use. parseZone preserves the source
// offset, so formatting it directly buckets classes under their origin-zone
// date, which can miss every local day cell and render the counts as 0.

const shouldPreserveActivityZone = (activity) =>
  activity?.type === "group" || activity?.type === "external";

const formatActivityTimeLabel = (activity, includeDate = false) => {
  if (shouldPreserveActivityZone(activity)) {
    const dateLabel = moment(activity.dayKey, "YYYY-MM-DD", true).isValid()
      ? moment(activity.dayKey, "YYYY-MM-DD").format("ddd, MMM D")
      : moment(activity.startTime).format("ddd, MMM D");
    return includeDate ? `${dateLabel} · ${activity.time}` : activity.time;
  }

  return moment(activity.startTime).format(includeDate ? "ddd, MMM D · h:mm A" : "h:mm A");
};


const extractInvites = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.invites)) return response.invites;
  if (Array.isArray(response.items)) return response.items;
  return [];
};


const buildScheduleItems = (lessons = []) =>
  lessons
    .map((lesson) => {
      const lessonId = lesson.id ?? lesson.lesson_id ?? lesson.lessonId ?? lesson.booking_id ?? lesson.uuid ?? null;
      const type = resolveLessonKind(lesson);
      const startSource =
        lesson.startTime ??
        lesson.start_time ??
        lesson.start_at ??
        lesson.start ??
        lesson.startDate ??
        lesson.starts_at ??
        lesson.start_date_time;
      const zonedStart = type === "group" && startSource
        ? moment.utc(startSource)
        : parseNearbyMoment(startSource);
      const startAt = zonedStart?.toDate() ?? parseDate(
        startSource,
      );
      if (!startAt) return null;

      const displayStart = zonedStart ?? moment(startAt);
      const coachName = pickString(lesson.full_name, lesson.coach_name, lesson.coachName, lesson?.coach?.name);
      const title =
        pickString(lesson.title, lesson.lesson_title, lesson.name, lesson.lesson_name, lesson.program_name) ||
        (type === "group" ? "Group Session" : coachName ? `Lesson with Coach ${coachName}` : "Private Lesson");

      return {
        id: `${type}-${lessonId ?? startAt.toISOString()}`,
        lessonId: lessonId != null ? String(lessonId) : null,
        type,
        time: displayStart.calendar(type === "group" ? moment.utc() : null, {
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
        destination:
          lessonId != null
            ? type === "group"
              ? `/group-lessons/${lessonId}`
              : `/player/lesson/${lessonId}`
            : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());

const buildScheduleMatchItems = (records = [], currentUser) =>
  records
    .map((record) => {
      const normalizedMatch = normalizeMatchRecord(record, { currentUser });
      const zonedStart = parseNearbyMoment(
        normalizedMatch.startDateTimeIso,
        record?.match_date_time,
        record?.start_date_time,
        record?.start_time,
        record?.startTime,
        record?.start_at,
        record?.date_time,
        record?.match_date,
        record?.scheduled_at,
      );
      const startAt = zonedStart?.toDate() ?? parseNearbyDate(
        normalizedMatch.startDateTimeIso,
        record?.match_date_time,
        record?.start_date_time,
        record?.start_time,
        record?.startTime,
        record?.start_at,
        record?.date_time,
        record?.match_date,
        record?.scheduled_at,
      );
      if (!startAt) return null;
      if (!isFutureNearbyActivity(startAt)) return null;

      const matchId = record?.id ?? record?.match_id ?? record?.matchId ?? normalizedMatch.id ?? null;
      const relationshipLabel =
        normalizedMatch.relationship === "host"
          ? "Hosting"
          : normalizedMatch.relationship === "participant"
            ? "Joined"
            : "Match";
      const matchTitle = normalizedMatch.format ? `${normalizedMatch.format} Match` : "Match Play";

      return {
        id: `match-${matchId ?? startAt.toISOString()}`,
        lessonId: matchId != null ? String(matchId) : null,
        type: "match",
        time: moment(startAt).calendar(null, {
          sameDay: "[Today] · h:mm A",
          nextDay: "[Tomorrow] · h:mm A",
          nextWeek: "ddd · h:mm A",
          sameElse: "ddd · h:mm A",
        }),
        title: relationshipLabel === "Match" ? matchTitle : `${relationshipLabel} ${matchTitle}`,
        location: formatDisplayLocation(normalizedMatch.location || "Location TBD"),
        status: relationshipLabel,
        startTime: startAt.toISOString(),
        icon: getTypeConfig("match").badge,
        destination: matchId != null ? `/matches/${matchId}` : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());


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
  const dashboardInviteIdentity = useMemo(() => getDashboardUserIdentityRecord(user), [user]);
  const firstName = displayName?.split(" ")?.[0] || "Player";
  const [scheduleState, setScheduleState] = useState({ status: "idle", items: [], error: null });
  const [activityState, setActivityState] = useState({ status: "idle", items: [], error: null });
  const [inviteState, setInviteState] = useState({ status: "idle", items: [], error: null });
  const [matchNeedsAlerts, setMatchNeedsAlerts] = useState([]);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
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
  const [searchRadius, setSearchRadius] = useState(getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES);
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

      const [futureLessonsResult, scheduleMatchesResult, nearbyResult, externalLessonsResult, invitesResult] = await Promise.allSettled([
        getPlayerFutureLessons({ token, page: 1, perPage: 25, signal: controller.signal }),
        listMatches({
          token,
          filter: "my",
          status: "upcoming",
          includeHidden: true,
          include_hidden: true,
          perPage: 25,
          page: 1,
          signal: controller.signal,
        }),
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

      if (futureLessonsResult.status === "fulfilled" || scheduleMatchesResult.status === "fulfilled") {
        const lessons = futureLessonsResult.status === "fulfilled" ? extractLessons(futureLessonsResult.value) : [];
        const matches = scheduleMatchesResult.status === "fulfilled" ? scheduleMatchesResult.value.matches : [];
        setMatchNeedsAlerts(deriveMatchNeedsAlerts(matches, user));
        const scheduleItems = [
          ...buildScheduleItems(lessons),
          ...buildScheduleMatchItems(matches, user),
        ].sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());
        const scheduleError =
          futureLessonsResult.status === "rejected"
            ? futureLessonsResult.reason instanceof Error
              ? futureLessonsResult.reason.message
              : "Unable to load booked lessons."
            : scheduleMatchesResult.status === "rejected"
              ? scheduleMatchesResult.reason instanceof Error
                ? scheduleMatchesResult.reason.message
                : "Unable to load your matches."
              : null;

        setScheduleState({ status: "ready", items: scheduleItems, error: scheduleError });
        const coachInviteItems = buildCoachInviteItems(lessons, dashboardInviteIdentity);

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
            : scheduleMatchesResult.reason instanceof Error
              ? scheduleMatchesResult.reason.message
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
  }, [activityFilterEnd, activityFilterStart, dashboardInviteIdentity, locationPosition, searchRadius, user]);

  const dayTabs = useMemo(
    () =>
      buildDayTabs({
        items: activityState.items,
        windowStart: activityWindowStart,
        windowEnd: activityWindowEnd,
      }),
    [activityState.items, activityWindowEnd, activityWindowStart],
  );

  const filteredActivities = useMemo(
    () => filterActivities({ items: activityState.items, selectedDay, selectedType }),
    [activityState.items, selectedDay, selectedType],
  );

  const counts = useMemo(
    () => typeCounts({ items: activityState.items, selectedDay }),
    [activityState.items, selectedDay],
  );

  const selectedDayLabel =
    dayTabs.find((day) => day.key === selectedDay)?.fullDate ??
    (selectedDay === "all" ? dayTabs[0]?.fullDate : moment(selectedDay).format("MMM D"));
  const scheduleItems = scheduleState.items;
  const hasSchedule = scheduleState.status === "ready" && scheduleItems.length > 0;
  const inviteItems = inviteState.items;
  // Combined, prioritized Alerts feed: invitations + hosted-match-needs, sorted by
  // deadline (most urgent first) across types.
  const alerts = useMemo(
    () => sortAlerts([...inviteItems.map(inviteToAlert).filter(Boolean), ...matchNeedsAlerts]),
    [inviteItems, matchNeedsAlerts],
  );
  const alertCount = alerts.length;
  const hasAlerts = inviteState.status === "ready" && alertCount > 0;
  // Hero only for a lone invitation; any other single alert or 2+ uses the collapsed section.
  const heroAlert = alertCount === 1 && alerts[0].type === "invitation" ? alerts[0] : null;
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

        {hasAlerts && heroAlert ? (
          <section className="ph-alert-hero" aria-labelledby="ph-alert-hero-title">
            <div className={`ph-alert-hero-band ${heroAlert.inviteKind === "coach" ? "coach" : "player"}`}>
              <span aria-hidden="true">{heroAlert.inviteKind === "coach" ? "👤" : "🎾"}</span>
              <span id="ph-alert-hero-title">{heroAlert.inviteKind === "coach" ? "Lesson invitation" : "Match invitation"}</span>
            </div>
            <button
              type="button"
              className="ph-alert-hero-body"
              onClick={() => heroAlert.destination && navigate(heroAlert.destination)}
            >
              <span className={`ph-invite-avatar ${heroAlert.leadingVisual.accent}`}>
                {heroAlert.leadingVisual.url ? (
                  <img src={heroAlert.leadingVisual.url} alt={heroAlert.title} />
                ) : (
                  <span>{heroAlert.leadingVisual.initials}</span>
                )}
              </span>
              <span className="ph-alert-hero-copy">
                <span className="ph-alert-row-title">
                  <strong>{heroAlert.title}</strong>
                  {heroAlert.isLeague ? <span className="ph-alert-league">League</span> : null}
                </span>
                {heroAlert.subtitle ? <span className="ph-alert-hero-sub">{heroAlert.subtitle}</span> : null}
                <span className="ph-invite-chips">
                  {heroAlert.metaLines.map((chip) => (
                    <span key={chip} className="ph-invite-chip">
                      {chip}
                    </span>
                  ))}
                </span>
                {heroAlert.deadlineAt && heroAlert.expiresLabel ? (
                  <span className="ph-invite-expiry">
                    Invitation expires <span>{heroAlert.expiresLabel}</span>
                  </span>
                ) : null}
              </span>
            </button>
            <div className="ph-alert-hero-actions">
              <button
                type="button"
                className="ph-alert-accept"
                disabled={Boolean(heroAlert.raw.pendingAction)}
                onClick={() => void handleInviteAction(heroAlert.raw, "accept")}
              >
                {heroAlert.raw.pendingAction === "accept" ? "Saving…" : "Accept"}
              </button>
              <button
                type="button"
                className="ph-alert-decline"
                disabled={Boolean(heroAlert.raw.pendingAction)}
                onClick={() => void handleInviteAction(heroAlert.raw, "decline")}
              >
                {heroAlert.raw.pendingAction === "decline" ? "Saving…" : "Decline"}
              </button>
            </div>
            {heroAlert.destination ? (
              <button type="button" className="ph-alert-hero-details" onClick={() => navigate(heroAlert.destination)}>
                View details
              </button>
            ) : null}
          </section>
        ) : hasAlerts ? (
          <section className="ph-alerts" aria-labelledby="ph-alerts-title">
            <div className="ph-alerts-head">
              <Bell size={16} aria-hidden="true" />
              <h2 id="ph-alerts-title">Alerts</h2>
              <span className="ph-alerts-count">{alertCount}</span>
              <span className="ph-alerts-flag">Action needed</span>
            </div>
            {(showAllAlerts ? alerts : alerts.slice(0, 3)).map((alert) => {
              const urgency = alertUrgency(alert.deadlineAt);
              const whenSummary = summarizeWhen(alert);
              const baseMeta = alert.rowMeta && alert.rowMeta.length ? alert.rowMeta : alert.metaLines;
              const metaLines = (whenSummary ? [whenSummary, ...baseMeta] : baseMeta).slice(0, 2);
              const rowContent = (
                <>
                  {alert.type === "invitation" ? (
                    <span className={`ph-invite-avatar ${alert.leadingVisual.accent}`}>
                      {alert.leadingVisual.url ? (
                        <img src={alert.leadingVisual.url} alt={alert.title} />
                      ) : (
                        <span>{alert.leadingVisual.initials}</span>
                      )}
                    </span>
                  ) : (
                    <span className="ph-alert-tile" aria-hidden="true">
                      <UserPlus size={18} />
                    </span>
                  )}
                  <span className="ph-alert-row-copy">
                    <span className="ph-alert-row-title">
                      <strong>{alert.title}</strong>
                      {alert.isLeague ? <span className="ph-alert-league">League</span> : null}
                    </span>
                    {metaLines.map((line) => (
                      <span key={line} className="ph-alert-row-meta">
                        {line}
                      </span>
                    ))}
                  </span>
                  <span className="ph-alert-row-side">
                    {urgency ? <span className={`ph-alert-chip ${urgency.tone}`}>{urgency.label}</span> : null}
                    {alert.destination ? <ChevronRight size={18} className="ph-schedule-arrow" /> : null}
                  </span>
                </>
              );
              return alert.destination ? (
                <button key={alert.id} type="button" className="ph-alert-row" onClick={() => navigate(alert.destination)}>
                  {rowContent}
                </button>
              ) : (
                <div key={alert.id} className="ph-alert-row ph-alert-row--static">
                  {rowContent}
                </div>
              );
            })}
            {alertCount > 3 ? (
              <button
                type="button"
                className="ph-alerts-viewall"
                onClick={() => setShowAllAlerts((value) => !value)}
              >
                {showAllAlerts ? "Show fewer" : `View all ${alertCount} alerts →`}
              </button>
            ) : null}
          </section>
        ) : null}

        {/* Recommended for you — gated: no home-ready recommendations source exists yet,
            so this renders nothing (never fabricated). Wire when a real feed lands. */}
        {false ? <section className="ph-recs" aria-label="Recommended for you" /> : null}

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
                    item.destination && navigate(item.destination)
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
