import { useNavigate } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import usePlayerIdentity from "../hooks/usePlayerIdentity";

const stats = [
  { label: "Matches", value: "8", change: "+2 this week" },
  { label: "Lessons", value: "4", change: "Next lesson in 2d" },
  { label: "Players", value: "12", change: "3 new invites" },
  { label: "Wins", value: "47", change: "Win rate 78%" },
];

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
    title: "Find Courts",
    description: "Book the perfect court time at nearby clubs.",
    action: "Explore",
    accent: "#0ea5e9",
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

  return (
    <MainLayout>
      <section className="hero-card">
        <div className="hero-header">
          <div className="hero-text">
            <h1>Welcome Back, {displayName}!</h1>
            <p>Your complete tennis platform for matches, players, coaches, and courts.</p>
          </div>
          <div className="tag">Season Pass Active</div>
        </div>
        <div className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <span className="stat-label">{stat.label}</span>
              <span className="stat-value">{stat.value}</span>
              <span className="stat-change">{stat.change}</span>
            </div>
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
          <button type="button" className="section-cta">
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
