import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, MapPin } from "lucide-react";
import Autocomplete from "react-google-autocomplete";
import { Link, useNavigate } from "react-router-dom";
import { getPlayerFutureLessons } from "../api/playerHome";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";
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

const buildScheduleItems = (lessons = []) =>
  lessons
    .map((lesson) => {
      const startAt = parseDate(
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
        time: `${moment(startAt).format("ddd")} · ${moment(startAt).format("h:mm A")}`,
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => moment(a.startTime).valueOf() - moment(b.startTime).valueOf());

const buildActivityItems = (lessons = []) =>
  lessons
    .map((lesson) => {
      const startAt = parseDate(
        lesson.startTime ??
          lesson.start_time ??
          lesson.start_at ??
          lesson.start ??
          lesson.startDate ??
          lesson.starts_at ??
          lesson.start_date_time,
      );
      if (!startAt) return null;

      const type = resolveLessonKind(lesson);
      const lessonId = lesson.id ?? lesson.lesson_id ?? lesson.lessonId ?? lesson.booking_id ?? lesson.uuid ?? null;
      const coachName = pickString(lesson.full_name, lesson.coach_name, lesson.coachName, lesson?.coach?.name);
      const label = type === "group" ? "GROUP LESSON" : "PRIVATE LESSON";

      return {
        id: `act-${lessonId ?? startAt.toISOString()}`,
        lessonId: lessonId != null ? String(lessonId) : null,
        type,
        label,
        title:
          pickString(lesson.title, lesson.lesson_title, lesson.name, lesson.lesson_name, lesson.program_name) ||
          (type === "group" ? "Intermediate Drills" : coachName ? `Coach ${coachName}` : "Private Lesson"),
        time: moment(startAt).format("h:mm A"),
        dayKey: moment(startAt).format("YYYY-MM-DD"),
        location:
          pickString(
            lesson.location_name,
            lesson.locationName,
            lesson.location,
            lesson.location_label,
            lesson.court_name,
            lesson.facility_name,
          ) || "Location TBD",
        price: parseNumber(lesson.price_per_person, lesson.group_price_per_person, lesson.price, lesson.lesson_price),
      };
    })
    .filter(Boolean)
    .sort((a, b) => moment(a.dayKey).valueOf() - moment(b.dayKey).valueOf());

const quickActions = [
  { icon: "👤", label: "Find a Coach", to: "/coaches" },
  { icon: "👥", label: "Group Lessons", to: "/group-lessons" },
  { icon: "🏆", label: "Match Play", to: "/matches" },
  { icon: "🔍", label: "Find Players", to: "/find-players" },
];

const locationItems = [
  { name: "Penmar Recreation Center", detail: "1341 Lake St, Venice", distance: "0.8 mi" },
  { name: "Venice Beach Courts", detail: "Ocean Front Walk", distance: "1.2 mi" },
  { name: "Mar Vista Recreation Center", detail: "11430 Woodbine St", distance: "2.1 mi" },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { displayName, initials } = usePlayerIdentity();
  const firstName = displayName?.split(" ")?.[0] || "Player";
  const [scheduleState, setScheduleState] = useState({ status: "idle", items: [], error: null });
  const [activityState, setActivityState] = useState({ status: "idle", items: [], error: null });
  const [selectedType, setSelectedType] = useState("all");
  const [selectedDay, setSelectedDay] = useState(moment().format("YYYY-MM-DD"));
  const [locationName, setLocationName] = useState("Venice");
  const [isLocationOpen, setIsLocationOpen] = useState(false);

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

      try {
        const response = await getPlayerFutureLessons({ token, page: 1, perPage: 25, signal: controller.signal });
        if (cancelled) return;
        const lessons = extractLessons(response);
        setScheduleState({ status: "ready", items: buildScheduleItems(lessons), error: null });
        setActivityState({ status: "ready", items: buildActivityItems(lessons), error: null });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load home feed.";
        setScheduleState({ status: "error", items: [], error: message });
        setActivityState({ status: "error", items: [], error: message });
      }
    };

    loadHome();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const dayTabs = useMemo(
    () => Array.from({ length: 8 }).map((_, index) => {
      const day = moment().add(index, "days");
      const key = day.format("YYYY-MM-DD");
      const count = activityState.items.filter((item) => item.dayKey === key).length;
      return {
        key,
        label: index === 0 ? "Today" : day.format("ddd"),
        date: day.format("D"),
        count,
      };
    }),
    [activityState.items],
  );

  const filteredActivities = useMemo(
    () => activityState.items.filter((item) => item.dayKey === selectedDay).filter((item) => (selectedType === "all" ? true : item.type === selectedType)),
    [activityState.items, selectedDay, selectedType],
  );

  const counts = useMemo(() => {
    const sameDay = activityState.items.filter((item) => item.dayKey === selectedDay);
    return {
      all: sameDay.length,
      private: sameDay.filter((item) => item.type === "private").length,
      group: sameDay.filter((item) => item.type === "group").length,
      match: 0,
    };
  }, [activityState.items, selectedDay]);

  const onOpenActivity = (activity) => {
    if (!activity.lessonId) return;
    if (activity.type === "group") navigate(`/group-lessons/${activity.lessonId}`);
    else navigate(`/player/lesson/${activity.lessonId}`);
  };

  const scheduleItems = scheduleState.items;

  const handlePlaceSelected = (place) => {
    const nextLocation = pickString(place?.name, place?.formatted_address);
    if (nextLocation) setLocationName(nextLocation);
  };

  return (
    <div className="player-home">
      <header className="ph-header">
        <div className="ph-brand"><span>🎾</span><strong>The Tennis <em>Plan</em></strong></div>
        <nav className="ph-nav-desktop">
          <Link className="active" to="/">🏠 Home</Link>
          <Link to="/matches/create">🏆 Post Match</Link>
          <Link to="/notifications">🔔 Alerts <span className="badge">2</span></Link>
        </nav>
        <div className="ph-header-right">
          <button className="ph-location" type="button" onClick={() => setIsLocationOpen(true)}>
            <MapPin size={14} /> {locationName} <ChevronDown size={14} />
          </button>
          <button className="ph-avatar" type="button">{initials || "PC"}</button>
        </div>
      </header>

      <main className="ph-main">
        <section className="ph-welcome">
          <h1>Welcome back, {firstName}! 👋</h1>
          <p>You have {scheduleItems.length} sessions this week</p>
        </section>

        <section className="ph-quick-actions">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.to} className="ph-quick-action">
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </Link>
          ))}
        </section>

        <section className="ph-content-grid">
          {scheduleState.status === "ready" && scheduleItems.length > 0 ? (
            <aside className="ph-schedule">
              <div className="ph-card-head">
                <h2>📅 My Schedule</h2>
                <Link to="/player/calendar">View All →</Link>
              </div>
              {scheduleItems.slice(0, 3).map((item) => (
                <button key={item.id} type="button" className="ph-schedule-item" onClick={() => item.lessonId && navigate(item.type === "group" ? `/group-lessons/${item.lessonId}` : `/player/lesson/${item.lessonId}`)}>
                  <div>
                    <p>{item.time}</p>
                    <h3>{item.title}</h3>
                    <small>📍 {item.location}</small>
                  </div>
                  <span>›</span>
                </button>
              ))}
            </aside>
          ) : null}

          <section className="ph-play-today">
            <div className="ph-card-head"><h2>Play Today</h2></div>

            <div className="ph-day-tabs">
              {dayTabs.map((day) => (
                <button key={day.key} type="button" className={`ph-day-tab${selectedDay === day.key ? " active" : ""}`} onClick={() => setSelectedDay(day.key)}>
                  <span>{day.label}</span>
                  <strong>{day.date}</strong>
                  <small>{day.count}</small>
                </button>
              ))}
              <button type="button" className="ph-day-tab picker"><CalendarDays size={14} /><small>Pick</small></button>
            </div>

            <div className="ph-type-tabs">
              <button type="button" className={selectedType === "all" ? "active" : ""} onClick={() => setSelectedType("all")}>All {counts.all}</button>
              <button type="button" className={selectedType === "private" ? "active" : ""} onClick={() => setSelectedType("private")}>Lessons</button>
              <button type="button" className={selectedType === "group" ? "active" : ""} onClick={() => setSelectedType("group")}>Groups</button>
              <button type="button" className={selectedType === "match" ? "active" : ""} onClick={() => setSelectedType("match")}>Matches</button>
            </div>

            {activityState.status === "loading" || activityState.status === "idle" ? (
              <div className="ph-feedback">Loading activities…</div>
            ) : filteredActivities.length === 0 ? (
              <div className="ph-empty">
                <div>📅</div>
                <h3>Nothing available today</h3>
                <p>Check tomorrow or post your own match</p>
                <Link to="/matches/create">🏆 Post a Match</Link>
              </div>
            ) : (
              <div className="ph-activities">
                {filteredActivities.map((activity) => (
                  <button key={activity.id} type="button" className={`ph-activity ${activity.type}`} onClick={() => onOpenActivity(activity)}>
                    <div className="avatar">{activity.type === "group" ? "👥" : "SM"}</div>
                    <div>
                      <p className="label">{activity.label}</p>
                      <h3>{activity.title}</h3>
                      <small>📍 {activity.location}</small>
                    </div>
                    <div className="meta">
                      <p>{activity.time}</p>
                      <strong>{activity.price ? `$${activity.price}` : "Available"}</strong>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>

      <nav className="ph-bottom-nav">
        <Link className="active" to="/">🏠<span>Home</span></Link>
        <Link to="/matches/create">🏆<span>Post Match</span></Link>
        <Link to="/notifications">🔔<span>Alerts</span></Link>
        <Link to="/settings/profile">👤<span>Profile</span></Link>
      </nav>

      {isLocationOpen ? (
        <div className="ph-location-overlay" onClick={() => setIsLocationOpen(false)}>
          <div className="ph-location-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="handle" />
            <h3>Choose Location</h3>
            <div className="search">
              <Autocomplete
                apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                placeholder="🔍 Search courts or neighborhoods..."
                className="ph-location-search-input"
                onPlaceSelected={handlePlaceSelected}
                options={{
                  types: ["geocode", "establishment"],
                  fields: ["formatted_address", "name"],
                }}
              />
            </div>
            <p className="section">CURRENT</p>
            <div className="current">📍 Venice, CA <span>✓</span></div>
            <p className="section">NEARBY COURTS</p>
            {locationItems.map((item) => (
              <div key={item.name} className="location-item">
                <div><strong>🎾 {item.name}</strong><small>{item.detail}</small></div>
                <span>{item.distance}</span>
              </div>
            ))}
            <div className="radius"><span>Search Radius</span><strong>5 mi</strong></div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;
