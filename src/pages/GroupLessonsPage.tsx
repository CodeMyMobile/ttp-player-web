/// <reference types="google.maps" />
import moment from "moment";
import Autocomplete from "react-google-autocomplete";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Clock, ExternalLink, MapPin, Search, Users } from "lucide-react";

import ResultsHeader from "../components/coaches/ResultsHeader";
import MainLayout from "../components/MainLayout";
import { fetchCoachProfile, type CoachProfileRecord } from "../api/coachProfile";
import {
  fetchUpcomingGroupLessons,
  isActiveGroupLessonBookingStatus,
  mapUpcomingGroupLessonsResponse,
  type GroupLesson,
} from "../api/groupLessons";
import {
  fetchMindbodyClasses,
  extractMindbodyClasses,
  mapMindbodyClassToGroupLesson,
} from "../api/mindbodyClasses";
import {
  getPlayerExternalLessonById,
  getPlayerExternalLessons,
  recordExternalLessonClick,
  type PlayerExternalLesson,
} from "../api/playerHome";
import { colors, typography } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import {
  DEFAULT_POSITION,
  getStoredLocation,
  storeLocation,
  USER_LOCATION_CHANGED_EVENT,
  type Coordinates,
} from "../utils/userLocation";

import "../components/coaches/coaches.css";
import "./GroupLessonsPage.css";

const DEFAULT_LOCATION = "San Francisco, CA";
const radiusOptions = [
  "All",
  "1 mi",
  "3 mi",
  "5 mi",
  "10 mi",
  "20 mi",
  "30 mi",
  "50 mi",
  "75 mi",
  "100 mi",
  "150 mi",
  "200 mi",
];
const DEFAULT_RADIUS_OPTION = "10 mi";

const parseRadius = (radius: string) => {
  if (radius === "All") {
    return Number.POSITIVE_INFINITY;
  }
  const match = /^(\d+)/.exec(radius);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const formatLevelRange = (level: number) => {
  const upperBound = (level + 0.5).toFixed(1);
  return `${level.toFixed(1)} - ${upperBound}`;
};

const LEVEL_FILTER_LABELS: Record<string, string> = {
  "2.5": "Beginner (NTRP 2.5)",
  "3.0": "Advanced Beginner (NTRP 3.0)",
  "3.5": "Intermediate (NTRP 3.5)",
  "4.0": "Advanced (NTRP 4.0)",
  "4.5": "Advanced Plus (NTRP 4.5)",
  "5.0": "Expert (NTRP 5.0)",
};

const toIsoDate = (date: Date) => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .slice(0, 10);
};

const parseLessonDateToIso = (label: string) => {
  const currentYear = new Date().getFullYear();
  const parsed = new Date(`${label}, ${currentYear} 12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return toIsoDate(parsed);
};

const addDays = (iso: string, amount: number) => {
  const base = new Date(`${iso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + amount);
  return base;
};

const formatWeekday = (iso: string, length: "long" | "short" = "long") => {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: length,
    timeZone: "UTC",
  });
};

const formatMonthDay = (iso: string, options: "long" | "short" = "long") => {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: options === "long" ? "long" : "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

const parsePriceValue = (pricePerPlayer: string) => {
  const match = String(pricePerPlayer).match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  return Number.parseFloat(match[1]);
};

const getLessonFormatLabel = (lesson: GroupLesson) => {
  if (lesson.isMindbody) {
    return "Partner class";
  }

  const candidate = lesson.focus?.trim();
  if (!candidate) {
    return "Open Group";
  }

  if (candidate.length <= 24 && !/[.,]/.test(candidate)) {
    return candidate;
  }

  if (/cardio/i.test(candidate)) {
    return "Cardio Tennis";
  }

  if (/clinic/i.test(candidate)) {
    return "Clinic";
  }

  return "Open Group";
};

const getCoachInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const isGenericCoachName = (value?: string | null) => {
  if (!value) {
    return true;
  }
  return value.trim().toLowerCase() === "coach";
};

const getSpotsTone = (availableSpots: number) => {
  if (availableSpots <= 0) {
    return {
      tone: "full" as const,
      label: "Full",
    };
  }

  if (availableSpots <= 2) {
    return {
      tone: "limited" as const,
      label: `${availableSpots} spot${availableSpots === 1 ? "" : "s"} left`,
    };
  }

  return {
    tone: "open" as const,
    label: `${availableSpots} spots left`,
  };
};

const extractExternalLessons = (response: unknown): PlayerExternalLesson[] => {
  if (!response || typeof response !== "object") return [];
  const record = response as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data as PlayerExternalLesson[];
  if (Array.isArray(record.lessons)) return record.lessons as PlayerExternalLesson[];
  if (Array.isArray(record.results)) return record.results as PlayerExternalLesson[];
  if (Array.isArray(record.items)) return record.items as PlayerExternalLesson[];
  return [];
};

const normalizeExternalUrl = (url?: string) => {
  const trimmed = url?.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const getExternalLessonMetadata = (lesson: PlayerExternalLesson) => {
  const metadata = lesson.metadata && typeof lesson.metadata === "object"
    ? lesson.metadata as Record<string, unknown>
    : {};
  return {
    title: typeof metadata.title === "string" ? metadata.title : undefined,
    level: typeof metadata.level === "string" ? metadata.level : undefined,
    description: typeof metadata.description === "string" ? metadata.description : undefined,
    externalUrl: typeof metadata.externalUrl === "string" ? metadata.externalUrl : undefined,
  };
};

const mapExternalLessonToGroupLesson = (lesson: PlayerExternalLesson): GroupLesson => {
  const metadata = getExternalLessonMetadata(lesson);
  const start = lesson.start_date_time ? new Date(String(lesson.start_date_time)) : null;
  const end = lesson.end_date_time ? new Date(String(lesson.end_date_time)) : null;
  const durationMinutes =
    start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
      ? Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0)
      : 60;
  const locationName =
    typeof lesson.location === "string" && lesson.location.trim()
      ? lesson.location
      : "Location TBD";
  const fullName = typeof lesson.full_name === "string" && lesson.full_name.trim()
    ? lesson.full_name
    : "External provider";
  const dateLabels = lesson.start_date_time
    ? {
        day: moment.utc(String(lesson.start_date_time)).format("dddd"),
        date: moment.utc(String(lesson.start_date_time)).format("MMM D"),
        startTime: moment.utc(String(lesson.start_date_time)).format("h:mm A"),
      }
    : { day: "TBD", date: "Date TBD", startTime: "Time TBD" };

  return {
    id: String(lesson.id),
    title: metadata.title || String(lesson.lesson_type_name ?? "External lesson"),
    coachId: 0,
    coachName: fullName,
    coachAvatarUrl: typeof lesson.profile_picture === "string" ? lesson.profile_picture : "",
    level: 3,
    skillLabel: metadata.level || "All levels",
    description: metadata.description || "Booking is completed through the provider.",
    day: dateLabels.day,
    date: dateLabels.date,
    startTime: dateLabels.startTime,
    startDateTime: typeof lesson.start_date_time === "string" ? lesson.start_date_time : undefined,
    endDateTime: typeof lesson.end_date_time === "string" ? lesson.end_date_time : undefined,
    locationName,
    locationCity: locationName,
    distanceMiles: 0,
    totalSpots: 0,
    availableSpots: 1,
    focus: typeof lesson.lesson_type_name === "string" ? lesson.lesson_type_name : "External",
    durationMinutes,
    pricePerPlayer: "External booking",
    participants: [],
    groupPlayers: [],
    isExternal: true,
    externalUrl: metadata.externalUrl,
    sourceLesson: lesson,
  };
};

type DateFilterState =
  | { type: "all" }
  | { type: "day"; iso: string }
  | { type: "range"; start: string; end: string };

type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  isCurrentLocation?: boolean;
};

type GroupLessonsStateSnapshot = {
  coachFilter: string;
  levelFilter: string;
  formatFilter: string;
  selectedRadius: string;
  searchTerm: string;
  dateFilter: DateFilterState;
  rangeStartValue: string;
  rangeEndValue: string;
  useLocationFilter: boolean;
  sortBy: "soonest" | "price-low" | "price-high";
  locationFilter: SelectedLocation | null;
  locationSearchTerm: string;
};

type GroupLessonsRouteState = {
  groupLessonsState?: GroupLessonsStateSnapshot;
};

const GroupLessonsPage = () => {
  const { externalLessonId, externallessonid } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [coachFilter, setCoachFilter] = useState<string>("All coaches");
  const [levelFilter, setLevelFilter] = useState<string>("All levels");
  const [position, setPosition] = useState<Coordinates | null>(
    () => getStoredLocation() ?? DEFAULT_POSITION,
  );
  const [locationFilter, setLocationFilter] = useState<SelectedLocation | null>(() => {
    const stored = getStoredLocation();
    if (stored) {
      return {
        label: "Current location",
        latitude: stored.latitude,
        longitude: stored.longitude,
        isCurrentLocation: true,
      };
    }
    return null;
  });
  const [locationSearchTerm, setLocationSearchTerm] = useState(locationFilter?.label ?? "");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState<string>(DEFAULT_RADIUS_OPTION);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showMobileMoreFilters, setShowMobileMoreFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterState>({ type: "all" });
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [rangeStartValue, setRangeStartValue] = useState<string>("");
  const [rangeEndValue, setRangeEndValue] = useState<string>("");
  const [rangeError, setRangeError] = useState<string | undefined>();
  const [useLocationFilter, setUseLocationFilter] = useState(true);
  const [lessons, setLessons] = useState<GroupLesson[]>([]);
  const [externalLesson, setExternalLesson] = useState<GroupLesson | null>(null);
  const [externalClickInFlight, setExternalClickInFlight] = useState(false);
  const [externalClickError, setExternalClickError] = useState<string | null>(null);
  const [coachProfilesById, setCoachProfilesById] = useState<Record<number, CoachProfileRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const authToken = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "Token" }) ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );
  const routeExternalLessonId = externalLessonId ?? externallessonid;

  useEffect(() => {
    const syncStoredLocation = () => {
      const stored = getStoredLocation();
      if (!stored) return;

      setPosition(stored);
      setLocationFilter({
        label: "Current location",
        latitude: stored.latitude,
        longitude: stored.longitude,
        isCurrentLocation: true,
      });
      setLocationSearchTerm("Current location");
      setUseLocationFilter(true);
      setGeoError("");
    };

    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
    return () => window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
  }, []);

  const getResolvedCoachName = useCallback(
    (lesson: GroupLesson) =>
      (isGenericCoachName(lesson.coachName) ? undefined : lesson.coachName) ??
      coachProfilesById[lesson.coachId]?.fullName ??
      "Coach",
    [coachProfilesById],
  );

  const getResolvedCoachAvatar = useCallback(
    (lesson: GroupLesson) => lesson.coachAvatarUrl || coachProfilesById[lesson.coachId]?.profilePicture || "",
    [coachProfilesById],
  );

  const lessonsWithIso = useMemo(
    () =>
      lessons.map((lesson) => ({
        ...lesson,
        isoDate: parseLessonDateToIso(lesson.date),
      })),
    [lessons],
  );

  const coachOptions = useMemo(
    () => [
      "All coaches",
      ...new Set(
        lessonsWithIso
          .filter((lesson) => !lesson.isExternal)
          .map((lesson) => getResolvedCoachName(lesson)),
      ),
    ],
    [getResolvedCoachName, lessonsWithIso],
  );

  const levelOptions = useMemo(() => {
    const uniqueLevels = Array.from(new Set(lessonsWithIso.map((lesson) => lesson.level)))
      .sort((a, b) => a - b)
      .map((lessonLevel) => lessonLevel.toFixed(1));
    return ["All levels", ...uniqueLevels];
  }, [lessonsWithIso]);

  const formatOptions = useMemo(
    () => ["All formats", ...new Set(lessonsWithIso.map((lesson) => getLessonFormatLabel(lesson)))],
    [lessonsWithIso],
  );
  const [formatFilter, setFormatFilter] = useState<string>("All formats");
  const [sortBy, setSortBy] = useState<"soonest" | "price-low" | "price-high">("soonest");

  const groupLessonsStateSnapshot = useMemo<GroupLessonsStateSnapshot>(
    () => ({
      coachFilter,
      levelFilter,
      formatFilter,
      selectedRadius,
      searchTerm,
      dateFilter,
      rangeStartValue,
      rangeEndValue,
      useLocationFilter,
      sortBy,
      locationFilter,
      locationSearchTerm,
    }),
    [
      coachFilter,
      dateFilter,
      formatFilter,
      levelFilter,
      locationFilter,
      locationSearchTerm,
      rangeEndValue,
      rangeStartValue,
      searchTerm,
      selectedRadius,
      sortBy,
      useLocationFilter,
    ],
  );

  const dateAnchors = useMemo(() => {
    const validIsos = lessonsWithIso
      .map((lesson) => lesson.isoDate)
      .filter((iso): iso is string => Boolean(iso))
      .sort();

    if (validIsos.length === 0) {
      const todayIso = toIsoDate(new Date());
      return { start: todayIso, end: toIsoDate(addDays(todayIso, 7)) };
    }

    const base = validIsos[0];
    const last = validIsos[validIsos.length - 1];
    const start = base;
    const endAnchor = addDays(base, 7);
    const computedEnd = toIsoDate(endAnchor);
    const max = last > computedEnd ? last : computedEnd;
    return { start, end: max };
  }, [lessonsWithIso]);

  const dayOptions = useMemo(() => {
    const startDate = dateAnchors.start;
    return Array.from({ length: 8 }, (_, index) => {
      const date = addDays(startDate, index);
      const iso = toIsoDate(date);
      return {
        iso,
        day: formatWeekday(iso),
        shortDay: formatWeekday(iso, "short"),
        label: formatMonthDay(iso),
        dayNumber: new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" }),
      };
    });
  }, [dateAnchors.start]);

  const dayLessonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    lessonsWithIso.forEach((lesson) => {
      if (!lesson.isoDate) return;
      counts.set(lesson.isoDate, (counts.get(lesson.isoDate) ?? 0) + 1);
    });
    return counts;
  }, [lessonsWithIso]);

  const themeVars = useMemo(
    () => ({
      "--fc-color-bg": colors.pageBackground,
      "--fc-color-surface": colors.surface,
      "--fc-color-text-primary": colors.primaryText,
      "--fc-color-text-secondary": colors.secondaryText,
      "--fc-color-text-muted": colors.mutedText,
      "--fc-color-border": colors.border,
      "--fc-color-icon": colors.icon,
      "--fc-color-accent": colors.accentPurple,
      "--fc-color-accent-light": colors.accentPurpleLight,
      "--fc-color-accent-border": colors.accentPurpleBorder,
      "--fc-chip-bg": colors.filterChipBg,
      "--fc-chip-hover-bg": colors.filterChipHover,
      "--fc-chip-text": colors.secondaryButtonText,
      "--fc-color-secondary-border": colors.secondaryButtonBorder,
      "--fc-color-secondary-text": colors.secondaryButtonText,
      "--fc-color-secondary-hover": colors.secondaryButtonHover,
      "--fc-color-success": colors.primarySuccess,
      "--fc-color-success-hover": colors.primarySuccessHover,
      "--fc-color-error-bg": colors.errorBg,
      "--fc-color-error-border": colors.errorBorder,
      "--fc-color-error-text": colors.errorText,
      "--fc-color-empty-icon-bg": colors.emptyIconBg,
      "--fc-color-skeleton-base": colors.skeletonBase,
      "--fc-color-skeleton-highlight": colors.skeletonHighlight,
      "--fc-font-family": typography.fontFamily,
      "--fc-heading-size": typography.heading1.size,
      "--fc-heading-line-height": typography.heading1.lineHeight,
      "--fc-body-size": typography.body.size,
      "--fc-body-line-height": typography.body.lineHeight,
    }),
    [],
  );

  const locationLabel = useLocationFilter
    ? locationFilter?.label ?? DEFAULT_LOCATION
    : "All locations";

  const hasLocationFilter = Boolean(locationFilter);

  const applyLocationFilter = useCallback((nextLocation: SelectedLocation | null) => {
    if (
      nextLocation &&
      typeof nextLocation.latitude === "number" &&
      typeof nextLocation.longitude === "number"
    ) {
      const coords: Coordinates = {
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
      };
      setPosition(coords);
      storeLocation(coords);
      setLocationFilter(nextLocation);
      setLocationSearchTerm(nextLocation.label);
      setGeoError("");
      setShowLocationPicker(false);
      return;
    }

    setLocationFilter(null);
    setLocationSearchTerm("");
    setGeoError("");
    setShowLocationPicker(false);
    setPosition({ ...DEFAULT_POSITION });
    storeLocation(null);
  }, []);

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Location detection is not supported in this browser.");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => {
        setIsDetectingLocation(false);
        const coords: Coordinates = {
          latitude: nextPosition.coords.latitude,
          longitude: nextPosition.coords.longitude,
        };
        applyLocationFilter({
          label: "Current location",
          latitude: coords.latitude,
          longitude: coords.longitude,
          isCurrentLocation: true,
        });
      },
      (geoErrorEvent) => {
        setIsDetectingLocation(false);
        console.error("Failed to detect current location", geoErrorEvent);
        setGeoError(
          geoErrorEvent.message || "We couldn't detect your location. Please allow access and try again.",
        );
      },
    );
  }, [applyLocationFilter]);

  const closeLocationPicker = useCallback(() => {
    setShowLocationPicker(false);
    setGeoError("");
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    if (!location.state || typeof location.state !== "object") {
      return;
    }

    const routeState = location.state as GroupLessonsRouteState;
    const restoredState = routeState.groupLessonsState;
    if (!restoredState) {
      return;
    }

    setCoachFilter(restoredState.coachFilter);
    setLevelFilter(restoredState.levelFilter);
    setFormatFilter(restoredState.formatFilter);
    setSelectedRadius(restoredState.selectedRadius);
    setSearchTerm(restoredState.searchTerm);
    setDateFilter(restoredState.dateFilter);
    setRangeStartValue(restoredState.rangeStartValue);
    setRangeEndValue(restoredState.rangeEndValue);
    setUseLocationFilter(restoredState.useLocationFilter);
    setSortBy(restoredState.sortBy);
    setLocationSearchTerm(restoredState.locationSearchTerm);
    applyLocationFilter(restoredState.locationFilter);

    navigate(location.pathname, { replace: true, state: null });
  }, [applyLocationFilter, location.pathname, location.state, navigate]);

  const totalLessons = lessonsWithIso.length;

  const currentUserIdentity = useMemo(() => {
    const record = user as Record<string, unknown> | null;
    const sessionRecord = record?.session as Record<string, unknown> | undefined;
    let storedUserId: string | undefined;
    let storedEmail: string | undefined;
    let storedPhone: string | undefined;
    if (typeof window !== "undefined") {
      try {
        const loginRaw = localStorage.getItem("authLoginResponse");
        const profileRaw = localStorage.getItem("playerPersonalDetails");
        const login = loginRaw ? JSON.parse(loginRaw) : null;
        const profile = profileRaw ? JSON.parse(profileRaw) : null;
        const storedId =
          login?.user_id ??
          login?.profile?.user_id ??
          profile?.user_id ??
          profile?.id ??
          undefined;
        storedUserId = storedId != null ? String(storedId) : undefined;
        storedEmail =
          (login?.email as string | undefined) ??
          (profile?.email as string | undefined);
        storedPhone =
          (login?.phone as string | undefined) ??
          (profile?.phone as string | undefined);
      } catch {
        storedUserId = undefined;
        storedEmail = undefined;
        storedPhone = undefined;
      }
    }
    const candidate =
      record?.id ??
      record?.user_id ??
      record?.player_id ??
      record?.profile_id ??
      sessionRecord?.user_id ??
      sessionRecord?.id;
    const email =
      (record?.email as string | undefined) ??
      (record?.user_email as string | undefined) ??
      (sessionRecord?.email as string | undefined);
    const phone =
      (record?.phone as string | undefined) ??
      (record?.phone_number as string | undefined) ??
      (sessionRecord?.phone as string | undefined);
    return {
      id: candidate != null ? String(candidate) : storedUserId,
      email: email ? String(email).toLowerCase() : storedEmail?.toLowerCase(),
      phone: phone ? String(phone) : storedPhone ? String(storedPhone) : undefined,
    };
  }, [user]);

  const isLessonBooked = useCallback(
    (lesson: GroupLesson) => {
      const groupPlayers = lesson.groupPlayers ?? [];
      if (!groupPlayers.length) return false;
      const playerRecord = groupPlayers.find((player) => {
        if (currentUserIdentity.id && player.playerId != null) {
          if (String(player.playerId) === currentUserIdentity.id) return true;
        }
        if (currentUserIdentity.email && player.email) {
          if (player.email.toLowerCase() === currentUserIdentity.email) return true;
        }
        if (currentUserIdentity.phone && player.phone) {
          if (String(player.phone) === currentUserIdentity.phone) return true;
        }
        return false;
      });
      if (!playerRecord) return false;
      return isActiveGroupLessonBookingStatus(playerRecord.status, playerRecord.paymentStatus);
    },
    [currentUserIdentity],
  );

  const dateSummary = useMemo(() => {
    if (dateFilter.type === "all") {
      return "across all upcoming dates";
    }
    if (dateFilter.type === "day") {
      const matchingOption = dayOptions.find((option) => option.iso === dateFilter.iso);
      if (matchingOption) {
        return `on ${matchingOption.day}, ${matchingOption.label}`;
      }
      return `on ${formatWeekday(dateFilter.iso)}, ${formatMonthDay(dateFilter.iso)}`;
    }
    return `from ${formatMonthDay(dateFilter.start, "short")} to ${formatMonthDay(dateFilter.end, "short")}`;
  }, [dateFilter, dayOptions]);

  const displayedLessons = useMemo(() => {
    const filteredLessons = lessonsWithIso.filter((lesson) => {
      if (formatFilter !== "All formats" && getLessonFormatLabel(lesson) !== formatFilter) {
        return false;
      }
      return true;
    });

    return [...filteredLessons].sort((a, b) => {
      if (sortBy === "price-low" || sortBy === "price-high") {
        const priceA = parsePriceValue(a.pricePerPlayer) ?? 0;
        const priceB = parsePriceValue(b.pricePerPlayer) ?? 0;
        return sortBy === "price-low" ? priceA - priceB : priceB - priceA;
      }

      const dateA = a.startDateTime ? new Date(a.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
      const dateB = b.startDateTime ? new Date(b.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
    });
  }, [formatFilter, lessonsWithIso, sortBy]);

  const resultsSummary =
    displayedLessons.length === totalLessons
      ? `${displayedLessons.length} ${
          displayedLessons.length === 1 ? "group lesson" : "group lessons"
        } available ${dateSummary}`
      : `${displayedLessons.length} ${
          displayedLessons.length === 1 ? "group lesson" : "group lessons"
        } match your filters ${dateSummary} (${totalLessons} total)`;

  const maxSelectableDate = dateAnchors.end;
  const selectedCoachId = useMemo(() => {
    if (coachFilter === "All coaches") {
      return undefined;
    }

    return lessons.find((lesson) => !lesson.isExternal && getResolvedCoachName(lesson) === coachFilter)?.coachId;
  }, [coachFilter, getResolvedCoachName, lessons]);

  useEffect(() => {
    const controller = new AbortController();

    if (!authToken || lessons.length === 0) {
      return () => controller.abort();
    }

    const coachIdsToLoad = Array.from(
      new Set(
        lessons
          .filter((lesson) => lesson.coachId && (isGenericCoachName(lesson.coachName) || !lesson.coachAvatarUrl))
          .map((lesson) => lesson.coachId)
          .filter((coachId) => !coachProfilesById[coachId]),
      ),
    );

    if (coachIdsToLoad.length === 0) {
      return () => controller.abort();
    }

    Promise.all(
      coachIdsToLoad.map(async (coachId) => {
        const profile = await fetchCoachProfile(coachId, {
          token: authToken,
          signal: controller.signal,
        });
        return [coachId, profile] as const;
      }),
    )
      .then((entries) => {
        if (controller.signal.aborted || entries.length === 0) return;
        setCoachProfilesById((current) => {
          const next = { ...current };
          for (const [coachId, profile] of entries) {
            next[coachId] = profile;
          }
          return next;
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
      });

    return () => controller.abort();
  }, [authToken, coachProfilesById, lessons]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadLessons = async () => {
      const token = authToken ?? getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setLoadError("Missing authentication token.");
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const selectedLevelLabel =
        levelFilter === "All levels" ? undefined : LEVEL_FILTER_LABELS[levelFilter];
      const radiusMiles = parseRadius(selectedRadius);
      const dateRange =
        dateFilter.type === "all"
          ? {}
          : dateFilter.type === "day"
            ? { dateStart: dateFilter.iso, dateEnd: dateFilter.iso }
            : { dateStart: dateFilter.start, dateEnd: dateFilter.end };
      const resolvedPosition = useLocationFilter ? position ?? DEFAULT_POSITION : undefined;

      try {
        const filters = {
          coachId: selectedCoachId,
          level: selectedLevelLabel,
          radius:
            useLocationFilter && Number.isFinite(radiusMiles) ? radiusMiles : undefined,
          ...dateRange,
        };
        const externalFilters = {
          ...filters,
          date:
            dateFilter.type === "day"
              ? dateFilter.iso
              : "",
        };

        const mindbodyDateRange =
          dateFilter.type === "all"
            ? {}
            : dateFilter.type === "day"
              ? { from: dateFilter.iso, to: dateFilter.iso }
              : { from: dateFilter.start, to: dateFilter.end };

        const [groupResponse, externalResponse, mindbodyResponse] = await Promise.all([
          fetchUpcomingGroupLessons({
            token,
            perPage: 50,
            page: 1,
            search: searchTerm.trim(),
            ...(resolvedPosition ? { position: resolvedPosition } : {}),
            filters,
            signal: controller.signal,
          }).catch((error) => {
            console.warn("Group lessons source failed", error);
            return null;
          }),
          selectedCoachId
            ? Promise.resolve(null)
            : getPlayerExternalLessons({
                token,
                perPage: 50,
                page: 1,
                search: searchTerm.trim(),
                ...(resolvedPosition ? { position: resolvedPosition } : {}),
                filters: externalFilters,
                signal: controller.signal,
              }).catch((error) => {
                console.warn("External lessons source failed", error);
                return null;
              }),
          selectedCoachId
            ? Promise.resolve(null)
            : fetchMindbodyClasses({
                token,
                perPage: 50,
                page: 1,
                search: searchTerm.trim(),
                filters: mindbodyDateRange,
                signal: controller.signal,
              }).catch((error) => {
                console.warn("Mindbody lessons source failed", error);
                return null;
              }),
        ]);

        if (cancelled) return;

        const mapped = groupResponse
          ? mapUpcomingGroupLessonsResponse(groupResponse)
          : { lessons: [] };
        const externalLessons = externalResponse
          ? extractExternalLessons(externalResponse)
              .filter((lesson) => Boolean(getExternalLessonMetadata(lesson).externalUrl))
              .map(mapExternalLessonToGroupLesson)
          : [];
        const mindbodyLessons = mindbodyResponse
          ? extractMindbodyClasses(mindbodyResponse).map(mapMindbodyClassToGroupLesson)
          : [];
        const nextLessons = [...mapped.lessons, ...externalLessons, ...mindbodyLessons];
        if (nextLessons.length === 0 && !groupResponse && !externalResponse && !mindbodyResponse) {
          throw new Error("Unable to load group lessons.");
        }
        setLessons(nextLessons);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load group lessons.");
        setLessons([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadLessons();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    authToken,
    levelFilter,
    selectedRadius,
    searchTerm,
    dateFilter,
    useLocationFilter,
    position,
    selectedCoachId,
  ]);

  useEffect(() => {
    if (!routeExternalLessonId) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadExternalLesson = async () => {
      const token = authToken ?? getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setLoadError("Missing authentication token.");
        return;
      }

      setExternalClickError(null);

      try {
        const response = await getPlayerExternalLessonById({
          token,
          lessonId: routeExternalLessonId,
          signal: controller.signal,
        });
        if (cancelled) return;
        const mapped = mapExternalLessonToGroupLesson(response);
        setExternalLesson(mapped.externalUrl ? mapped : null);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load external lesson.");
      }
    };

    loadExternalLesson();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authToken, routeExternalLessonId]);

  const openExternalLessonDialog = useCallback((lesson: GroupLesson) => {
    setExternalClickError(null);
    setExternalLesson(lesson);
  }, []);

  const closeExternalLessonDialog = useCallback(() => {
    setExternalClickError(null);
    setExternalLesson(null);
    if (routeExternalLessonId) {
      navigate("/group-lessons", { replace: true });
    }
  }, [navigate, routeExternalLessonId]);

  const continueToExternalBooking = useCallback(async () => {
    if (!externalLesson?.externalUrl) return;

    const token = authToken ?? getStoredAuthToken({ preferScheme: "token" });
    setExternalClickInFlight(true);
    setExternalClickError(null);

    try {
      if (token) {
        await recordExternalLessonClick({
          token,
          lessonId: externalLesson.id,
          clickPayload: {
            device_type: "web",
            metadata: {
              component: "GroupLessonsPage",
              clickedUrl: externalLesson.externalUrl,
            },
          },
        });
      }

      const url = normalizeExternalUrl(externalLesson.externalUrl);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      closeExternalLessonDialog();
    } catch (error) {
      setExternalClickError(error instanceof Error ? error.message : "Unable to open booking link.");
    } finally {
      setExternalClickInFlight(false);
    }
  }, [authToken, closeExternalLessonDialog, externalLesson]);

  const handleApplyRange = () => {
    if (!rangeStartValue || !rangeEndValue) {
      setRangeError("Select both a start and end date.");
      return;
    }
    if (rangeStartValue > rangeEndValue) {
      setRangeError("Start date must be before the end date.");
      return;
    }
    setRangeError(undefined);
    setDateFilter({ type: "range", start: rangeStartValue, end: rangeEndValue });
    setIsRangeOpen(false);
  };

  const handleClearRange = () => {
    setRangeStartValue("");
    setRangeEndValue("");
    setRangeError(undefined);
    setDateFilter({ type: "all" });
    setIsRangeOpen(false);
  };

  const resetAllFilters = useCallback(() => {
    setCoachFilter("All coaches");
    setLevelFilter("All levels");
    setFormatFilter("All formats");
    applyLocationFilter(null);
    setSelectedRadius(DEFAULT_RADIUS_OPTION);
    setSearchTerm("");
  }, [applyLocationFilter]);

  const hasActiveFilters =
    coachFilter !== "All coaches" ||
    levelFilter !== "All levels" ||
    formatFilter !== "All formats" ||
    selectedRadius !== DEFAULT_RADIUS_OPTION ||
    searchTerm.trim().length > 0 ||
    !useLocationFilter;

  return (
    <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
      <div className="find-coaches-page group-lessons-page" style={themeVars}>
        <div className="find-coaches-page__inner group-lessons-page__inner">
          <div className="group-lessons-desktop-shell">
            <ResultsHeader
              title="Group Lessons"
              description="Dial in your game with trusted coaches"
            />

            <section className="group-lessons-desktop-filters" aria-label="Filter group lessons">
              <div className="group-lessons-desktop-filters__top">
                <label className="group-lessons-desktop-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    aria-label="Search classes"
                    placeholder="Search classes"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>

                <div className="group-lessons-desktop-filters__actions">
                  <label className="group-lessons-desktop-select">
                    <select
                      aria-label="Filter by format"
                      value={formatFilter}
                      onChange={(event) => setFormatFilter(event.target.value)}
                    >
                      {formatOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="group-lessons-desktop-select">
                    <select
                      aria-label="Filter by distance"
                      value={selectedRadius}
                      onChange={(event) => setSelectedRadius(event.target.value)}
                    >
                      {radiusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === "All" ? "Any distance" : option}
                        </option>
                      ))}
                    </select>
                  </label>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="group-lessons-desktop-clear"
                      onClick={() => {
                        setCoachFilter("All coaches");
                        setLevelFilter("All levels");
                        setFormatFilter("All formats");
                        setSelectedRadius(DEFAULT_RADIUS_OPTION);
                        setSearchTerm("");
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              <div className="group-lessons-desktop-chip-row">
                <span className="group-lessons-desktop-chip-row__label">Level</span>
                <div className="group-lessons-desktop-chip-row__chips">
                  <button
                    type="button"
                    className={`group-lessons-desktop-chip${
                      levelFilter === "All levels" ? " group-lessons-desktop-chip--active" : ""
                    }`}
                    onClick={() => setLevelFilter("All levels")}
                  >
                    All
                  </button>
                  {levelOptions
                    .filter((option) => option !== "All levels")
                    .map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`group-lessons-desktop-chip${
                          levelFilter === option ? " group-lessons-desktop-chip--active" : ""
                        }`}
                        onClick={() => setLevelFilter(option)}
                      >
                        {formatLevelRange(Number.parseFloat(option))}
                      </button>
                    ))}
                </div>
              </div>

              <div className="group-lessons-desktop-chip-row">
                <span className="group-lessons-desktop-chip-row__label">Coach</span>
                <div className="group-lessons-desktop-chip-row__chips">
                  <button
                    type="button"
                    className={`group-lessons-desktop-chip${
                      coachFilter === "All coaches" ? " group-lessons-desktop-chip--active" : ""
                    }`}
                    onClick={() => setCoachFilter("All coaches")}
                  >
                    All
                  </button>
                  {coachOptions
                    .filter((option) => option !== "All coaches")
                    .map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`group-lessons-desktop-chip group-lessons-desktop-chip--coach${
                          coachFilter === option ? " group-lessons-desktop-chip--active" : ""
                        }`}
                        onClick={() => setCoachFilter(option)}
                      >
                        <span className="group-lessons-desktop-chip__avatar">
                          {getCoachInitials(option)}
                        </span>
                        {option}
                      </button>
                    ))}
                </div>
              </div>
            </section>
          </div>

          <div className="group-lessons-mobile-shell">
            <section className="group-lessons-mobile-hero">
              <h1>Group Lessons</h1>
              <p>Dial in your game with trusted coaches</p>
            </section>

            <div className="group-lessons-mobile-search-row">
              <label className="group-lessons-mobile-search">
                <Search size={14} aria-hidden="true" />
                <input
                  aria-label="Search classes"
                  placeholder="Search classes"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={`group-lessons-mobile-more${
                  formatFilter !== "All formats" ||
                  selectedRadius !== DEFAULT_RADIUS_OPTION
                    ? " group-lessons-mobile-more--active"
                    : ""
                }`}
                onClick={() => setShowMobileMoreFilters(true)}
              >
                <span>⚙</span>
                <span>
                  More
                  {formatFilter !== "All formats" ||
                  selectedRadius !== DEFAULT_RADIUS_OPTION
                    ? ` · ${
                        Number(formatFilter !== "All formats") +
                        Number(selectedRadius !== DEFAULT_RADIUS_OPTION)
                      }`
                    : ""}
                </span>
              </button>
            </div>

            <div className="group-lessons-mobile-chip-row">
              <span className="group-lessons-mobile-chip-row__label">Level</span>
              <div className="group-lessons-mobile-chip-row__scroller">
                <button
                  type="button"
                  className={`group-lessons-mobile-chip${
                    levelFilter === "All levels" ? " group-lessons-mobile-chip--active" : ""
                  }`}
                  onClick={() => setLevelFilter("All levels")}
                >
                  All
                </button>
                {levelOptions
                  .filter((option) => option !== "All levels")
                  .map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`group-lessons-mobile-chip${
                        levelFilter === option ? " group-lessons-mobile-chip--active" : ""
                      }`}
                      onClick={() => setLevelFilter(option)}
                    >
                      {formatLevelRange(Number.parseFloat(option))}
                    </button>
                  ))}
              </div>
            </div>

            <div className="group-lessons-mobile-chip-row">
              <span className="group-lessons-mobile-chip-row__label">Coach</span>
              <div className="group-lessons-mobile-chip-row__scroller">
                <button
                  type="button"
                  className={`group-lessons-mobile-chip${
                    coachFilter === "All coaches" ? " group-lessons-mobile-chip--active" : ""
                  }`}
                  onClick={() => setCoachFilter("All coaches")}
                >
                  All
                </button>
                {coachOptions
                  .filter((option) => option !== "All coaches")
                  .map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`group-lessons-mobile-chip group-lessons-mobile-chip--coach${
                        coachFilter === option ? " group-lessons-mobile-chip--active" : ""
                      }`}
                      onClick={() => setCoachFilter(option)}
                    >
                      <span className="group-lessons-mobile-chip__avatar">
                        {getCoachInitials(option)}
                      </span>
                      {option.split(" ")[0]}
                    </button>
                  ))}
              </div>
            </div>

          </div>

          {showLocationPicker ? (
            <section className="fp-location-panel" id="group-lessons-location-picker" aria-label="Location picker">
              <Autocomplete
                apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                placeholder="Search for a city, club, or court"
                className="fp-autocomplete-input"
                value={locationSearchTerm}
                onChange={(event) => setLocationSearchTerm(event.target.value)}
                onPlaceSelected={(place: google.maps.places.PlaceResult | null) => {
                  if (!place) {
                    setGeoError("Please choose a location from the suggestions.");
                    return;
                  }

                  const lat = place.geometry?.location?.lat?.();
                  const lng = place.geometry?.location?.lng?.();
                  const label =
                    place.formatted_address || place.name || locationSearchTerm || "Custom location";

                  if (
                    typeof lat === "number" &&
                    !Number.isNaN(lat) &&
                    typeof lng === "number" &&
                    !Number.isNaN(lng)
                  ) {
                    applyLocationFilter({ label, latitude: lat, longitude: lng });
                  } else {
                    setGeoError("We couldn't read that location's coordinates. Try another search.");
                  }
                }}
                options={{
                  types: ["geocode", "establishment"],
                  fields: ["formatted_address", "geometry", "name", "address_components"],
                }}
              />

              <div className="fp-location-actions">
                <button
                  type="button"
                  className="fp-location-detect"
                  onClick={detectCurrentLocation}
                  disabled={isDetectingLocation}
                >
                  {isDetectingLocation ? "Detecting location..." : "Use my current location"}
                </button>
                <div className="fp-location-secondary-actions">
                  {hasLocationFilter ? (
                    <button type="button" className="fp-location-secondary" onClick={() => applyLocationFilter(null)}>
                      Clear location
                    </button>
                  ) : null}
                  <button type="button" className="fp-location-secondary" onClick={closeLocationPicker}>
                    Close
                  </button>
                </div>
              </div>

              <div className="fp-location-summary">
                <h4>Selected location</h4>
                {locationFilter ? (
                  <p>{locationFilter.label}</p>
                ) : useLocationFilter ? (
                  <p>{DEFAULT_LOCATION}</p>
                ) : (
                  <p>No location selected yet.</p>
                )}
              </div>

              {geoError ? <p className="fp-location-error">{geoError}</p> : null}
              {!import.meta.env.VITE_GOOGLE_API_KEY ? (
                <p className="fp-location-tip">
                  Tip: Provide a Google Places API key to enable location search suggestions.
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="group-lessons-day-filter" role="region" aria-label="Filter sessions by day">
            <div className="group-lessons-day-filter__controls">
              <div className="group-lessons-day-filter__quick">
                <button
                  type="button"
                  className={`group-lessons-day-filter__pill${
                    dateFilter.type === "all" ? " group-lessons-day-filter__pill--active" : ""
                  }`}
                  aria-pressed={dateFilter.type === "all"}
                  onClick={() => {
                    setDateFilter({ type: "all" });
                    setRangeStartValue("");
                    setRangeEndValue("");
                    setRangeError(undefined);
                    setIsRangeOpen(false);
                  }}
                >
                  <span className="group-lessons-day-filter__day">All</span>
                  <span className="group-lessons-day-filter__date group-lessons-day-filter__date--primary">Wk</span>
                  <span className="group-lessons-day-filter__count">{totalLessons}</span>
                </button>
                {dayOptions.map((option) => {
                  const isActive = dateFilter.type === "day" && dateFilter.iso === option.iso;
                  const count = dayLessonCounts.get(option.iso) ?? 0;
                  return (
                    <button
                      key={option.iso}
                      type="button"
                      className={`group-lessons-day-filter__pill${
                        isActive ? " group-lessons-day-filter__pill--active" : ""
                      }`}
                      aria-pressed={isActive}
                      onClick={() => {
                        setDateFilter({ type: "day", iso: option.iso });
                        setRangeStartValue(option.iso);
                        setRangeEndValue(option.iso);
                        setRangeError(undefined);
                        setIsRangeOpen(false);
                      }}
                    >
                      <span className="group-lessons-day-filter__day">{option.shortDay}</span>
                      <span className="group-lessons-day-filter__date group-lessons-day-filter__date--primary">
                        {option.dayNumber}
                      </span>
                      <span className="group-lessons-day-filter__count">{count}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`group-lessons-day-filter__range-toggle${
                    dateFilter.type === "range" ? " group-lessons-day-filter__range-toggle--active" : ""
                  }`}
                  aria-expanded={isRangeOpen}
                  aria-label={
                    dateFilter.type === "range"
                      ? `Pick dates, current range ${formatMonthDay(dateFilter.start, "short")} to ${formatMonthDay(
                          dateFilter.end,
                          "short",
                        )}`
                      : "Pick dates"
                  }
                  onClick={() => {
                    if (!isRangeOpen) {
                      if (dateFilter.type === "range") {
                        setRangeStartValue(dateFilter.start);
                        setRangeEndValue(dateFilter.end);
                      } else {
                        setRangeStartValue((current) => current || dateAnchors.start);
                        setRangeEndValue((current) => current || dateAnchors.start);
                      }
                    }
                    setIsRangeOpen((open) => !open);
                  }}
                >
                  <span className="group-lessons-day-filter__picker-icon" aria-hidden>
                    <CalendarDays size={15} />
                  </span>
                  <span className="group-lessons-day-filter__date group-lessons-day-filter__date--primary">Pick</span>
                </button>
              </div>
            </div>
            {isRangeOpen ? (
              <div className="group-lessons-date-range">
                <div className="group-lessons-date-range__fields">
                  <label className="group-lessons-date-range__field">
                    <span>Start</span>
                    <input
                      type="date"
                      value={rangeStartValue}
                      min={dateAnchors.start}
                      max={rangeEndValue || maxSelectableDate}
                      onChange={(event) => {
                        setRangeStartValue(event.target.value);
                        setRangeError(undefined);
                      }}
                    />
                  </label>
                  <label className="group-lessons-date-range__field">
                    <span>End</span>
                    <input
                      type="date"
                      value={rangeEndValue}
                      min={rangeStartValue || dateAnchors.start}
                      max={maxSelectableDate}
                      onChange={(event) => {
                        setRangeEndValue(event.target.value);
                        setRangeError(undefined);
                      }}
                    />
                  </label>
                </div>
                <p className="group-lessons-date-range__hint">
                  {rangeStartValue && rangeEndValue
                    ? `Showing availability from ${formatMonthDay(rangeStartValue, "short")} to ${formatMonthDay(
                        rangeEndValue,
                        "short",
                      )}.`
                    : "Select a start and end date to filter sessions."}
                </p>
                {rangeError ? <p className="group-lessons-date-range__error">{rangeError}</p> : null}
                <div className="group-lessons-date-range__actions">
                  <button type="button" onClick={handleClearRange}>
                    Clear
                  </button>
                  <button type="button" onClick={handleApplyRange}>
                    Apply range
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <section aria-labelledby="group-lessons-results-heading" className="group-lessons-results">
            <div className="group-lessons-results__header">
              {/* <div>
                <h2 id="group-lessons-results-heading">Available sessions nearby</h2>
                <p className="group-lessons-results__meta">{resultsSummary}</p>
              </div> */}
              <div className="group-lessons-results__sort">
                <span>Sort by</span>
                <label className="group-lessons-results__sort-select">
                  <select
                    aria-label="Sort group lessons"
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as "soonest" | "price-low" | "price-high")
                    }
                  >
                    <option value="soonest">Soonest</option>
                    <option value="price-low">Price low</option>
                    <option value="price-high">Price high</option>
                  </select>
                </label>
              </div>
            </div>

            {isLoading ? (
              <div className="empty-state">
                <p>Loading group lessons…</p>
              </div>
            ) : loadError ? (
              <div className="empty-state">
                <p>{loadError}</p>
              </div>
            ) : displayedLessons.length === 0 ? (
              <div className="empty-state">
                <p>No lessons match your current filters.</p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="lessons-grid">
                {displayedLessons.map((lesson) => {
                  const levelRange = formatLevelRange(lesson.level);
                  const spotTone = getSpotsTone(lesson.availableSpots);
                  const isBooked = isLessonBooked(lesson);
                  const isExternal = Boolean(lesson.isExternal && lesson.externalUrl);
                  const isMindbody = Boolean(lesson.isMindbody);
                  const isSoldOut = !isExternal && lesson.availableSpots === 0;
                  const priceValue = parsePriceValue(lesson.pricePerPlayer);
                  const showPackLink = !isExternal && !isMindbody && priceValue !== null && priceValue > 29;
                  const coachName = getResolvedCoachName(lesson);
                  const coachAvatar = getResolvedCoachAvatar(lesson);
                  const mindbodyTotalCents =
                    (lesson.classPriceCents ?? 0) + (lesson.platformFeeAmountCents ?? 0);
                  const detailsPath = isExternal
                    ? `/lessons/external/${lesson.id}`
                    : isMindbody
                      ? `/mindbody/classes/${lesson.partnerClassId ?? lesson.id}`
                      : `/group-lessons/${lesson.id}`;

                  return (
                    <article
                      key={lesson.id}
                      className={`lesson-card lesson-card--desktop${isExternal ? " lesson-card--external" : ""}${isMindbody ? " lesson-card--mindbody" : ""}`}
                    >
                      <header className="lesson-card__band">
                        <div className="lesson-card__band-label">
                          {lesson.day.toUpperCase()} · {lesson.date.toUpperCase()}
                        </div>
                        <span className="lesson-card__level">
                          {isExternal ? "External" : isMindbody ? lesson.partnerName ?? "Partner" : `${levelRange} NTRP`}
                        </span>
                      </header>

                      <div className="lesson-card__body">
                        <div className="lesson-card__headline">
                          <div className="lesson-card__title-wrap">
                            <h3>{lesson.title}</h3>
                            <p className="lesson-card__description">
                              {lesson.description || lesson.focus || "Details coming soon."}
                            </p>
                          </div>
                          <div className="lesson-card__price">
                            <div className="lesson-card__price-value">
                              {isExternal
                                ? "Book offsite"
                                : isMindbody
                                  ? `$${(mindbodyTotalCents / 100).toFixed(2)} total`
                                  : priceValue !== null ? `$${priceValue}` : lesson.pricePerPlayer}
                            </div>
                            {showPackLink ? (
                              <button
                                type="button"
                                className="lesson-card__pack-link"
                                onClick={() => navigate("/credits")}
                              >
                                $29 w/ pack
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="lesson-card__info-list">
                          <div className="lesson-card__info-row">
                            <Clock size={16} aria-hidden="true" />
                            <span>
                              {lesson.startTime} · {lesson.durationMinutes} min
                            </span>
                          </div>
                          <div className="lesson-card__info-row">
                            <MapPin size={16} aria-hidden="true" />
                            <span>{lesson.locationName}</span>
                          </div>
                          <div className="lesson-card__info-row lesson-card__info-row--spots">
                            {isExternal ? (
                              <ExternalLink size={16} aria-hidden="true" />
                            ) : (
                              <Users size={16} aria-hidden="true" />
                            )}
                            <span
                              className={`lesson-card__spots-pill lesson-card__spots-pill--${
                                isExternal ? "external" : isMindbody ? "mindbody" : spotTone.tone
                              }`}
                            >
                              {isExternal ? "External booking" : isMindbody ? `Partner booking · ${spotTone.label}` : spotTone.label}
                            </span>
                          </div>
                        </div>

                        <div className="lesson-card__coach-strip">
                          <div className="lesson-coach">
                            {coachAvatar ? (
                              <img src={coachAvatar} alt="" aria-hidden="true" />
                            ) : (
                              <span className="lesson-card__coach-fallback">
                                {getCoachInitials(coachName)}
                              </span>
                            )}
                            <div>
                              <p className="coach-name">
                                with <strong>{coachName}</strong>
                              </p>
                            </div>
                          </div>
                        </div>

                        <footer className="lesson-card__footer">
                          <Link
                            to={detailsPath}
                            state={{ groupLessonsState: groupLessonsStateSnapshot }}
                            className="ghost-button"
                          >
                            View details
                          </Link>
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => {
                              if (isExternal) {
                                openExternalLessonDialog(lesson);
                                return;
                              }
                              navigate(detailsPath, {
                                state: {
                                  groupLessonsState: groupLessonsStateSnapshot,
                                },
                              });
                            }}
                            disabled={isSoldOut || isBooked}
                          >
                            {isExternal ? "Continue" : isBooked ? "Booked" : isSoldOut ? "Join waitlist" : isMindbody ? "Book partner class" : "Book now"}
                          </button>
                        </footer>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      {externalLesson && typeof document !== "undefined"
        ? createPortal(
            <div className="external-lesson-dialog" role="presentation">
              <button
                type="button"
                className="external-lesson-dialog__backdrop"
                aria-label="Close external booking dialog"
                onClick={closeExternalLessonDialog}
              />
              <section
                className="external-lesson-dialog__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="external-lesson-dialog-title"
              >
                <div className="external-lesson-dialog__icon" aria-hidden="true">
                  <ExternalLink size={22} />
                </div>
                <h2 id="external-lesson-dialog-title">You're Leaving The Tennis Plan App</h2>
                <p>
                  Booking for {externalLesson.title || "this lesson"} is handled by the provider.
                  Continue to open their booking page in a new tab.
                </p>
                {externalLesson.locationName ? (
                  <div className="external-lesson-dialog__meta">
                    <MapPin size={15} aria-hidden="true" />
                    <span>{externalLesson.locationName}</span>
                  </div>
                ) : null}
                {externalClickError ? (
                  <p className="external-lesson-dialog__error">{externalClickError}</p>
                ) : null}
                <div className="external-lesson-dialog__actions">
                  <button type="button" onClick={closeExternalLessonDialog}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={continueToExternalBooking}
                    disabled={externalClickInFlight}
                  >
                    {externalClickInFlight ? "Opening..." : "Continue to booking"}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
      {showMobileMoreFilters && typeof document !== "undefined"
        ? createPortal(
            <div className="group-lessons-mobile-sheet">
              <button
                type="button"
                className="group-lessons-mobile-sheet__backdrop"
                aria-label="Close filters"
                onClick={() => setShowMobileMoreFilters(false)}
              />
              <div className="group-lessons-mobile-sheet__panel">
                <div className="group-lessons-mobile-sheet__handle" />
                <div className="group-lessons-mobile-sheet__header">
                  <h2>More filters</h2>
                  <button type="button" onClick={resetAllFilters}>
                    Clear
                  </button>
                </div>
                <div className="group-lessons-mobile-sheet__content">
                  <section className="group-lessons-mobile-sheet__group">
                    <h3>Distance</h3>
                    <p>Within radius of {useLocationFilter ? locationLabel : DEFAULT_LOCATION}</p>
                    <div className="group-lessons-mobile-sheet__chips">
                      {radiusOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`group-lessons-mobile-sheet__chip${
                            selectedRadius === option ? " group-lessons-mobile-sheet__chip--active" : ""
                          }`}
                          onClick={() => setSelectedRadius(option)}
                        >
                          {option === "All" ? "Any" : option}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="group-lessons-mobile-sheet__group">
                    <h3>Format</h3>
                    <div className="group-lessons-mobile-sheet__chips">
                      {formatOptions
                        .filter((option) => option !== "All formats")
                        .map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`group-lessons-mobile-sheet__chip${
                              formatFilter === option ? " group-lessons-mobile-sheet__chip--active" : ""
                            }`}
                            onClick={() => setFormatFilter(option)}
                          >
                            {option}
                          </button>
                        ))}
                    </div>
                  </section>
                </div>
                <div className="group-lessons-mobile-sheet__footer">
                  <button type="button" onClick={() => setShowMobileMoreFilters(false)}>
                    Show results
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </MainLayout>
  );
};

export default GroupLessonsPage;
