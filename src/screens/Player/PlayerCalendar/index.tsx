import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  Calendar,
  momentLocalizer,
  type Event as RBCEvent,
  type EventProps as RBEventProps,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./index.css";

import {
  bookLesson,
  cancelBooking,
  fetchAvailableLessons,
  fetchPlayerBookings,
  type Lesson as ApiLesson,
} from "../../../api/playerLessons";
import {
  getPlayerCoaches,
  getCoachLocation,
  getCoachLessonsById,
  getCoachScheduleById,
  getCoachScheduleByIdAndLocation,
  type PlayerCoach,
  type CoachLocation,
  type CoachScheduleEntry,
} from "../../../api/playerCalendar";
import { useAuth } from "../../../context/AuthContext";
import { getStoredAuthToken } from "../../../services/authToken";

const localizer = momentLocalizer(moment);

const LESSON_LEVELS = [
  { id: 0, name: "All", description: "" },
  { id: 1, name: "Beginner (NTRP 2.5)", description: "Just getting started in the game" },
  { id: 2, name: "Advanced Beginner (NTRP 3.0)", description: "I can rally but my strokes are not consistent yet" },
  { id: 3, name: "Intermediate (NTRP 3.5)", description: "I can hit with spin and direction most of the time" },
  { id: 4, name: "Advanced (NTRP 4.0)", description: "I can consistently rally with spin, direction, and pace" },
  { id: 5, name: "Advanced Plus (NTRP 4.5)", description: "I have control over my shots and hit consistently with depth and pace" },
  { id: 6, name: "Expert (NTRP 5.0)", description: "I have competitive experience and advanced skill levels" },
] as const;

export interface Lesson extends ApiLesson {}

export type EventType = "available" | "booked" | "full";

export interface LessonEvent extends Omit<RBCEvent, "resource"> {
  resource: Lesson;
  type: EventType;
}

interface AvailabilityColors {
  background: string;
  border: string;
  text: string;
}

export interface AvailabilityEvent extends Omit<RBCEvent, "resource"> {
  resource: CoachScheduleEntry & { occurrenceDate: string; availabilityColors: AvailabilityColors };
  type: "availability";
}

type CalendarEvent = LessonEvent | AvailabilityEvent;

const isAvailabilityEvent = (event: CalendarEvent): event is AvailabilityEvent => event.type === "availability";

const WEEK_DAYS: Array<"MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"> = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const determineEventType = (lesson: Lesson, bookings: Set<number>): EventType => {
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

const colorDot = (color: string) => ({
  width: "12px",
  height: "12px",
  borderRadius: "999px",
  backgroundColor: color,
  border: "1px solid rgba(0,0,0,0.1)",
});

const AVAILABILITY_COLOR_PALETTE: AvailabilityColors[] = [
  { background: "#8ecae6", border: "#5a99b3", text: "#0f172a" },
  { background: "#fde68a", border: "#fbbf24", text: "#78350f" },
  { background: "#fbcfe8", border: "#f472b6", text: "#831843" },
  { background: "#c7d2fe", border: "#818cf8", text: "#312e81" },
  { background: "#bbf7d0", border: "#4ade80", text: "#14532d" },
  { background: "#fed7aa", border: "#fb923c", text: "#7c2d12" },
];

const buildWeekDates = (referenceDate: Date) => {
  const start = moment(referenceDate).startOf("week");
  return Array.from({ length: 7 }, (_, index) => start.clone().add(index, "days").toDate());
};

const PlayerCalendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [rawLessons, setRawLessons] = useState<Lesson[]>([]);
  const [lessonEvents, setLessonEvents] = useState<LessonEvent[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [playerBookings, setPlayerBookings] = useState<number[]>([]);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [coachOptions, setCoachOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [coachOptionsLoading, setCoachOptionsLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [locationOptionsLoading, setLocationOptionsLoading] = useState(false);
  const [coachSpecificLessons, setCoachSpecificLessons] = useState<Lesson[]>([]);
  const [availabilityEvents, setAvailabilityEvents] = useState<AvailabilityEvent[]>([]);
  const [coachScheduleByDay, setCoachScheduleByDay] = useState<Record<string, CoachScheduleEntry[]>>({});
  const [coachScheduleLoading, setCoachScheduleLoading] = useState(false);
  const [coachLessonLoading, setCoachLessonLoading] = useState(false);
  const [visibleDates, setVisibleDates] = useState<Date[]>(() => buildWeekDates(new Date()));

  const authToken = useMemo(
    () => getStoredAuthToken({ preferScheme: "token" }) ?? undefined,
    [user],
  );

  const startRange = useMemo(
    () => moment(currentDate).startOf("week").subtract(1, "weeks"),
    [currentDate],
  );
  const endRange = useMemo(
    () => startRange.clone().add(3, "weeks"),
    [startRange],
  );
  const normalizedVisibleDates = useMemo(() => (visibleDates.length ? visibleDates : [currentDate]), [currentDate, visibleDates]);

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

    const parsedLocationId = locationFilter === "all" ? null : Number(locationFilter);
    const selectedLocationId =
      parsedLocationId !== null && Number.isFinite(parsedLocationId) ? parsedLocationId : null;

    const fetchSchedules = async () => {
      setCoachScheduleLoading(true);
      try {
        const responses = await Promise.all(
          WEEK_DAYS.map((day) =>
            selectedLocationId
              ? getCoachScheduleByIdAndLocation({ coachId, day, locationId: selectedLocationId })
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
          console.error("Failed to load weekly coach schedule", err);
          setCoachScheduleByDay({});
        }
      } finally {
        if (!cancelled) {
          setCoachScheduleLoading(false);
        }
      }
    };

    fetchSchedules();

    return () => {
      cancelled = true;
    };
  }, [coachFilter, locationFilter]);

  useEffect(() => {
    let cancelled = false;

    if (!authToken || !coachFilter || coachFilter === "all") {
      setCoachSpecificLessons([]);
      setCoachLessonLoading(false);
      return;
    }

    const coachId = Number(coachFilter);
    if (Number.isNaN(coachId)) {
      setCoachSpecificLessons([]);
      setCoachLessonLoading(false);
      return;
    }

    const parsedLocationId = locationFilter === "all" ? null : Number(locationFilter);
    const selectedLocationId =
      parsedLocationId !== null && Number.isFinite(parsedLocationId) ? parsedLocationId : null;
    const dayMoments = normalizedVisibleDates.map((date) => moment(date));
    const uniqueDayMoments = Array.from(
      new Map(dayMoments.map((momentDay) => [momentDay.format("YYYY-MM-DD"), momentDay])).values(),
    );

    const fetchLessons = async () => {
      setCoachLessonLoading(true);
      try {
        const responses = await Promise.all(
          uniqueDayMoments.map((dayMoment) =>
            getCoachLessonsById({
              coachId,
              date: dayMoment.format("YYYY-MM-DD"),
            }),
          ),
        );
        if (cancelled) return;
        const lessonList = responses.flat().filter(Boolean) as Lesson[];
        const filteredLessons =
          selectedLocationId !== null
            ? lessonList.filter((lesson) => Number(lesson.location_id) === selectedLocationId)
            : lessonList;
        setCoachSpecificLessons(filteredLessons);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load coach lessons", err);
          setCoachSpecificLessons([]);
        }
      } finally {
        if (!cancelled) {
          setCoachLessonLoading(false);
        }
      }
    };

    fetchLessons();

    return () => {
      cancelled = true;
    };
  }, [authToken, coachFilter, locationFilter, normalizedVisibleDates]);

  const loadLessons = useCallback(async () => {
    if (!authToken) {
      setError("You need to be logged in to view lessons.");
      setRawLessons([]);
      setPlayerBookings([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const coachIdParam = parseFilterId(coachFilter);
      const locationIdParam = parseFilterId(locationFilter);
      const levelParam = levelFilter && levelFilter !== "All" ? levelFilter : undefined;
      const [lessonsResponse, bookingsResponse] = await Promise.all([
        fetchAvailableLessons({
          token: authToken,
          start_date: startRange.format("YYYY-MM-DD"),
          end_date: endRange.format("YYYY-MM-DD"),
          search: searchQuery.trim() || undefined,
          coach_id: coachIdParam,
          location_id: locationIdParam,
          level: levelParam,
        }),
        fetchPlayerBookings({ token: authToken }),
      ]);

      setRawLessons(lessonsResponse?.data ?? []);
      setPlayerBookings(bookingsResponse?.data ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong while loading lessons.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authToken, coachFilter, endRange, levelFilter, locationFilter, searchQuery, startRange]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const bookingSet = useMemo(() => new Set(playerBookings), [playerBookings]);

  const combinedLessons = useMemo(() => {
    const merged = new Map<number, Lesson>();
    rawLessons.forEach((lesson) => {
      if (lesson?.id) {
        merged.set(lesson.id, lesson);
      }
    });
    coachSpecificLessons.forEach((lesson) => {
      if (lesson?.id) {
        merged.set(lesson.id, lesson);
      }
    });
    return Array.from(merged.values());
  }, [coachSpecificLessons, rawLessons]);

  const filteredLessons = useMemo(() => {
    const coachId = coachFilter === "all" ? null : Number(coachFilter);
    const locationId = locationFilter === "all" ? null : Number(locationFilter);
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return combinedLessons.filter((lesson) => {
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
    });
  }, [coachFilter, combinedLessons, levelFilter, locationFilter, searchQuery]);

  const derivedEvents = useMemo(
    () =>
      filteredLessons.map<LessonEvent>((lesson) => ({
        title: formatLessonTitle(lesson),
        start: moment(lesson.start_date_time).toDate(),
        end: moment(lesson.end_date_time).toDate(),
        resource: lesson,
        type: determineEventType(lesson, bookingSet),
        allDay: false,
      })),
    [bookingSet, filteredLessons],
  );

  useEffect(() => {
    setLessonEvents(derivedEvents);
  }, [derivedEvents]);

  const calendarEvents = useMemo(
    () => [...availabilityEvents, ...lessonEvents],
    [availabilityEvents, lessonEvents],
  );

  const calendarBusy = loading || coachScheduleLoading || coachLessonLoading;
  const busyMessage = loading
    ? "Loading lessons..."
    : coachScheduleLoading
      ? "Loading coach availability..."
      : coachLessonLoading
        ? "Loading coach lessons..."
        : "";

  useEffect(() => {
    if (!coachFilter || coachFilter === "all") {
      setAvailabilityEvents([]);
      return;
    }

    const events: AvailabilityEvent[] = [];
    const colorAssignments = new Map<string, AvailabilityColors>();
    let colorIndex = 0;

    const resolveColor = (slot: CoachScheduleEntry): AvailabilityColors => {
      const key =
        (slot.location_id != null && String(slot.location_id)) ||
        slot.location_name ||
        slot.location ||
        slot.day ||
        String(colorIndex);

      if (!colorAssignments.has(key)) {
        const paletteColor = AVAILABILITY_COLOR_PALETTE[colorIndex % AVAILABILITY_COLOR_PALETTE.length];
        colorAssignments.set(key, paletteColor);
        colorIndex += 1;
      }

      return colorAssignments.get(key) ?? AVAILABILITY_COLOR_PALETTE[0];
    };

    for (let weekOffset = -4; weekOffset <= 4; weekOffset++) {
      const weekStart = moment(currentDate).add(weekOffset, "weeks").startOf("isoWeek");
      WEEK_DAYS.forEach((day, dayIndex) => {
        const schedules = coachScheduleByDay[day] ?? [];
        if (!schedules.length) return;
        const eventDate = weekStart.clone().add(dayIndex, "days");
        schedules.forEach((slot) => {
          if (!slot.from || !slot.to) return;
          const [fromH = "0", fromM = "0"] = slot.from.split(":");
          const [toH = "0", toM = "0"] = slot.to.split(":");
          const start = eventDate.clone().hour(Number(fromH)).minute(Number(fromM)).second(0).toDate();
          const end = eventDate.clone().hour(Number(toH)).minute(Number(toM)).second(0).toDate();
          const locationLabel = slot.location_name || slot.location || "Coach availability";
          const availabilityColors = resolveColor(slot);
          events.push({
            title: locationLabel,
            start,
            end,
            allDay: false,
            resource: {
              ...slot,
              occurrenceDate: eventDate.format("YYYY-MM-DD"),
              availabilityColors,
            },
            type: "availability",
          });
        });
      });
    }
    setAvailabilityEvents(events);
  }, [coachFilter, coachScheduleByDay, currentDate]);

  const handleRangeChange = useCallback(
    (range: Date[] | { start: Date; end: Date } | Date) => {
      if (!range) return;
      if (Array.isArray(range)) {
        setVisibleDates(range.map((date) => new Date(date)));
        return;
      }
      if (range instanceof Date) {
        setVisibleDates([new Date(range)]);
        return;
      }
      if ("start" in range && "end" in range && range.start && range.end) {
        const start = moment(range.start);
        const end = moment(range.end);
        const dates: Date[] = [];
        const cursor = start.clone();
        while (cursor.isSameOrBefore(end, "day")) {
          dates.push(cursor.toDate());
          cursor.add(1, "day");
        }
        setVisibleDates(dates);
      }
    },
    [],
  );

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

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.type === "availability") {
      return;
    }
    setSelectedLesson(event.resource);
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
    setMutationLoading(true);
    try {
      await bookLesson({ lessonId: selectedLesson.id, token: authToken });
      window.alert("Lesson booked successfully!");
      await refetchLessons();
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

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    if (event.type === "availability") {
      const colors = event.resource.availabilityColors ?? AVAILABILITY_COLOR_PALETTE[0];
      return {
        className: "player-calendar__event--availability",
        style: {
          backgroundColor: colors.background,
          borderColor: colors.border,
          color: colors.text,
          borderRadius: "8px",
        },
      };
    }
    if (event.type === "booked") {
      return {
        className: "player-calendar__event--booked",
        style: {
          backgroundColor: "#457b9d",
          borderColor: "#2c5c77",
          color: "#ffffff",
          borderRadius: "8px",
        },
      };
    }
    if (event.type === "full") {
      return {
        className: "player-calendar__event--full",
        style: {
          backgroundColor: "#e76f51",
          borderColor: "#c8543a",
          color: "#ffffff",
          borderRadius: "8px",
        },
      };
    }
    return {
      className: "player-calendar__event--available",
      style: {
        backgroundColor: "#2a9d8f",
        borderColor: "#1d6f65",
        color: "#ffffff",
        borderRadius: "8px",
      },
    };
  }, []);

  const formatTimeRange = useCallback((start: Date, end: Date) => {
    const startText = moment(start).format("h:mm A");
    const endText = moment(end).format("h:mm A");
    return `${startText} – ${endText}`;
  }, []);

  const CalendarEventContent = useCallback(
    ({ event }: RBEventProps<CalendarEvent>) => {
      if (!event) return null;
      if (isAvailabilityEvent(event)) {
        const label = event.title;
        const courtLabel = event.resource.court ? `Court ${event.resource.court}` : null;
        const dayLabel = moment(event.start as Date).format("dddd");
        return (
          <div className="player-calendar__event-content">
            <div className="player-calendar__event-label">{label}</div>
            <div className="player-calendar__event-meta">
              Availability · {dayLabel} · {formatTimeRange(event.start as Date, event.end as Date)}
            </div>
            {courtLabel ? <div className="player-calendar__event-meta">{courtLabel}</div> : null}
          </div>
        );
      }

      const lesson = event.resource;
      const locationLabel = lesson.location_name || (lesson as { location?: string }).location || "Location TBD";
      const levelLabel =
        lesson.metadata?.level && lesson.metadata.level !== "All" ? `${lesson.metadata.level} level` : null;
      return (
        <div className="player-calendar__event-content">
          <div className="player-calendar__event-label">{event.title}</div>
          <div className="player-calendar__event-meta">{locationLabel}</div>
          {lesson.coach_name ? (
            <div className="player-calendar__event-meta">Coach {lesson.coach_name}</div>
          ) : null}
          {levelLabel ? <div className="player-calendar__event-meta">{levelLabel}</div> : null}
          <div className="player-calendar__event-meta">{formatTimeRange(event.start as Date, event.end as Date)}</div>
        </div>
      );
    },
    [formatTimeRange],
  );

  const spotsRemaining = useMemo(() => {
    if (!selectedLesson || typeof selectedLesson.player_limit !== "number") {
      return null;
    }
    const taken = selectedLesson.current_player_count ?? 0;
    return Math.max(selectedLesson.player_limit - taken, 0);
  }, [selectedLesson]);

  const modalLessonType =
    selectedLesson && determineEventType(selectedLesson, bookingSet);

  return (
    <div className="player-calendar space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="player-calendar__header space-y-2">
        <h1 className="player-calendar__title text-3xl font-semibold tracking-tight text-slate-900">
          Find a Lesson
        </h1>
        <p className="player-calendar__subtitle text-base text-slate-600">
          Browse open lesson times, see your bookings, and reserve a spot directly from the calendar.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm shadow-slate-100">
        <div className="flex min-w-[200px] flex-col gap-1">
          <label htmlFor="coachFilter" className="text-sm font-medium text-slate-600">
            Coach
          </label>
          <select
            id="coachFilter"
            value={coachFilter}
            onChange={(event) => setCoachFilter(event.target.value)}
            disabled={coachOptionsLoading && !displayedCoachOptions.length}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
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
        </div>
        <div className="flex min-w-[180px] flex-col gap-1">
          <label htmlFor="levelFilter" className="text-sm font-medium text-slate-600">
            Level
          </label>
          <select
            id="levelFilter"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {LESSON_LEVELS.map((level) => (
              <option key={level.id} value={level.name}>
                {level.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[200px] flex-col gap-1">
          <label htmlFor="locationFilter" className="text-sm font-medium text-slate-600">
            Location
          </label>
          <select
            id="locationFilter"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            disabled={locationOptionsLoading && !displayedLocationOptions.length}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
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
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <label htmlFor="searchLessons" className="text-sm font-medium text-slate-600">
            Search
          </label>
          <input
            id="searchLessons"
            type="search"
            placeholder="Search by coach, title, or location"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          views={["week", "day"]}
          defaultView="week"
          selectable={false}
          step={30}
          timeslots={2}
          date={currentDate}
          onNavigate={setCurrentDate}
          onSelectEvent={handleSelectEvent}
          onRangeChange={handleRangeChange}
          style={{ height: "620px" }}
          eventPropGetter={eventPropGetter}
          components={{ event: CalendarEventContent }}
        />
        {calendarBusy ? (
          <div className="absolute inset-0 grid place-items-center bg-white/80 text-base font-semibold text-slate-700">
            {busyMessage}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-600" aria-label="Lesson legend">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-slate-200" style={colorDot("#2a9d8f")} />
          Available
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-slate-200" style={colorDot("#457b9d")} />
          Booked
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-slate-200" style={colorDot("#e76f51")} />
          Full
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border border-slate-200" style={colorDot("#8ecae6")} />
          Coach availability (color-coded by location)
        </span>
      </div>

      {bookingModalOpen && selectedLesson ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{formatLessonTitle(selectedLesson)}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {moment(selectedLesson.start_date_time).format("dddd, MMM D • h:mm A")} –{" "}
                  {moment(selectedLesson.end_date_time).format("h:mm A")}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close booking modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3 px-6 py-5 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Coach</span>
                <span className="font-semibold text-slate-900">{selectedLesson.coach_name}</span>
              </div>
              {selectedLesson.location_name ? (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">Location</span>
                  <span className="font-semibold text-slate-900">{selectedLesson.location_name}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Level</span>
                <span className="font-semibold text-slate-900">
                  {selectedLesson.metadata?.level || selectedLesson.metadata_level || "All"}
                </span>
              </div>
              {selectedLesson.metadata?.description ? (
                <div>
                  <span className="font-medium text-slate-500">About this session</span>
                  <p className="mt-1 text-slate-700">{selectedLesson.metadata.description}</p>
                </div>
              ) : null}
              {typeof selectedLesson.price_per_person === "number" ? (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">Price</span>
                  <span className="font-semibold text-slate-900">${selectedLesson.price_per_person.toFixed(2)}</span>
                </div>
              ) : null}
              {spotsRemaining !== null ? (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">Spots remaining</span>
                  <span className="font-semibold text-slate-900">{spotsRemaining}</span>
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
                onClick={closeModal}
                disabled={mutationLoading}
              >
                Close
              </button>
              {modalLessonType === "booked" ? (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-70"
                  onClick={handleCancelLesson}
                  disabled={mutationLoading}
                >
                  {mutationLoading ? "Cancelling..." : "Cancel Booking"}
                </button>
              ) : (
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                    modalLessonType === "full"
                      ? "bg-slate-400"
                      : "bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-200"
                  } disabled:opacity-70`}
                  onClick={handleBookLesson}
                  disabled={mutationLoading || modalLessonType === "full"}
                >
                  {modalLessonType === "full"
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
    </div>
  );
};

export default PlayerCalendar;
