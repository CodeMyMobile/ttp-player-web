import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Search,
  X,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import FilterMenu from "../components/FilterMenu";
import { fetchCoachProfile } from "../api/coachProfile";
import SimpleSurvey from "../components/questionnaire/SimpleSurvey";
import { mockCoaches, type Coach, type CoachHighlight } from "../data/mockCoaches";
import { useAuth } from "../context/AuthContext";
import { useAuthDrawer } from "../hooks/useAuthDrawer";
import api from "../services/api";
import { getStoredAuthToken } from "../services/authToken";
import {
  clearCoachMatchSurveyAnswers,
  getCoachMatchSurveyQuestions,
  submitCoachMatchSurveyAnswers,
} from "../api/playerHome";
import {
  DEFAULT_POSITION,
  getStoredLocation,
  getStoredLocationLabel,
  storeLocation,
  storeLocationLabel,
  USER_LOCATION_CHANGED_EVENT,
  type Coordinates,
} from "../utils/userLocation";
import {
  buildSurveySubmissionPayload,
  extractSurveyQuestions,
  formatSurveyAnswer,
  hasSurveyAnswer,
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

type FindCoachesStateSnapshot = {
  searchTerm: string;
  appliedSearchTerm: string;
  selectedRadius: number;
  appliedRadius: number;
  sortBy: string;
  page: number;
  locationFilter: SelectedLocation | null;
  locationSearchTerm: string;
};

type FindCoachesRouteState = {
  openCoachMatchSurvey?: boolean;
  findCoachesState?: FindCoachesStateSnapshot;
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
  availableSlotCount: number | null;
};

const DEFAULT_RADIUS = 10;

type CoachMatchSummaryItem = {
  label: string;
  value: string;
};

type CoachesPagination = {
  page: number;
  perPage: number | null;
  total: number | null;
  totalPages: number | null;
};

const getInitialSelectedLocation = (): SelectedLocation | null => {
  const storedLocation = getStoredLocation();
  if (!storedLocation) return null;

  return {
    label: getStoredLocationLabel() ?? "Selected location",
    latitude: storedLocation.latitude,
    longitude: storedLocation.longitude,
  };
};

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

const extractPagination = (payload: unknown): CoachesPagination | null => {
  if (!payload || typeof payload !== "object") return null;

  const container = payload as Record<string, unknown>;
  const meta = container.meta as Record<string, unknown> | undefined;
  const pagination =
    (container.pagination as Record<string, unknown> | undefined)
    ?? (meta?.pagination as Record<string, unknown> | undefined)
    ?? container;

  const page = parseNumberValue(
    pagination.current_page
      ?? pagination.currentPage
      ?? pagination.page
      ?? container.current_page
      ?? container.currentPage
      ?? container.page,
  );
  const perPage = parseNumberValue(
    pagination.per_page
      ?? pagination.perPage
      ?? pagination.page_size
      ?? container.per_page
      ?? container.perPage,
  );
  const total = parseNumberValue(
    pagination.total
      ?? pagination.total_count
      ?? container.total
      ?? container.total_count,
  );
  const totalPages = parseNumberValue(
    pagination.total_pages
      ?? pagination.totalPages
      ?? pagination.last_page
      ?? container.total_pages
      ?? container.totalPages,
  );

  if (page === null && perPage === null && total === null && totalPages === null) {
    return null;
  }

  const resolvedPerPage = perPage && perPage > 0 ? perPage : null;
  const resolvedTotalPages = totalPages && totalPages > 0
    ? totalPages
    : (total && resolvedPerPage ? Math.max(1, Math.ceil(total / resolvedPerPage)) : null);

  return {
    page: page && page > 0 ? page : 1,
    perPage: resolvedPerPage,
    total: total && total >= 0 ? total : null,
    totalPages: resolvedTotalPages,
  };
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  zh: "Chinese",
};

const toTitleCase = (value: string) =>
  value
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const normalizeDisplayLabel = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  if (LANGUAGE_LABELS[lower]) return LANGUAGE_LABELS[lower];
  if (lower === "semi") return "Semi-Private";
  if (lower === "semi private") return "Semi-Private";
  if (lower === "weekday_mornings") return "Weekday Mornings";
  if (lower === "weekday_afternoons") return "Weekday Afternoons";
  if (lower === "weekday_evenings") return "Weekday Evenings";

  return toTitleCase(normalized);
};

const normalizeDisplayArray = (values: string[]) =>
  values
    .map((value) => normalizeDisplayLabel(value))
    .filter(Boolean);

const formatMoney = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(0)}` : null;
};

const formatDistance = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? `${numeric.toFixed(1)} mi` : "Distance unavailable";
};

// --- Presentational helpers for the redesigned coach card (no effect on matching/sorting) ---

// Reduce a formatted address to just its venue/neighborhood name —
// everything before the first comma — dropping city, state, ZIP, and country.
const toVenueLabel = (value: string): string => value.split(",")[0]?.trim() ?? "";

// Show a location only when it's a real place name — never a bare zip code.
const isDisplayableLocation = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(zip\s*)?\d{5}(-\d{4})?$/i.test(trimmed)) return false;
  return true;
};

// Parse a budget answer like "$50–80", "$50-$80", "$50 to 80" into a {min,max} range.
const parseBudgetRange = (value?: string): { min: number; max: number } | null => {
  if (!value) return null;
  const numbers = (value.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => Number.isFinite(n));
  if (numbers.length === 0) return null;
  if (numbers.length === 1) return { min: 0, max: numbers[0] };
  return { min: Math.min(numbers[0], numbers[1]), max: Math.max(numbers[0], numbers[1]) };
};

// Display-only: how a rate compares to the player's budget. Does not affect matching or sorting.
const budgetFlag = (
  rate: number | null | undefined,
  budget: { min: number; max: number } | null,
): "over" | "in" | null => {
  if (rate == null || !Number.isFinite(rate) || !budget) return null;
  return rate > budget.max ? "over" : "in";
};

// A time-anchored availability phrase derived from existing label data (no fabricated dates).
const deriveAvailabilityPhrase = (coach: CoachCardModel): string => {
  const raw =
    (Array.isArray(coach.availabilityWindows) ? coach.availabilityWindows[0] : "") ||
    (typeof coach.availability === "string" ? coach.availability : "") ||
    "";
  const cleaned = String(raw).replace(/\s*\(\d+\s*slots?\)\s*$/i, "").trim();
  if (cleaned && !/^availability/i.test(cleaned)) return `Next opening · ${cleaned}`;
  if ((coach.availableSlotCount ?? 0) > 0) return "Openings available";
  return "Availability on request";
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
  const formats = normalizeDisplayArray(
    toStringArray(record.formats ?? record.lesson_formats ?? record.lesson_types),
  );
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
  const explicit = normalizeDisplayArray(
    toStringArray(
      record.availability_windows ?? record.availability_labels ?? record.available_times ?? record.availability,
    ),
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
  const availableSlotCount = bookingDates.reduce((sum, date) => {
    const totalSlots = parseNumberValue(date.totalSlots);
    return totalSlots && totalSlots > 0 ? sum + totalSlots : sum;
  }, 0);

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
    certifications: normalizeDisplayArray(toStringArray(profile.certifications)),
    specialties: normalizeDisplayArray(toStringArray(profile.specialties)),
    courts: coachingLocations.length > 0 ? coachingLocations : profileLocations.length > 0 ? profileLocations : coach.courts,
    levels: normalizeDisplayArray(toStringArray(profile.levels)),
    formats:
      lessonTypeLabels.length > 0
        ? normalizeDisplayArray(lessonTypeLabels.map((label) => label.replace(/\s+lesson$/i, "")))
        : coach.formats,
    languages: normalizeDisplayArray(toStringArray(profile.languages)),
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
    availableSlotCount: availableSlotCount > 0 ? availableSlotCount : coach.availableSlotCount,
    tags:
      toStringArray(profile.specialties).length > 0
        ? normalizeDisplayArray(toStringArray(profile.specialties)).slice(0, 3)
        : coach.tags,
  };
};

const mapCoachRecordToCard = (record: Record<string, unknown>, fallbackIndex: number): CoachCardModel => {
  const pricing = (record.pricing as Record<string, unknown> | undefined) ?? {};
  const recommendation = (record.recommendation as Record<string, unknown> | undefined) ?? {};
  const recommendationPrices = (recommendation.prices as Record<string, unknown> | undefined) ?? {};
  const primaryLocation = (record.primary_location as Record<string, unknown> | undefined) ?? undefined;
  const locationRecords = Array.isArray(record.locations)
    ? (record.locations as Array<Record<string, unknown>>)
    : [];
  const idCandidate =
    record.id ?? record.coach_id ?? record.player_coach_id ?? record.user_id ?? record.uuid ?? `${fallbackIndex}`;
  const displayName =
    pickFirstString(record.full_name, record.fullName, record.name, record.coach_name, record.coachName) ||
    `Coach ${fallbackIndex + 1}`;
  const certifications = normalizeDisplayArray(toStringArray(record.certifications ?? record.certification ?? []));
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
    record.hourly_rate ??
      record.price_private ??
      pricing.hourly ??
      pricing.private ??
      recommendationPrices.private ??
      record.price_per_hour ??
      record.hourlyRate ??
      record.rate,
  );
  const hourlyRateDisplay =
    hourlyRate !== null ? `$${hourlyRate.toFixed(0)}` : "$0";
  const groupRateValue = parseNumberValue(
    record.group_rate ?? pricing.group ?? pricing.group_price ?? recommendationPrices.group ?? record.price_group,
  );
  const semiRateValue = parseNumberValue(
    record.price_semi ?? pricing.semi ?? pricing.semi_private ?? recommendationPrices.semi,
  );
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
  const levels = normalizeDisplayArray(toStringArray(record.levels ?? record.focus_levels ?? record.skill_levels ?? []));
  const specialties = normalizeDisplayArray(toStringArray(
    record.specialties ?? record.speciality ?? record.specialty ?? record.tags ?? [],
  ));
  const languages = normalizeDisplayArray(toStringArray(record.languages ?? record.language ?? []));
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
    availableSlotCount: null,
  };
};

const findCoachMatchQuestion = (
  questions: NormalizedSurveyQuestion[],
  matcher: (question: NormalizedSurveyQuestion) => boolean,
) => questions.find(matcher);

const getCoachMatchSummaryItems = (questions: NormalizedSurveyQuestion[]): CoachMatchSummaryItem[] => {
  const answeredQuestions = questions.filter((question) => hasSurveyAnswer(question));
  if (answeredQuestions.length === 0) return [];

  const getValue = (matcher: (question: NormalizedSurveyQuestion) => boolean) => {
    const question = findCoachMatchQuestion(answeredQuestions, matcher);
    return question ? formatSurveyAnswer(question).trim() : "";
  };

  return [
    { label: "Who", value: "Myself" },
    {
      label: "Level",
      value: getValue((question) => question.questionText.toLowerCase().includes("current level")),
    },
    {
      label: "Goals",
      value: getValue((question) => question.questionText.toLowerCase().includes("want to improve")),
    },
    {
      label: "Format",
      value: getValue((question) => question.questionText.toLowerCase().includes("prefer to learn")),
    },
    {
      label: "When",
      value: getValue((question) => question.questionText.toLowerCase().includes("usually free")),
    },
    {
      label: "Budget",
      value: getValue((question) => question.questionText.toLowerCase().includes("budget per lesson")),
    },
  ].filter((item) => item.value);
};

const FindCoaches = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openAuthDrawer } = useAuthDrawer();
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedRadius, setSelectedRadius] = useState<number>(DEFAULT_RADIUS);
  const [appliedRadius, setAppliedRadius] = useState<number>(DEFAULT_RADIUS);
  const [sortBy, setSortBy] = useState("distance");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const [coaches, setCoaches] = useState<CoachCardModel[]>([]);
  const [pagination, setPagination] = useState<CoachesPagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedToken] = useState(() =>
    getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
  );
  const playerToken = user?.session?.access_token ?? user?.access_token ?? user?.token ?? storedToken ?? null;
  const [locationFilter, setLocationFilter] = useState<SelectedLocation | null>(() => getInitialSelectedLocation());
  const [position, setPosition] = useState<Coordinates | null>(() => {
    const storedLocation = getStoredLocation();
    return storedLocation
      ? {
          latitude: storedLocation.latitude,
          longitude: storedLocation.longitude,
        }
      : null;
  });
  const [locationSearchTerm, setLocationSearchTerm] = useState(() => getInitialSelectedLocation()?.label ?? "");
  const [showCoachMatchSurvey, setShowCoachMatchSurvey] = useState(false);
  const [coachMatchQuestions, setCoachMatchQuestions] = useState<NormalizedSurveyQuestion[]>([]);
  const [coachMatchLoading, setCoachMatchLoading] = useState(false);
  const [coachMatchSubmitting, setCoachMatchSubmitting] = useState(false);
  const [coachMatchClearing, setCoachMatchClearing] = useState(false);
  const [coachMatchSubmitted, setCoachMatchSubmitted] = useState(false);
  const [coachMatchError, setCoachMatchError] = useState<string | null>(null);
  const [coachMatchCurrentIndex, setCoachMatchCurrentIndex] = useState(0);
  const [coachMatchSummaryDismissed, setCoachMatchSummaryDismissed] = useState(false);
  const [locationPermissionPrompt, setLocationPermissionPrompt] = useState<string | null>(null);
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);
  const [hasResolvedInitialLocation, setHasResolvedInitialLocation] = useState(() => Boolean(getStoredLocation()));

  useEffect(() => {
    const syncStoredLocation = () => {
      const storedLocation = getStoredLocation();
      if (!storedLocation) return;

      const nextLocation = {
        label: getStoredLocationLabel() ?? "Selected location",
        latitude: storedLocation.latitude,
        longitude: storedLocation.longitude,
      };

      setPosition(storedLocation);
      setLocationFilter(nextLocation);
      setLocationSearchTerm(nextLocation.label);
      setHasResolvedInitialLocation(true);
    };

    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
    return () => window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
  }, []);

  const findCoachesStateSnapshot = useMemo<FindCoachesStateSnapshot>(
    () => ({
      searchTerm,
      appliedSearchTerm,
      selectedRadius,
      appliedRadius,
      sortBy,
      page,
      locationFilter,
      locationSearchTerm,
    }),
    [
      appliedRadius,
      appliedSearchTerm,
      locationFilter,
      locationSearchTerm,
      page,
      searchTerm,
      selectedRadius,
      sortBy,
    ],
  );

  const locationLabel = locationFilter?.label ?? (position ? "Current location" : "Select location");
  const hasLocationFilter = Boolean(locationFilter);
  const isSignedIn = Boolean(playerToken);

  const handleBookLesson = useCallback(
    (coach: CoachCardModel) => {
      const proceedToBooking = () =>
        navigate(`/coaches/${coach.id}`, { state: { findCoachesState: findCoachesStateSnapshot } });

      if (isSignedIn) {
        proceedToBooking();
        return;
      }

      openAuthDrawer({
        mode: "signin",
        title: `Sign in to book with ${coach.name}`,
        onSuccess: proceedToBooking,
      });
    },
    [findCoachesStateSnapshot, isSignedIn, navigate, openAuthDrawer],
  );

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

  const loadCoachMatchQuestions = useCallback(
    async ({ showLoader = false, surfaceError = false }: { showLoader?: boolean; surfaceError?: boolean } = {}) => {
      if (!playerToken) return [];

      if (showLoader) setCoachMatchLoading(true);
      if (surfaceError) setCoachMatchError(null);

      try {
        const response = await getCoachMatchSurveyQuestions({ token: playerToken });
        const questions = extractSurveyQuestions(response);
        setCoachMatchQuestions(questions);
        return questions;
      } catch (requestError) {
        if (surfaceError) {
          setCoachMatchError(
            requestError instanceof Error
              ? requestError.message
              : "We couldn't load the coach match questionnaire right now.",
          );
        }
        return [];
      } finally {
        if (showLoader) setCoachMatchLoading(false);
      }
    },
    [playerToken],
  );

  const openCoachMatchSurvey = useCallback(async () => {
    if (!playerToken || coachMatchLoading) return;

    setShowCoachMatchSurvey(true);
    setCoachMatchError(null);
    setCoachMatchSubmitted(false);
    setCoachMatchSummaryDismissed(false);

    if (coachMatchQuestions.length > 0) {
      return;
    }

    await loadCoachMatchQuestions({ showLoader: true, surfaceError: true });
  }, [coachMatchLoading, coachMatchQuestions.length, loadCoachMatchQuestions, playerToken]);

  useEffect(() => {
    if (!location.state || typeof location.state !== "object") {
      return;
    }

    const routeState = location.state as FindCoachesRouteState;
    const restoredState = routeState.findCoachesState;
    const shouldOpenCoachMatchSurvey = Boolean(routeState.openCoachMatchSurvey);

    if (!restoredState && !shouldOpenCoachMatchSurvey) {
      return;
    }

    if (restoredState) {
      setSearchTerm(restoredState.searchTerm);
      setAppliedSearchTerm(restoredState.appliedSearchTerm);
      setSelectedRadius(restoredState.selectedRadius);
      setAppliedRadius(restoredState.appliedRadius);
      setSortBy(restoredState.sortBy);
      setPage(restoredState.page || 1);
      setLocationSearchTerm(restoredState.locationSearchTerm);
      applyLocationFilter(restoredState.locationFilter);
    }

    if (shouldOpenCoachMatchSurvey) {
      void openCoachMatchSurvey();
    }

    const nextState = { ...routeState };
    delete nextState.findCoachesState;
    delete nextState.openCoachMatchSurvey;

    navigate(location.pathname, {
      replace: true,
      state: Object.keys(nextState).length > 0 ? nextState : null,
    });
  }, [applyLocationFilter, location.pathname, location.state, navigate, openCoachMatchSurvey]);

  useEffect(() => {
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    if (getStoredLocation()) return;
    requestCurrentLocation();
  }, [requestCurrentLocation]);

  useEffect(() => {
    if (!playerToken) {
      setCoachMatchQuestions([]);
      return;
    }

    void loadCoachMatchQuestions();
  }, [loadCoachMatchQuestions, playerToken]);

  const fetchCoaches = useCallback(async () => {
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
        page: String(page),
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

      const endpoint = playerToken ? "player/getchecklocation" : "public/coaches/search";
      const response = await api(`${endpoint}?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
        },
        json: {
          position: positionPayload,
        },
        authToken: playerToken ?? null,
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
      setPagination(extractPagination(payload));
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
      setPagination(null);
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
    locationSearchTerm,
    page,
    playerToken,
    position?.latitude,
    position?.longitude,
  ]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

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
        await loadCoachMatchQuestions();
        await fetchCoaches();
        setCoachMatchSummaryDismissed(false);
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
    [coachMatchQuestions, coachMatchSubmitting, fetchCoaches, loadCoachMatchQuestions, playerToken],
  );

  const clearCoachMatchSummary = useCallback(async () => {
    if (!playerToken || coachMatchClearing) return;

    setCoachMatchClearing(true);
    setCoachMatchError(null);

    try {
      await clearCoachMatchSurveyAnswers({ token: playerToken });
      setCoachMatchQuestions([]);
      setCoachMatchSummaryDismissed(true);
      setCoachMatchSubmitted(false);
      await loadCoachMatchQuestions();
      await fetchCoaches();
    } catch (requestError) {
      setCoachMatchError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't clear your coach match answers right now.",
      );
    } finally {
      setCoachMatchClearing(false);
    }
  }, [coachMatchClearing, fetchCoaches, loadCoachMatchQuestions, playerToken]);

  const handleSearch = () => {
    const trimmed = searchTerm.trim();
    setMode("normal");
    setPage(1);
    if (trimmed === appliedSearchTerm) {
      fetchCoaches();
      return;
    }
    setAppliedSearchTerm(trimmed);
  };

  const handleRadiusChange = (radius: number) => {
    setSelectedRadius(radius);
    setMode("normal");
    setPage(1);
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
    setPage(1);
    applyLocationFilter(null);
  };

  const handleFilterChange = useCallback(
    ({ type, value }: { type: string; value?: unknown }) => {
      if (type === "location") {
        const locationValue = value as
          | { formatted_address?: string; short_label?: string; lat?: number; lng?: number }
          | undefined;
        const latitude = locationValue?.lat;
        const longitude = locationValue?.lng;
        if (typeof latitude === "number" && typeof longitude === "number") {
          applyLocationFilter({
            label: locationValue?.short_label || locationValue?.formatted_address || "Selected location",
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
        setPage(1);
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
      if (sortBy === "match") {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        if ((a.distanceMiles ?? Number.MAX_SAFE_INTEGER) !== (b.distanceMiles ?? Number.MAX_SAFE_INTEGER)) {
          return (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER);
        }
        return b.rating - a.rating;
      }
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
  const totalPages = pagination?.totalPages ?? null;
  const hasPreviousPage = page > 1;
  const hasNextPage = useMemo(() => {
    if (totalPages) return page < totalPages;
    if (pagination?.perPage) return filteredCoaches.length >= pagination.perPage;
    return false;
  }, [filteredCoaches.length, page, pagination?.perPage, totalPages]);

  const locationShortLabel = hasLocationFilter ? locationLabel : "Nearby";
  const coachMatchSummaryItems = useMemo(
    () => getCoachMatchSummaryItems(coachMatchQuestions),
    [coachMatchQuestions],
  );
  const hasSavedCoachMatchPreferences = coachMatchSummaryItems.length > 0;
  const shouldShowCoachMatchSummary =
    !coachMatchSummaryDismissed && !showCoachMatchSurvey && coachMatchSummaryItems.length > 0;
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const coachMatchBudgetRange = useMemo(
    () => parseBudgetRange(coachMatchSummaryItems.find((item) => item.label === "Budget")?.value),
    [coachMatchSummaryItems],
  );

  useEffect(() => {
    if (hasSavedCoachMatchPreferences && sortBy === "distance") {
      setSortBy("match");
      return;
    }

    if (!hasSavedCoachMatchPreferences && sortBy === "match") {
      setSortBy("distance");
    }
  }, [hasSavedCoachMatchPreferences, sortBy]);

  const coachMatchMaxScore = useMemo(
    () => Math.max(...filteredCoaches.map((coach) => coach.matchScore), 1),
    [filteredCoaches],
  );
  const shouldNormalizeCoachScores = coachMatchMaxScore <= 25;
  const resultsCountLabel =
    status === "loading"
      ? "Finding coaches..."
      : shouldShowError
        ? "Unable to load coaches"
        : shouldShowEmpty
          ? "No coaches found"
          : `${filteredCoaches.length} ${filteredCoaches.length === 1 ? "coach" : "coaches"} near you`;
  const renderCoachMatchPanel = () =>
    shouldShowCoachMatchSummary ? (
      <section className="fc-summary" aria-label="Matched for you">
        <div className="fc-summary__top">
          <span className="fc-summary__ball" aria-hidden="true">🎾</span>
          <span className="fc-summary__title">Matched for you</span>
          <button type="button" className="fc-summary__edit" onClick={openCoachMatchSurvey}>
            Edit
          </button>
          <button
            type="button"
            className="fc-summary__toggle"
            aria-expanded={summaryExpanded}
            aria-label={summaryExpanded ? "Collapse match criteria" : "Expand match criteria"}
            onClick={() => setSummaryExpanded((value) => !value)}
          >
            <ChevronDown size={16} className={`fc-summary__chev${summaryExpanded ? " is-open" : ""}`} />
          </button>
        </div>
        {summaryExpanded ? (
          <div className="fc-summary__detail">
            {coachMatchSummaryItems.map((item) => (
              <div key={item.label} className="fc-summary__row">
                <span className="fc-summary__row-label">{item.label}</span>
                <span className="fc-summary__row-value">{item.value}</span>
              </div>
            ))}
            <button type="button" className="fc-summary__clear" onClick={clearCoachMatchSummary}>
              {coachMatchClearing ? "Clearing..." : "Clear preferences"}
            </button>
          </div>
        ) : (
          <div className="fc-summary__line">
            {coachMatchSummaryItems
              .filter((item) => item.label !== "Who")
              .map((item) => item.value)
              .join(" · ")}
          </div>
        )}
      </section>
    ) : (
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
          </div>
        </div>
      </section>
    );

  return (
    <MainLayout mobileChrome="home" desktopChrome="home">
      <div className="fcv2-page">
        <section className="fcv2-mobile-search-block">
          <div className="fcv2-mobile-title-row">
            <div>
              <h1>Find a Coach</h1>
              <p>{resultsCountLabel}</p>
            </div>

            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="fcv2-mobile-sort">
              <option value="match">Best Match</option>
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

            <div className="fcv2-mobile-search-filter">
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
                compact
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
        </section>

        <section className="fcv2-mobile-banner-block">
          {renderCoachMatchPanel()}
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
                <option value="match">Best match</option>
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

            {renderCoachMatchPanel()}
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
              compact
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
            <>
              <section className="fcv2-grid coach-match-page__grid">
                {filteredCoaches.map((coach) => {
                  const isMatched = shouldShowCoachMatchSummary;
                  const matchPercent = shouldNormalizeCoachScores
                    ? Math.round((coach.matchScore / coachMatchMaxScore) * 100)
                    : Math.max(0, Math.min(100, Math.round(coach.matchScore)));
                  const reasons = coach.matchReasons.slice(0, 3);
                  const privateRate = formatMoney(coach.hourlyRateValue);
                  const groupRate = formatMoney(coach.groupRateValue);
                  const certLabel = coach.certifications[0] ?? "";
                  const privateFlag = isMatched ? budgetFlag(coach.hourlyRateValue, coachMatchBudgetRange) : null;
                  const groupFlag = isMatched ? budgetFlag(coach.groupRateValue, coachMatchBudgetRange) : null;
                  const rawLocation = [coach.courts?.[0], coach.cityLabel].find(isDisplayableLocation) || "";
                  const locationLabel = toVenueLabel(rawLocation);
                  const tags = coach.specialties.slice(0, 3);

                  return (
                    <article key={coach.id} className="fc-card">
                      <div className="fc-card__head">
                        <div className="fc-card__photo">
                          {coach.imageUrl ? (
                            <img src={coach.imageUrl} alt={coach.name} />
                          ) : (
                            <span>{coach.initials}</span>
                          )}
                        </div>

                        <div className="fc-card__mid">
                          <div className="fc-card__name">{coach.name}</div>
                          <div className="fc-card__signals">
                            {certLabel ? (
                              <span className="fc-card__cert">{certLabel}</span>
                            ) : (
                              <span className="fc-card__new">New coach</span>
                            )}
                            <span className="fc-card__dist">· {formatDistance(coach.distanceMiles)}</span>
                          </div>
                        </div>

                        <div className="fc-card__head-right">
                          {isMatched && matchPercent > 0 ? (
                            <div className="fc-card__match">
                              <div className="fc-card__match-pct">{matchPercent}%</div>
                              <div className="fc-card__match-lbl">Match</div>
                            </div>
                          ) : (
                            <div className="fc-card__rate-right">
                              <div className="fc-card__rate-main">
                                <span className="fc-card__sm">$</span>
                                {privateRate ? privateRate.replace("$", "") : "N/A"}
                                <span className="fc-card__sm">/hour</span>
                              </div>
                              {groupRate ? <div className="fc-card__rate-group">group {groupRate}</div> : null}
                            </div>
                          )}
                        </div>
                      </div>

                      {isMatched ? (
                        <div className="fc-card__rate-line">
                          <span className="fc-card__rate-main">
                            <span className="fc-card__sm">$</span>
                            {privateRate ? privateRate.replace("$", "") : "N/A"}
                            <span className="fc-card__sm">/hour</span>
                          </span>
                          {privateFlag ? (
                            <span className={`fc-card__flag fc-card__flag--${privateFlag}`}>
                              {privateFlag === "over" ? "Over budget" : "In budget"}
                            </span>
                          ) : null}
                          {groupRate ? <span className="fc-card__rate-group">· group {groupRate}</span> : null}
                          {groupRate && groupFlag ? (
                            <span className={`fc-card__flag fc-card__flag--${groupFlag}`}>
                              {groupFlag === "over" ? "Over budget" : "In budget"}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {isMatched && reasons.length > 0 ? (
                        <div className="fc-card__why">
                          {reasons.map((reason) => (
                            <div key={`${coach.id}-${reason}`} className="fc-card__why-row">
                              <Check size={14} strokeWidth={3} />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <p className="fc-card__bio">{coach.bio || "Coach bio coming soon."}</p>

                      {tags.length > 0 ? (
                        <div className="fc-card__tags">
                          {tags.map((tag) => (
                            <span key={`${coach.id}-${tag}`} className="fc-card__tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {!isMatched ? (
                        <div className="fc-card__avail">
                          <span className="fc-card__avail-dot" />
                          <span>
                            {deriveAvailabilityPhrase(coach)}
                            {locationLabel ? ` · ${locationLabel}` : ""}
                          </span>
                        </div>
                      ) : null}

                      <div className="fc-card__actions">
                        {isMatched ? (
                          <>
                            {/* Booking isn't wired this PR (separate booking PR); temporarily routes to the
                                profile. Logged-out users get the contextual auth drawer first. */}
                            <button
                              type="button"
                              onClick={() => handleBookLesson(coach)}
                              className="fc-card__btn fc-card__btn--book"
                            >
                              Book a lesson
                            </button>
                            <Link
                              to={`/coaches/${coach.id}`}
                              state={{ findCoachesState: findCoachesStateSnapshot }}
                              className="fc-card__btn fc-card__btn--profile"
                            >
                              Profile
                            </Link>
                          </>
                        ) : (
                          <Link
                            to={`/coaches/${coach.id}`}
                            state={{ findCoachesState: findCoachesStateSnapshot }}
                            className="fc-card__btn fc-card__btn--profile fc-card__btn--full"
                          >
                            View profile
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
              {(totalPages && totalPages > 1) || hasPreviousPage || hasNextPage ? (
                <nav className="fcv2-pagination" aria-label="Coach results pagination">
                  <button
                    type="button"
                    className="fcv2-pagination__button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={!hasPreviousPage || status === "loading"}
                  >
                    Previous
                  </button>
                  <span className="fcv2-pagination__status">
                    Page {page}
                    {totalPages ? ` of ${totalPages}` : ""}
                  </span>
                  <button
                    type="button"
                    className="fcv2-pagination__button"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={!hasNextPage || status === "loading"}
                  >
                    Next
                  </button>
                </nav>
              ) : null}
            </>
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

      </div>
    </MainLayout>
  );
};

export default FindCoaches;
