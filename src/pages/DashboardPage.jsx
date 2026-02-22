import moment from "moment";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Star } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { getPlayerFutureGroupLessons, getPlayerFutureLessons } from "../api/playerHome";
import MainLayout from "../components/MainLayout";
import { getStoredAuthToken } from "../services/authToken";

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

const extractLessons = (response) => {
  if (!response) return [];
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.items)) return response.items;
  return [];
};

const buildScheduleItems = (lessons = [], type) =>
  lessons
    .map((lesson, index) => {
      const startAt = parseDate(
        lesson.startTime ?? lesson.start_time ?? lesson.start_at ?? lesson.start ?? lesson.startDate,
      );
      const id = `${type}-${lesson.id ?? lesson.lesson_id ?? lesson.lessonId ?? index}`;
      const coach = lesson.coach ?? lesson.instructor ?? lesson.pro ?? {};
      const coachName =
        pickString(
          lesson.coach_name,
          lesson.coachName,
          coach.name,
          coach.full_name,
          [coach.first_name, coach.last_name].filter(Boolean).join(" "),
        ) ?? "Coach";

      return {
        id,
        title: pickString(lesson.title, lesson.name, lesson.lesson_name, lesson.program_name) ?? "Session",
        locationLabel:
          pickString(
            lesson.location_name,
            lesson.location,
            lesson.court_name,
            lesson.facility_name,
            lesson.venue_name,
            lesson?.location?.name,
          ) ?? "Location TBD",
        time: startAt ? moment(startAt).format("h:mm A") : "TBD",
        meridiem: startAt ? moment(startAt).format("A") : "",
        type,
        coachLabel: type === "lesson" ? `w/ ${coachName.replace(/^coach\s+/i, "")}` : null,
      };
    })
    .filter(Boolean);

const activityTypeMeta = {
  match: { label: "MATCH", icon: "🎾", typeClass: "match", button: "Join" },
  private: { label: "PRIVATE LESSON", icon: "🎓", typeClass: "lesson", button: "Book" },
  group: { label: "GROUP SESSION", icon: "👥", typeClass: "group", button: "Book" },
};

const activities = [
  {
    id: "activity-match-1",
    type: "match",
    title: "Saturday Morning Doubles",
    venue: "Penmar Courts",
    distance: "1.2 mi",
    level: "USTA 4.0",
    spotsRemaining: 2,
    price: "$18",
    badge: "Starting Soon",
    startTime: moment().add(2, "hours").toISOString(),
  },
  {
    id: "activity-private-1",
    type: "private",
    title: "Coach Maria — Serve Technique",
    venue: "LA Tennis Club",
    distance: "3.1 mi",
    level: "All Levels",
    spotsRemaining: 1,
    price: "$95",
    badge: "Featured",
    startTime: moment().add(1, "day").hour(16).minute(0).toISOString(),
  },
  {
    id: "activity-group-1",
    type: "group",
    title: "Cardio Tennis — Evening",
    venue: "Venice Beach",
    distance: "1.8 mi",
    level: "All Levels",
    spotsRemaining: 5,
    price: "$25",
    badge: "Popular",
    startTime: moment().add(1, "day").hour(19).minute(0).toISOString(),
  },
  {
    id: "activity-match-2",
    type: "match",
    title: "Singles Practice — Intermediate",
    venue: "Mar Vista",
    distance: "2.4 mi",
    level: "USTA 3.5",
    spotsRemaining: 1,
    price: "Free",
    startTime: moment().add(2, "days").hour(14).minute(0).toISOString(),
  },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const datePickerRef = useRef(null);
  const [locationState, setLocationState] = useState({ status: "idle", locationName: null });
  const [distanceFilter, setDistanceFilter] = useState("10");
  const distanceOptions = ["5", "10", "15", "20"];
  const [scheduleState, setScheduleState] = useState({ status: "idle", items: [], error: null });
  const [dateFilter, setDateFilter] = useState({ type: "all" });
  const [activeFilter, setActiveFilter] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => moment().startOf("day").add(weekOffset * 7, "days"), [weekOffset]);

  const dayOptions = useMemo(() => {
    const countsByDay = activities.reduce((acc, activity) => {
      const key = moment(activity.startTime).startOf("day").format("YYYY-MM-DD");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Array.from({ length: 5 }).map((_, index) => {
      const dayMoment = weekStart.clone().add(index, "days");
      const key = dayMoment.format("YYYY-MM-DD");
      const isToday = dayMoment.isSame(moment(), "day");
      return {
        value: key,
        label: index === 0 && weekOffset === 0 ? "TODAY" : dayMoment.format("ddd").toUpperCase(),
        date: dayMoment.format("D"),
        events: countsByDay[key] || 0,
        isToday,
      };
    });
  }, [weekOffset, weekStart]);

  const scopedActivities = useMemo(
    () =>
      activities.filter((activity) => {
        if (dateFilter.type === "all") return true;
        return moment(activity.startTime).format("YYYY-MM-DD") === dateFilter.iso;
      }),
    [dateFilter],
  );

  const typeCounts = useMemo(
    () => ({
      all: scopedActivities.length,
      match: scopedActivities.filter((activity) => activity.type === "match").length,
      private: scopedActivities.filter((activity) => activity.type === "private").length,
      group: scopedActivities.filter((activity) => activity.type === "group").length,
    }),
    [scopedActivities],
  );

  const filteredActivities = useMemo(
    () =>
      scopedActivities.filter((activity) => activeFilter === "all" || activity.type === activeFilter),
    [activeFilter, scopedActivities],
  );

  const stats = useMemo(
    () => ({
      matches: activities.filter((item) => item.type === "match").length * 3,
      rating: "4.0",
      lessons: activities.filter((item) => item.type !== "match").length * 2,
      connections: 24,
    }),
    [],
  );

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => setLocationState({ status: "ready", locationName: "Los Angeles" }),
      () => setLocationState({ status: "error", locationName: "Location unavailable" }),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadSchedule = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setScheduleState({ status: "unauthenticated", items: [], error: null });
        return;
      }

      setScheduleState((prev) => ({ ...prev, status: "loading", error: null }));
      try {
        const [lessonsResponse, groupLessonsResponse] = await Promise.all([
          getPlayerFutureLessons({ token, perPage: 5, signal: controller.signal }),
          getPlayerFutureGroupLessons({ token, perPage: 5, signal: controller.signal }),
        ]);

        if (cancelled) return;

        const privateLessons = buildScheduleItems(extractLessons(lessonsResponse), "lesson");
        const groupLessons = buildScheduleItems(extractLessons(groupLessonsResponse), "group");

        setScheduleState({ status: "ready", items: [...privateLessons, ...groupLessons].slice(0, 3), error: null });
      } catch (error) {
        if (cancelled) return;
        setScheduleState({
          status: "error",
          items: [],
          error: error instanceof Error ? error.message : "Unable to load schedule.",
        });
      }
    };

    loadSchedule();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const filterOptions = [
    { id: "all", label: "All" },
    { id: "match", label: "Matches" },
    { id: "private", label: "Lessons" },
    { id: "group", label: "Groups" },
  ];

  return (
    <MainLayout>
      <div className="home-redesign">
        <div className="home-redesign__main">
          <section className="hero-cards hero-scroll">
            <button type="button" className="hero-card hero-card--match" onClick={() => navigate("/matches/create")}>
              <div className="hero-icon" aria-hidden="true">🎾</div>
              <div className="hero-content">
                <div className="hero-title">Create a Match</div>
                <div className="hero-subtitle">Organize singles or doubles</div>
              </div>
              <div className="hero-arrow" aria-hidden="true">→</div>
            </button>
            <button type="button" className="hero-card hero-card--lesson" onClick={() => navigate("/find-coaches")}>
              <div className="hero-icon" aria-hidden="true">⭐</div>
              <div className="hero-content">
                <div className="hero-title">Book a Lesson</div>
                <div className="hero-subtitle">Find a coach near you</div>
              </div>
              <div className="hero-arrow" aria-hidden="true">→</div>
            </button>
          </section>

          <section className="schedule-section-mobile">
            <div className="schedule-header-mobile">
              <span className="schedule-title-mobile">My Schedule</span>
              <button type="button" className="schedule-link-mobile" onClick={() => navigate("/player/calendar")}>View All →</button>
            </div>
            <div className="schedule-items-mobile">
              {scheduleState.status === "ready" && scheduleState.items.length > 0 ? (
                scheduleState.items.map((item) => (
                  <article key={`mobile-${item.id}`} className="schedule-item-mobile">
                    <span className={`schedule-type ${item.type === "group" ? "group" : "lesson"}`} />
                    <div className="schedule-time-mobile">
                      <div className="schedule-time-value">{item.time.split(" ")[0]}</div>
                      <div className="schedule-time-period">{item.time.split(" ")[1] ?? ""}</div>
                    </div>
                    <div className="schedule-content-mobile">
                      <div className="schedule-item-title-mobile">{item.type === "lesson" ? `${item.title} ${item.coachLabel ?? ""}` : item.title}</div>
                      <div className="schedule-meta-mobile">{item.locationLabel}</div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="sidebar-empty">No upcoming sessions yet.</p>
              )}
            </div>
          </section>

          <section className="date-selector-v2">
            <button type="button" className="date-nav-btn" onClick={() => setWeekOffset((prev) => prev - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className={`date-option${dateFilter.type === "all" ? " selected" : ""}`}
              onClick={() => setDateFilter({ type: "all" })}
            >
              <strong>ALL</strong>
              <span>{typeCounts.all} events</span>
            </button>
            {dayOptions.map((day) => (
              <button
                type="button"
                key={day.value}
                className={`date-option${dateFilter.type === "day" && dateFilter.iso === day.value ? " selected" : ""}`}
                onClick={() => setDateFilter({ type: "day", iso: day.value })}
              >
                <strong>{day.label} {day.date}</strong>
                <span>{day.events} event{day.events === 1 ? "" : "s"}</span>
              </button>
            ))}
            <button type="button" className="date-nav-btn" onClick={() => setWeekOffset((prev) => prev + 1)}>
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="date-calendar-btn"
              onClick={() => datePickerRef.current?.showPicker?.()}
            >
              <CalendarDays size={14} /> Pick Date
            </button>
            <input
              ref={datePickerRef}
              type="date"
              className="date-picker-input"
              onChange={(event) => setDateFilter({ type: "day", iso: event.target.value })}
            />
          </section>

          <section className="filter-bar-v2">
            <div className="filter-row-v2">
              <button type="button" className="filter-item">📍 {locationState.locationName || "Los Angeles"} ▾</button>
              <button
                type="button"
                className="filter-item"
                onClick={() => {
                  const index = distanceOptions.indexOf(distanceFilter);
                  const next = distanceOptions[(index + 1) % distanceOptions.length];
                  setDistanceFilter(next);
                }}
              >
                📏 {distanceFilter} mi ▾
              </button>
            </div>
            <div className="filter-tabs-v2">
              {filterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`filter-tab${activeFilter === option.id ? " active" : ""}`}
                  onClick={() => setActiveFilter(option.id)}
                >
                  {option.label} <span>{typeCounts[option.id]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="available-section">
            <div className="available-section__header">
              <h2>Available Near You</h2>
              <button type="button" onClick={() => navigate("/matches")}>See All →</button>
            </div>
            <div className="activity-list-v2">
              {filteredActivities.map((activity) => {
                const meta = activityTypeMeta[activity.type];
                const startLabel = moment(activity.startTime).calendar(null, {
                  sameDay: "[Today] · h:mm A",
                  nextDay: "[Tomorrow] · h:mm A",
                  nextWeek: "ddd · h:mm A",
                  sameElse: "ddd · h:mm A",
                });
                return (
                  <article key={activity.id} className="activity-card-v2">
                    <div className={`activity-type-icon ${meta.typeClass}`}>{meta.icon}</div>
                    <div className="activity-content">
                      <div className="activity-top-row">
                        <span className={`activity-type-label ${meta.typeClass}`}>{meta.label}</span>
                        {activity.badge ? <span className="activity-badge">{activity.badge}</span> : null}
                      </div>
                      <h3>{activity.title}</h3>
                      <div className="activity-meta-row">
                        <span><Clock3 size={13} /> {startLabel}</span>
                        <span><MapPin size={13} /> {activity.venue} · {activity.distance}</span>
                        <span><Star size={13} /> {activity.level}</span>
                      </div>
                    </div>
                    <div className="activity-right">
                      <div className="activity-price">{activity.price}</div>
                      <div className={`activity-spots${activity.spotsRemaining <= 2 ? " urgent" : ""}`}>
                        {activity.spotsRemaining} spots left
                      </div>
                      <button type="button" className={`activity-btn ${meta.typeClass}`}>{meta.button}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="home-redesign__sidebar">
          <section className="sidebar-card-v2">
            <div className="sidebar-card-v2__header">
              <h3>My Schedule</h3>
              <button type="button" onClick={() => navigate("/player/calendar")}>View All →</button>
            </div>
            {scheduleState.status === "ready" && scheduleState.items.length > 0 ? (
              scheduleState.items.map((item) => (
                <article key={item.id} className="schedule-item-v2">
                  <span className={`schedule-type ${item.type === "group" ? "group" : "lesson"}`} />
                  <div>
                    <p>{item.time}</p>
                    <h4>{item.type === "lesson" ? `${item.title} ${item.coachLabel ?? ""}` : item.title}</h4>
                    <span>{item.locationLabel}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="sidebar-empty">No upcoming sessions yet.</p>
            )}
          </section>

          <section className="sidebar-card-v2">
            <h3>Your Stats</h3>
            <div className="stats-grid">
              <div><strong>{stats.matches}</strong><span>Matches</span></div>
              <div><strong>{stats.rating}</strong><span>Rating</span></div>
              <div><strong>{stats.lessons}</strong><span>Lessons</span></div>
              <div><strong>{stats.connections}</strong><span>Connect</span></div>
            </div>
          </section>

          <section className="sidebar-card-v2 find-players-card">
            <div className="sidebar-card-v2__header">
              <h3>Find Players</h3>
              <button type="button" onClick={() => navigate("/find-players")}>Browse →</button>
            </div>
            <p className="find-emoji">🔍</p>
            <h4>Looking for a hitting partner?</h4>
            <p>Find players near you.</p>
            <button type="button" className="find-players-btn" onClick={() => navigate("/find-players")}>Find Players</button>
          </section>
        </aside>
      </div>

      <nav className="bottom-nav-mobile" aria-label="Mobile navigation">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav-mobile__item${isActive ? " active" : ""}`}>
          <span className="bottom-nav-mobile__icon" aria-hidden="true">🏠</span>
          Home
        </NavLink>
        <NavLink to="/matches" className={({ isActive }) => `bottom-nav-mobile__item${isActive ? " active" : ""}`}>
          <span className="bottom-nav-mobile__icon" aria-hidden="true">🎾</span>
          Matches
        </NavLink>
        <NavLink to="/find-players" className={({ isActive }) => `bottom-nav-mobile__item${isActive ? " active" : ""}`}>
          <span className="bottom-nav-mobile__icon" aria-hidden="true">🔍</span>
          Players
        </NavLink>
        <NavLink to="/group-lessons" className={({ isActive }) => `bottom-nav-mobile__item${isActive ? " active" : ""}`}>
          <span className="bottom-nav-mobile__icon" aria-hidden="true">👥</span>
          Groups
        </NavLink>
        <NavLink to="/find-coaches" className={({ isActive }) => `bottom-nav-mobile__item${isActive ? " active" : ""}`}>
          <span className="bottom-nav-mobile__icon" aria-hidden="true">🎓</span>
          Coaches
        </NavLink>
      </nav>
    </MainLayout>
  );
};

export default DashboardPage;
