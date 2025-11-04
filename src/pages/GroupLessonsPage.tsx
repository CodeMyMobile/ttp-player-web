import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Clock, MapPin, Timer, Users } from "lucide-react";

import GroupLessonsFilterBar from "../components/group-lessons/GroupLessonsFilterBar";
import ResultsHeader from "../components/coaches/ResultsHeader";
import MainLayout from "../components/MainLayout";
import { mockGroupLessons } from "../data/mockGroupLessons";
import { colors, typography } from "../lib/theme";

import "../components/coaches/coaches.css";
import "./GroupLessonsPage.css";

const DEFAULT_LOCATION = "San Francisco, CA";
const radiusOptions = ["5 mi", "10 mi", "15 mi", "20 mi", "All"];

const parseRadius = (radius: string) => {
  if (radius === "All") {
    return Number.POSITIVE_INFINITY;
  }
  const match = /^(\d+)/.exec(radius);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const formatLevelRange = (level: number) => {
  const upperBound = (level + 0.5).toFixed(1);
  return `${level.toFixed(1)} - ${upperBound}`;
};

const GroupLessonsPage = () => {
  const navigate = useNavigate();
  const [coachFilter, setCoachFilter] = useState<string>("All coaches");
  const [levelFilter, setLevelFilter] = useState<string>("All levels");
  const [location, setLocation] = useState<string>(DEFAULT_LOCATION);
  const [selectedRadius, setSelectedRadius] = useState<string>(radiusOptions[1]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const coachOptions = useMemo(
    () => ["All coaches", ...new Set(mockGroupLessons.map((lesson) => lesson.coachName))],
    [],
  );

  const levelOptions = useMemo(() => {
    const uniqueLevels = Array.from(new Set(mockGroupLessons.map((lesson) => lesson.level)))
      .sort((a, b) => a - b)
      .map((lessonLevel) => lessonLevel.toFixed(1));
    return ["All levels", ...uniqueLevels];
  }, []);

  const themeVars = useMemo(
    () => ({
      "--fc-color-bg": colors.pageBackground,
      "--fc-color-surface": colors.surface,
      "--fc-color-text-primary": colors.primaryText,
      "--fc-color-text-secondary": colors.secondaryText,
      "--fc-color-text-muted": colors.mutedText,
      "--fc-color-border": colors.border,
      "--fc-color-icon": colors.icon,
      "--fc-color-accent": colors.accentPurple,
      "--fc-color-accent-light": colors.accentPurpleLight,
      "--fc-color-accent-border": colors.accentPurpleBorder,
      "--fc-chip-bg": colors.filterChipBg,
      "--fc-chip-hover-bg": colors.filterChipHover,
      "--fc-chip-text": colors.secondaryButtonText,
      "--fc-color-secondary-border": colors.secondaryButtonBorder,
      "--fc-color-secondary-text": colors.secondaryButtonText,
      "--fc-color-secondary-hover": colors.secondaryButtonHover,
      "--fc-color-success": colors.primarySuccess,
      "--fc-color-success-hover": colors.primarySuccessHover,
      "--fc-color-error-bg": colors.errorBg,
      "--fc-color-error-border": colors.errorBorder,
      "--fc-color-error-text": colors.errorText,
      "--fc-color-empty-icon-bg": colors.emptyIconBg,
      "--fc-color-skeleton-base": colors.skeletonBase,
      "--fc-color-skeleton-highlight": colors.skeletonHighlight,
      "--fc-font-family": typography.fontFamily,
      "--fc-heading-size": typography.heading1.size,
      "--fc-heading-line-height": typography.heading1.lineHeight,
      "--fc-body-size": typography.body.size,
      "--fc-body-line-height": typography.body.lineHeight,
    }),
    [],
  );

  const handleLocationClick = () => {
    const nextLocation = window.prompt("Enter your city or neighborhood", location);
    if (nextLocation !== null) {
      const trimmed = nextLocation.trim();
      setLocation(trimmed.length ? trimmed : DEFAULT_LOCATION);
    }
  };

  const filteredLessons = useMemo(() => {
    const normalizedLocation = location.trim().toLowerCase();
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const radiusLimit = parseRadius(selectedRadius);

    return mockGroupLessons.filter((lesson) => {
      const matchesCoach =
        coachFilter === "All coaches" || lesson.coachName === coachFilter;
      const matchesLevel =
        levelFilter === "All levels" || lesson.level.toFixed(1) === levelFilter;
      const matchesLocation =
        normalizedLocation.length === 0 ||
        lesson.locationCity.toLowerCase().includes(normalizedLocation);
      const withinRadius = lesson.distanceMiles <= radiusLimit + 0.001;
      const haystack = [
        lesson.title,
        lesson.focus,
        lesson.coachName,
        lesson.locationCity,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = normalizedSearch.length === 0 || haystack.includes(normalizedSearch);

      return matchesCoach && matchesLevel && matchesLocation && withinRadius && matchesSearch;
    });
  }, [coachFilter, levelFilter, location, searchTerm, selectedRadius]);

  const totalLessons = mockGroupLessons.length;
  const resultsCountLabel = `${filteredLessons.length} ${
    filteredLessons.length === 1 ? "group lesson" : "group lessons"
  } found`;

  return (
    <MainLayout>
      <div className="find-coaches-page group-lessons-page" style={themeVars}>
        <div className="find-coaches-page__inner group-lessons-page__inner">
          <ResultsHeader
            title="Find Group Lessons"
            description="Dial in your game with curated sessions led by trusted Matchplay coaches."
          />

          <GroupLessonsFilterBar
            coachOptions={coachOptions}
            selectedCoach={coachFilter}
            onCoachChange={setCoachFilter}
            levelOptions={levelOptions}
            selectedLevel={levelFilter}
            onLevelChange={setLevelFilter}
            location={location}
            onLocationClick={handleLocationClick}
            radiusOptions={radiusOptions}
            selectedRadius={selectedRadius}
            onRadiusChange={setSelectedRadius}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onSearch={() => {
              setSearchTerm((current) => current.trim());
            }}
          />

          <span className="fc-results-count">{resultsCountLabel}</span>

          <section aria-labelledby="group-lessons-results-heading" className="group-lessons-results">
            <div className="group-lessons-results__header">
              <div>
                <h2 id="group-lessons-results-heading">Available sessions nearby</h2>
                <p className="group-lessons-results__meta">
                  Showing {filteredLessons.length} of {totalLessons} total sessions
                </p>
              </div>
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
                    setSelectedRadius(radiusOptions[1]);
                    setSearchTerm("");
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
                          <Link to={`/group-lessons/${lesson.id}`} className="ghost-button">
                            View details
                          </Link>
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => {
                              navigate(`/booking/confirm?groupLesson=${lesson.id}`, {
                                state: { groupLessonId: lesson.id },
                              });
                            }}
                            disabled={lesson.availableSpots === 0}
                          >
                            {lesson.availableSpots === 0 ? "Join waitlist" : "Quick book"}
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
      </div>
    </MainLayout>
  );
};

export default GroupLessonsPage;
