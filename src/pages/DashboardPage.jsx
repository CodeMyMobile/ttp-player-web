import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import usePlayerIdentity from "../hooks/usePlayerIdentity";

const schedule = [
  {
    time: "8:00 AM",
    duration: "60 min",
    title: "Morning Training",
    coach: "Coach Maria",
    location: "Court 3",
    highlight: true,
    badge: "Performance Focus",
  },
  {
    time: "11:30 AM",
    duration: "45 min",
    title: "Doubles Match",
    coach: "With Alex & Jamie",
    location: "Court 6",
    status: "Confirmed",
  },
  {
    time: "2:00 PM",
    duration: "30 min",
    title: "Strategy Session",
    coach: "Coach David",
    location: "Clubhouse",
    status: "Reminder",
  },
];

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
  });
  const [lastUpdated, setLastUpdated] = useState(null);

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationState({
        status: "error",
        coords: null,
        error: "Location services are not supported in this browser.",
        accuracyMiles: null,
      });
      setLastUpdated(null);
      return;
    }

    setLocationState((previous) => ({
      ...previous,
      status: "loading",
      error: null,
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
        });
        setLastUpdated(new Date());
      },
      (error) => {
        setLocationState({
          status: "error",
          coords: null,
          error: error.message || "We couldn't determine your location.",
          accuracyMiles: null,
        });
        setLastUpdated(null);
      }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const locationRadiusBodyCopy = () => {
    if (!locationState.accuracyMiles) {
      return "your area";
    }

    if (locationState.accuracyMiles === 1) {
      return "a 1-mile radius";
    }

    return `a ${locationState.accuracyMiles}-mile radius`;
  };

  const locationChipLabel = () => {
    if (locationState.status === "ready") {
      if (locationState.accuracyMiles) {
        return `${locationState.accuracyMiles}-mile radius`;
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
          <div className="play-hero__text">
            <p className="play-hero__eyebrow">Ready to Play?</p>
            <h1>Welcome back, {displayName}. Let&rsquo;s get you on court.</h1>
            <p className="play-hero__subtitle">
              Discover curated matches, lessons, and group sessions tailored to your level and
              schedule.
            </p>
          </div>
          <div className="play-hero__status">
            <div className="play-hero__status-card">
              <span className="play-hero__status-label">Next booking</span>
              <span className="play-hero__status-value">Today · 5:30 PM</span>
              <span className="play-hero__status-meta">Court 4 with Jamie</span>
            </div>
            <div
              className={`play-hero__location-card play-hero__location-card--${locationState.status}`}
            >
              <div className="play-hero__location-header">
                <div className="play-hero__location-heading">
                  <div className="play-hero__location-label">Nearby opportunities</div>
                  <div
                    className={`play-hero__location-chip play-hero__location-chip--${locationState.status}`}
                  >
                    <MapPin size={16} strokeWidth={2} />
                    <span>{locationChipLabel()}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="play-hero__location-button"
                  onClick={detectLocation}
                  disabled={locationState.status === "loading"}
                >
                  {locationState.status === "loading" ? "Locating…" : "Update location"}
                </button>
              </div>
              <div className="play-hero__location-body">
                {locationState.status === "ready" ? (
                  <>
                    <div className="play-hero__location-value">
                      Tuned to {locationRadiusBodyCopy()} near you
                    </div>
                    {locationState.coords ? (
                      <div className="play-hero__location-meta">
                        Lat {locationState.coords.latitude.toFixed(2)}°, Lon {" "}
                        {locationState.coords.longitude.toFixed(2)}°
                      </div>
                    ) : null}
                    {lastUpdated ? (
                      <div className="play-hero__location-meta">
                        Updated at {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {locationState.status === "idle" ? (
                  <>
                    <div className="play-hero__location-value">
                      Use your location to prioritize courts and sessions nearby.
                    </div>
                    <div className="play-hero__location-meta">
                      We only use your approximate area to tailor recommendations.
                    </div>
                  </>
                ) : null}

                {locationState.status === "loading" ? (
                  <>
                    <div className="play-hero__location-value">Checking your area…</div>
                    <div className="play-hero__location-meta">
                      This helps surface matches and events within reach.
                    </div>
                  </>
                ) : null}

                {locationState.status === "error" ? (
                  <>
                    <div className="play-hero__location-value play-hero__location-value--error">
                      We couldn't confirm your location.
                    </div>
                    {locationState.error ? (
                      <div className="play-hero__location-meta">{locationState.error}</div>
                    ) : null}
                  </>
                ) : null}
              </div>
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
          <button type="button" className="section-cta">
            View Calendar
          </button>
        </div>
        <div className="schedule-grid">
          {schedule.map((item) => (
            <article key={item.title} className={`schedule-card${item.highlight ? " primary" : ""}`}>
              <div className="schedule-time">
                <span>{item.time}</span>
                <span>{item.duration}</span>
              </div>
              <div>
                <div className="schedule-title">{item.title}</div>
                <div className="schedule-meta">{item.coach}</div>
                <div className="schedule-meta">{item.location}</div>
              </div>
              {item.badge ? <div className="tag">{item.badge}</div> : null}
              {item.status ? <div className="status-badge">{item.status}</div> : null}
            </article>
          ))}
        </div>
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
