import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";

import GroupLessonsFilterBar from "../components/group-lessons/GroupLessonsFilterBar";
import GroupLessonConfirmationModal from "../components/group-lessons/GroupLessonConfirmationModal";
import ResultsHeader from "../components/coaches/ResultsHeader";
import MainLayout from "../components/MainLayout";
import { mockGroupLessons } from "../data/mockGroupLessons";
import type { GroupLesson } from "../data/mockGroupLessons";
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

const toIsoDate = (date: Date) => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .slice(0, 10);
};

const parseLessonDateToIso = (label: string) => {
  const currentYear = new Date().getFullYear();
  const parsed = new Date(`${label}, ${currentYear} 12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return toIsoDate(parsed);
};

const addDays = (iso: string, amount: number) => {
  const base = new Date(`${iso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + amount);
  return base;
};

const formatWeekday = (iso: string) => {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long" });
};

const formatMonthDay = (iso: string, options: "long" | "short" = "long") => {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: options === "long" ? "long" : "short",
    day: "numeric",
  });
};

type DateFilterState =
  | { type: "all" }
  | { type: "day"; iso: string }
  | { type: "range"; start: string; end: string };

const GroupLessonsPage = () => {
  const [confirmationLesson, setConfirmationLesson] = useState<GroupLesson | undefined>();
  const [coachFilter, setCoachFilter] = useState<string>("All coaches");
  const [levelFilter, setLevelFilter] = useState<string>("All levels");
  const [location, setLocation] = useState<string>(DEFAULT_LOCATION);
  const [selectedRadius, setSelectedRadius] = useState<string>(radiusOptions[1]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterState>({ type: "all" });
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [rangeStartValue, setRangeStartValue] = useState<string>("");
  const [rangeEndValue, setRangeEndValue] = useState<string>("");
  const [rangeError, setRangeError] = useState<string | undefined>();

  const lessons = useMemo(
    () =>
      mockGroupLessons.map((lesson) => ({
        ...lesson,
        isoDate: parseLessonDateToIso(lesson.date),
      })),
    [],
  );

  const coachOptions = useMemo(
    () => ["All coaches", ...new Set(lessons.map((lesson) => lesson.coachName))],
    [lessons],
  );

  const levelOptions = useMemo(() => {
    const uniqueLevels = Array.from(new Set(lessons.map((lesson) => lesson.level)))
      .sort((a, b) => a - b)
      .map((lessonLevel) => lessonLevel.toFixed(1));
    return ["All levels", ...uniqueLevels];
  }, [lessons]);

  const dateAnchors = useMemo(() => {
    const validIsos = lessons
      .map((lesson) => lesson.isoDate)
      .filter((iso): iso is string => Boolean(iso))
      .sort();

    if (validIsos.length === 0) {
      const todayIso = toIsoDate(new Date());
      return { start: todayIso, end: toIsoDate(addDays(todayIso, 7)) };
    }

    const base = validIsos[0];
    const last = validIsos[validIsos.length - 1];
    const start = base;
    const endAnchor = addDays(base, 7);
    const computedEnd = toIsoDate(endAnchor);
    const max = last > computedEnd ? last : computedEnd;
    return { start, end: max };
  }, [lessons]);

  const dayOptions = useMemo(() => {
    const startDate = dateAnchors.start;
    return Array.from({ length: 8 }, (_, index) => {
      const date = addDays(startDate, index);
      const iso = toIsoDate(date);
      return {
        iso,
        day: formatWeekday(iso),
        label: formatMonthDay(iso),
      };
    });
  }, [dateAnchors.start]);

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

    return lessons.filter((lesson) => {
      const matchesCoach =
        coachFilter === "All coaches" || lesson.coachName === coachFilter;
      const matchesLevel =
        levelFilter === "All levels" || lesson.level.toFixed(1) === levelFilter;
      const matchesLocation =
        normalizedLocation.length === 0 ||
        lesson.locationCity.toLowerCase().includes(normalizedLocation);
      const matchesDay = (() => {
        if (!lesson.isoDate) {
          return true;
        }
        if (dateFilter.type === "all") {
          return true;
        }
        if (dateFilter.type === "day") {
          return lesson.isoDate === dateFilter.iso;
        }
        return lesson.isoDate >= dateFilter.start && lesson.isoDate <= dateFilter.end;
      })();
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

      return (
        matchesCoach &&
        matchesLevel &&
        matchesLocation &&
        matchesDay &&
        withinRadius &&
        matchesSearch
      );
    });
  }, [coachFilter, levelFilter, location, searchTerm, dateFilter, lessons, selectedRadius]);

  const totalLessons = lessons.length;

  const dateSummary = useMemo(() => {
    if (dateFilter.type === "all") {
      return "across all upcoming dates";
    }
    if (dateFilter.type === "day") {
      const matchingOption = dayOptions.find((option) => option.iso === dateFilter.iso);
      if (matchingOption) {
        return `on ${matchingOption.day}, ${matchingOption.label}`;
      }
      return `on ${formatWeekday(dateFilter.iso)}, ${formatMonthDay(dateFilter.iso)}`;
    }
    return `from ${formatMonthDay(dateFilter.start, "short")} to ${formatMonthDay(dateFilter.end, "short")}`;
  }, [dateFilter, dayOptions]);

  const resultsSummary =
    filteredLessons.length === totalLessons
      ? `${filteredLessons.length} ${
          filteredLessons.length === 1 ? "group lesson" : "group lessons"
        } available ${dateSummary}`
      : `${filteredLessons.length} ${
          filteredLessons.length === 1 ? "group lesson" : "group lessons"
        } match your filters ${dateSummary} (${totalLessons} total)`;

  const maxSelectableDate = dateAnchors.end;

  const handleApplyRange = () => {
    if (!rangeStartValue || !rangeEndValue) {
      setRangeError("Select both a start and end date.");
      return;
    }
    if (rangeStartValue > rangeEndValue) {
      setRangeError("Start date must be before the end date.");
      return;
    }
    setRangeError(undefined);
    setDateFilter({ type: "range", start: rangeStartValue, end: rangeEndValue });
    setIsRangeOpen(false);
  };

  const handleClearRange = () => {
    setRangeStartValue("");
    setRangeEndValue("");
    setRangeError(undefined);
    setDateFilter({ type: "all" });
    setIsRangeOpen(false);
  };

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

          <div className="group-lessons-day-filter" role="region" aria-label="Filter sessions by day">
            <div className="group-lessons-day-filter__controls">
              <div className="group-lessons-day-filter__quick">
                <button
                  type="button"
                  className={`group-lessons-day-filter__pill${
                    dateFilter.type === "all" ? " group-lessons-day-filter__pill--active" : ""
                  }`}
                  aria-pressed={dateFilter.type === "all"}
                  onClick={() => {
                    setDateFilter({ type: "all" });
                    setRangeStartValue("");
                    setRangeEndValue("");
                    setRangeError(undefined);
                    setIsRangeOpen(false);
                  }}
                >
                  <span className="group-lessons-day-filter__day">All days</span>
                </button>
                {dayOptions.map((option) => {
                  const isActive = dateFilter.type === "day" && dateFilter.iso === option.iso;
                  return (
                    <button
                      key={option.iso}
                      type="button"
                      className={`group-lessons-day-filter__pill${
                        isActive ? " group-lessons-day-filter__pill--active" : ""
                      }`}
                      aria-pressed={isActive}
                      onClick={() => {
                        setDateFilter({ type: "day", iso: option.iso });
                        setRangeStartValue(option.iso);
                        setRangeEndValue(option.iso);
                        setRangeError(undefined);
                        setIsRangeOpen(false);
                      }}
                    >
                      <span className="group-lessons-day-filter__day">{option.day}</span>
                      <span className="group-lessons-day-filter__date">{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="group-lessons-day-filter__actions">
                <button
                  type="button"
                  className={`group-lessons-day-filter__range-toggle${
                    dateFilter.type === "range" ? " group-lessons-day-filter__range-toggle--active" : ""
                  }`}
                  aria-expanded={isRangeOpen}
                  onClick={() => {
                    if (!isRangeOpen) {
                      if (dateFilter.type === "range") {
                        setRangeStartValue(dateFilter.start);
                        setRangeEndValue(dateFilter.end);
                      } else {
                        setRangeStartValue((current) => current || dateAnchors.start);
                        setRangeEndValue((current) => current || dateAnchors.start);
                      }
                    }
                    setIsRangeOpen((open) => !open);
                  }}
                >
                  {dateFilter.type === "range"
                    ? `Custom range: ${formatMonthDay(dateFilter.start, "short")} – ${formatMonthDay(
                        dateFilter.end,
                        "short",
                      )}`
                    : "Choose dates"}
                </button>
              </div>
            </div>
            {isRangeOpen ? (
              <div className="group-lessons-date-range">
                <div className="group-lessons-date-range__fields">
                  <label className="group-lessons-date-range__field">
                    <span>Start</span>
                    <input
                      type="date"
                      value={rangeStartValue}
                      min={dateAnchors.start}
                      max={rangeEndValue || maxSelectableDate}
                      onChange={(event) => {
                        setRangeStartValue(event.target.value);
                        setRangeError(undefined);
                      }}
                    />
                  </label>
                  <label className="group-lessons-date-range__field">
                    <span>End</span>
                    <input
                      type="date"
                      value={rangeEndValue}
                      min={rangeStartValue || dateAnchors.start}
                      max={maxSelectableDate}
                      onChange={(event) => {
                        setRangeEndValue(event.target.value);
                        setRangeError(undefined);
                      }}
                    />
                  </label>
                </div>
                <p className="group-lessons-date-range__hint">
                  {rangeStartValue && rangeEndValue
                    ? `Showing availability from ${formatMonthDay(rangeStartValue, "short")} to ${formatMonthDay(
                        rangeEndValue,
                        "short",
                      )}.`
                    : "Select a start and end date to filter sessions."}
                </p>
                {rangeError ? <p className="group-lessons-date-range__error">{rangeError}</p> : null}
                <div className="group-lessons-date-range__actions">
                  <button type="button" onClick={handleClearRange}>
                    Clear
                  </button>
                  <button type="button" onClick={handleApplyRange}>
                    Apply range
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <section aria-labelledby="group-lessons-results-heading" className="group-lessons-results">
            <div className="group-lessons-results__header">
              <div>
                <h2 id="group-lessons-results-heading">Available sessions nearby</h2>
                <p className="group-lessons-results__meta">{resultsSummary}</p>
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
                          <span>{lesson.date}</span>
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
                              setConfirmationLesson(lesson);
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
      {confirmationLesson ? (
        <GroupLessonConfirmationModal
          lesson={confirmationLesson}
          onClose={() => setConfirmationLesson(undefined)}
        />
      ) : null}
    </MainLayout>
  );
};

export default GroupLessonsPage;
