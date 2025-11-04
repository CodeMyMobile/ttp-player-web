import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Timer,
  Target,
  SlidersHorizontal,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import { mockGroupLessons } from "../data/mockGroupLessons";

import "./GroupLessonsPage.css";

const DEFAULT_LOCATION = "San Francisco, CA";
const DEFAULT_RADIUS = 10;

const formatLevelRange = (level: number) => {
  const upperBound = (level + 0.5).toFixed(1);
  return `${level.toFixed(1)} - ${upperBound}`;
};

const radiusLabel = (radius: number) => `${radius} miles`;

const GroupLessonsPage = () => {
  const [coachFilter, setCoachFilter] = useState<string>("All coaches");
  const [levelFilter, setLevelFilter] = useState<string>("All levels");
  const [location, setLocation] = useState<string>(DEFAULT_LOCATION);
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS);

  const coachOptions = useMemo(
    () => ["All coaches", ...new Set(mockGroupLessons.map((lesson) => lesson.coachName))],
    [],
  );

  const levelOptions = useMemo(() => {
    const uniqueLevels = Array.from(new Set(mockGroupLessons.map((lesson) => lesson.level)))
      .sort((a, b) => a - b)
      .map((level) => level.toFixed(1));
    return ["All levels", ...uniqueLevels];
  }, []);

  const filteredLessons = useMemo(() => {
    const normalizedLocation = location.trim().toLowerCase();

    return mockGroupLessons.filter((lesson) => {
      const matchesCoach =
        coachFilter === "All coaches" || lesson.coachName === coachFilter;
      const matchesLevel =
        levelFilter === "All levels" || lesson.level.toFixed(1) === levelFilter;
      const matchesLocation =
        normalizedLocation.length === 0 ||
        lesson.locationCity.toLowerCase().includes(normalizedLocation);
      const withinRadius = lesson.distanceMiles <= radius + 0.001;

      return matchesCoach && matchesLevel && matchesLocation && withinRadius;
    });
  }, [coachFilter, levelFilter, location, radius]);

  return (
    <MainLayout>
      <div className="group-lessons-page">
        <section className="group-lessons-hero">
          <div>
            <p className="group-lessons-eyebrow">Group Lessons</p>
            <h1>Train with players near you</h1>
            <p className="group-lessons-subtitle">
              Browse curated group sessions led by trusted Matchplay coaches. Dial in the skills you
              need, match with players at your level, and secure a spot in minutes.
            </p>
          </div>
          <div className="group-lessons-hero-card">
            <div className="hero-stat">
              <span className="hero-stat__value">{filteredLessons.length}</span>
              <span className="hero-stat__label">Lessons near you</span>
            </div>
            <div className="hero-divider" aria-hidden="true" />
            <div className="hero-location">
              <MapPin size={18} aria-hidden="true" />
              <div>
                <p className="hero-location__label">Location</p>
                <p className="hero-location__value">{location || DEFAULT_LOCATION}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="group-lessons-filters" aria-labelledby="group-lessons-filters-heading">
          <div className="filters-header">
            <div>
              <p className="filters-eyebrow">Refine your search</p>
              <h2 id="group-lessons-filters-heading">Find the right fit faster</h2>
            </div>
            <SlidersHorizontal aria-hidden="true" />
          </div>
          <div className="filters-grid">
            <label className="filter-field">
              <span>Coach</span>
              <select value={coachFilter} onChange={(event) => setCoachFilter(event.target.value)}>
                {coachOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>Level</span>
              <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                {levelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "All levels" ? option : `${option} NTRP`}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>Location</span>
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Enter a city or neighborhood"
              />
              <button
                type="button"
                className="use-location"
                onClick={() => setLocation(DEFAULT_LOCATION)}
              >
                Use my location
              </button>
            </label>
            <div className="filter-field">
              <span>Radius</span>
              <div className="radius-control">
                <div className="radius-value">
                  <Target size={16} aria-hidden="true" />
                  <span>{radiusLabel(radius)}</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={25}
                  step={5}
                  value={radius}
                  onChange={(event) => setRadius(Number.parseInt(event.target.value, 10))}
                  aria-label="Search radius in miles"
                />
                <div className="radius-scale" aria-hidden="true">
                  {[5, 10, 15, 20, 25].map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="group-lessons-results-heading" className="group-lessons-results">
          <div className="results-header">
            <div>
              <p className="results-eyebrow">Available sessions</p>
              <h2 id="group-lessons-results-heading">Snapshot of group lessons nearby</h2>
            </div>
            <p className="results-count">
              Showing <strong>{filteredLessons.length}</strong> {filteredLessons.length === 1 ? "lesson" : "lessons"}
            </p>
          </div>

          {filteredLessons.length === 0 ? (
            <div className="empty-state">
              <p>No lessons match your current filters.</p>
              <button
                type="button"
                onClick={() => {
                  setCoachFilter("All coaches");
                  setLevelFilter("All levels");
                  setLocation(DEFAULT_LOCATION);
                  setRadius(DEFAULT_RADIUS);
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="lessons-grid">
              {filteredLessons.map((lesson) => {
                const levelRange = formatLevelRange(lesson.level);
                const spotsLabel = `${lesson.availableSpots} of ${lesson.totalSpots} spots left`;

                return (
                  <article key={lesson.id} className="lesson-card">
                    <header className="lesson-card__header">
                      <div>
                        <p className="lesson-card__day">{lesson.day}</p>
                        <h3>{lesson.title}</h3>
                      </div>
                      <span className="lesson-card__level">{levelRange} NTRP</span>
                    </header>
                    <p className="lesson-card__focus">{lesson.focus}</p>
                    <div className="lesson-card__meta">
                      <div className="lesson-card__meta-item">
                        <CalendarDays size={18} aria-hidden="true" />
                        <span>{lesson.day}</span>
                      </div>
                      <div className="lesson-card__meta-item">
                        <Clock size={18} aria-hidden="true" />
                        <span>
                          {lesson.startTime}
                          <span className="bullet" aria-hidden="true">
                            •
                          </span>
                          {lesson.durationMinutes} min
                        </span>
                      </div>
                      <div className="lesson-card__meta-item">
                        <Timer size={18} aria-hidden="true" />
                        <span>{lesson.skillLabel}</span>
                      </div>
                      <div className="lesson-card__meta-item">
                        <MapPin size={18} aria-hidden="true" />
                        <span>
                          {lesson.locationName}
                          <span className="bullet" aria-hidden="true">
                            •
                          </span>
                          {lesson.distanceMiles.toFixed(1)} mi
                        </span>
                      </div>
                      <div className="lesson-card__meta-item lesson-card__meta-item--spots">
                        <Users size={18} aria-hidden="true" />
                        <span>{spotsLabel}</span>
                      </div>
                    </div>
                    <footer className="lesson-card__footer">
                      <div className="lesson-coach">
                        <img src={lesson.coachAvatarUrl} alt="" aria-hidden="true" />
                        <div>
                          <p className="coach-name">{lesson.coachName}</p>
                          <p className="coach-location">{lesson.locationCity}</p>
                        </div>
                      </div>
                      <div className="lesson-actions">
                        <button type="button" className="ghost-button">
                          View details
                        </button>
                        <button type="button" className="primary-button">
                          Quick book
                        </button>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
};

export default GroupLessonsPage;
