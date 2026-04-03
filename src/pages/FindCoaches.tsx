import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import FilterMenu from "../components/FilterMenu";
import { fetchCoachProfile } from "../api/coachProfile";
import SimpleSurvey from "../components/questionnaire/SimpleSurvey";
import { mockCoaches, type Coach, type CoachHighlight } from "../data/mockCoaches";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { getStoredAuthToken } from "../services/authToken";
import {
  getCoachMatchSurveyQuestions,
  submitCoachMatchSurveyAnswers,
} from "../api/playerHome";
import {
  DEFAULT_POSITION,
  storeLocation,
  storeLocationLabel,
  type Coordinates,
} from "../utils/userLocation";
import {
  buildSurveySubmissionPayload,
  extractSurveyQuestions,
  type NormalizedSurveyQuestion,
} from "../utils/surveyQuestionnaire";

import "./CoachMatchRecommendationsPage.css";
import "./FindCoachesPage.css";

type Mode = "normal" | "empty" | "error";
type Status = "loading" | "ready";

type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  isCurrentLocation?: boolean;
};

type CoachCardModel = Coach & {
  initials: string;
  verified: boolean;
  studentCount: number | null;
  distanceMiles: number | null;
  cityLabel: string;
  hourlyRateValue: number | null;
  groupRateValue: number | null;
  availabilityWindows: string[];
  formats: string[];
  matchScore: number;
  matchReasons: string[];
  semiRateValue: number | null;
};

const DEFAULT_RADIUS = 10;

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry === null || entry === undefined) return "";
        if (typeof entry === "string") return entry.trim();
        if (typeof entry === "number" || typeof entry === "boolean") return String(entry);
        const record = entry as Record<string, unknown>;
        const label = record.label ?? record.name ?? record.title ?? record.value ?? "";
        return typeof label === "string" ? label.trim() : String(label ?? "");
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/,|\n|\|/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
};

const pickFirstString = (...values: Array<unknown>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") {
      const next = String(value).trim();
      if (next) return next;
    }
  }
  return "";
};

const parseNumberValue = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatMoney = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(0)}` : null;
};

const formatExperience = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric.toFixed(0)} years` : "Experience not listed";
};

const extractCoachArray = (payload: unknown): Record<string, unknown>[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const container = payload as Record<string, unknown>;
  const candidates = [container.data, container.results, container.coaches, container.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
  }
  return [];
};

const pickImageUrl = (record: Record<string, unknown>): string => {
  const candidates = [
    record.avatar,
    record.avatar_url,
    record.profile_image,
    record.profile_picture,
    record.photo,
    record.image,
    record.picture,
    (record.media as Record<string, unknown> | undefined)?.profile_image,
    (record.profile as Record<string, unknown> | undefined)?.profile_image,
    (record.user as Record<string, unknown> | undefined)?.profile_image,
    ((record.user as Record<string, unknown> | undefined)?.profile as Record<string, unknown> | undefined)?.profile_image,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() && !candidate.trim().endsWith(".com/")) {
      return candidate.trim();
    }
  }
  return (
    mockCoaches[0]?.imageUrl ??
    "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=256&q=80"
  );
};

const buildInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "TC";

const deriveFormats = (record: Record<string, unknown>) => {
  const pricing = (record.pricing as Record<string, unknown> | undefined) ?? {};
  const formats = toStringArray(record.formats ?? record.lesson_formats ?? record.lesson_types);
  if (formats.length > 0) return formats;
  const result = ["Private"];
  if (
    parseNumberValue(record.group_rate) !== null ||
    pickFirstString(record.group_rate) ||
    parseNumberValue(pricing.group ?? pricing.group_price) !== null
  ) {
    result.push("Group");
  }
  return result;
};

const deriveAvailabilityWindows = (record: Record<string, unknown>) => {
  const explicit = toStringArray(
    record.availability_windows ?? record.availability_labels ?? record.available_times ?? record.availability,
  );
  if (explicit.length > 0) return explicit;
  return ["Weekday Mornings", "Weekends"];
};

const parseStudentCountFromHighlights = (highlights: Array<Record<string, unknown>>) => {
  for (const highlight of highlights) {
    const label = pickFirstString(highlight.label);
    const match = label.match(/(\d+)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const mergeCoachProfileIntoCard = (coach: CoachCardModel, profile: Record<string, unknown>): CoachCardModel => {
  const booking = (profile.booking as Record<string, unknown> | undefined) ?? {};
  const bookingDates = Array.isArray(booking.availableDates)
    ? (booking.availableDates as Array<Record<string, unknown>>)
    : [];
  const lessonTypes = Array.isArray(booking.lessonTypes)
    ? (booking.lessonTypes as Array<Record<string, unknown>>)
    : [];
  const highlightChips = Array.isArray(profile.highlightChips)
    ? (profile.highlightChips as Array<Record<string, unknown>>)
    : [];
  const metrics = Array.isArray(profile.metrics)
    ? (profile.metrics as Array<Record<string, unknown>>)
    : [];
  const coachingLocations = toStringArray(profile.coachingLocations);
  const profileLocations = Array.isArray(profile.locations)
    ? (profile.locations as Array<Record<string, unknown>>).map((location) => pickFirstString(location.label))
    : [];
  const availabilityWindows =
    bookingDates.length > 0
      ? bookingDates.map((date) => {
          const label = pickFirstString(date.label);
          const totalSlots = parseNumberValue(date.totalSlots);
          return totalSlots && totalSlots > 0 ? `${label} (${totalSlots} slot${totalSlots === 1 ? "" : "s"})` : label;
        }).filter(Boolean)
      : toStringArray(profile.availability);

  const lessonTypeLabels = lessonTypes.map((lessonType) => pickFirstString(lessonType.label)).filter(Boolean);
  const privateMetric = metrics.find((metric) => pickFirstString(metric.label).toLowerCase() === "private");
  const privateValue = pickFirstString(privateMetric?.value);
  const groupLessonType = lessonTypes.find((lessonType) => pickFirstString(lessonType.id).toLowerCase() === "group");
  const groupValue = pickFirstString(groupLessonType?.price);
  const studentCount =
    parseNumberValue(profile.studentCount ?? profile.student_count) ?? parseStudentCountFromHighlights(highlightChips);

  return {
    ...coach,
    name: pickFirstString(profile.fullName, coach.name) || coach.name,
    initials: pickFirstString(profile.initials) || coach.initials,
    bio: pickFirstString(profile.about, coach.bio) || coach.bio,
    summary: pickFirstString(profile.about, coach.summary) || coach.summary,
    yearsExperience: parseNumberValue(profile.experienceYears ?? profile.experience_years) ?? coach.yearsExperience,
    certifications: toStringArray(profile.certifications),
    specialties: toStringArray(profile.specialties),
    courts: coachingLocations.length > 0 ? coachingLocations : profileLocations.length > 0 ? profileLocations : coach.courts,
    levels: toStringArray(profile.levels),
    formats: lessonTypeLabels.length > 0 ? lessonTypeLabels.map((label) => label.replace(/\s+lesson$/i, "")) : coach.formats,
    languages: toStringArray(profile.languages),
    availability: availabilityWindows[0] || coach.availability,
    availabilityWindows: availabilityWindows.length > 0 ? availabilityWindows : coach.availabilityWindows,
    lessonRates: {
      private: privateValue || coach.lessonRates.private,
      group: groupValue || coach.lessonRates.group,
    },
    hourlyRateValue:
      parseNumberValue(privateValue.replace?.(/[^\d.]/g, "")) ?? coach.hourlyRateValue,
    groupRateValue:
      parseNumberValue(groupValue.replace?.(/[^\d.]/g, "")) ?? coach.groupRateValue,
    pricePerHour: `${privateValue || coach.lessonRates.private}/hr`,
    imageUrl: pickImageUrl({ ...coach, profilePicture: profile.profilePicture }),
    cityLabel: coachingLocations[0] || profileLocations[0] || coach.cityLabel,
    location: coachingLocations[0] || profileLocations[0] || coach.location,
    studentCount: studentCount ?? coach.studentCount,
    tags:
      toStringArray(profile.specialties).length > 0
        ? toStringArray(profile.specialties).slice(0, 3)
        : coach.tags,
  };
};

const mapCoachRecordToCard = (record: Record<string, unknown>, fallbackIndex: number): CoachCardModel => {
  const pricing = (record.pricing as Record<string, unknown> | undefined) ?? {};
  const recommendation = (record.recommendation as Record<string, unknown> | undefined) ?? {};
  const primaryLocation = (record.primary_location as Record<string, unknown> | undefined) ?? undefined;
  const locationRecords = Array.isArray(record.locations)
    ? (record.locations as Array<Record<string, unknown>>)
    : [];
  const idCandidate =
    record.id ?? record.coach_id ?? record.player_coach_id ?? record.user_id ?? record.uuid ?? `${fallbackIndex}`;
  const displayName =
    pickFirstString(record.full_name, record.fullName, record.name, record.coach_name, record.coachName) ||
    `Coach ${fallbackIndex + 1}`;
  const certifications = toStringArray(record.certifications ?? record.certification ?? []);
  const locations = locationRecords
    .map((location) => pickFirstString(location.label, location.name, location.title))
    .filter(Boolean);
  const cityLabel =
    pickFirstString(
      primaryLocation?.label,
      record.city_label,
      record.location,
      record.city,
      record.city_name,
      record.facility,
      record.club_name,
    ) || locations[0] || "Multiple locations";
  const hourlyRate = parseNumberValue(
    record.hourly_rate ?? pricing.hourly ?? pricing.private ?? record.price_per_hour ?? record.hourlyRate ?? record.rate,
  );
  const hourlyRateDisplay =
    hourlyRate !== null ? `$${hourlyRate.toFixed(0)}` : "$0";
  const groupRateValue = parseNumberValue(record.group_rate ?? pricing.group ?? pricing.group_price ?? record.price_group);
  const semiRateValue = parseNumberValue(record.price_semi ?? pricing.semi ?? pricing.semi_private);
  const groupRateDisplay =
    groupRateValue !== null ? `$${groupRateValue.toFixed(0)}` : "";
  const summary =
    pickFirstString(
      record.about_me,
      record.summary,
      record.bio,
      record.about,
      record.description,
      (record.profile as Record<string, unknown> | undefined)?.summary,
      (record.profile as Record<string, unknown> | undefined)?.bio,
    ) || "Tennis coach profile coming soon.";
  const experience =
    parseNumberValue(
      record.years_experience ?? record.experience_years ?? record.yearsExperience ?? record.experience,
    ) ?? 0;
  const courts = locations.length > 0 ? locations : toStringArray(record.courts ?? record.venues ?? []);
  const levels = toStringArray(record.levels ?? record.focus_levels ?? record.skill_levels ?? []);
  const specialties = toStringArray(
    record.specialties ?? record.speciality ?? record.specialty ?? record.tags ?? [],
  );
  const languages = toStringArray(record.languages ?? record.language ?? []);
  const availabilityWindows = deriveAvailabilityWindows(record);
  const availabilitySummary = availabilityWindows[0] || "Availability on request";
  const nextLessonDay = availabilityWindows[0] || "Availability";
  const nextLessonTime = availabilityWindows[1] || "";
  const nextLessonCourt = cityLabel;
  const ratingValue =
    parseNumberValue(record.review_score ?? record.rating ?? record.rating_value ?? record.score) ?? 0;
  const ratingCount =
    parseNumberValue(
      record.review_count ?? record.reviews_count ?? record.rating_count ?? record.total_reviews,
    ) ?? 0;
  const distanceMiles = parseNumberValue(
    record.distance_miles ??
      record.distanceMiles ??
      record.distance ??
      primaryLocation?.distanceMiles,
  );
  const formats = deriveFormats(record);
  const matchScore =
    parseNumberValue(record.score ?? recommendation.score) ?? 0;
  const matchReasons = toStringArray(record.reasons ?? recommendation.reasons);
  const highlightCandidates: CoachHighlight[] = [];
  if (cityLabel) highlightCandidates.push({ icon: "map", label: cityLabel });
  highlightCandidates.push({ icon: "calendar", label: availabilitySummary });
  if (specialties.length > 0) highlightCandidates.push({ icon: "spark", label: specialties[0] });
  else if (formats.length > 0) highlightCandidates.push({ icon: "users", label: formats.join(" · ") });

  const numericId = (() => {
    if (typeof idCandidate === "number" && Number.isFinite(idCandidate)) return idCandidate;
    const parsed = Number(idCandidate);
    if (Number.isFinite(parsed)) return parsed;
    return fallbackIndex + 1;
  })();

  return {
    id: numericId,
    name: displayName,
    initials: pickFirstString(record.initials) || buildInitials(displayName),
    title:
      pickFirstString(record.title, record.headline, certifications[0], record.speciality, record.specialty, record.role, "Tennis Coach") ||
      "Tennis Professional",
    rating: ratingValue,
    reviewCount: ratingCount,
    studentCount: parseNumberValue(record.student_count ?? record.studentCount),
    location: cityLabel,
    pricePerHour: `${hourlyRateDisplay}/hr`,
    availabilityTag: availabilitySummary,
    featured: Boolean(record.is_featured || record.featured),
    summary,
    bio: summary,
    yearsExperience: experience,
    certifications,
    courts: courts.length > 0 ? courts : [cityLabel],
    levels: levels.length > 0 ? levels : ["Beginner", "Intermediate"],
    specialties,
    lessonRates: {
      private: hourlyRateDisplay,
      group: groupRateDisplay || hourlyRateDisplay,
    },
    languages,
    availability: availabilitySummary,
    nextAvailableLesson: {
      day: nextLessonDay,
      time: nextLessonTime,
      court: nextLessonCourt,
    },
    highlights: highlightCandidates,
    tags: specialties.length > 0 ? specialties.slice(0, 3) : formats.slice(0, 1),
    imageUrl: pickImageUrl(record),
    verified: certifications.length > 0,
    distanceMiles,
    cityLabel,
    hourlyRateValue: hourlyRate,
    groupRateValue,
    semiRateValue,
    availabilityWindows,
    formats,
    matchScore,
    matchReasons,
  };
};

const FindCoaches = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedRadius, setSelectedRadius] = useState<number>(DEFAULT_RADIUS);
  const [appliedRadius, setAppliedRadius] = useState<number>(DEFAULT_RADIUS);
  const [sortBy, setSortBy] = useState("distance");
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const [coaches, setCoaches] = useState<CoachCardModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [storedToken] = useState(() =>
    getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
  );
  const playerToken = user?.session?.access_token ?? user?.access_token ?? user?.token ?? storedToken ?? null;
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [locationFilter, setLocationFilter] = useState<SelectedLocation | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState(locationFilter?.label ?? "");
  const [showCoachMatchSurvey, setShowCoachMatchSurvey] = useState(false);
  const [coachMatchQuestions, setCoachMatchQuestions] = useState<NormalizedSurveyQuestion[]>([]);
  const [coachMatchLoading, setCoachMatchLoading] = useState(false);
  const [coachMatchSubmitting, setCoachMatchSubmitting] = useState(false);
  const [coachMatchSubmitted, setCoachMatchSubmitted] = useState(false);
  const [coachMatchError, setCoachMatchError] = useState<string | null>(null);
  const [coachMatchCurrentIndex, setCoachMatchCurrentIndex] = useState(0);
  const [locationPermissionPrompt, setLocationPermissionPrompt] = useState<string | null>(null);
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const [hasResolvedInitialLocation, setHasResolvedInitialLocation] = useState(false);

  const locationLabel = locationFilter?.label ?? (position ? "Current location" : "Select location");
  const hasLocationFilter = Boolean(locationFilter);

  const applyLocationFilter = useCallback((nextLocation: SelectedLocation | null) => {
    if (nextLocation && typeof nextLocation.latitude === "number" && typeof nextLocation.longitude === "number") {
      const coords: Coordinates = {
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
      };
      setPosition(coords);
      storeLocation(coords);
      storeLocationLabel(nextLocation.label);
      setLocationFilter(nextLocation);
      setLocationSearchTerm(nextLocation.label);
      setMode("normal");
      return;
    }

    setLocationFilter(null);
    setLocationSearchTerm("");
    setMode("normal");
    setPosition(null);
    storeLocation(null);
    storeLocationLabel(null);
  }, []);

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setHasResolvedInitialLocation(true);
      setLocationPermissionPrompt("Enable location permission in your browser to see coaches near you.");
      return;
    }

    setIsResolvingCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => {
        setIsResolvingCurrentLocation(false);
        setHasResolvedInitialLocation(true);
        setLocationPermissionPrompt(null);
        applyLocationFilter({
          label: "Current location",
          latitude: nextPosition.coords.latitude,
          longitude: nextPosition.coords.longitude,
          isCurrentLocation: true,
        });
      },
      () => {
        setIsResolvingCurrentLocation(false);
        setHasResolvedInitialLocation(true);
        setLocationPermissionPrompt(
          "Enable location permission in your browser to see coaches near your current location.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, [applyLocationFilter]);

  const openCoachMatchSurvey = useCallback(async () => {
    if (!playerToken || coachMatchLoading) return;

    setShowCoachMatchSurvey(true);
    setCoachMatchError(null);
    setCoachMatchSubmitted(false);

    if (coachMatchQuestions.length > 0) {
      return;
    }

    setCoachMatchLoading(true);
    try {
      const response = await getCoachMatchSurveyQuestions({ token: playerToken });
      setCoachMatchQuestions(extractSurveyQuestions(response));
    } catch (requestError) {
      setCoachMatchError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't load the coach match questionnaire right now.",
      );
    } finally {
      setCoachMatchLoading(false);
    }
  }, [coachMatchLoading, coachMatchQuestions.length, playerToken]);

  useEffect(() => {
    if (!location.state || typeof location.state !== "object") {
      return;
    }

    const shouldOpenCoachMatchSurvey = Boolean(
      (location.state as { openCoachMatchSurvey?: boolean }).openCoachMatchSurvey,
    );

    if (!shouldOpenCoachMatchSurvey) {
      return;
    }

    void openCoachMatchSurvey();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, openCoachMatchSurvey]);

  const handleCoachMatchSurveyFinished = useCallback(
    async (answers: Array<Record<string, unknown>>) => {
      if (!playerToken || coachMatchSubmitting) return;

      setCoachMatchSubmitting(true);
      setCoachMatchError(null);

      try {
        await submitCoachMatchSurveyAnswers({
          token: playerToken,
          surveyAnswers: buildSurveySubmissionPayload(answers, coachMatchQuestions),
        });
        setCoachMatchSubmitted(true);
      } catch (requestError) {
        setCoachMatchError(
          requestError instanceof Error
            ? requestError.message
            : "We couldn't submit your coach match answers right now.",
        );
      } finally {
        setCoachMatchSubmitting(false);
      }
    },
    [coachMatchQuestions, coachMatchSubmitting, playerToken],
  );

  useEffect(() => {
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    requestCurrentLocation();
  }, [requestCurrentLocation]);

  const fetchCoaches = useCallback(async () => {
    if (!playerToken) {
      setCoaches([]);
      setStatus("ready");
      setMode("error");
      setError("Please sign in to search for coaches.");
      return;
    }

    if (!position) {
      if (!hasResolvedInitialLocation) {
        setStatus("loading");
        return;
      }

      setCoaches([]);
      setStatus("ready");
      setMode("error");
      setError("Enable location permission to see coaches near your current location.");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const searchValue = appliedSearchTerm.trim();
      const params = new URLSearchParams({
        perPage: "12",
        page: "1",
        search: searchValue,
      });
      params.set("radius", appliedRadius.toString());

      const positionPayload =
        position && typeof position.latitude === "number" && typeof position.longitude === "number"
          ? {
              latitude: position.latitude,
              longitude: position.longitude,
              latitudeDelta: 0.25,
              longitudeDelta: 0.25,
            }
          : null;

      // When a place is chosen from Google autocomplete, use its coordinates for lookup
      // instead of sending the human-readable place label in the query string.
      if (!positionPayload) {
        const locationSearchValue = locationSearchTerm.trim();
        if (locationSearchValue) params.set("locationSearch", locationSearchValue);
      }

      const response = await api(`player/getchecklocation?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
        },
        json: {
          position: positionPayload,
        },
        authToken: playerToken,
      });

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
      const baseCards = extractCoachArray(payload).map((coach, index) => mapCoachRecordToCard(coach, index));
      const normalized = await Promise.all(
        baseCards.map(async (coach) => {
          try {
            const profile = await fetchCoachProfile(coach.id);
            return mergeCoachProfileIntoCard(coach, profile as Record<string, unknown>);
          } catch {
            return coach;
          }
        }),
      );
      setCoaches(normalized);
      setMode(normalized.length > 0 ? "normal" : "empty");
    } catch (requestError) {
      setCoaches([]);
      setMode("error");
      setError(
        requestError instanceof Error ? requestError.message : "We couldn't load coaches right now.",
      );
    } finally {
      setStatus("ready");
    }
  }, [
    appliedRadius,
    appliedSearchTerm,
    hasResolvedInitialLocation,
    playerToken,
    locationSearchTerm,
    position?.latitude,
    position?.longitude,
  ]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  const handleSearch = () => {
    const trimmed = searchTerm.trim();
    setMode("normal");
    if (trimmed === appliedSearchTerm) {
      fetchCoaches();
      return;
    }
    setAppliedSearchTerm(trimmed);
  };

  const handleRadiusChange = (radius: number) => {
    setSelectedRadius(radius);
    setMode("normal");
    if (radius === appliedRadius) {
      fetchCoaches();
      return;
    }
    setAppliedRadius(radius);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setAppliedSearchTerm("");
    setSelectedRadius(DEFAULT_RADIUS);
    setAppliedRadius(DEFAULT_RADIUS);
    applyLocationFilter(null);
  };

  const handleFilterChange = useCallback(
    ({ type, value }: { type: string; value?: unknown }) => {
      if (type === "location") {
        const locationValue = value as
          | { formatted_address?: string; lat?: number; lng?: number }
          | undefined;
        const latitude = locationValue?.lat;
        const longitude = locationValue?.lng;
        if (typeof latitude === "number" && typeof longitude === "number") {
          applyLocationFilter({
            label: locationValue?.formatted_address || "Selected location",
            latitude,
            longitude,
          });
        }
        return;
      }

      if (type === "name") {
        const nextName = typeof value === "string" ? value : "";
        setSearchTerm(nextName);
        setAppliedSearchTerm(nextName.trim());
        setMode("normal");
        return;
      }

      if (type === "clear") {
        resetFilters();
      }
    },
    [applyLocationFilter],
  );

  const filteredCoaches = useMemo(() => {
    if (mode !== "normal") return [];

    return [...coaches].sort((a, b) => {
        if (sortBy === "rating") return b.rating - a.rating;
        if (sortBy === "price_asc") return (a.hourlyRateValue ?? Number.MAX_SAFE_INTEGER) - (b.hourlyRateValue ?? Number.MAX_SAFE_INTEGER);
        if (sortBy === "price_desc") return (b.hourlyRateValue ?? 0) - (a.hourlyRateValue ?? 0);
        return (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER);
      });
  }, [coaches, mode, sortBy]);

  const shouldShowError = status === "ready" && mode === "error";
  const shouldShowEmpty =
    status === "ready" && (mode === "empty" || (mode === "normal" && filteredCoaches.length === 0));
  const shouldShowResults = status === "ready" && mode === "normal" && filteredCoaches.length > 0;

  const locationShortLabel = hasLocationFilter ? locationLabel : "Nearby";
  const resultsCountLabel =
    status === "loading"
      ? "Finding coaches..."
      : shouldShowError
        ? "Unable to load coaches"
        : shouldShowEmpty
          ? "No coaches found"
          : `${filteredCoaches.length} ${filteredCoaches.length === 1 ? "coach" : "coaches"} near you`;

  return (
    <MainLayout>
      <div className="fcv2-page">
        <header className="fcv2-mobile-header">
          <div className="fcv2-mobile-brand">
            <span className="fcv2-mobile-brand-mark">🎾</span>
            <span>
              The Tennis <em>Plan</em>
            </span>
          </div>
        </header>

        <section className="fcv2-mobile-search-block">
          <div className="fcv2-mobile-title-row">
            <div>
              <h1>Find a Coach</h1>
              <p>{resultsCountLabel}</p>
            </div>

            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="fcv2-mobile-sort">
              <option value="distance">Nearest</option>
              <option value="rating">Top Rated</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
            </select>
          </div>

          <div className="fcv2-mobile-search-row">
            <div className="fcv2-mobile-search-input">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                placeholder="Search by name, specialty, court..."
                aria-label="Search coaches"
              />
            </div>
          </div>

          {locationPermissionPrompt ? (
            <section className="fcv2-location-permission-banner" aria-label="Location permission">
              <div>
                <strong>Enable location</strong>
                <p>{locationPermissionPrompt}</p>
              </div>
              <button type="button" onClick={requestCurrentLocation} disabled={isResolvingCurrentLocation}>
                {isResolvingCurrentLocation ? "Checking..." : "Enable location"}
              </button>
            </section>
          ) : null}

          <section className="fcv2-coach-match-banner" aria-label="Find my coach">
            <div className="fcv2-coach-match-banner__icon" aria-hidden="true">🎾</div>
            <div className="fcv2-coach-match-banner__content">
              <div className="fcv2-coach-match-banner__title">Not sure where to start?</div>
              <div className="fcv2-coach-match-banner__copy">
                Answer 5 quick questions and we&apos;ll find your best match.
              </div>
              <div className="fcv2-coach-match-banner__actions">
                <button type="button" className="fcv2-coach-match-banner__button" onClick={openCoachMatchSurvey}>
                  Find my coach →
                </button>
                <button
                  type="button"
                  className="fcv2-coach-match-banner__secondary"
                  onClick={() => navigate("/coach-match/recommendations")}
                >
                  Explore recommended coaches
                </button>
              </div>
            </div>
          </section>

          <FilterMenu
            onFilterChange={handleFilterChange}
            userPos={{
              latitude: position?.latitude ?? DEFAULT_POSITION.latitude,
              longitude: position?.longitude ?? DEFAULT_POSITION.longitude,
            }}
            showName
            radius={selectedRadius}
            onRadiusChange={handleRadiusChange}
            isCoachSearch
            token={playerToken ?? undefined}
          />
        </section>

        <div className="fcv2-shell">
          <section className="fcv2-page-head">
            <div className="fcv2-page-head-copy">
              <h1>Find a Coach</h1>
              <p>
                <span>📍 {locationShortLabel}</span>
                <span>·</span>
                <span>{resultsCountLabel}</span>
              </p>
            </div>

            <div className="fcv2-page-head-actions">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="fcv2-sort-select"
                aria-label="Sort coaches"
              >
                <option value="distance">Nearest first</option>
                <option value="rating">Top rated</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </section>

          <section className="fcv2-search-panel">
            <div className="fcv2-search-bar">
              <Search size={18} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                placeholder="Search by coach name, court, or specialty"
                aria-label="Search coaches"
              />
              <button type="button" onClick={handleSearch}>
                Search
              </button>
            </div>

            {locationPermissionPrompt ? (
              <section className="fcv2-location-permission-banner" aria-label="Location permission">
                <div>
                  <strong>Enable location</strong>
                  <p>{locationPermissionPrompt}</p>
                </div>
                <button type="button" onClick={requestCurrentLocation} disabled={isResolvingCurrentLocation}>
                  {isResolvingCurrentLocation ? "Checking..." : "Enable location"}
                </button>
              </section>
            ) : null}

            <section className="fcv2-coach-match-banner" aria-label="Find my coach">
              <div className="fcv2-coach-match-banner__icon" aria-hidden="true">🎾</div>
              <div className="fcv2-coach-match-banner__content">
                <div className="fcv2-coach-match-banner__title">Not sure where to start?</div>
                <div className="fcv2-coach-match-banner__copy">
                  Answer 5 quick questions and we&apos;ll find your best match.
                </div>
                <div className="fcv2-coach-match-banner__actions">
                  <button type="button" className="fcv2-coach-match-banner__button" onClick={openCoachMatchSurvey}>
                    Find my coach →
                  </button>
                  <button
                    type="button"
                    className="fcv2-coach-match-banner__secondary"
                    onClick={() => navigate("/coach-match/recommendations")}
                  >
                    Explore recommended coaches
                  </button>
                </div>
              </div>
            </section>
            <FilterMenu
              onFilterChange={handleFilterChange}
              userPos={{
                latitude: position?.latitude ?? DEFAULT_POSITION.latitude,
                longitude: position?.longitude ?? DEFAULT_POSITION.longitude,
              }}
              showName
              radius={selectedRadius}
              onRadiusChange={handleRadiusChange}
              isCoachSearch
              token={playerToken ?? undefined}
            />
          </section>

          {status === "loading" ? (
            <section className="fcv2-grid coach-match-page__grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <article key={index} className="coach-match-card coach-match-card--skeleton" aria-hidden="true" />
              ))}
            </section>
          ) : null}

          {shouldShowError ? (
            <section className="fcv2-state">
              <div className="fcv2-state-icon">!</div>
              <h2>We couldn't load coaches right now</h2>
              <p>{error ?? "Please try again in a few minutes or adjust your filters."}</p>
              <button type="button" onClick={resetFilters}>
                Retry search
              </button>
            </section>
          ) : null}

          {shouldShowEmpty && !shouldShowError ? (
            <section className="fcv2-state">
              <div className="fcv2-state-icon">🎾</div>
              <h2>No coaches match these filters</h2>
              <p>Broaden your distance, clear filters, or try a different focus area.</p>
              <button type="button" onClick={resetFilters}>
                Reset filters
              </button>
            </section>
          ) : null}

          {shouldShowResults ? (
            <section className="fcv2-grid coach-match-page__grid">
              {filteredCoaches.map((coach) => (
                <article key={coach.id} className="coach-match-card">
                  <div className="coach-match-card__top">
                    <div className="coach-match-card__profile">
                      {coach.imageUrl ? (
                        <img src={coach.imageUrl} alt={coach.name} />
                      ) : (
                        <div className="coach-match-card__avatar-fallback">{coach.initials}</div>
                      )}
                      <div>
                        <h2>{coach.name}</h2>
                        <p>{formatExperience(coach.yearsExperience)}</p>
                      </div>
                    </div>

                    <div className="coach-match-card__score">
                      <Sparkles size={16} />
                      <strong>{coach.matchScore}</strong>
                      <span>match score</span>
                    </div>
                  </div>

                  <p className="coach-match-card__bio">{coach.bio || "Coach bio coming soon."}</p>

                  <div className="coach-match-card__chips">
                    {coach.levels.slice(0, 2).map((level) => (
                      <span key={`level-${coach.id}-${level}`}>{level}</span>
                    ))}
                    {coach.formats.slice(0, 2).map((format) => (
                      <span key={`format-${coach.id}-${format}`}>{format}</span>
                    ))}
                    {coach.specialties.slice(0, 2).map((specialty) => (
                      <span key={`specialty-${coach.id}-${specialty}`}>{specialty}</span>
                    ))}
                  </div>

                  <div className="coach-match-card__meta-grid">
                    <div>
                      <span>Private</span>
                      <strong>{formatMoney(coach.hourlyRateValue) || "N/A"}</strong>
                    </div>
                    <div>
                      <span>Semi</span>
                      <strong>{formatMoney(coach.semiRateValue) || "N/A"}</strong>
                    </div>
                    <div>
                      <span>Group</span>
                      <strong>{formatMoney(coach.groupRateValue) || "N/A"}</strong>
                    </div>
                    <div>
                      <span>Languages</span>
                      <strong>{coach.languages.slice(0, 2).join(", ") || "N/A"}</strong>
                    </div>
                  </div>

                  <div className="coach-match-card__breakdown">
                    <div className="coach-match-card__breakdown-title">
                      <Star size={14} />
                      <span>Why this coach matches</span>
                    </div>
                    <ul>
                      {coach.matchReasons.length > 0 ? (
                        coach.matchReasons.map((reason) => <li key={`${coach.id}-${reason}`}>{reason}</li>)
                      ) : (
                        <li>No reasons provided</li>
                      )}
                    </ul>
                  </div>

                  <div className="coach-match-card__footer">
                    <div className="coach-match-card__courts">
                      {coach.courts[0] || coach.cityLabel || "Home courts not listed"}
                    </div>
                    <Link to={`/coaches/${coach.id}`} className="coach-match-card__action">
                      View profile
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </div>

        {showCoachMatchSurvey ? (
          <div className="fcv2-coach-match-modal" onClick={() => setShowCoachMatchSurvey(false)}>
            <div className="fcv2-coach-match-modal__card" onClick={(event) => event.stopPropagation()}>
              <div className="fcv2-coach-match-modal__head">
                <div>
                  <p>Coach match</p>
                  <h2>Find my coach</h2>
                  {coachMatchQuestions.length > 0 ? (
                    <span>
                      Question {coachMatchCurrentIndex + 1} of {coachMatchQuestions.length}
                    </span>
                  ) : null}
                </div>
                <button type="button" onClick={() => setShowCoachMatchSurvey(false)} aria-label="Close coach match survey">
                  <X size={18} />
                </button>
              </div>

              {coachMatchLoading ? (
                <div className="fcv2-coach-match-modal__state">
                  <h3>Loading questionnaire…</h3>
                </div>
              ) : coachMatchSubmitted ? (
                <div className="fcv2-coach-match-modal__state">
                  <h3>Your coach match profile is saved</h3>
                  <p>We&apos;ll use these answers to improve your coach recommendations.</p>
                  <div className="fcv2-coach-match-modal__actions">
                    <button
                      type="button"
                      className="fcv2-coach-match-modal__ghost"
                      onClick={() => setShowCoachMatchSurvey(false)}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="fcv2-coach-match-banner__button"
                      onClick={() => {
                        setShowCoachMatchSurvey(false);
                        navigate("/coach-match/recommendations");
                      }}
                    >
                      View matches
                    </button>
                  </div>
                </div>
              ) : coachMatchError ? (
                <div className="fcv2-coach-match-modal__state fcv2-coach-match-modal__state--error">
                  <AlertTriangle size={22} aria-hidden="true" />
                  <h3>Unable to load coach questions</h3>
                  <p>{coachMatchError}</p>
                </div>
              ) : coachMatchQuestions.length > 0 ? (
                <SimpleSurvey
                  survey={coachMatchQuestions}
                  onCurrentQuestionIndexChange={setCoachMatchCurrentIndex}
                  onSurveyFinished={handleCoachMatchSurveyFinished}
                />
              ) : (
                <div className="fcv2-coach-match-modal__state">
                  <h3>No coach questionnaire available</h3>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <nav className="fcv2-mobile-tabbar" aria-label="Mobile navigation">
          <Link to="/">🏠<span>Home</span></Link>
          <Link to="/find-coaches" className="active">👤<span>Coaches</span></Link>
          <Link to="/group-lessons">👥<span>Groups</span></Link>
          <Link to="/matches">🏆<span>Match</span></Link>
          <Link to="/player/calendar">📅<span>Schedule</span></Link>
        </nav>
      </div>
    </MainLayout>
  );
};

export default FindCoaches;
