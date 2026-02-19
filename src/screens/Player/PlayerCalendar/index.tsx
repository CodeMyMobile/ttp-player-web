import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import { ChevronDown, Clock, Layers, MapPin, Search as SearchIcon, User, UserCheck } from "lucide-react";
import "./index.css";
import "../../../pages/GroupLessonsPage.css";

import {
  bookLesson,
  cancelBooking,
  fetchAvailableLessons,
  fetchPlayerBookings,
  fetchCoachLessonsByDate,
  fetchCoachSchedule,
  requestPrivateLesson,
  type Lesson as ApiLesson,
} from "../../../api/playerLessons";
import LessonDetailCard from "../../../components/LessonDetailCard";
import {
  getPlayerCoaches,
  getCoachLocation,
  getCoachScheduleById,
  getCoachScheduleByIdAndLocation,
  type PlayerCoach,
  type CoachLocation,
  type CoachScheduleEntry,
} from "../../../api/playerCalendar";
import ResultsHeader from "../../../components/coaches/ResultsHeader";
import MainLayout from "../../../components/MainLayout";
import { colors, typography } from "../../../lib/theme";
import { useAuth } from "../../../context/AuthContext";
import { getStoredAuthToken } from "../../../services/authToken";

const DISTANCE_OPTIONS = [
  { value: "5", label: "5 mi" },
  { value: "10", label: "10 mi" },
  { value: "15", label: "15 mi" },
  { value: "20", label: "20 mi" },
  { value: "any", label: "All" },
] as const;

const LESSON_TYPE_OPTIONS = [
  { value: "all", label: "All session types" },
  { value: "private", label: "Private lessons" },
  { value: "group", label: "Group sessions" },
] as const;

const LESSON_LEVELS = [
  { id: 0, name: "All", description: "" },
  { id: 1, name: "Beginner (NTRP 2.5)", description: "Just getting started in the game" },
  { id: 2, name: "Advanced Beginner (NTRP 3.0)", description: "I can rally but my strokes are not consistent yet" },
  { id: 3, name: "Intermediate (NTRP 3.5)", description: "I can hit with spin and direction most of the time" },
  { id: 4, name: "Advanced (NTRP 4.0)", description: "I can consistently rally with spin, direction, and pace" },
  { id: 5, name: "Advanced Plus (NTRP 4.5)", description: "I have control over my shots and hit consistently with depth and pace" },
  { id: 6, name: "Expert (NTRP 5.0)", description: "I have competitive experience and advanced skill levels" },
] as const;

const WEEK_DAYS: Array<"MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"> = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const getDefaultDateRange = (): DateRange => ({
  start: moment().startOf("day"),
  end: moment().add(13, "days").endOf("day"),
});

export interface Lesson extends ApiLesson {}

export type LessonStatus = "available" | "booked" | "full";

type DateRange = {
  start: moment.Moment;
  end: moment.Moment;
};

type SessionTab = "all" | "private" | "group";

type ConfirmationStatus = "request" | "confirmed";

type BookingConfirmation = {
  title: string;
  subtitle: string;
  statusLabel: string;
  tone: ConfirmationStatus;
  lessonTitle: string;
  coachName: string;
  dateLabel: string;
  timeRange: string;
  locationLabel?: string;
  priceLabel?: string;
};

const isConfirmedLessonType = (lesson: Lesson) => {
  const normalizedType = (lesson.lesson_type_name || "").toLowerCase();
  const playerLimit = lesson.player_limit ?? 0;
  return normalizedType.includes("group") || normalizedType.includes("semi") || playerLimit > 1;
};

const buildConfirmationDetails = (lesson: Lesson, tone: ConfirmationStatus): BookingConfirmation => {
  const start = moment(lesson.start_date_time);
  const end = moment(lesson.end_date_time);
  const lessonTitle =
    lesson.metadata?.title || lesson.metadata_title || lesson.lesson_type_name || "Lesson session";
  const locationLabel = lesson.location_name || (lesson as { location?: string }).location;
  const priceLabel =
    typeof lesson.price_per_person === "number" ? `$${lesson.price_per_person.toFixed(2)}` : undefined;
  const copy =
    tone === "confirmed"
      ? {
          title: "You are confirmed",
          subtitle: "Your spot is locked in. We’ll see you on court!",
          statusLabel: "Booking confirmed",
        }
      : {
          title: "Lesson Request sent",
          subtitle: "Your request has been sent to your coach for confirmation.",
          statusLabel: "Awaiting coach response",
        };

  return {
    ...copy,
    tone,
    lessonTitle,
    coachName: lesson.coach_name || "Coach",
    dateLabel: start.format("dddd, MMM D"),
    timeRange: `${start.format("h:mm A")} – ${end.format("h:mm A")}`,
    locationLabel,
    priceLabel,
  };
};

interface CoachAvailabilitySlot {
  start_time: string;
  end_time: string;
  duration_minutes?: number;
  schedule_id?: number;
  location_id?: number | string;
  location?: string;
  court?: string | number | null;
}

interface CoachAvailabilityDay {
  date: string;
  day: string;
  slots: CoachAvailabilitySlot[];
}

interface CoachAvailability {
  coach_id: number;
  coach_name?: string;
  availability?: CoachAvailabilityDay[];
}

const SHOWCASE_DATE_RANGE: DateRange = {
  start: moment("2025-11-11T00:00:00-06:00"),
  end: moment("2025-11-12T23:59:59-06:00"),
};

const SHOWCASE_LESSONS: Lesson[] = [
  {
    id: 1101,
    coach_id: 501,
    coach_name: "Rafael O'Neill",
    location_id: 301,
    location_name: "Royal Oaks Country Club",
    start_date_time: "2025-11-11T09:00:00-06:00",
    end_date_time: "2025-11-11T10:00:00-06:00",
    player_limit: 8,
    current_player_count: 4,
    metadata: {
      title: "Junior Group Clinic",
      level: "3.0 – 3.5",
      description: "For players age 13-15 focusing on strategy and match play.",
    },
    lesson_type_name: "Group session",
    price_per_person: 45,
  },
  {
    id: 1102,
    coach_id: 502,
    coach_name: "Lena Martinez",
    location_id: 302,
    location_name: "Austin Tennis Academy",
    start_date_time: "2025-11-11T12:30:00-06:00",
    end_date_time: "2025-11-11T14:00:00-06:00",
    player_limit: 6,
    current_player_count: 4,
    metadata: {
      title: "Doubles Strategy Workshop",
      level: "4.0 – 4.5",
      description: "Sharpen your net play and transition game in match scenarios.",
    },
    lesson_type_name: "Group session",
    price_per_person: 60,
  },
  {
    id: 1103,
    coach_id: 503,
    coach_name: "Ava Thompson",
    location_id: 303,
    location_name: "Southwest Family YMCA",
    start_date_time: "2025-11-11T15:00:00-06:00",
    end_date_time: "2025-11-11T16:30:00-06:00",
    player_limit: 1,
    current_player_count: 1,
    metadata: {
      title: "Private Lesson with Coach Ava",
      level: "3.0",
      description: "Focus on serve consistency and match strategy with personalized drills.",
    },
    lesson_type_name: "Private lesson",
    price_per_person: 85,
    player_has_booking: true,
  },
  {
    id: 2101,
    coach_id: 601,
    coach_name: "Marcus Lin",
    location_id: 401,
    location_name: "Lost Creek Country Club",
    start_date_time: "2025-11-12T08:00:00-06:00",
    end_date_time: "2025-11-12T10:00:00-06:00",
    player_limit: 12,
    current_player_count: 6,
    metadata: {
      title: "Adult Live Ball Mixer",
      level: "3.0 – 4.0",
      description: "Fast-paced doubles-style drills with rotation and live ball points.",
    },
    lesson_type_name: "Group session",
    price_per_person: 55,
  },
  {
    id: 2102,
    coach_id: 602,
    coach_name: "Priya Desai",
    location_id: 402,
    location_name: "Westlake Athletic Club",
    start_date_time: "2025-11-12T11:00:00-06:00",
    end_date_time: "2025-11-12T12:00:00-06:00",
    player_limit: 14,
    current_player_count: 14,
    metadata: {
      title: "Cardio Tennis Blast",
      level: "All",
      description: "High-energy workout with music and point-based cardio drills.",
    },
    lesson_type_name: "Cardio tennis",
    price_per_person: 30,
  },
  {
    id: 2103,
    coach_id: 603,
    coach_name: "Daniel Harper",
    location_id: 403,
    location_name: "Mueller Lake Park Courts",
    start_date_time: "2025-11-12T18:30:00-06:00",
    end_date_time: "2025-11-12T20:00:00-06:00",
    player_limit: 10,
    current_player_count: 5,
    metadata: {
      title: "Beginner Skills & Drills",
      level: "2.5",
      description: "Build fundamentals with footwork, rally skills, and serve practice.",
    },
    lesson_type_name: "Group session",
    price_per_person: 40,
  },
];

const determineLessonStatus = (lesson: Lesson, bookings: Set<number>): LessonStatus => {
  if (lesson.player_has_booking || bookings.has(lesson.id)) {
    return "booked";
  }

  if (
    typeof lesson.player_limit === "number" &&
    lesson.player_limit > 0 &&
    typeof lesson.current_player_count === "number" &&
    lesson.current_player_count >= lesson.player_limit
  ) {
    return "full";
  }

  return "available";
};

const parseFilterId = (value: string) => {
  if (!value || value === "all") {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const formatLessonTitle = (lesson: Lesson) => {
  if (lesson.metadata?.title) return lesson.metadata.title;
  if (lesson.metadata_title) return lesson.metadata_title;
  if (lesson.lesson_type_name && lesson.coach_name) {
    return `${lesson.lesson_type_name} with ${lesson.coach_name}`;
  }
  if (lesson.lesson_type_name) {
    return lesson.lesson_type_name;
  }
  return `Lesson with ${lesson.coach_name}`;
};

const formatTimeRange = (start: Date, end: Date) => {
  const startText = moment(start).format("h:mm A");
  const endText = moment(end).format("h:mm A");
  return `${startText} – ${endText}`;
};

const formatDuration = (start: Date, end: Date) => {
  const minutes = Math.max(moment(end).diff(moment(start), "minutes"), 0);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hr${hours > 1 ? "s" : ""}`;
    }
    return `${minutes} min`;
  }
  return `${minutes} min`;
};

const statusCopy: Record<LessonStatus, { label: string; tone: "success" | "info" | "danger" }> = {
  available: { label: "Available", tone: "success" },
  booked: { label: "Booked", tone: "info" },
  full: { label: "Waitlist", tone: "danger" },
};
const formatScheduleSlot = (from?: string | null, to?: string | null) => {
  if (!from || !to) return "";
  const start = moment(from, "HH:mm:ss");
  const end = moment(to, "HH:mm:ss");
  if (!start.isValid() || !end.isValid()) return "";
  return `${start.format("h:mm A")} – ${end.format("h:mm A")}`;
};

const formatAvailabilityWindow = (startIso: string, endIso: string) => {
  const start = moment(startIso);
  const end = moment(endIso);
  if (!start.isValid() || !end.isValid()) {
    return "";
  }
  return `${start.format("MMM D, h:mm A")} – ${end.format("h:mm A")}`;
};

// Split a long availability window into 1-hour slots (HH:mm:ss format) for easier rendering.
const splitIntoSlots = (availability?: { from?: string | null; to?: string | null }) => {
  if (!availability?.from || !availability?.to) return [];
  const fromMoment = moment(availability.from, "HH:mm:ss");
  const toMoment = moment(availability.to, "HH:mm:ss");
  if (!fromMoment.isValid() || !toMoment.isValid() || !fromMoment.isBefore(toMoment)) return [];

  const slots: Array<{ startTime: string; endTime: string }> = [];
  let cursor = fromMoment.clone();
  while (cursor.isBefore(toMoment)) {
    const segmentEnd = cursor.clone().add(1, "hour");
    if (segmentEnd.isAfter(toMoment)) break;
    slots.push({
      startTime: cursor.format("HH:mm:ss"),
      endTime: segmentEnd.format("HH:mm:ss"),
    });
    cursor = segmentEnd;
  }
  return slots;
};

const PlayerCalendar = () => {
  const { user } = useAuth();

  const [rawLessons, setRawLessons] = useState<Lesson[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [distanceFilter, setDistanceFilter] = useState<string>("10");
  const [dateRange, setDateRange] = useState<DateRange>(() => getDefaultDateRange());
  const [playerBookings, setPlayerBookings] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [coachOptions, setCoachOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [coachOptionsLoading, setCoachOptionsLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [locationOptionsLoading, setLocationOptionsLoading] = useState(false);
  const [lessonTypeFilter, setLessonTypeFilter] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [rangeStartValue, setRangeStartValue] = useState("");
  const [rangeEndValue, setRangeEndValue] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [isShowcaseMode, setIsShowcaseMode] = useState(false);
  const [sessionTab, setSessionTab] = useState<SessionTab>("all");
  const [coachScheduleByDay, setCoachScheduleByDay] = useState<Record<string, CoachScheduleEntry[]>>({});
  const [coachScheduleLoading, setCoachScheduleLoading] = useState(false);
  const [apiCoachAvailability, setApiCoachAvailability] = useState<CoachAvailability[]>([]);
  const [requestSlot, setRequestSlot] = useState<{
    coachId: number;
    coachName: string;
    dayLabel: string;
    slot: {
      location?: string;
      locationId?: number;
      court?: number | string | null;
      apiStart?: string;
      apiEnd?: string;
      scheduleFrom?: string;
      scheduleTo?: string;
      scheduleDate?: string;
    };
  } | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestTimeRange, setRequestTimeRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null);

  const authToken = useMemo(
    () => getStoredAuthToken({ preferScheme: "token" }) ?? undefined,
    [user],
  );

  const applyShowcaseLessons = useCallback(() => {
    setIsShowcaseMode(true);
    setRawLessons(SHOWCASE_LESSONS);
    setPlayerBookings(
      SHOWCASE_LESSONS.filter((lesson) => Boolean(lesson.player_has_booking)).map((lesson) => lesson.id),
    );
    setApiCoachAvailability([]);
    const showcaseStartIso = SHOWCASE_DATE_RANGE.start.format("YYYY-MM-DD");
    const showcaseEndIso = SHOWCASE_DATE_RANGE.end.format("YYYY-MM-DD");
    setCustomDateRange({ start: showcaseStartIso, end: showcaseEndIso });
    setRangeStartValue(showcaseStartIso);
    setRangeEndValue(showcaseEndIso);
    setRangeError(null);
    setIsRangeOpen(false);
    setDateRange((current) => {
      const isStartAligned = current.start.isSame(SHOWCASE_DATE_RANGE.start, "day");
      const isEndAligned = current.end.isSame(SHOWCASE_DATE_RANGE.end, "day");

      if (isStartAligned && isEndAligned) {
        return current;
      }

      return {
        start: SHOWCASE_DATE_RANGE.start.clone(),
        end: SHOWCASE_DATE_RANGE.end.clone(),
      };
    });
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    const fetchCoaches = async () => {
      setCoachOptionsLoading(true);
      try {
        const coaches = await getPlayerCoaches({ perPage: 100 });
        if (cancelled) return;
        const options = coaches
          .map((coach: PlayerCoach) => {
            const fallbackName =
              coach.coach_name ||
              (coach as { full_name?: string }).full_name ||
              [coach.firstName, coach.lastName].filter(Boolean).join(" ").trim() ||
              `Coach #${coach.id}`;
            return {
              id: coach.id,
              name: fallbackName,
            };
          })
          .filter((option) => option.id && option.name);
        setCoachOptions(options);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load coaches", err);
        }
      } finally {
        if (!cancelled) {
          setCoachOptionsLoading(false);
        }
      }
    };

    fetchCoaches();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!coachFilter || coachFilter === "all") {
      setCoachScheduleByDay({});
      setCoachScheduleLoading(false);
      return;
    }

    const coachId = Number(coachFilter);
    if (Number.isNaN(coachId)) {
      setCoachScheduleByDay({});
      setCoachScheduleLoading(false);
      return;
    }

    const selectedDayName =
      selectedDay !== "all" && moment(selectedDay, moment.ISO_8601, true).isValid()
        ? moment(selectedDay).format("dddd").toUpperCase()
        : null;

    const parsedLocationId = parseFilterId(locationFilter);

    const fetchSchedule = async () => {
      setCoachScheduleLoading(true);
      try {
        if (selectedDayName) {
          try {
            const entries = await fetchCoachSchedule({
              token: authToken ?? "",
              coachId,
              day: selectedDayName,
            });
            if (cancelled) return;
            setCoachScheduleByDay({ [selectedDayName]: entries ?? [] });
          } catch (err) {
            const status = (err as Error & { status?: number }).status;
            if (status === 304) {
              setCoachScheduleByDay({ [selectedDayName]: [] });
            } else {
              throw err;
            }
          }
          return;
        }

        const responses = await Promise.all(
          WEEK_DAYS.map((day) =>
            parsedLocationId
              ? getCoachScheduleByIdAndLocation({ coachId, day, locationId: parsedLocationId })
              : getCoachScheduleById({ coachId, day }),
          ),
        );
        if (cancelled) return;
        const map: Record<string, CoachScheduleEntry[]> = {};
        responses.forEach((entries, index) => {
          map[WEEK_DAYS[index]] = entries ?? [];
        });
        setCoachScheduleByDay(map);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load coach schedule", err);
          setCoachScheduleByDay({});
        }
      } finally {
        if (!cancelled) {
          setCoachScheduleLoading(false);
        }
      }
    };

    fetchSchedule();

    return () => {
      cancelled = true;
    };
  }, [authToken, coachFilter, locationFilter, selectedDay]);

  useEffect(() => {
    let cancelled = false;

    const fetchLocations = async () => {
      setLocationOptionsLoading(true);
      try {
        const locations = await getCoachLocation({ page: 1, limit: 100 });
        if (cancelled) return;
        const options = locations
          .map((location: CoachLocation) => ({
            id: Number(location.id),
            name:
              location.name ||
              location.location ||
              location.location_name ||
              location.label ||
              location.court_name ||
              `Location #${location.id}`,
          }))
          .filter((option) => option.id && option.name);
        setLocationOptions(options);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load locations", err);
        }
      } finally {
        if (!cancelled) {
          setLocationOptionsLoading(false);
        }
      }
    };

    fetchLocations();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!authToken) {
      applyShowcaseLessons();
      setError(null);
      setLoading(false);
      return;
    }

    try {
      const coachIdParam = parseFilterId(coachFilter);
      const locationIdParam = parseFilterId(locationFilter);
      const levelParam = levelFilter && levelFilter !== "All" ? levelFilter : undefined;
      const selectedDayMoment =
        selectedDay !== "all" && moment(selectedDay, moment.ISO_8601, true).isValid()
          ? moment(selectedDay)
          : null;
      const [lessonsResponse, bookingsResponse, coachDayLessons] = await Promise.all([
        fetchAvailableLessons({
          token: authToken,
          start_date: dateRange.start.format("YYYY-MM-DD"),
          end_date: dateRange.end.format("YYYY-MM-DD"),
          search: searchQuery.trim() || undefined,
          coach_id: coachIdParam,
          location_id: locationIdParam,
          level: levelParam,
        }),
        fetchPlayerBookings({ token: authToken }),
        coachIdParam && selectedDayMoment
          ? fetchCoachLessonsByDate({
              token: authToken,
              coachId: coachIdParam,
              date: selectedDayMoment.format("YYYY-MM-DD"),
            }).catch((err) => {
              console.error("Failed to fetch coach lessons for date", err);
              return [];
            })
          : Promise.resolve([]),
      ]);

      const fetchedLessons = lessonsResponse?.data ?? [];
      const mergedLessons = (() => {
        if (!coachDayLessons?.length) return fetchedLessons;
        const merged = new Map<number | string, Lesson>();
        [...fetchedLessons, ...coachDayLessons].forEach((lesson) => {
          if (!lesson || (!lesson.id && lesson.id !== 0)) return;
          merged.set(lesson.id, lesson);
        });
        return Array.from(merged.values());
      })();
      const fetchedBookings = bookingsResponse?.data ?? [];
      const availabilityPayload = Array.isArray(
        (lessonsResponse as { availability_by_coach?: CoachAvailability[] })?.availability_by_coach,
      )
        ? ((lessonsResponse as { availability_by_coach?: CoachAvailability[] })?.availability_by_coach as CoachAvailability[])
        : [];

      if (!mergedLessons.length) {
        applyShowcaseLessons();
        setError("We couldn’t load live availability just yet, so here’s a sample schedule.");
        setApiCoachAvailability([]);
        return;
      }

      setIsShowcaseMode(false);
      setRawLessons(mergedLessons);
      setPlayerBookings(fetchedBookings);
      setApiCoachAvailability(availabilityPayload);
      setError(null);
    } catch (err) {
      console.error("Failed to load player calendar", err);
      applyShowcaseLessons();
      setApiCoachAvailability([]);
      setError("We couldn’t load live availability right now, so here’s a sample schedule.");
    } finally {
      setLoading(false);
    }
  }, [
    applyShowcaseLessons,
    authToken,
    coachFilter,
    dateRange.end,
    dateRange.start,
    levelFilter,
    locationFilter,
    searchQuery,
    selectedDay,
  ]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const fallbackCoachOptions = useMemo(() => {
    const seen = new Map<number, string>();
    rawLessons.forEach((lesson) => {
      if (!seen.has(lesson.coach_id)) {
        const label = lesson.coach_name || `Coach #${lesson.coach_id}`;
        seen.set(lesson.coach_id, label);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rawLessons]);

  const displayedCoachOptions = coachOptions.length ? coachOptions : fallbackCoachOptions;

  const fallbackLocationOptions = useMemo(() => {
    const seen = new Map<number, string>();
    rawLessons.forEach((lesson) => {
      if (lesson.location_id && !seen.has(lesson.location_id)) {
        seen.set(
          lesson.location_id,
          lesson.location_name || (lesson as { location?: string }).location || `Location #${lesson.location_id}`,
        );
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rawLessons]);

  const displayedLocationOptions = locationOptions.length ? locationOptions : fallbackLocationOptions;

  const selectedLocationLabel = useMemo(() => {
    if (locationOptionsLoading && displayedLocationOptions.length === 0) {
      return "Loading locations…";
    }
    if (locationFilter === "all") {
      return "All locations";
    }
    const match = displayedLocationOptions.find((option) => String(option.id) === locationFilter);
    return match?.name ?? "All locations";
  }, [displayedLocationOptions, locationFilter, locationOptionsLoading]);

  const bookingSet = useMemo(() => new Set(playerBookings), [playerBookings]);

  const dayOptions = useMemo(() => {
    const start = dateRange.start.clone();
    return Array.from({ length: 7 }, (_, index) => {
      const date = start.clone().add(index, "days");
      return {
        iso: date.format("YYYY-MM-DD"),
        weekday: date.format("dddd"),
        label: date.format("MMM D"),
      };
    });
  }, [dateRange.start]);

  const dateAnchors = useMemo(() => {
    const isoDates = rawLessons
      .map((lesson) => moment(lesson.start_date_time).format("YYYY-MM-DD"))
      .filter(Boolean)
      .sort();

    if (isoDates.length === 0) {
      const today = moment().startOf("day");
      return {
        start: today.format("YYYY-MM-DD"),
        end: today.clone().add(7, "days").format("YYYY-MM-DD"),
      };
    }

    const base = isoDates[0];
    const last = isoDates[isoDates.length - 1];
    const computedEnd = moment(base).add(7, "days").format("YYYY-MM-DD");
    const max = last > computedEnd ? last : computedEnd;

    return { start: base, end: max };
  }, [rawLessons]);

  const maxSelectableDate = dateAnchors.end;

  const customRangeSummary = useMemo(() => {
    if (!customDateRange) {
      return null;
    }
    const startLabel = moment(customDateRange.start).format("MMM D");
    const endLabel = moment(customDateRange.end).format("MMM D");
    return `${startLabel} – ${endLabel}`;
  }, [customDateRange]);

  const isCustomRangeActive = Boolean(customDateRange);

  useEffect(() => {
    setSelectedDay("all");
  }, [dateRange.start, dateRange.end]);

  const handleApplyRange = () => {
    if (!rangeStartValue || !rangeEndValue) {
      setRangeError("Select both a start and end date.");
      return;
    }

    if (rangeStartValue > rangeEndValue) {
      setRangeError("Start date must be before the end date.");
      return;
    }

    const startMoment = moment(rangeStartValue).startOf("day");
    const endMoment = moment(rangeEndValue).endOf("day");

    setRangeError(null);
    setCustomDateRange({ start: rangeStartValue, end: rangeEndValue });
    setDateRange({ start: startMoment, end: endMoment });
    setSelectedDay("all");
    setIsRangeOpen(false);
  };

  const handleClearRange = () => {
    setRangeStartValue("");
    setRangeEndValue("");
    setRangeError(null);
    setCustomDateRange(null);
    setDateRange(getDefaultDateRange());
    setSelectedDay("all");
    setIsRangeOpen(false);
  };

  const syncSessionTab = useCallback(
    (value: string) => {
      if (value === "private" || value === "group") {
        setSessionTab(value);
      } else {
        setSessionTab("all");
      }
    },
    [],
  );

  useEffect(() => {
    syncSessionTab(lessonTypeFilter);
  }, [lessonTypeFilter, syncSessionTab]);

  const filteredLessons = useMemo(() => {
    const coachId = coachFilter === "all" ? null : Number(coachFilter);
    const locationId = locationFilter === "all" ? null : Number(locationFilter);
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return rawLessons
      .filter((lesson) => {
        if (coachId && Number(lesson.coach_id) !== coachId) {
          return false;
        }
        if (locationId && Number(lesson.location_id) !== locationId) {
          return false;
        }
        if (levelFilter && levelFilter !== "All") {
          const lessonLevel = lesson.metadata?.level || lesson.metadata_level || "All";
          if (lessonLevel !== levelFilter) {
            return false;
          }
        }
        if (lessonTypeFilter !== "all") {
          const normalizedType = (lesson.lesson_type_name || "").toLowerCase();
          if (lessonTypeFilter === "private" && !normalizedType.includes("private")) {
            return false;
          }
          if (lessonTypeFilter === "group" && !normalizedType.includes("group")) {
            return false;
          }
        }
        if (selectedDay !== "all") {
          const lessonDayKey = moment(lesson.start_date_time).format("YYYY-MM-DD");
          if (lessonDayKey !== selectedDay) {
            return false;
          }
        }
        if (normalizedSearch) {
          const haystack = [
            formatLessonTitle(lesson),
            lesson.coach_name,
            lesson.location_name,
            lesson.metadata?.description,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(normalizedSearch)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => moment(a.start_date_time).diff(moment(b.start_date_time)));
  }, [coachFilter, lessonTypeFilter, levelFilter, locationFilter, rawLessons, searchQuery, selectedDay]);

  const lessonsByDate = useMemo(() => {
    const grouped = new Map<string, Lesson[]>();

    filteredLessons.forEach((lesson) => {
      const key = moment(lesson.start_date_time).format("YYYY-MM-DD");
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(lesson);
    });

    return Array.from(grouped.entries())
      .map(([key, lessons]) => ({
        key,
        date: moment(key, "YYYY-MM-DD").toDate(),
        lessons: lessons.sort((a, b) => moment(a.start_date_time).diff(moment(b.start_date_time))),
      }))
      .sort((a, b) => moment(a.date).diff(moment(b.date)));
  }, [filteredLessons]);

  const resolveScheduleDate = useCallback(
    (day: string) => {
      const normalizedDay = day.toUpperCase();
      if (selectedDay !== "all") {
        const selectedMoment = moment(selectedDay);
        if (selectedMoment.format("dddd").toUpperCase() === normalizedDay) {
          return selectedMoment.clone();
        }
      }
      const cursor = dateRange.start.clone();
      while (cursor.isSameOrBefore(dateRange.end, "day")) {
        if (cursor.format("dddd").toUpperCase() === normalizedDay) {
          return cursor.clone();
        }
        cursor.add(1, "day");
      }
      return null;
    },
    [dateRange.end, dateRange.start, selectedDay],
  );

  const selectedCoachName = useMemo(() => {
    if (coachFilter === "all") return null;
    const match = displayedCoachOptions.find((option) => String(option.id) === coachFilter);
    return match?.name ?? null;
  }, [coachFilter, displayedCoachOptions]);

  const derivedCoachSchedule = useMemo(() => {
    if (!coachFilter || coachFilter === "all") {
      return [];
    }
    return WEEK_DAYS.map((day) => {
      const entries = coachScheduleByDay[day] ?? [];
      const matchDate = resolveScheduleDate(day);
      const slots =
        entries
          .filter((entry) => entry.from && entry.to)
          .flatMap((entry) => {
            const baseId = entry.id ?? `${day}-${entry.from}-${entry.to}-${entry.location_id ?? "loc"}`;
            const locationId =
              typeof entry.location_id === "number"
                ? entry.location_id
                : entry.location_id !== undefined
                  ? Number(entry.location_id)
                  : undefined;
            const segments = splitIntoSlots({ from: entry.from, to: entry.to });
            const segmentList =
              segments.length > 0
                ? segments
                : [
                    {
                      startTime: entry.from,
                      endTime: entry.to,
                    },
                  ];
            return segmentList.map((segment, index) => ({
              id: `${baseId}-seg-${index}`,
              from: segment.startTime,
              to: segment.endTime,
              location: entry.location || entry.location_name || "",
              locationId,
              court: entry.court,
            }));
          }) ?? [];
      return {
        day,
        label: day.charAt(0) + day.slice(1).toLowerCase(),
        matchDate,
        slots,
      };
    }).filter((entry) => entry.slots.length > 0);
  }, [coachFilter, coachScheduleByDay, resolveScheduleDate]);

  const availabilityCards = useMemo(() => {
    const buildFromApi = (collection: CoachAvailability[]) =>
      collection
        .map((coach) => ({
          coachId: coach.coach_id,
          coachName: coach.coach_name || `Coach #${coach.coach_id}`,
          source: "api" as const,
          days:
            coach.availability
              ?.map((day) => ({
                label: day.day || moment(day.date).format("dddd"),
                date: day.date,
                slots:
                  day.slots?.map((slot, index) => ({
                    id: slot.schedule_id ?? `${coach.coach_id}-${day.date}-${index}`,
                    primaryLabel: formatAvailabilityWindow(slot.start_time, slot.end_time),
                    location: slot.location,
                    locationId:
                      typeof slot.location_id === "number"
                        ? slot.location_id
                        : slot.location_id
                          ? Number(slot.location_id)
                          : undefined,
                    court: slot.court,
                    apiStart: slot.start_time,
                    apiEnd: slot.end_time,
                  })) ?? [],
              }))
              .filter((day) => day.slots.length > 0) ?? [],
        }))
        .filter((card) => card.days.length > 0);

    const filteredApi =
      coachFilter === "all"
        ? apiCoachAvailability
        : apiCoachAvailability.filter((coach) => String(coach.coach_id) === coachFilter);
    const apiCards = buildFromApi(filteredApi);
    if (apiCards.length) {
      return apiCards;
    }

    if (coachFilter !== "all" && derivedCoachSchedule.length) {
      const coachIdNumeric = parseFilterId(coachFilter);
      if (!coachIdNumeric) return [];
      return [
        {
          coachId: coachIdNumeric,
          coachName: selectedCoachName ?? `Coach #${coachIdNumeric}`,
          source: "schedule" as const,
          days: derivedCoachSchedule.map((day) => ({
            label: day.label,
            date: day.matchDate?.format("YYYY-MM-DD"),
            slots: day.slots.map((slot) => ({
              id: slot.id,
              primaryLabel: day.matchDate
                ? `${day.matchDate.format("MMM D")} • ${formatScheduleSlot(slot.from, slot.to)}`
                : formatScheduleSlot(slot.from, slot.to),
              location: slot.location,
              locationId:
                typeof slot.locationId === "number"
                  ? slot.locationId
                  : slot.locationId
                    ? Number(slot.locationId)
                    : undefined,
              court: slot.court,
              scheduleFrom: slot.from,
              scheduleTo: slot.to,
              scheduleDate: day.matchDate?.format("YYYY-MM-DD"),
            })),
          })),
        },
      ];
    }

    return [];
  }, [apiCoachAvailability, coachFilter, derivedCoachSchedule, selectedCoachName]);

  const handleRequestSlot = useCallback(
    (
      card: {
        coachId: number;
        coachName: string;
      },
      dayEntry: { label: string; date?: string },
      slot: {
        location?: string;
        locationId?: number;
        court?: number | string | null;
        apiStart?: string;
        apiEnd?: string;
        scheduleFrom?: string;
        scheduleTo?: string;
        scheduleDate?: string;
      },
    ) => {
      if (!authToken) {
        window.alert("You need to be logged in to request a private lesson.");
        return;
      }
      if (!slot.locationId) {
        window.alert("This availability slot is missing a location.");
        return;
      }
      const hasApiTimes = slot.apiStart && slot.apiEnd;
      const hasScheduleTimes = slot.scheduleFrom && slot.scheduleTo && (slot.scheduleDate || dayEntry.date);
      if (!hasApiTimes && !hasScheduleTimes) {
        window.alert("This availability slot is missing time information.");
        return;
      }
      const initialStart = slot.apiStart
        ? moment(slot.apiStart).format("HH:mm")
        : slot.scheduleFrom
          ? slot.scheduleFrom.slice(0, 5)
          : "";
      const initialEnd = slot.apiEnd
        ? moment(slot.apiEnd).format("HH:mm")
        : slot.scheduleTo
          ? slot.scheduleTo.slice(0, 5)
          : "";
      setRequestError(null);
      setRequestSlot({
        coachId: card.coachId,
        coachName: card.coachName,
        dayLabel: dayEntry.label,
        slot: {
          location: slot.location,
          locationId: slot.locationId,
          court: slot.court,
          apiStart: slot.apiStart,
          apiEnd: slot.apiEnd,
          scheduleFrom: slot.scheduleFrom,
          scheduleTo: slot.scheduleTo,
          scheduleDate: slot.scheduleDate || dayEntry.date,
        },
      });
      setRequestTimeRange({
        start: initialStart,
        end: initialEnd,
      });
      setRequestModalOpen(true);
    },
    [authToken],
  );

  const openLessonModal = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setBookingModalOpen(true);
  };

  const closeModal = () => {
    setBookingModalOpen(false);
    setSelectedLesson(null);
  };

  const refetchLessons = async () => {
    await loadLessons();
    closeModal();
  };

  const handleBookLesson = async () => {
    if (!selectedLesson || !authToken) return;
    const lesson = selectedLesson;
    setMutationLoading(true);
    try {
      await bookLesson({ lessonId: lesson.id, token: authToken });
      const tone: ConfirmationStatus = isConfirmedLessonType(lesson) ? "confirmed" : "request";
      const confirmationDetails = buildConfirmationDetails(lesson, tone);
      await loadLessons();
      closeModal();
      setBookingConfirmation(confirmationDetails);
      setMutationLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to book lesson.";
      window.alert(message);
      setMutationLoading(false);
    }
  };

  const handleCancelLesson = async () => {
    if (!selectedLesson || !authToken) return;
    setMutationLoading(true);
    try {
      await cancelBooking({ lessonId: selectedLesson.id, token: authToken });
      window.alert("Booking cancelled.");
      await refetchLessons();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to cancel booking.";
      window.alert(message);
      setMutationLoading(false);
    }
  };

  const handleRequestLessonSubmit = async () => {
    if (!requestSlot || !authToken) return;
    const { slot, coachId } = requestSlot;
    if (!slot.locationId) {
      setRequestError("Location is required to request a lesson.");
      return;
    }
    if (!requestTimeRange.start || !requestTimeRange.end) {
      setRequestError("Select a start and end time.");
      return;
    }

    let startLocal: moment.Moment | null = null;
    let endLocal: moment.Moment | null = null;

    const windowDate = slot.scheduleDate
      ? slot.scheduleDate
      : slot.apiStart
        ? moment(slot.apiStart).format("YYYY-MM-DD")
        : null;

    const selectedDate = windowDate ?? moment().format("YYYY-MM-DD");
    startLocal = moment(`${selectedDate} ${requestTimeRange.start}`, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"]);
    endLocal = moment(`${selectedDate} ${requestTimeRange.end}`, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"]);

    if (!startLocal || !endLocal || !startLocal.isValid() || !endLocal.isValid()) {
      setRequestError("Unable to parse schedule time.");
      return;
    }

    const windowStart = slot.apiStart
      ? moment(slot.apiStart)
      : slot.scheduleFrom && windowDate
        ? moment(`${windowDate} ${slot.scheduleFrom}`, "YYYY-MM-DD HH:mm:ss")
        : null;
    const windowEnd = slot.apiEnd
      ? moment(slot.apiEnd)
      : slot.scheduleTo && windowDate
        ? moment(`${windowDate} ${slot.scheduleTo}`, "YYYY-MM-DD HH:mm:ss")
        : null;

    if (endLocal.isSameOrBefore(startLocal)) {
      setRequestError("End time must be after start time.");
      return;
    }

    if (windowStart && startLocal.isBefore(windowStart)) {
      setRequestError("Start time must be within the coach’s availability window.");
      return;
    }
    if (windowEnd && endLocal.isAfter(windowEnd)) {
      setRequestError("End time must be within the coach’s availability window.");
      return;
    }

    const startUtc = moment.utc(startLocal).toISOString();
    const endUtc = moment.utc(endLocal).toISOString();
    const startTz = startLocal.toISOString();
    const endTz = endLocal.toISOString();

    setRequestLoading(true);
    setRequestError(null);
    try {
      await requestPrivateLesson({
        token: authToken,
        coachId,
        startDateTime: startUtc,
        endDateTime: endUtc,
        startDateTimeTz: startTz,
        endDateTimeTz: endTz,
        locationId: slot.locationId,
        court: slot.court ?? 0,
      });
      const requestLesson: Lesson = {
        id: 0,
        coach_id: coachId,
        coach_name: requestSlot.coachName,
        location_id: Number(slot.locationId),
        location_name: slot.location || "Location TBD",
        start_date_time: startLocal.toISOString(),
        end_date_time: endLocal.toISOString(),
        lesson_type_name: "Private lesson",
      };
      setBookingConfirmation(buildConfirmationDetails(requestLesson, "request"));
      setRequestModalOpen(false);
      setRequestSlot(null);
      setRequestTimeRange({ start: "", end: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send request.";
      setRequestError(message);
    } finally {
      setRequestLoading(false);
    }
  };

  const spotsRemaining = useMemo(() => {
    if (!selectedLesson || typeof selectedLesson.player_limit !== "number") {
      return null;
    }
    const taken = selectedLesson.current_player_count ?? 0;
    return Math.max(selectedLesson.player_limit - taken, 0);
  }, [selectedLesson]);

  const modalLessonStatus = selectedLesson ? determineLessonStatus(selectedLesson, bookingSet) : null;

  const renderLessonCard = (lesson: Lesson) => {
    const status = determineLessonStatus(lesson, bookingSet);
    const statusInfo = statusCopy[status];
    const start = moment(lesson.start_date_time).toDate();
    const end = moment(lesson.end_date_time).toDate();
    const duration = formatDuration(start, end);
    const locationLabel = lesson.location_name || (lesson as { location?: string }).location || "Location TBD";
    const levelValue = lesson.metadata?.level || lesson.metadata_level || "All";
    const normalizedLevelLabel = (() => {
      const trimmed = levelValue?.trim();
      if (!trimmed) return "";
      if (/^all$/i.test(trimmed)) return "All levels";
      return trimmed.toLowerCase().startsWith("level") ? trimmed : `Level ${trimmed}`;
    })();
    const sessionTypeLabel = lesson.lesson_type_name
      ? lesson.lesson_type_name.charAt(0).toUpperCase() + lesson.lesson_type_name.slice(1)
      : "";
    const spots =
      typeof lesson.player_limit === "number"
        ? Math.max((lesson.player_limit ?? 0) - (lesson.current_player_count ?? 0), 0)
        : null;
    const spotsLabel =
      spots === null ? null : spots > 0 ? `${spots} spot${spots === 1 ? "" : "s"} left` : "Waitlist available";
    const buttonCopy =
      status === "booked" ? "Manage booking" : status === "full" ? "Join waitlist" : "Reserve spot";

    return (
      <div key={lesson.id} className="player-calendar__session">
        <div className="player-calendar__session-time">
          <span className="player-calendar__session-time-label">{moment(start).format("h:mm A")}</span>
          <span className="player-calendar__session-duration">{duration}</span>
        </div>
        <div className="player-calendar__session-card">
          <LessonDetailCard
            lesson={lesson}
            statusLabel={statusInfo.label}
            onShare={() => openLessonModal(lesson)}
            currentUserId={user?.session?.user_id ?? user?.id}
          />
          <div className="player-calendar__session-cta">
            {typeof lesson.price_per_person === "number" ? (
              <p className="player-calendar__session-price">
                ${lesson.price_per_person.toFixed(2)}
                <span>per player</span>
              </p>
            ) : null}
            <button
              type="button"
              className={`player-calendar__session-button player-calendar__session-button--${status}`}
              onClick={() => openLessonModal(lesson)}
            >
              {buttonCopy}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="find-coaches-page player-calendar-page" style={themeVars}>
        <div className="find-coaches-page__inner player-calendar-page__inner">
          <ResultsHeader
            title="Calendar"
            description="Browse upcoming tennis matches, lessons, and group sessions near you."
          />

          <section className="fc-filter player-calendar__filter-card" aria-label="Filter upcoming sessions">
            <div className="fc-filter__distance-row player-calendar__distance-row">
              <div className="fc-filter__distance-group player-calendar__distance-group">
                <label
                  className="player-calendar__location-control"
                  title={selectedLocationLabel}
                >
                  <span className="fc-distance-chip fc-distance-chip--location group-lessons-filter__location player-calendar__location-chip">
                    <MapPin size={18} aria-hidden />
                    <span>{selectedLocationLabel}</span>
                  </span>
                  <select
                    aria-label="Filter by location"
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    disabled={locationOptionsLoading && !displayedLocationOptions.length}
                    className="player-calendar__location-native"
                  >
                    <option value="all">All locations</option>
                    {displayedLocationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                    {locationOptionsLoading && displayedLocationOptions.length === 0 ? (
                      <option value="" disabled>
                        Loading locations…
                      </option>
                    ) : null}
                  </select>
                </label>
                {DISTANCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`fc-distance-chip${distanceFilter === option.value ? " fc-distance-chip--active" : ""}`}
                    onClick={() => setDistanceFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <form
              className="fc-filter__form player-calendar__filter-form"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchQuery((current) => current.trim());
              }}
            >
              <div className="fc-filter__search player-calendar__search">
                <SearchIcon className="fc-filter__search-icon" size={18} strokeWidth={2} />
                <input
                  type="search"
                  placeholder="Search calendar events..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-label="Search calendar"
                />
              </div>
              <div className="player-calendar__selects">
                <div className="fc-select player-calendar__select">
                  <select
                    className="fc-select__field"
                    value={lessonTypeFilter}
                    onChange={(event) => {
                      setLessonTypeFilter(event.target.value);
                      syncSessionTab(event.target.value);
                    }}
                    aria-label="Filter by session type"
                  >
                    {LESSON_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="fc-select__icon" aria-hidden="true" />
                </div>
                <div className="fc-select player-calendar__select">
                  <select
                    className="fc-select__field"
                    value={coachFilter}
                    onChange={(event) => setCoachFilter(event.target.value)}
                    disabled={coachOptionsLoading && !displayedCoachOptions.length}
                    aria-label="Filter by coach"
                  >
                    <option value="all">All coaches</option>
                    {displayedCoachOptions.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.name}
                      </option>
                    ))}
                    {coachOptionsLoading && displayedCoachOptions.length === 0 ? (
                      <option value="" disabled>
                        Loading coaches…
                      </option>
                    ) : null}
                  </select>
                  <ChevronDown size={16} className="fc-select__icon" aria-hidden="true" />
                </div>
                <div className="fc-select player-calendar__select">
                  <select
                    className="fc-select__field"
                    value={levelFilter}
                    onChange={(event) => setLevelFilter(event.target.value)}
                    aria-label="Filter by level"
                  >
                    {LESSON_LEVELS.map((level) => (
                      <option key={level.id} value={level.name}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="fc-select__icon" aria-hidden="true" />
                </div>
              </div>
            </form>

            <div className="player-calendar__tabs" role="tablist" aria-label="Session type">
              {[
                { key: "all", label: "All" },
                { key: "private", label: "Private" },
                { key: "group", label: "Group" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={sessionTab === tab.key}
                  className={`player-calendar__tab${sessionTab === tab.key ? " player-calendar__tab--active" : ""}`}
                  onClick={() => {
                    const value = tab.key as SessionTab;
                    setSessionTab(value);
                    setLessonTypeFilter(value);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          <section className="group-lessons-day-filter player-calendar__day-filter" role="region" aria-label="Filter sessions by day">
            <div className="group-lessons-day-filter__controls">
              <div className="group-lessons-day-filter__quick">
                <button
                  type="button"
                  className={`group-lessons-day-filter__pill${
                    selectedDay === "all" ? " group-lessons-day-filter__pill--active" : ""
                  }`}
                  aria-pressed={selectedDay === "all"}
                  onClick={() => {
                    setSelectedDay("all");
                    setCustomDateRange(null);
                    setRangeStartValue("");
                    setRangeEndValue("");
                    setRangeError(null);
                    setIsRangeOpen(false);
                  }}
                >
                  <span className="group-lessons-day-filter__day">All days</span>
                </button>
                {dayOptions.map((option) => (
                  <button
                    key={option.iso}
                    type="button"
                    className={`group-lessons-day-filter__pill${
                      selectedDay === option.iso ? " group-lessons-day-filter__pill--active" : ""
                    }`}
                    aria-pressed={selectedDay === option.iso}
                    onClick={() => {
                      setSelectedDay(option.iso);
                      setCustomDateRange(null);
                      setRangeStartValue(option.iso);
                      setRangeEndValue(option.iso);
                      setRangeError(null);
                      setIsRangeOpen(false);
                    }}
                  >
                    <span className="group-lessons-day-filter__day">{option.weekday}</span>
                    <span className="group-lessons-day-filter__date">{option.label}</span>
                  </button>
                ))}
              </div>
              <div className="group-lessons-day-filter__actions">
                <button
                  type="button"
                  className={`group-lessons-day-filter__range-toggle${
                    isRangeOpen || isCustomRangeActive ? " group-lessons-day-filter__range-toggle--active" : ""
                  }`}
                  aria-expanded={isRangeOpen}
                  onClick={() => {
                    if (!isRangeOpen) {
                      const startIso = customDateRange?.start ?? dateRange.start.format("YYYY-MM-DD");
                      const endIso = customDateRange?.end ?? dateRange.end.format("YYYY-MM-DD");
                      setRangeStartValue(startIso);
                      setRangeEndValue(endIso);
                      setRangeError(null);
                    }
                    setIsRangeOpen((open) => !open);
                  }}
                >
                  {customRangeSummary ? `Custom range: ${customRangeSummary}` : "Choose dates"}
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
                        setRangeError(null);
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
                        setRangeError(null);
                      }}
                    />
                  </label>
                </div>
                <p className="group-lessons-date-range__hint">
                  {rangeStartValue && rangeEndValue
                    ? `Showing availability from ${moment(rangeStartValue).format("MMM D")} to ${moment(rangeEndValue).format("MMM D")}.`
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
          </section>

          <div className="player-calendar__content">
            {error ? (
              <div className="player-calendar__alert" role="status">
                {error}
              </div>
            ) : null}

            <section className="player-calendar__summary" aria-live="polite">
              <div className="player-calendar__summary-copy">
                <h2>Available sessions nearby</h2>
                <p>
                  {loading
                    ? "Loading sessions…"
                    : `${filteredLessons.length} session${filteredLessons.length === 1 ? "" : "s"} match your filters.`}
                </p>
              </div>
              <div className="player-calendar__summary-meta">
                <span className="player-calendar__summary-sort">Sorted by soonest start time</span>
                <div className="player-calendar__legend" aria-label="Session status legend">
                  <span>
                    <span className="player-calendar__legend-dot player-calendar__legend-dot--success" /> Available
                  </span>
                  <span>
                    <span className="player-calendar__legend-dot player-calendar__legend-dot--info" /> Booked
                  </span>
                  <span>
                    <span className="player-calendar__legend-dot player-calendar__legend-dot--danger" /> Waitlist
                  </span>
                </div>
              </div>
            </section>

            {availabilityCards.length ? (
              <section className="player-calendar__availability" aria-label="Coach availability">
                <div className="player-calendar__availability-header">
                  <h3>
                    {coachFilter === "all"
                      ? "Coach availability"
                      : `Availability for ${availabilityCards[0]?.coachName ?? selectedCoachName ?? `Coach #${coachFilter}`}`}
                  </h3>
                  {coachFilter === "all" ? (
                    <p>
                      Showing {availabilityCards.length} coach{availabilityCards.length === 1 ? "" : "es"} between{" "}
                      {dateRange.start.format("MMM D")} and {dateRange.end.format("MMM D")}.
                    </p>
                  ) : locationFilter !== "all" ? (
                    <p>Filtered to {selectedLocationLabel}</p>
                  ) : null}
                </div>
                {coachFilter !== "all" && availabilityCards[0]?.source === "schedule" && coachScheduleLoading ? (
                  <div className="player-calendar__loading">Loading coach availability…</div>
                ) : (
                  <div className="player-calendar__availability-grid">
                    {availabilityCards.map((card) => (
                      <article key={card.coachId} className="player-calendar__availability-card">
                        <header>
                          <h4>{card.coachName}</h4>
                          <span>
                            {card.days.length} day{card.days.length === 1 ? "" : "s"}
                          </span>
                        </header>
                        <div className="player-calendar__availability-days">
                          {card.days.map((day) => (
                            <div key={`${card.coachId}-${day.label}-${day.date ?? "na"}`} className="player-calendar__availability-day">
                              <div className="player-calendar__availability-day-label">
                                <strong>{day.label}</strong>
                                <span>{day.date ? moment(day.date).format("MMM D") : ""}</span>
                              </div>
                              <ul>
                                {day.slots.map((slot) => (
                                  <li key={slot.id}>
                                    <span>{slot.primaryLabel}</span>
                                    {slot.location ? <span>{slot.location}</span> : null}
                                    {slot.court ? <span>Court {slot.court}</span> : null}
                                    <button
                                      type="button"
                                      className="player-calendar__availability-action"
                                      onClick={() => handleRequestSlot(card, day, slot)}
                                    >
                                      Request private lesson
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : coachFilter !== "all" ? (
              <section className="player-calendar__availability" aria-label="Coach availability">
                <div className="player-calendar__availability-header">
                  <h3>Availability for {selectedCoachName ?? `Coach #${coachFilter}`}</h3>
                </div>
                {coachScheduleLoading ? (
                  <div className="player-calendar__loading">Loading coach availability…</div>
                ) : (
                  <p className="player-calendar__empty">No availability published for this coach in the selected range.</p>
                )}
              </section>
            ) : null}

            <div className="player-calendar__days">
              {loading ? (
                <div className="player-calendar__loading">Loading lessons…</div>
              ) : lessonsByDate.length === 0 ? (
                <div className="player-calendar__empty">
                  <p>No sessions match your filters in this date range.</p>
                </div>
              ) : (
                lessonsByDate.map((entry) => (
                  <section key={entry.key} className="player-calendar__day">
                    <header className="player-calendar__day-header">
                      <div>
                        <h3>{moment(entry.date).format("dddd, MMMM D, YYYY")}</h3>
                        <p>
                          {entry.lessons.length} session{entry.lessons.length === 1 ? "" : "s"} within your filters
                        </p>
                      </div>
                    </header>
                    <div className="player-calendar__sessions-list">
                      {entry.lessons.map((lesson) => renderLessonCard(lesson))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {bookingModalOpen && selectedLesson ? (
        <div role="dialog" aria-modal="true" className="player-calendar__modal">
          <div className="player-calendar__modal-card">
            <div className="player-calendar__modal-header">
              <div className="player-calendar__modal-header-row">
                <div>
                  <h2>{formatLessonTitle(selectedLesson)}</h2>
                  <p>
                    {moment(selectedLesson.start_date_time).format("dddd, MMM D • h:mm A")} – {moment(selectedLesson.end_date_time).format("h:mm A")}
                  </p>
                </div>
                <button type="button" onClick={closeModal} aria-label="Close booking modal" className="player-calendar__close-btn">
                  ×
                </button>
              </div>
            </div>
            <div className="player-calendar__modal-body">
              <div className="player-calendar__modal-row">
                <span>Coach</span>
                <span>{selectedLesson.coach_name}</span>
              </div>
              {selectedLesson.location_name ? (
                <div className="player-calendar__modal-row">
                  <span>Location</span>
                  <span>{selectedLesson.location_name}</span>
                </div>
              ) : null}
              <div className="player-calendar__modal-row">
                <span>Level</span>
                <span>{selectedLesson.metadata?.level || selectedLesson.metadata_level || "All"}</span>
              </div>
              {selectedLesson.metadata?.description ? (
                <div className="player-calendar__modal-description">
                  <span>About this session</span>
                  <p>{selectedLesson.metadata.description}</p>
                </div>
              ) : null}
              {typeof selectedLesson.price_per_person === "number" ? (
                <div className="player-calendar__modal-row">
                  <span>Price</span>
                  <span>${selectedLesson.price_per_person.toFixed(2)}</span>
                </div>
              ) : null}
              {spotsRemaining !== null ? (
                <div className="player-calendar__modal-row">
                  <span>Spots remaining</span>
                  <span>{spotsRemaining}</span>
                </div>
              ) : null}
            </div>
            <div className="player-calendar__modal-footer">
              <button type="button" className="player-calendar__modal-secondary" onClick={closeModal} disabled={mutationLoading}>
                Close
              </button>
              {modalLessonStatus === "booked" ? (
                <button
                  type="button"
                  className="player-calendar__modal-danger"
                  onClick={handleCancelLesson}
                  disabled={mutationLoading}
                >
                  {mutationLoading ? "Cancelling..." : "Cancel Booking"}
                </button>
              ) : (
                <button
                  type="button"
                  className={`player-calendar__modal-primary player-calendar__modal-primary--${modalLessonStatus ?? "available"}`}
                  onClick={handleBookLesson}
                  disabled={mutationLoading || modalLessonStatus === "full"}
                >
                  {modalLessonStatus === "full"
                    ? "Lesson Full"
                    : mutationLoading
                      ? "Booking..."
                      : "Book Lesson"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {requestModalOpen && requestSlot ? (
        <div role="dialog" aria-modal="true" className="player-calendar__modal">
          <div className="player-calendar__modal-card">
            <div className="player-calendar__modal-header">
              <div className="player-calendar__modal-header-row">
                <div>
                  <h2>Request a lesson with {requestSlot.coachName}</h2>
                  <p>
                    {(() => {
                      if (requestSlot.slot.apiStart && requestSlot.slot.apiEnd) {
                        return formatAvailabilityWindow(requestSlot.slot.apiStart, requestSlot.slot.apiEnd);
                      }
                      if (requestSlot.slot.scheduleDate && requestSlot.slot.scheduleFrom && requestSlot.slot.scheduleTo) {
                        return `${moment(requestSlot.slot.scheduleDate).format("dddd, MMM D")} • ${formatScheduleSlot(requestSlot.slot.scheduleFrom, requestSlot.slot.scheduleTo)}`;
                      }
                      return requestSlot.dayLabel;
                    })()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRequestModalOpen(false);
                    setRequestSlot(null);
                    setRequestError(null);
                    setRequestTimeRange({ start: "", end: "" });
                  }}
                  aria-label="Close request modal"
                  className="player-calendar__close-btn"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="player-calendar__modal-body">
              <div className="player-calendar__modal-row">
                <span>Location</span>
                <span>{requestSlot.slot.location || "Location TBD"}</span>
              </div>
              {requestSlot.slot.court ? (
                <div className="player-calendar__modal-row">
                  <span>Court</span>
                  <span>{requestSlot.slot.court}</span>
                </div>
              ) : null}
              <div className="player-calendar__modal-row">
                <span>Status</span>
                <span>Will be sent to coach for confirmation</span>
              </div>
              <div className="player-calendar__modal-row player-calendar__modal-row--inputs">
                <label className="player-calendar__field">
                  <span>Start time</span>
                  <input
                    type="time"
                    value={requestTimeRange.start}
                    onChange={(event) =>
                      setRequestTimeRange((prev) => ({
                        ...prev,
                        start: event.target.value,
                      }))
                    }
                    aria-label="Select lesson start time"
                  />
                </label>
                <label className="player-calendar__field">
                  <span>End time</span>
                  <input
                    type="time"
                    value={requestTimeRange.end}
                    onChange={(event) =>
                      setRequestTimeRange((prev) => ({
                        ...prev,
                        end: event.target.value,
                      }))
                    }
                    aria-label="Select lesson end time"
                  />
                </label>
              </div>
              {requestError ? (
                <div className="player-calendar__alert" role="alert">
                  {requestError}
                </div>
              ) : null}
            </div>
            <div className="player-calendar__modal-footer">
              <button
                type="button"
                className="player-calendar__modal-secondary"
                onClick={() => {
                  setRequestModalOpen(false);
                  setRequestSlot(null);
                  setRequestError(null);
                  setRequestTimeRange({ start: "", end: "" });
                }}
                disabled={requestLoading}
              >
                Close
              </button>
              <button
                type="button"
                className="player-calendar__modal-primary"
                onClick={handleRequestLessonSubmit}
                disabled={requestLoading}
              >
                {requestLoading ? "Sending..." : "Send request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bookingConfirmation ? (
        <div role="dialog" aria-modal="true" className="player-calendar__modal">
          <div className="player-calendar__modal-card">
            <div className="player-calendar__modal-header">
              <div className="player-calendar__modal-header-row">
                <div>
                  <h2>{bookingConfirmation.title}</h2>
                  <p>{bookingConfirmation.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingConfirmation(null)}
                  aria-label="Close confirmation modal"
                  className="player-calendar__close-btn"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="player-calendar__modal-body">
              <div className={`player-calendar__confirmation-status player-calendar__confirmation-status--${bookingConfirmation.tone}`}>
                <span>{bookingConfirmation.statusLabel}</span>
              </div>
              <div className="player-calendar__modal-row">
                <span>Coach</span>
                <span>{bookingConfirmation.coachName}</span>
              </div>
              <div className="player-calendar__modal-row">
                <span>Session</span>
                <span>{bookingConfirmation.lessonTitle}</span>
              </div>
              <div className="player-calendar__modal-row">
                <span>Date</span>
                <span>{bookingConfirmation.dateLabel}</span>
              </div>
              <div className="player-calendar__modal-row">
                <span>Time</span>
                <span>{bookingConfirmation.timeRange}</span>
              </div>
              {bookingConfirmation.locationLabel ? (
                <div className="player-calendar__modal-row">
                  <span>Location</span>
                  <span>{bookingConfirmation.locationLabel}</span>
                </div>
              ) : null}
              {bookingConfirmation.priceLabel ? (
                <div className="player-calendar__modal-row">
                  <span>Price</span>
                  <span>{bookingConfirmation.priceLabel}</span>
                </div>
              ) : null}
            </div>
            <div className="player-calendar__modal-footer">
              <button type="button" className="player-calendar__modal-primary" onClick={() => setBookingConfirmation(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
};

export default PlayerCalendar;
