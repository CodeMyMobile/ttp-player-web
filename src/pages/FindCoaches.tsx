import { useCallback, useEffect, useMemo, useState } from "react";

import CoachCard from "../components/coaches/CoachCard";
import CoachCardSkeleton from "../components/coaches/CoachCardSkeleton";
import CoachMatchQuestionnaire from "../components/coaches/CoachMatchQuestionnaire";
import FilterBar from "../components/coaches/FilterBar";
import ResultsHeader from "../components/coaches/ResultsHeader";
import StateBanner from "../components/coaches/StateBanner";
import MainLayout from "../components/MainLayout";
import BookLessonModal from "../components/coaches/BookLessonModal";
import { mockCoaches, type Coach, type CoachHighlight } from "../data/mockCoaches";
import { colors, typography } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { getStoredAuthToken } from "../services/authToken";

import "../components/coaches/coaches.css";

type Mode = "normal" | "empty" | "error";
type Status = "loading" | "ready";

const radiusOptions = ["5 mi", "10 mi", "15 mi", "20 mi", "All"];

const parseRadius = (radius: string) => {
  const match = radius.match(/(\d+)/);
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry === null || entry === undefined) {
          return "";
        }
        if (typeof entry === "string") {
          return entry.trim();
        }
        if (typeof entry === "number" || typeof entry === "boolean") {
          return String(entry);
        }
        const entryRecord = entry as Record<string, any>;
        const label =
          entryRecord.label ?? entryRecord.name ?? entryRecord.title ?? entryRecord.value ?? "";
        return typeof label === "string" ? label.trim() : String(label ?? "");
      })
      .filter((entry) => Boolean(entry));
  }
  if (typeof value === "string") {
    return value
      .split(/,|\n|\|/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  return [];
};

const pickFirstString = (...values: Array<unknown>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      const formatted = String(value);
      if (formatted.trim()) {
        return formatted.trim();
      }
    }
  }
  return "";
};

const parseNumberValue = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const extractCoachArray = (payload: unknown): Record<string, any>[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload as Record<string, any>[];
  }
  const container = payload as Record<string, any>;
  const candidates = [
    container?.data,
    container?.results,
    container?.coaches,
    container?.items,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as Record<string, any>[];
    }
  }
  return [];
};

const pickImageUrl = (record: Record<string, any>): string => {
  const candidates = [
    record.avatar,
    record.avatar_url,
    record.profile_image,
    record.profile_picture,
    record.photo,
    record.image,
    record.picture,
    record.media?.profile_image,
    record.profile?.profile_image,
    record.user?.profile_image,
    record.user?.profile?.profile_image,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return mockCoaches[0]?.imageUrl ?? "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=256&q=80";
};

const mapCoachRecordToCard = (record: Record<string, any>, fallbackIndex: number): Coach => {
  const idCandidate =
    record.id ??
    record.coach_id ??
    record.player_coach_id ??
    record.user_id ??
    record.uuid ??
    `${fallbackIndex}`;
  const firstName = pickFirstString(record.first_name, record.firstName);
  const lastName = pickFirstString(record.last_name, record.lastName);
  const displayName =
    pickFirstString(record.name, record.full_name, record.fullName, record.coach_name) ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    `Coach ${fallbackIndex + 1}`;
  const locationLabel =
    pickFirstString(
      record.location,
      record.city,
      record.city_name,
      record.state,
      [record.city, record.state].filter(Boolean).join(", "),
      record.facility,
      record.club_name,
    ) || "Multiple locations";
  const hourlyRate =
    record.hourly_rate ?? record.price_per_hour ?? record.hourlyRate ?? record.rate ?? null;
  const hourlyRateDisplay =
    typeof hourlyRate === "number"
      ? `$${hourlyRate.toFixed(0)}`
      : typeof hourlyRate === "string"
        ? hourlyRate
        : "$85";
  const summary =
    pickFirstString(
      record.summary,
      record.bio,
      record.about,
      record.description,
      record.profile?.summary,
      record.profile?.bio,
    ) || "Certified tennis professional helping players level up.";
  const bio = summary;
  const experience =
    parseNumberValue(
      record.years_experience ?? record.experience_years ?? record.yearsExperience ?? record.experience,
    ) ?? 5;
  const certifications = toStringArray(record.certifications ?? record.certification ?? []);
  const courts = toStringArray(record.courts ?? record.locations ?? record.venues ?? []);
  const levels = toStringArray(record.levels ?? record.focus_levels ?? record.skill_levels ?? []);
  const specialties = toStringArray(
    record.specialties ?? record.speciality ?? record.specialty ?? record.tags ?? [],
  );
  const languages = toStringArray(record.languages ?? record.language ?? []);
  const availability =
    pickFirstString(
      record.availability,
      record.schedule_summary,
      record.next_available,
      record.availability_summary,
    ) || "Flexible schedule";
  const nextLessonDay = pickFirstString(record.next_lesson_day, record.next_available_day, "Next opening");
  const nextLessonTime = pickFirstString(record.next_lesson_time, record.next_available_time, "Flexible times");
  const nextLessonCourt = pickFirstString(record.next_lesson_court, record.next_available_location, locationLabel);
  const ratingValue =
    parseNumberValue(record.review_score ?? record.rating ?? record.rating_value ?? record.score) ?? 5;
  const ratingCount =
    parseNumberValue(
      record.review_count ?? record.reviews_count ?? record.rating_count ?? record.total_reviews,
    ) ?? 0;
  const highlightCandidates: CoachHighlight[] = [];
  if (locationLabel) {
    highlightCandidates.push({ icon: "map", label: locationLabel });
  }
  highlightCandidates.push({ icon: "calendar", label: availability });
  if (specialties.length > 0) {
    highlightCandidates.push({ icon: "spark", label: specialties[0] });
  } else {
    highlightCandidates.push({ icon: "users", label: "Private & group lessons" });
  }
  const groupRate =
    typeof record.group_rate === "number"
      ? `$${record.group_rate.toFixed(0)}`
      : pickFirstString(record.group_rate, "$45");

  const numericId = (() => {
    if (typeof idCandidate === "number" && Number.isFinite(idCandidate)) {
      return idCandidate;
    }
    const parsed = Number(idCandidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    return fallbackIndex + 1;
  })();

  return {
    id: numericId,
    name: displayName,
    title:
      pickFirstString(
        record.title,
        record.headline,
        record.speciality,
        record.specialty,
        record.role,
        "Tennis Professional",
      ) || "Tennis Professional",
    rating: ratingValue,
    reviewCount: ratingCount,
    location: locationLabel,
    pricePerHour: hourlyRateDisplay,
    availabilityTag: pickFirstString(record.availability_status, record.status, "Available"),
    featured: Boolean(record.is_featured || record.featured),
    summary,
    bio,
    yearsExperience: experience,
    certifications,
    courts: courts.length > 0 ? courts : [locationLabel],
    levels: levels.length > 0 ? levels : ["Beginner", "Intermediate"],
    specialties: specialties.length > 0 ? specialties : ["Technique", "Strategy"],
    lessonRates: {
      private: hourlyRateDisplay,
      group: groupRate,
    },
    languages: languages.length > 0 ? languages : ["English"],
    availability,
    nextAvailableLesson: {
      day: nextLessonDay,
      time: nextLessonTime,
      court: nextLessonCourt,
    },
    highlights: highlightCandidates,
    tags: specialties.length > 0 ? specialties.slice(0, 3) : ["Footwork", "Serve", "Strategy"],
    imageUrl: pickImageUrl(record),
  };
};

const FindCoaches = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedRadius, setSelectedRadius] = useState<string>(radiusOptions[1]);
  const [appliedRadius, setAppliedRadius] = useState<string>(radiusOptions[1]);
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [storedToken] = useState(() =>
    getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
  );
  const playerToken =
    user?.session?.access_token ?? user?.access_token ?? user?.token ?? storedToken ?? null;

  const fetchCoaches = useCallback(async () => {
    if (!playerToken) {
      setCoaches([]);
      setStatus("ready");
      setMode("error");
      setError("Please sign in to search for coaches.");
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const radiusValue = parseRadius(appliedRadius);
      const searchValue = appliedSearchTerm.trim();
      const params = new URLSearchParams({
        perPage: "12",
        page: "1",
        search: searchValue,
        locationSearch: "",
      });
      if (typeof radiusValue === "number") {
        params.set("radius", radiusValue.toString());
      }
      const response = await api(
        `/player/getchecklocation?${params.toString()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
          },
          json: {
            position: null,
          },
          authToken: playerToken,
        },
      );

      if (response.status === 404) {
        setCoaches([]);
        setMode("empty");
        setStatus("ready");
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load coaches (${response.status})`);
      }

      const payload = await response.json();
      const normalized = extractCoachArray(payload).map((coach, index) =>
        mapCoachRecordToCard(coach, index),
      );
      setCoaches(normalized);
      setMode(normalized.length > 0 ? "normal" : "empty");
    } catch (requestError) {
      console.error("Failed to load coaches", requestError);
      setCoaches([]);
      setMode("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't load coaches right now.",
      );
    } finally {
      setStatus("ready");
    }
  }, [appliedRadius, appliedSearchTerm, playerToken]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

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

  const handleSearch = () => {
    const trimmed = searchTerm.trim();
    setMode("normal");
    if (trimmed === appliedSearchTerm) {
      fetchCoaches();
      return;
    }
    setAppliedSearchTerm(trimmed);
  };

  const handleRadiusChange = (radius: string) => {
    setSelectedRadius(radius);
    setMode("normal");
    if (radius === appliedRadius) {
      fetchCoaches();
      return;
    }
    setAppliedRadius(radius);
  };

  const resetState = () => {
    setSearchTerm("");
    setSelectedRadius(radiusOptions[1]);
    const shouldRefetchImmediately =
      appliedSearchTerm === "" && appliedRadius === radiusOptions[1];
    setAppliedSearchTerm("");
    setAppliedRadius(radiusOptions[1]);
    setMode("normal");
    if (shouldRefetchImmediately) {
      fetchCoaches();
    }
  };

  const filteredCoaches = useMemo(() => {
    if (mode !== "normal") {
      return [];
    }
    return coaches;
  }, [coaches, mode]);

  const handleQuestionnaireComplete = useCallback(() => {
    setMode("normal");
    fetchCoaches();
  }, [fetchCoaches]);

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
          <CoachMatchQuestionnaire onComplete={handleQuestionnaireComplete} />

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
              message={error ?? "Please try again in a few minutes or adjust your filters."}
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
