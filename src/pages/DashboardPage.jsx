import moment from "moment";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPlayerFutureGroupLessons, getPlayerFutureLessons } from "../api/playerHome";
import MainLayout from "../components/MainLayout";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";

const pickString = (...values) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = moment(value);
  if (!date.isValid()) {
    return null;
  }
  return date.toDate();
};

const formatDurationLabel = (startAt, endAt) => {
  if (!startAt || !endAt) return null;
  const minutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) {
    return `${hours} hr ${remainingMinutes} min`;
  }
  if (hours) {
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }
  return `${minutes} min`;
};

const formatStatusLabel = (value) => {
  if (!value) return null;
  return value
    .toString()
    .replace(/[_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
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
    .map((lesson) => {
      const startAt = parseDate(
        lesson.startTime ??
          lesson.start_time ??
          lesson.start_at ??
          lesson.start ??
          lesson.startDate ??
          lesson.starts_at,
      );
      const endAt = parseDate(
        lesson.endTime ??
          lesson.end_time ??
          lesson.end_at ??
          lesson.end ??
          lesson.endDate ??
          lesson.ends_at,
      );

      const idSource =
        lesson.id ??
        lesson.lesson_id ??
        lesson.lessonId ??
        lesson.booking_id ??
        lesson.uuid ??
        lesson.slug ??
        (startAt ? `${type}-${startAt.toISOString()}` : null);
      const id = `${type}-${idSource ?? Math.random().toString(36).slice(2)}`;

      const coach = lesson.coach ?? lesson.instructor ?? lesson.pro ?? {};
      const coachFullName = [coach.firstName ?? coach.first_name, coach.lastName ?? coach.last_name]
        .filter((part) => typeof part === "string" && part.trim())
        .join(" ");
      const coachName =
        pickString(
          lesson.coach_name,
          lesson.coachName,
          lesson.instructor_name,
          coachFullName,
          coach.name,
          coach.full_name,
          coach.fullName,
        ) || null;
      const coachLabel =
        coachName && /^coach\s+/i.test(coachName)
          ? coachName
          : coachName
            ? `Coach ${coachName}`
            : null;

      const locationLabel =
        pickString(
          lesson.location_name,
          lesson.locationName,
          lesson.location,
          lesson.location_label,
          lesson.locationLabel,
          lesson.court_name,
          lesson.court,
          lesson.facility_name,
          lesson.facility,
          lesson.address,
          lesson.venue_name,
          lesson.venueName,
        ) ||
        pickString(
          lesson?.location?.name,
          lesson?.location?.title,
          lesson?.location?.label,
          lesson?.venue?.name,
          lesson?.venue?.title,
          lesson?.coach_location?.name,
        );

      const rawStatus =
        pickString(lesson.status, lesson.registration_status, lesson.booking_status, lesson.lesson_status) ||
        null;
      const statusLabel = rawStatus ? formatStatusLabel(rawStatus) : null;

      const title =
        pickString(
          lesson.title,
          lesson.lesson_title,
          lesson.name,
          lesson.lesson_name,
          lesson.program_name,
          lesson.series_name,
          lesson.description,
        ) || (type === "group" ? "Group Session" : "Private Lesson");

      const badgeLabel =
        type === "group"
          ? "Group Session"
          : pickString(
              lesson.program_type,
              lesson.programName,
              lesson.program_label,
              lesson.category,
              lesson.type,
            );

      const durationLabel = formatDurationLabel(startAt, endAt);
      const dayLabel = startAt ? moment(startAt).format("ddd, MMM D") : null;
      const timeRangeLabel =
        startAt && endAt
          ? `${moment(startAt).format("h:mm A")} – ${moment(endAt).format("h:mm A")}`
          : startAt
            ? moment(startAt).format("h:mm A")
            : null;

      return {
        id,
        title,
        coachLabel,
        locationLabel: locationLabel ?? "Location TBD",
        statusLabel,
        badgeLabel,
        startAt,
        endAt,
        timeLabel: dayLabel ?? "Date TBD",
        secondaryLabel: timeRangeLabel ?? "Time TBD",
        durationLabel,
        type,
      };
    })
    .filter(Boolean);

const playColumns = [
  {
    id: "matches",
    title: "Open Matches",
    subtitle: "Competitive and social play near you.",
    available: "12 available",
    cta: "Browse Matches",
    ctaPath: "/matches",
    items: [
      {
        id: "match-1",
        label: "Today · 5:30 PM",
        title: "Sunset Rally at Riverside Courts",
        meta: ["Advanced Doubles", "2 spots left"],
        highlight: "Starting Soon",
      },
      {
        id: "match-2",
        label: "Sat · 10:00 AM",
        title: "Competitive Singles at Beverly Hills Club",
        meta: ["USTA 4.0", "90 min"],
        spots: "4 spots left",
      },
      {
        id: "match-3",
        label: "Tomorrow · 7:15 PM",
        title: "Mixed Doubles Ladder Night",
        meta: ["City Center Courts", "Level 3.5 - 4.0"],
      },
    ],
  },
  {
    id: "lessons",
    title: "Private Lessons",
    subtitle: "One-on-one coaching with trusted pros.",
    available: "8 available",
    cta: "Book a Lesson",
    ctaPath: "/find-coaches",
    items: [
      {
        id: "lesson-1",
        label: "Today · 4:30 PM",
        title: "Coach Maria — Serve Technique",
        meta: ["LA Tennis Complex", "60 min"],
        highlight: "Featured",
      },
      {
        id: "lesson-2",
        label: "Tomorrow · 9:00 AM",
        title: "Coach David — Match Strategy",
        meta: ["Downtown Racquet Club", "90 min"],
        spots: "1 spot open",
      },
      {
        id: "lesson-3",
        label: "Mon · 6:15 PM",
        title: "Coach Jamie — Footwork Foundations",
        meta: ["Westside Courts", "60 min"],
      },
    ],
  },
  {
    id: "groups",
    title: "Group Sessions",
    subtitle: "High-energy clinics and programs.",
    available: "7 available",
    cta: "View Group Sessions",
    ctaPath: "/group-lessons",
    items: [
      {
        id: "group-1",
        label: "Today · 7:00 PM",
        title: "Cardio Tennis Workout",
        meta: ["Fitness Center Courts", "All levels"],
        highlight: "Popular",
      },
      {
        id: "group-2",
        label: "Tomorrow · 6:30 PM",
        title: "Doubles Strategy Clinic",
        meta: ["Harbor Point Club", "4 spots left"],
      },
      {
        id: "group-3",
        label: "Sun · 8:30 AM",
        title: "Junior Development Squad",
        meta: ["Meadowbrook Courts", "Ages 12-15"],
      },
    ],
  },
];

const quickActions = [
  {
    id: "matches",
    title: "Browse Matches",
    description: "See upcoming matches and find the perfect competition.",
    action: "Join Match",
    className: "matches",
  },
  {
    id: "players",
    title: "Find Players",
    description: "Connect with partners that match your skill level.",
    action: "Find Players",
    className: "players",
  },
  {
    id: "lessons",
    title: "Group Lessons",
    description: "Level up your skills with small-group coaching.",
    action: "View Lessons",
    className: "groups",
  },
  {
    id: "coaches",
    title: "Find Coaches",
    description: "Explore top-rated coaches near you.",
    action: "View Coaches",
    className: "coaches",
  },
];

const matches = [
  {
    type: "Doubles",
    title: "Friendly Ladder",
    details: ["Tomorrow • 6:30 PM", "Court 4 • 2 spots left"],
  },
  {
    type: "Singles",
    title: "Skill Challenge",
    details: ["Thursday • 5:00 PM", "Court 1 • Intermediate"],
  },
  {
    type: "Cardio",
    title: "Endurance Clinic",
    details: ["Saturday • 9:00 AM", "Fitness Center • 6 spots"],
  },
];

const coaches = [
  { name: "Mia Roberts", speciality: "USTA Certified", rating: "4.9", sessions: "32 lessons" },
  { name: "David Park", speciality: "High Performance", rating: "4.8", sessions: "28 lessons" },
  { name: "Jamie Lee", speciality: "Junior Development", rating: "4.9", sessions: "19 lessons" },
  { name: "Carlos Ramirez", speciality: "Serve Specialist", rating: "4.7", sessions: "24 lessons" },
];

const bottomActions = [
  {
    title: "AI Match Me",
    description: "Get matched instantly with players at your level.",
    action: "Start",
    accent: "#16a34a",
  },
  {
    title: "Get Gear",
    description: "Shop curated gear recommended by pros.",
    action: "Shop",
    accent: "#f97316",
  },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { displayName } = usePlayerIdentity();
  const [locationState, setLocationState] = useState({
    status: "idle",
    coords: null,
    error: null,
    accuracyMiles: null,
    locationName: null,
    lookupFailed: false,
  });
  const [selectedRadius, setSelectedRadius] = useState("10 mi");
  const [scheduleState, setScheduleState] = useState({
    status: "idle",
    items: [],
    error: null,
  });

  const distanceOptions = ["5 mi", "10 mi", "15 mi", "20 mi", "All"];

  const formatCoordinatesLabel = (coords) => {
    if (!coords) {
      return "Your area";
    }

    const latitude = Math.abs(coords.latitude).toFixed(2);
    const longitude = Math.abs(coords.longitude).toFixed(2);
    const latHemisphere = coords.latitude >= 0 ? "N" : "S";
    const lonHemisphere = coords.longitude >= 0 ? "E" : "W";

    return `${latitude}° ${latHemisphere}, ${longitude}° ${lonHemisphere}`;
  };

  const resolveLocationName = async (coords) => {
    if (!coords) {
      return;
    }

    try {
      const query = new URLSearchParams({
        format: "jsonv2",
        lat: coords.latitude.toString(),
        lon: coords.longitude.toString(),
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to lookup location");
      }

      const data = await response.json();
      const address = data?.address ?? {};

      const locality =
        address.city ||
        address.town ||
        address.village ||
        address.hamlet ||
        address.suburb ||
        address.county;
      const region = address.state || address.region;
      const countryCode = address.country_code ? address.country_code.toUpperCase() : null;

      const labelParts = [locality, region, countryCode].filter(Boolean);
      const locationLabel = labelParts.length
        ? labelParts.join(", ")
        : data?.display_name?.split(",").slice(0, 2).join(", ") || null;

      setLocationState((previous) => {
        if (previous.status !== "ready") {
          return previous;
        }

        return {
          ...previous,
          locationName: locationLabel,
          lookupFailed: !locationLabel,
        };
      });
    } catch (error) {
      console.error("Failed to resolve location", error);
      setLocationState((previous) => {
        if (previous.status !== "ready") {
          return previous;
        }

        return {
          ...previous,
          locationName: null,
          lookupFailed: true,
        };
      });
    }
  };

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationState({
        status: "error",
        coords: null,
        error: "Location services are not supported in this browser.",
        accuracyMiles: null,
        locationName: null,
        lookupFailed: false,
      });
      return;
    }

    setLocationState((previous) => ({
      ...previous,
      status: "loading",
      error: null,
      lookupFailed: false,
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { coords } = position;
        const accuracyMiles = coords.accuracy
          ? Math.max(1, Math.round(coords.accuracy / 1609.34))
          : null;

        setLocationState({
          status: "ready",
          coords,
          error: null,
          accuracyMiles,
          locationName: null,
          lookupFailed: false,
        });
        resolveLocationName(coords);
      },
      (error) => {
        setLocationState({
          status: "error",
          coords: null,
          error: error.message || "We couldn't determine your location.",
          accuracyMiles: null,
          locationName: null,
          lookupFailed: false,
        });
      }
    );
  };

  useEffect(() => {
    detectLocation();
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

      setScheduleState((previous) => ({
        ...previous,
        status: "loading",
        error: null,
      }));

      try {
        const [lessonsResponse, groupLessonsResponse] = await Promise.all([
          getPlayerFutureLessons({ token, perPage: 5, signal: controller.signal }),
          getPlayerFutureGroupLessons({ token, perPage: 5, signal: controller.signal }),
        ]);

        if (cancelled) return;

        const privateLessons = buildScheduleItems(extractLessons(lessonsResponse), "lesson");
        const groupLessons = buildScheduleItems(extractLessons(groupLessonsResponse), "group");
        const combined = [...privateLessons, ...groupLessons].sort((a, b) => {
          if (a.startAt && b.startAt) {
            return a.startAt.getTime() - b.startAt.getTime();
          }
          if (a.startAt) return -1;
          if (b.startAt) return 1;
          return 0;
        });

        const annotated = combined.map((item, index) => ({
          ...item,
          highlight: index === 0 && !!item.startAt,
        }));

        setScheduleState({
          status: "ready",
          items: annotated,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load upcoming lessons", error);
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

  const locationChipLabel = () => {
    if (locationState.status === "ready") {
      if (locationState.locationName) {
        return locationState.locationName;
      }

      if (locationState.coords) {
        return formatCoordinatesLabel(locationState.coords);
      }

      return "Your area";
    }

    if (locationState.status === "loading") {
      return "Locating…";
    }

    if (locationState.status === "error") {
      return "Location unavailable";
    }

    return "Use my location";
  };

  return (
    <MainLayout>
      <section className="play-hero">
        <div className="play-hero__intro">
          <div className="play-hero__lead">
            <div className="play-hero__text">
              <p className="play-hero__eyebrow">Ready to Play?</p>
              <h1>Welcome back, {displayName}. Let&rsquo;s get you on court.</h1>
              <p className="play-hero__subtitle">
                Discover curated matches, lessons, and group sessions tailored to your level and
                schedule.
              </p>
            </div>
            <div
              className={`play-hero__location-surface play-hero__location-surface--${locationState.status}`}
            >
              <div className="play-hero__location-row">
                <div className="play-hero__location-group">
                  <button
                    type="button"
                    className={`play-hero__distance-chip play-hero__distance-chip--location play-hero__distance-chip--${locationState.status}`}
                    aria-label="Current location"
                    onClick={detectLocation}
                    disabled={locationState.status === "loading"}
                  >
                    <MapPin size={16} strokeWidth={2} />
                    <span>{locationChipLabel()}</span>
                  </button>
                  {distanceOptions.map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      className={`play-hero__distance-chip${
                        selectedRadius === radius ? " play-hero__distance-chip--active" : ""
                      }`}
                      onClick={() => setSelectedRadius(radius)}
                    >
                      {radius}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="play-hero__status">
            <div className="play-hero__status-card">
              <span className="play-hero__status-label">Next booking</span>
              <span className="play-hero__status-value">Today · 5:30 PM</span>
              <span className="play-hero__status-meta">Court 4 with Jamie</span>
            </div>
          </div>
        </div>
        <div className="play-hero__grid">
          {playColumns.map((column) => (
            <article key={column.id} className={`play-card ${column.id}`}>
              <header className="play-card__header">
                <div>
                  <h2 className="play-card__title">{column.title}</h2>
                  <p className="play-card__subtitle">{column.subtitle}</p>
                </div>
                <span className="play-card__count">{column.available}</span>
              </header>
              <ul className="play-card__list">
                {column.items.map((item) => (
                  <li
                    key={item.id}
                    className={`play-card__item${item.highlight ? " is-highlight" : ""}`}
                  >
                    <div className="play-card__item-top">
                      <span className="play-card__label">{item.label}</span>
                      {item.highlight ? <span className="play-card__pill">{item.highlight}</span> : null}
                    </div>
                    <div className="play-card__item-title">{item.title}</div>
                    <div className="play-card__meta">
                      {item.meta.map((meta) => (
                        <span key={meta}>{meta}</span>
                      ))}
                    </div>
                    {item.spots ? <div className="play-card__spots">{item.spots}</div> : null}
                  </li>
                ))}
              </ul>
              <footer className="play-card__footer">
                <button
                  type="button"
                  className="play-card__cta"
                  onClick={() => navigate(column.ctaPath)}
                >
                  {column.cta}
                </button>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="schedule">
        <div className="section-header">
          <div>
            <h2 className="section-title">My Schedule</h2>
            <p className="section-subtitle">Your upcoming matches and coaching sessions for the day.</p>
          </div>
          <button
            type="button"
            className="section-cta"
            onClick={() => navigate("/player/calendar")}
          >
            View Calendar
          </button>
        </div>
        {scheduleState.status === "loading" || scheduleState.status === "idle" ? (
          <div className="schedule-feedback">Loading your schedule…</div>
        ) : scheduleState.status === "error" ? (
          <div className="schedule-feedback schedule-feedback--error">
            We couldn&rsquo;t load your upcoming lessons. Please try again.
          </div>
        ) : scheduleState.status === "unauthenticated" ? (
          <div className="schedule-feedback">Sign in to view your upcoming lessons.</div>
        ) : scheduleState.items.length === 0 ? (
          <div className="schedule-feedback">
            You don&rsquo;t have any upcoming lessons yet. Book a session to get started!
          </div>
        ) : (
          <div className="schedule-grid">
            {scheduleState.items.map((item) => (
              <article key={item.id} className={`schedule-card${item.highlight ? " primary" : ""}`}>
                <div className="schedule-time">
                  <span>{item.timeLabel}</span>
                  <span>{item.secondaryLabel}</span>
                </div>
                <div>
                  <div className="schedule-title">{item.title}</div>
                  {item.coachLabel ? <div className="schedule-meta">{item.coachLabel}</div> : null}
                  {item.locationLabel ? <div className="schedule-meta">{item.locationLabel}</div> : null}
                  {item.durationLabel ? <div className="schedule-meta">⏱ {item.durationLabel}</div> : null}
                </div>
                {item.badgeLabel ? <div className="tag">{item.badgeLabel}</div> : null}
                {item.statusLabel ? <div className="status-badge">{item.statusLabel}</div> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section" id="quick-actions">
        <div className="section-header">
          <div>
            <h2 className="section-title">Quick Actions</h2>
            <p className="section-subtitle">Find matches, players, and coaching in just a few taps.</p>
          </div>
        </div>
        <div className="quick-actions-grid">
          {quickActions.map((action) => (
            <article key={action.id} className={`quick-card ${action.className}`} id={action.id}>
              <div>
                <div className="title">{action.title}</div>
                <div className="description">{action.description}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (action.id === "matches") {
                    navigate("/matches");
                    return;
                  }
                  if (action.id === "coaches") {
                    navigate("/find-coaches");
                  }
                }}
              >
                {action.action}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="matches">
        <div className="section-header">
          <div>
            <h2 className="section-title">Matches Near You</h2>
            <p className="section-subtitle">Join competitive and social matches happening soon.</p>
          </div>
          <button
            type="button"
            className="section-cta"
            onClick={() => navigate("/matches/create")}
          >
            + Create Match
          </button>
        </div>
        <div className="matches-grid">
          {matches.map((match) => (
            <article key={match.title} className="match-card">
              <div className="match-type">{match.type}</div>
              <div className="match-title">{match.title}</div>
              <div className="match-meta">
                {match.details.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </div>
              <button type="button" className="join-btn">
                Join Match
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="coaches">
        <div className="section-header">
          <div>
            <h2 className="section-title">Featured Coaches</h2>
            <p className="section-subtitle">Top coaches with stellar reviews from players like you.</p>
          </div>
          <button type="button" className="section-cta">
            View All Coaches
          </button>
        </div>
        <div className="coaches-grid">
          {coaches.map((coach) => (
            <article key={coach.name} className="coach-card">
              <div className="coach-avatar">{coach.name.split(" ").map((part) => part[0]).join("")}</div>
              <div className="coach-name">{coach.name}</div>
              <div className="coach-speciality">{coach.speciality}</div>
              <div className="coach-speciality">{coach.sessions}</div>
              <div className="rating">⭐ {coach.rating}</div>
              <button type="button" className="coach-btn">
                Book Session
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="bottom-actions" id="activity">
        {bottomActions.map((action) => (
          <article key={action.title} className="bottom-card" style={{ borderTop: `4px solid ${action.accent}` }}>
            <h3>{action.title}</h3>
            <p>{action.description}</p>
            <button type="button" style={{ background: action.accent }}>
              {action.action}
            </button>
          </article>
        ))}
      </section>
    </MainLayout>
  );
};

export default DashboardPage;
