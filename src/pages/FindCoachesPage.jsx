import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlayerHeader from "../components/PlayerHeader";
import ProfileManager from "../components/ProfileManager";
import { useAuth } from "../context/AuthContext";
import { getDisplayName } from "../utils/userDisplay";
import { getStoredAuthToken } from "../services/authToken";
import { getPlayerCoaches } from "../api/playerHome";
import {
  getCoachAvailability,
  getCoachAvatarColor,
  getCoachFocus,
  getCoachFullName,
  getCoachIdentifier,
  getCoachInitials,
  getCoachLessonTypes,
  getCoachLocations,
  getCoachRate,
  getCoachRating,
  getCoachReviewCount,
  getCoachSpecialties,
} from "../utils/coachFormatting";

const DEFAULT_LOCATION = "All Locations";
const DEFAULT_LESSON = "All Lessons";
const DEFAULT_PAGE_SIZE = 50;

const FindCoachesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isProfileManagerOpen, setProfileManagerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_LOCATION);
  const [selectedLesson, setSelectedLesson] = useState(DEFAULT_LESSON);
  const [coaches, setCoaches] = useState([]);
  const [locations, setLocations] = useState([DEFAULT_LOCATION]);
  const [lessonTypes, setLessonTypes] = useState([DEFAULT_LESSON]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rawDisplayName = useMemo(() => getDisplayName(user), [user]);
  const headerDisplayName = rawDisplayName === "Player" ? "Paul" : rawDisplayName;
  const greetingName = rawDisplayName === "Player" ? "there" : rawDisplayName;

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchCoaches = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });

      if (!token) {
        setError("Please sign in again to browse coaches.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await getPlayerCoaches({
          token,
          perPage: DEFAULT_PAGE_SIZE,
          signal: controller.signal,
        });

        if (!isMounted) return;

        const fetchedCoaches = response?.data ?? [];
        setCoaches(fetchedCoaches);

        const derivedLocations = new Set();
        const derivedLessonTypes = new Set();

        fetchedCoaches.forEach((coach) => {
          getCoachLocations(coach).forEach((location) => derivedLocations.add(location));
          getCoachLessonTypes(coach).forEach((lesson) => derivedLessonTypes.add(lesson));
        });

        setLocations([DEFAULT_LOCATION, ...Array.from(derivedLocations).sort()]);
        setLessonTypes([DEFAULT_LESSON, ...Array.from(derivedLessonTypes).sort()]);
      } catch (fetchError) {
        if (!isMounted) return;
        if (fetchError.name === "AbortError") return;
        setError(fetchError.message || "We couldn\'t load coaches right now.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCoaches();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const filteredCoaches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return coaches.filter((coach) => {
      const name = getCoachFullName(coach).toLowerCase();
      const matchesSearch = !normalizedSearch || name.includes(normalizedSearch);
      const coachLocations = getCoachLocations(coach);
      const matchesLocation =
        selectedLocation === DEFAULT_LOCATION || coachLocations.includes(selectedLocation);
      const coachLessonTypes = getCoachLessonTypes(coach);
      const matchesLesson =
        selectedLesson === DEFAULT_LESSON || coachLessonTypes.includes(selectedLesson);
      return matchesSearch && matchesLocation && matchesLesson;
    });
  }, [coaches, searchTerm, selectedLocation, selectedLesson]);

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
          <div className="coach-results-count">
            {loading ? "Loading…" : `${filteredCoaches.length} coaches found`}
          </div>
        </div>
        <div className="coaches-filters">
          <label className="filter-field">
            <span>Location</span>
            <select value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Lesson Type</span>
            <select value={selectedLesson} onChange={(event) => setSelectedLesson(event.target.value)}>
              {lessonTypes.map((lesson) => (
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
            const coachId = getCoachIdentifier(coach);
            const name = getCoachFullName(coach);
            const specialties = getCoachSpecialties(coach);
            const rate = getCoachRate(coach);
            const rating = getCoachRating(coach);
            const reviewCount = getCoachReviewCount(coach);
            const availability = getCoachAvailability(coach);
            const focus = getCoachFocus(coach);

            const rateDisplay = rate ? `$${Math.round(rate)}` : "Rate TBD";
            const ratingDisplay = rating ? rating.toFixed(1) : "New";
            const reviewDisplay =
              reviewCount && reviewCount > 0
                ? `${Math.round(reviewCount)} reviews`
                : "No reviews yet";

            return (
              <article
                key={coachId || name}
                className={`coach-result-card${coachId ? "" : " disabled"}`}
                onClick={() => coachId && handleNavigateToCoach(coachId)}
                role="button"
                tabIndex={coachId ? 0 : -1}
                aria-disabled={coachId ? undefined : true}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && coachId) {
                    event.preventDefault();
                    handleNavigateToCoach(coachId);
                  }
                }}
              >
                <div className="coach-card-header">
                  <div className="coach-avatar" style={{ backgroundColor: getCoachAvatarColor(coach) }}>
                    {getCoachInitials(coach)}
                  </div>
                  <div>
                    <div className="coach-name">{name}</div>
                    <div className="coach-tagline">{focus}</div>
                  </div>
                  <div className="coach-rate">{rateDisplay}</div>
                </div>
                <div className="coach-card-meta">
                  <span className="coach-rating">⭐ {ratingDisplay}</span>
                  <span>{reviewDisplay}</span>
                </div>
                <div className="coach-chip-row">
                  {specialties.slice(0, 3).map((speciality) => (
                    <span key={speciality} className="coach-chip">
                      {speciality}
                    </span>
                  ))}
                </div>
                <div className="coach-availability">Typical availability: {availability}</div>
                <div className="coach-card-cta">
                  View profile
                  <span aria-hidden="true">→</span>
                </div>
              </article>
            );
          })}
          {loading ? (
            <div className="coach-loading-state">Loading coaches…</div>
          ) : null}
          {!loading && error ? (
            <div className="coach-error-state" role="status">
              <h3>Unable to load coaches</h3>
              <p>{error}</p>
            </div>
          ) : null}
          {!loading && !error && filteredCoaches.length === 0 ? (
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
