import { useEffect, useMemo, useRef, useState } from "react";

import CoachCard from "../components/coaches/CoachCard";
import CoachCardSkeleton from "../components/coaches/CoachCardSkeleton";
import FilterBar from "../components/coaches/FilterBar";
import ResultsHeader from "../components/coaches/ResultsHeader";
import StateBanner from "../components/coaches/StateBanner";
import { mockCoaches, type Coach } from "../data/mockCoaches";
import { colors, radii, shadows, spacing, typography } from "../lib/theme";

import "../components/coaches/coaches.css";

type Mode = "normal" | "empty" | "error";
type Status = "loading" | "ready";

const distanceOptions = ["Anywhere", "Within 5 miles", "Within 15 miles", "Within 30 miles", "Virtual"];

const specialties = [
  "Top rated",
  "Available now",
  "Serve clinic",
  "Junior focus",
  "High performance",
  "Data-driven",
];

const distanceCities: Record<string, string[]> = {
  Anywhere: [],
  "Within 5 miles": ["London"],
  "Within 15 miles": ["London", "Birmingham"],
  "Within 30 miles": ["London", "Birmingham", "Manchester", "Leeds"],
  Virtual: [],
};

const matchesSpecialty = (coach: Coach, specialty: string) => {
  switch (specialty) {
    case "Top rated":
      return coach.rating >= 4.8;
    case "Available now":
      return Boolean(coach.status && /now|accepting|responds/i.test(coach.status));
    case "Serve clinic":
      return coach.tags.some((tag) => /serve/i.test(tag));
    case "Junior focus":
      return coach.tags.some((tag) => /junior/i.test(tag));
    case "High performance":
      return Boolean(coach.experience && /former|performance|davis/i.test(coach.experience));
    case "Data-driven":
      return Boolean(coach.summary && /data|analytics|tracking/i.test(coach.summary));
    default:
      return true;
  }
};

const FindCoaches = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDistance, setSelectedDistance] = useState(distanceOptions[0]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(["Top rated"]);
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const loadingTimer = useRef<number>();

  useEffect(() => {
    loadingTimer.current = window.setTimeout(() => {
      setStatus("ready");
    }, 900);

    return () => {
      if (loadingTimer.current) {
        window.clearTimeout(loadingTimer.current);
      }
    };
  }, []);

  const themeVars = useMemo(() => ({
    "--fc-color-bg": colors.pageBackground,
    "--fc-color-surface": colors.surface,
    "--fc-color-text-primary": colors.primaryText,
    "--fc-color-text-secondary": colors.secondaryText,
    "--fc-color-text-muted": colors.mutedText,
    "--fc-color-border": colors.border,
    "--fc-color-icon": colors.icon,
    "--fc-color-accent": colors.accentPurple,
    "--fc-color-accent-hover": "#6941C6",
    "--fc-color-accent-ring": "#E9D7FE",
    "--fc-color-accent-light": colors.accentPurpleLight,
    "--fc-color-accent-border": colors.accentPurpleBorder,
    "--fc-color-available-bg": colors.availableBg,
    "--fc-color-available-text": colors.availableText,
    "--fc-color-featured-bg": colors.featuredBg,
    "--fc-color-featured-text": colors.featuredText,
    "--fc-color-price-bg": colors.priceBadgeBg,
    "--fc-color-price-text": colors.priceBadgeText,
    "--fc-color-secondary-border": colors.secondaryButtonBorder,
    "--fc-color-secondary-text": colors.secondaryButtonText,
    "--fc-color-secondary-hover": colors.secondaryButtonHover,
    "--fc-color-success": colors.primarySuccess,
    "--fc-color-success-hover": colors.primarySuccessHover,
    "--fc-color-success-ring": colors.successRing,
    "--fc-color-error-bg": colors.errorBg,
    "--fc-color-error-border": colors.errorBorder,
    "--fc-color-error-text": colors.errorText,
    "--fc-color-empty-icon-bg": colors.emptyIconBg,
    "--fc-color-skeleton-base": colors.skeletonBase,
    "--fc-color-skeleton-highlight": colors.skeletonHighlight,
    "--fc-chip-bg": colors.filterChipBg,
    "--fc-chip-text": colors.secondaryButtonText,
    "--fc-chip-hover-bg": colors.filterChipHover,
    "--fc-chip-active-bg": colors.filterChipSelectedBg,
    "--fc-chip-active-border": colors.filterChipSelectedBorder,
    "--fc-chip-active-text": colors.filterChipSelectedText,
    "--fc-font-family": typography.fontFamily,
    "--fc-heading-size": typography.heading1.size,
    "--fc-heading-line-height": typography.heading1.lineHeight,
    "--fc-heading-weight": typography.heading1.weight.toString(),
    "--fc-heading-letter": typography.heading1.letterSpacing ?? "-0.01em",
    "--fc-body-size": typography.body.size,
    "--fc-body-line-height": typography.body.lineHeight,
    "--fc-tag-size": typography.tag.size,
    "--fc-tag-weight": typography.tag.weight.toString(),
    "--fc-tag-letter": typography.tag.letterSpacing ?? "0.01em",
    "--fc-tag-line-height": typography.tag.lineHeight,
    "--fc-price-size": typography.price.size,
    "--fc-price-weight": typography.price.weight.toString(),
    "--fc-price-line-height": typography.price.lineHeight,
    "--fc-radius-card": radii.card,
    "--fc-radius-button": radii.button,
    "--fc-radius-pill": radii.pill,
    "--fc-shadow-card": shadows.card,
    "--fc-shadow-sticky": shadows.sticky,
    "--fc-spacing-x": spacing.pageX,
    "--fc-spacing-y": spacing.pageY,
    "--fc-spacing-x-mobile": spacing.pageXMobile,
    "--fc-grid-gap": spacing.grid,
  }), []);

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

  const handleDistanceChange = (value: string) => {
    setSelectedDistance(value);
    beginLoading(() => {
      setMode("normal");
    });
  };

  const handleToggleSpecialty = (value: string) => {
    setSelectedSpecialties((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
    beginLoading(() => {
      setMode("normal");
    });
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedDistance(distanceOptions[0]);
    setSelectedSpecialties(["Top rated"]);
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
      const matchesTerm =
        !normalizedTerm ||
        coach.name.toLowerCase().includes(normalizedTerm) ||
        coach.location.toLowerCase().includes(normalizedTerm) ||
        coach.tags.some((tag) => tag.toLowerCase().includes(normalizedTerm)) ||
        (coach.summary && coach.summary.toLowerCase().includes(normalizedTerm));

      const allowedCities = distanceCities[selectedDistance];
      const matchesDistance =
        selectedDistance === "Anywhere" ||
        selectedDistance === "Virtual" ||
        (allowedCities && allowedCities.some((city) => coach.location.toLowerCase().includes(city.toLowerCase())));

      const matchesSpecialties =
        !selectedSpecialties.length ||
        selectedSpecialties.every((specialty) => matchesSpecialty(coach, specialty));

      return matchesTerm && matchesDistance && matchesSpecialties;
    });
  }, [mode, searchTerm, selectedDistance, selectedSpecialties]);

  const shouldShowError = status === "ready" && mode === "error";
  const shouldShowEmpty =
    status === "ready" && (mode === "empty" || (mode === "normal" && filteredCoaches.length === 0));
  const shouldShowResults = status === "ready" && mode === "normal" && filteredCoaches.length > 0;

  const averageRating = useMemo(() => {
    if (!filteredCoaches.length) {
      return "0.0";
    }
    const total = filteredCoaches.reduce((sum, coach) => sum + coach.rating, 0);
    return (total / filteredCoaches.length).toFixed(1);
  }, [filteredCoaches]);

  const meta = useMemo(() => {
    const countLabel = `${filteredCoaches.length} ${filteredCoaches.length === 1 ? "coach" : "coaches"}`;
    return [countLabel, `Avg rating ${averageRating}`, "Verified by Matchplay"];
  }, [filteredCoaches.length, averageRating]);

  return (
    <div className="find-coaches-page" style={themeVars}>
      <div className="find-coaches-page__header">
        <ResultsHeader
          title="Find your next tennis coach"
          description="Pro coaches with proven results, transparent pricing, and availability tailored to you."
          meta={meta}
          locationValue="London, UK"
          onChangeLocation={resetFilters}
        />
        <FilterBar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onSearch={handleSearch}
          distances={distanceOptions}
          selectedDistance={selectedDistance}
          onDistanceChange={handleDistanceChange}
          specialties={specialties}
          selectedSpecialties={selectedSpecialties}
          onToggleSpecialty={handleToggleSpecialty}
        />
      </div>

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
          message="Please try searching again in a moment or adjust your filters."
          action={
            <button type="button" className="coach-card__primary" onClick={resetFilters}>
              Retry search
            </button>
          }
        />
      )}

      {shouldShowEmpty && !shouldShowError && (
        <StateBanner
          tone="empty"
          title="No coaches match these filters"
          message="Try broadening your radius, clearing filters, or searching a different focus area."
          action={
            <button type="button" className="coach-card__secondary" onClick={resetFilters}>
              Reset filters
            </button>
          }
        />
      )}

      {shouldShowResults && (
        <div className="coach-grid">
          {filteredCoaches.map((coach) => (
            <CoachCard key={coach.id} coach={coach} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FindCoaches;
