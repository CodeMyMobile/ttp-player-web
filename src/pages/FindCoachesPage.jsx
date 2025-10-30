import { useEffect, useMemo, useState } from "react";
import PlayerHeader from "../components/PlayerHeader";
import ProfileManager from "../components/ProfileManager";
import { useAuth } from "../context/AuthContext";
import { getDisplayName } from "../utils/userDisplay";

const coachData = [
  {
    id: "maria-santos",
    name: "Maria Santos",
    rating: 4.9,
    reviewCount: 127,
    rate: 85,
    experience:
      "Former college player with 10+ years coaching experience. Specializing in serve technique and match strategy.",
    focus: "I help players develop consistent serves and smart court positioning.",
    specialties: ["Serve Technique", "Match Strategy", "Tournament Prep"],
    locations: ["Oceanside Tennis Center", "Vista Courts", "Carlsbad Tennis Club"],
    lessonTypes: ["Private Lessons", "Video Analysis", "Group Lessons"],
    availability: "Morning & Evening",
    avatarColor: "#f59e0b",
  },
  {
    id: "david-park",
    name: "David Park",
    rating: 4.8,
    reviewCount: 98,
    rate: 75,
    experience:
      "USTA certified coach focused on mental toughness and adaptive strategy for competitive players.",
    focus: "Structured programs to build confidence under pressure.",
    specialties: ["Mental Game", "Footwork", "Match Review"],
    locations: ["North Coast Tennis", "Vista Courts"],
    lessonTypes: ["Private Lessons", "Match Play", "Group Lessons"],
    availability: "Afternoon & Evening",
    avatarColor: "#3b82f6",
  },
  {
    id: "sarah-martinez",
    name: "Sarah Martinez",
    rating: 4.9,
    reviewCount: 142,
    rate: 95,
    experience:
      "Former national junior champion. Expert in mental game and building competition readiness.",
    focus: "Helping players create game plans tailored to their strengths.",
    specialties: ["Game Planning", "Mental Game", "Competitive Play"],
    locations: ["South Bay Courts", "Carlsbad Tennis Club"],
    lessonTypes: ["Private Lessons", "Tournament Coaching"],
    availability: "Weekday Mornings",
    avatarColor: "#ec4899",
  },
  {
    id: "michael-chen",
    name: "Michael Chen",
    rating: 4.7,
    reviewCount: 76,
    rate: 70,
    experience:
      "USTA high performance certified. Focused on doubles tactics and adaptive strategy.",
    focus: "Transforming doubles play with smart formations and communication.",
    specialties: ["Doubles Strategy", "Serve & Volley", "Video Analysis"],
    locations: ["Oceanside Tennis Center", "North Coast Tennis"],
    lessonTypes: ["Doubles Clinics", "Group Lessons", "Private Lessons"],
    availability: "Evenings & Weekends",
    avatarColor: "#10b981",
  },
  {
    id: "jennifer-wilson",
    name: "Jennifer Wilson",
    rating: 4.8,
    reviewCount: 84,
    rate: 80,
    experience:
      "Specializes in adult beginners and building strong foundations with video feedback.",
    focus: "Creating confident fundamentals with supportive coaching.",
    specialties: ["Adult Beginners", "Consistency", "Video Analysis"],
    locations: ["Vista Courts", "Downtown Tennis Pavilion"],
    lessonTypes: ["Private Lessons", "Group Lessons"],
    availability: "Weekday Evenings",
    avatarColor: "#6366f1",
  },
  {
    id: "robert-johnson",
    name: "Robert Johnson",
    rating: 4.6,
    reviewCount: 65,
    rate: 72,
    experience:
      "High school coach helping junior players improve match confidence.",
    focus: "Building reliable rally patterns and focused practice sessions.",
    specialties: ["Junior Players", "Match Confidence", "Footwork"],
    locations: ["Carlsbad Tennis Club", "Vista Courts"],
    lessonTypes: ["Private Lessons", "Group Lessons", "Match Play"],
    availability: "Afternoon & Weekends",
    avatarColor: "#f97316",
  },
];

const lessonTypeFilters = ["All Lessons", "Private Lessons", "Group Lessons", "Match Play", "Video Analysis"];

const locationFilters = ["All Locations", "Oceanside Tennis Center", "Vista Courts", "Carlsbad Tennis Club", "North Coast Tennis", "South Bay Courts", "Downtown Tennis Pavilion"];

const FindCoachesPage = () => {
  const { user } = useAuth();
  const [isProfileManagerOpen, setProfileManagerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(locationFilters[0]);
  const [selectedLesson, setSelectedLesson] = useState(lessonTypeFilters[0]);
  const [selectedCoachId, setSelectedCoachId] = useState(coachData[0].id);

  const rawDisplayName = useMemo(() => getDisplayName(user), [user]);
  const headerDisplayName = rawDisplayName === "Player" ? "Paul" : rawDisplayName;
  const greetingName = rawDisplayName === "Player" ? "there" : rawDisplayName;

  const filteredCoaches = useMemo(() => {
    return coachData.filter((coach) => {
      const matchesSearch = coach.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
      const matchesLocation =
        selectedLocation === locationFilters[0] || coach.locations.includes(selectedLocation);
      const matchesLesson =
        selectedLesson === lessonTypeFilters[0] || coach.lessonTypes.includes(selectedLesson);
      return matchesSearch && matchesLocation && matchesLesson;
    });
  }, [searchTerm, selectedLocation, selectedLesson]);

  useEffect(() => {
    if (!filteredCoaches.some((coach) => coach.id === selectedCoachId)) {
      setSelectedCoachId(filteredCoaches[0]?.id ?? null);
    }
  }, [filteredCoaches, selectedCoachId]);

  const selectedCoach = filteredCoaches.find((coach) => coach.id === selectedCoachId) || filteredCoaches[0];

  const handleBackToList = () => {
    if (typeof window === "undefined") {
      return;
    }
    const listElement = window.document.querySelector(".coach-results-grid");
    if (listElement) {
      listElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="find-coaches-page">
      <PlayerHeader
        onManageProfile={() => setProfileManagerOpen(true)}
        displayNameOverride={headerDisplayName}
      />
      <main className="coaches-layout">
        <section className="coaches-browser">
          <div className="coaches-browser-header">
            <div>
              <h1>Find Coaches</h1>
              <p>Discover certified coaches to take your game further, {greetingName}.</p>
            </div>
            <div className="coach-results-count">{filteredCoaches.length} coaches found</div>
          </div>
          <div className="coaches-filters">
            <label className="filter-field">
              <span>Location</span>
              <select value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>
                {locationFilters.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>Lesson Type</span>
              <select value={selectedLesson} onChange={(event) => setSelectedLesson(event.target.value)}>
                {lessonTypeFilters.map((lesson) => (
                  <option key={lesson} value={lesson}>
                    {lesson}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field search">
              <span>Search by coach name</span>
              <input
                type="search"
                placeholder="Search coaches"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
          </div>
          <div className="coach-results-grid">
            {filteredCoaches.map((coach) => {
              const isSelected = coach.id === selectedCoach?.id;
              return (
                <article
                  key={coach.id}
                  className={`coach-result-card${isSelected ? " selected" : ""}`}
                  onClick={() => setSelectedCoachId(coach.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedCoachId(coach.id);
                    }
                  }}
                >
                  <div className="coach-card-header">
                    <div className="coach-avatar" style={{ backgroundColor: coach.avatarColor }}>
                      {coach.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </div>
                    <div>
                      <div className="coach-name">{coach.name}</div>
                      <div className="coach-tagline">{coach.focus}</div>
                    </div>
                    <div className="coach-rate">${coach.rate}</div>
                  </div>
                  <div className="coach-card-meta">
                    <span className="coach-rating">⭐ {coach.rating}</span>
                    <span>{coach.reviewCount} reviews</span>
                  </div>
                  <div className="coach-chip-row">
                    {coach.specialties.slice(0, 3).map((speciality) => (
                      <span key={speciality} className="coach-chip">
                        {speciality}
                      </span>
                    ))}
                  </div>
                  <div className="coach-availability">Typical availability: {coach.availability}</div>
                </article>
              );
            })}
            {filteredCoaches.length === 0 ? (
              <div className="coach-empty-state">
                <h3>No coaches match your filters yet</h3>
                <p>Try adjusting your location, lesson type, or search term to discover more options.</p>
              </div>
            ) : null}
          </div>
        </section>
        <aside className="coach-detail">
          {selectedCoach ? (
            <div className="coach-detail-card">
              <button type="button" className="back-to-list" onClick={handleBackToList}>
                ← Back to Coaches
              </button>
              <div className="coach-detail-header">
                <div className="coach-avatar" style={{ backgroundColor: selectedCoach.avatarColor }}>
                  {selectedCoach.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>
                <div className="coach-detail-info">
                  <h2>{selectedCoach.name}</h2>
                  <div className="coach-detail-meta">
                    <span>⭐ {selectedCoach.rating}</span>
                    <span>{selectedCoach.reviewCount} reviews</span>
                    <span>${selectedCoach.rate} per hour</span>
                  </div>
                  <button type="button" className="cta-button">
                    Send Roster Request
                  </button>
                </div>
              </div>
              <p className="coach-detail-summary">{selectedCoach.experience}</p>
              <p className="coach-detail-focus">{selectedCoach.focus}</p>
              <div className="coach-detail-section">
                <h3>Specialties</h3>
                <div className="detail-chip-grid">
                  {selectedCoach.specialties.map((speciality) => (
                    <span key={speciality} className="detail-chip">
                      {speciality}
                    </span>
                  ))}
                </div>
              </div>
              <div className="coach-detail-section">
                <h3>Coaching Locations</h3>
                <ul className="detail-list">
                  {selectedCoach.locations.map((location) => (
                    <li key={location}>{location}</li>
                  ))}
                </ul>
              </div>
              <div className="coach-detail-section">
                <h3>Available Lesson Types</h3>
                <div className="detail-chip-grid">
                  {selectedCoach.lessonTypes.map((lesson) => (
                    <span key={lesson} className="detail-chip">
                      {lesson}
                    </span>
                  ))}
                </div>
              </div>
              <div className="coach-detail-section availability">
                <h3>Typical availability</h3>
                <p>{selectedCoach.availability}</p>
              </div>
            </div>
          ) : (
            <div className="coach-detail-empty">
              <h3>Select a coach to view their full profile</h3>
              <p>Use the filters to find the perfect match for your goals.</p>
            </div>
          )}
        </aside>
      </main>
      <ProfileManager isOpen={isProfileManagerOpen} onClose={() => setProfileManagerOpen(false)} />
    </div>
  );
};

export default FindCoachesPage;
