import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  CalendarRange,
  ChevronDown,
  Clock,
  Filter as FilterIcon,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search as SearchIcon,
  Users,
} from "lucide-react";
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
  type PlayerCoach,
  type CoachLocation,
} from "../../../api/playerCalendar";
import { useAuth } from "../../../context/AuthContext";
import { getStoredAuthToken } from "../../../services/authToken";

const LESSON_LEVELS = [
  { id: 0, name: "All", description: "" },
  { id: 1, name: "Beginner (NTRP 2.5)", description: "Just getting started in the game" },
  { id: 2, name: "Advanced Beginner (NTRP 3.0)", description: "I can rally but my strokes are not consistent yet" },
  { id: 3, name: "Intermediate (NTRP 3.5)", description: "I can hit with spin and direction most of the time" },
  { id: 4, name: "Advanced (NTRP 4.0)", description: "I can consistently rally with spin, direction, and pace" },
  { id: 5, name: "Advanced Plus (NTRP 4.5)", description: "I have control over my shots and hit consistently with depth and pace" },
  { id: 6, name: "Expert (NTRP 5.0)", description: "I have competitive experience and advanced skill levels" },
] as const;

const DATE_PRESETS = [
  {
    id: "7",
    label: "Next 7 days",
    range: () => ({
      start: moment().startOf("day"),
      end: moment().add(6, "days").endOf("day"),
    }),
  },
  {
    id: "14",
    label: "Next 14 days",
    range: () => ({
      start: moment().startOf("day"),
      end: moment().add(13, "days").endOf("day"),
    }),
  },
  {
    id: "30",
    label: "Next 30 days",
    range: () => ({
      start: moment().startOf("day"),
      end: moment().add(29, "days").endOf("day"),
    }),
  },
] as const;

export interface Lesson extends ApiLesson {}

export type LessonStatus = "available" | "booked" | "full";

type DateRange = {
  start: moment.Moment;
  end: moment.Moment;
};

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
    return `${hours} hr ${remainingMinutes} min`;
  }
  return `${minutes} min`;
};

const statusCopy: Record<LessonStatus, { label: string; tone: "success" | "info" | "danger" }> = {
  available: { label: "Available", tone: "success" },
  booked: { label: "Booked", tone: "info" },
  full: { label: "Waitlist", tone: "danger" },
};

const PlayerCalendar = () => {
  const { user } = useAuth();

  const [rawLessons, setRawLessons] = useState<Lesson[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [coachFilter, setCoachFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [distanceFilter, setDistanceFilter] = useState<string>("10");
  const [priceFilter, setPriceFilter] = useState<string>("any");
  const [datePreset, setDatePreset] = useState<string>(DATE_PRESETS[1]?.id ?? "14");
  const [dateRange, setDateRange] = useState<DateRange>(DATE_PRESETS[1]?.range() ?? DATE_PRESETS[0].range());
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

  const authToken = useMemo(
    () => getStoredAuthToken({ preferScheme: "token" }) ?? undefined,
    [user],
  );

  useEffect(() => {
    const preset = DATE_PRESETS.find((option) => option.id === datePreset);
    if (preset) {
      setDateRange(preset.range());
    }
  }, [datePreset]);

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
      const [lessonsResponse, bookingsResponse] = await Promise.all([
        fetchAvailableLessons({
          token: authToken,
          start_date: dateRange.start.format("YYYY-MM-DD"),
          end_date: dateRange.end.format("YYYY-MM-DD"),
          search: searchQuery.trim() || undefined,
        }),
        fetchPlayerBookings({ token: authToken }),
      ]);

      setRawLessons(lessonsResponse?.data ?? []);
      setPlayerBookings(bookingsResponse?.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong while loading lessons.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authToken, dateRange.end, dateRange.start, searchQuery]);

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

  const bookingSet = useMemo(() => new Set(playerBookings), [playerBookings]);

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
  }, [coachFilter, levelFilter, locationFilter, rawLessons, searchQuery]);

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

  const spotsRemaining = useMemo(() => {
    if (!selectedLesson || typeof selectedLesson.player_limit !== "number") {
      return null;
    }
    const taken = selectedLesson.current_player_count ?? 0;
    return Math.max(selectedLesson.player_limit - taken, 0);
  }, [selectedLesson]);

  const modalLessonStatus = selectedLesson ? determineLessonStatus(selectedLesson, bookingSet) : null;

  const handleResetFilters = () => {
    setCoachFilter("all");
    setLevelFilter("All");
    setLocationFilter("all");
    setSearchQuery("");
    setDistanceFilter("10");
    setPriceFilter("any");
    setDatePreset(DATE_PRESETS[1]?.id ?? "14");
  };

  const renderLessonCard = (lesson: Lesson) => {
    const status = determineLessonStatus(lesson, bookingSet);
    const statusInfo = statusCopy[status];
    const start = moment(lesson.start_date_time).toDate();
    const end = moment(lesson.end_date_time).toDate();
    const duration = formatDuration(start, end);
    const locationLabel = lesson.location_name || (lesson as { location?: string }).location || "Location TBD";
    const levelLabel = lesson.metadata?.level || lesson.metadata_level || "All";
    const spots =
      typeof lesson.player_limit === "number"
        ? Math.max((lesson.player_limit ?? 0) - (lesson.current_player_count ?? 0), 0)
        : null;

    return (
      <div key={lesson.id} className="player-calendar__session">
        <div className="player-calendar__session-time">
          <span className="player-calendar__session-time-label">{moment(start).format("h:mm A")}</span>
          <span className="player-calendar__session-duration">{duration}</span>
        </div>
        <article className="player-calendar__session-card">
          <header className="player-calendar__session-card-header">
            <div className="player-calendar__session-card-heading">
              <p className="player-calendar__session-location">
                <MapPin aria-hidden className="player-calendar__session-location-icon" />
                {locationLabel}
              </p>
              <h3 className="player-calendar__session-title">{formatLessonTitle(lesson)}</h3>
              {lesson.metadata?.description ? (
                <p className="player-calendar__session-description">{lesson.metadata.description}</p>
              ) : null}
            </div>
            <div className={`player-calendar__status player-calendar__status--${statusInfo.tone}`}>
              {statusInfo.label}
            </div>
          </header>
          <div className="player-calendar__session-body">
            <ul className="player-calendar__session-details">
              <li>
                <Clock aria-hidden />
                {formatTimeRange(start, end)}
              </li>
              {lesson.coach_name ? (
                <li>
                  <Users aria-hidden />
                  Coach {lesson.coach_name}
                </li>
              ) : null}
              {levelLabel ? (
                <li>
                  <FilterIcon aria-hidden />
                  {levelLabel === "All" ? "All levels" : `${levelLabel} level`}
                </li>
              ) : null}
              {spots !== null ? (
                <li>
                  <Users aria-hidden />
                  {spots > 0 ? `${spots} spot${spots === 1 ? "" : "s"} left` : "No spots remaining"}
                </li>
              ) : null}
            </ul>
            <div className="player-calendar__session-cta">
              {typeof lesson.price_per_person === "number" ? (
                <p className="player-calendar__session-price">
                  ${lesson.price_per_person.toFixed(2)}
                  <span>per player</span>
                </p>
              ) : null}
              <button
                type="button"
                className="player-calendar__session-button"
                onClick={() => openLessonModal(lesson)}
                disabled={status === "full"}
              >
                {status === "booked" ? "Manage booking" : status === "full" ? "Join waitlist" : "Reserve spot"}
              </button>
            </div>
          </div>
        </article>
      </div>
    );
  };

  return (
    <div className="player-calendar-page">
      <div className="player-calendar__layout">
        <header className="player-calendar__hero">
          <div>
            <h1>Calendar</h1>
            <p>Discover group lessons, matches, and coaching sessions near you.</p>
          </div>
          <div className="player-calendar__hero-actions">
            <button type="button" className="player-calendar__hero-link" onClick={handleResetFilters}>
              <RefreshCw aria-hidden /> Reset filters
            </button>
          </div>
        </header>

        <section className="player-calendar__filters" aria-label="Primary filters">
          <div className="player-calendar__filters-grid">
            <label className="player-calendar__field">
              <span className="player-calendar__field-label">Location</span>
              <div className="player-calendar__select">
                <select
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                  disabled={locationOptionsLoading && !displayedLocationOptions.length}
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
                <ChevronDown aria-hidden />
              </div>
            </label>

            <label className="player-calendar__field">
              <span className="player-calendar__field-label">Distance</span>
              <div className="player-calendar__select">
                <select value={distanceFilter} onChange={(event) => setDistanceFilter(event.target.value)}>
                  <option value="5">Within 5 miles</option>
                  <option value="10">Within 10 miles</option>
                  <option value="25">Within 25 miles</option>
                  <option value="any">Any distance</option>
                </select>
                <ChevronDown aria-hidden />
              </div>
            </label>

            <label className="player-calendar__field">
              <span className="player-calendar__field-label">Date range</span>
              <div className="player-calendar__select">
                <select value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
                  {DATE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <CalendarRange aria-hidden />
              </div>
            </label>

            <label className="player-calendar__field">
              <span className="player-calendar__field-label">Price</span>
              <div className="player-calendar__select">
                <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}>
                  <option value="any">Any price</option>
                  <option value="25">Under $25</option>
                  <option value="50">Under $50</option>
                  <option value="premium">Premium sessions</option>
                </select>
                <ChevronDown aria-hidden />
              </div>
            </label>
          </div>

          <div className="player-calendar__filters-actions">
            <button type="button" className="player-calendar__ghost-button">
              <LocateFixed aria-hidden /> View map
            </button>
            <button type="button" className="player-calendar__ghost-button">
              <FilterIcon aria-hidden /> Actions
            </button>
          </div>
        </section>

        <section className="player-calendar__secondary" aria-label="Refine results">
          <div className="player-calendar__search">
            <SearchIcon aria-hidden />
            <input
              type="search"
              placeholder="Search for sessions, coaches, or locations"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <label className="player-calendar__field player-calendar__field--small">
            <span className="player-calendar__field-label">Coach</span>
            <div className="player-calendar__select">
              <select
                value={coachFilter}
                onChange={(event) => setCoachFilter(event.target.value)}
                disabled={coachOptionsLoading && !displayedCoachOptions.length}
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
              <ChevronDown aria-hidden />
            </div>
          </label>
          <label className="player-calendar__field player-calendar__field--small">
            <span className="player-calendar__field-label">Level</span>
            <div className="player-calendar__select">
              <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                {LESSON_LEVELS.map((level) => (
                  <option key={level.id} value={level.name}>
                    {level.name}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden />
            </div>
          </label>
        </section>

        {error ? (
          <div className="player-calendar__alert" role="status">
            {error}
          </div>
        ) : null}

        <section className="player-calendar__summary" aria-live="polite">
          <div>
            <h2>Available sessions nearby</h2>
            <p>
              {loading
                ? "Loading sessions…"
                : `${filteredLessons.length} session${filteredLessons.length === 1 ? "" : "s"} match your filters.`}
            </p>
          </div>
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
        </section>

        <div className="player-calendar__days">
          {loading ? (
            <div className="player-calendar__loading">Loading lessons…</div>
          ) : lessonsByDate.length === 0 ? (
            <div className="player-calendar__empty">
              <p>No sessions match your filters in this date range.</p>
              <button type="button" onClick={handleResetFilters}>
                Reset filters
              </button>
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

      {bookingModalOpen && selectedLesson ? (
        <div role="dialog" aria-modal="true" className="player-calendar__modal">
          <div className="player-calendar__modal-card">
            <div className="player-calendar__modal-header">
              <div className="player-calendar__modal-header-row">
                <div>
                  <h2>{formatLessonTitle(selectedLesson)}</h2>
                  <p>
                    {moment(selectedLesson.start_date_time).format("dddd, MMM D • h:mm A")} –{" "}
                    {moment(selectedLesson.end_date_time).format("h:mm A")}
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
    </div>
  );
};

export default PlayerCalendar;
