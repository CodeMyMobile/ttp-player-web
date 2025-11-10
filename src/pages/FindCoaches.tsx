import { useEffect, useMemo, useRef, useState } from "react";

import CoachCard from "../components/coaches/CoachCard";
import CoachCardSkeleton from "../components/coaches/CoachCardSkeleton";
import CoachMatchQuestionnaire from "../components/coaches/CoachMatchQuestionnaire";
import FilterBar from "../components/coaches/FilterBar";
import ResultsHeader from "../components/coaches/ResultsHeader";
import StateBanner from "../components/coaches/StateBanner";
import MainLayout from "../components/MainLayout";
import BookLessonModal from "../components/coaches/BookLessonModal";
import { mockCoaches, type Coach } from "../data/mockCoaches";
import { colors, typography } from "../lib/theme";

import "../components/coaches/coaches.css";

type Mode = "normal" | "empty" | "error";
type Status = "loading" | "ready";

const radiusOptions = ["5 mi", "10 mi", "15 mi", "20 mi", "All"];

const FindCoaches = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRadius, setSelectedRadius] = useState<string>(radiusOptions[1]);
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const loadingTimer = useRef<number>();

  useEffect(() => {
    loadingTimer.current = window.setTimeout(() => {
      setStatus("ready");
    }, 600);

    return () => {
      if (loadingTimer.current) {
        window.clearTimeout(loadingTimer.current);
      }
    };
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
    []
  );

  const beginLoading = (callback?: () => void) => {
    if (loadingTimer.current) {
      window.clearTimeout(loadingTimer.current);
    }
    setStatus("loading");
    loadingTimer.current = window.setTimeout(() => {
      callback?.();
      setStatus("ready");
    }, 420);
  };

  const handleSearch = () => {
    const trimmed = searchTerm.trim().toLowerCase();
    beginLoading(() => {
      if (trimmed === "error") {
        setMode("error");
      } else if (trimmed === "empty") {
        setMode("empty");
      } else {
        setMode("normal");
      }
    });
  };

  const handleRadiusChange = (radius: string) => {
    setSelectedRadius(radius);
    beginLoading(() => {
      setMode("normal");
    });
  };

  const resetState = () => {
    setSearchTerm("");
    setSelectedRadius(radiusOptions[1]);
    beginLoading(() => {
      setMode("normal");
    });
  };

  const filteredCoaches = useMemo(() => {
    if (mode !== "normal") {
      return [];
    }

    const normalizedTerm = searchTerm.trim().toLowerCase();

    return mockCoaches.filter((coach) => {
      if (!normalizedTerm) {
        return true;
      }
      const haystack = [
        coach.name,
        coach.title,
        coach.location,
        coach.summary,
        ...coach.tags,
        ...coach.highlights.map((highlight) => highlight.label),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedTerm);
    });
  }, [mode, searchTerm]);

  const shouldShowError = status === "ready" && mode === "error";
  const shouldShowEmpty =
    status === "ready" && (mode === "empty" || (mode === "normal" && filteredCoaches.length === 0));
  const shouldShowResults = status === "ready" && mode === "normal" && filteredCoaches.length > 0;

  const resultsCountLabel = (() => {
    if (status === "loading") {
      return "Finding coaches…";
    }
    if (shouldShowError) {
      return "Unable to load coaches";
    }
    if (shouldShowEmpty) {
      return "No coaches found";
    }
    if (shouldShowResults) {
      return `${filteredCoaches.length} ${filteredCoaches.length === 1 ? "coach" : "coaches"} found`;
    }
    return "Finding coaches…";
  })();

  return (
    <MainLayout>
      <div className="find-coaches-page" style={themeVars}>
        <div className="find-coaches-page__inner">
          <CoachMatchQuestionnaire
            onComplete={() => {
              beginLoading(() => {
                setMode("normal");
              });
            }}
          />

          <ResultsHeader
            title="Find Coaches"
            description="Connect with certified tennis professionals in your area."
          />

          <FilterBar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onSearch={handleSearch}
            radiusOptions={radiusOptions}
            selectedRadius={selectedRadius}
            onRadiusChange={handleRadiusChange}
          />

          <span className="fc-results-count">{resultsCountLabel}</span>

          {status === "loading" && (
            <div className="coach-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <CoachCardSkeleton key={index} />
              ))}
            </div>
          )}

          {shouldShowError && (
            <StateBanner
              tone="error"
              title="We couldn't load coaches right now"
              message="Please try again in a few minutes or adjust your filters."
              action={
                <button type="button" className="fc-button fc-button--primary" onClick={resetState}>
                  Retry search
                </button>
              }
            />
          )}

          {shouldShowEmpty && !shouldShowError && (
            <StateBanner
              tone="empty"
              title="No coaches match these filters"
              message="Broaden your distance, clear filters, or try a different focus area."
              action={
                <button type="button" className="fc-button fc-button--secondary" onClick={resetState}>
                  Reset filters
                </button>
              }
            />
          )}

          {shouldShowResults && (
            <div className="coach-grid">
              {filteredCoaches.map((coach: Coach) => (
                <CoachCard
                  key={coach.id}
                  coach={coach}
                  onBook={(nextCoach) => {
                    setSelectedCoach(nextCoach);
                  }}
                />
              ))}
            </div>
          )}
        </div>
        {selectedCoach ? (
          <BookLessonModal
            coach={selectedCoach}
            onClose={() => {
              setSelectedCoach(null);
            }}
          />
        ) : null}
      </div>
    </MainLayout>
  );
};

export default FindCoaches;
