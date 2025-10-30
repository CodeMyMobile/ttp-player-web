import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlayerHeader from "../components/PlayerHeader";
import ProfileManager from "../components/ProfileManager";
import { useAuth } from "../context/AuthContext";
import { getDisplayName } from "../utils/userDisplay";
import { coachData, lessonTypeFilters, locationFilters } from "../data/coachData";

const FindCoachesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isProfileManagerOpen, setProfileManagerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(locationFilters[0]);
  const [selectedLesson, setSelectedLesson] = useState(lessonTypeFilters[0]);

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

  const handleNavigateToCoach = (coachId) => {
    navigate(`/coaches/${coachId}`);
  };

  return (
    <div className="find-coaches-page">
      <PlayerHeader
        onManageProfile={() => setProfileManagerOpen(true)}
        displayNameOverride={headerDisplayName}
      />
      <main className="coaches-browser">
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
          {filteredCoaches.map((coach) => (
            <article
              key={coach.id}
              className="coach-result-card"
              onClick={() => handleNavigateToCoach(coach.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleNavigateToCoach(coach.id);
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
              <div className="coach-card-cta">
                View profile
                <span aria-hidden="true">→</span>
              </div>
            </article>
          ))}
          {filteredCoaches.length === 0 ? (
            <div className="coach-empty-state">
              <h3>No coaches match your filters yet</h3>
              <p>Try adjusting your location, lesson type, or search term to discover more options.</p>
            </div>
          ) : null}
        </div>
      </main>
      <ProfileManager isOpen={isProfileManagerOpen} onClose={() => setProfileManagerOpen(false)} />
    </div>
  );
};

export default FindCoachesPage;
