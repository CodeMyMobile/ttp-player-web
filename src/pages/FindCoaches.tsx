import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  MapPin,
  Pencil,
  Search,
  X,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import CoachMatchCard from "../components/coaches/CoachMatchCard";
import CoachSearchCard from "../components/coaches/CoachSearchCard";
import TrustCard from "../components/coaches/TrustCard";
import { normalizeVenueLabel } from "../utils/venueLabel";
import { fetchCoachProfile } from "../api/coachProfile";
import SimpleSurvey from "../components/questionnaire/SimpleSurvey";
import { type Coach, type CoachHighlight } from "../data/mockCoaches";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { getStoredAuthToken } from "../services/authToken";
import {
  clearCoachMatchSurveyAnswers,
  getCoachMatchSurveyQuestions,
  submitCoachMatchSurveyAnswers,
} from "../api/playerHome";
import {
  DEFAULT_RADIUS_MILES,
  getStoredLocation,
  getStoredLocationLabel,
  getStoredLocationRadius,
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

// Radius is owned by the header location chip and stored in utils/userLocation, the
// same store the feed, group lessons and find players read. This page used to keep its
// own copy and never read the stored one, so moving the header slider changed every
// other surface and left this one alone.

const shareCoach = async (id: string | number, name: string) => {
  const url = `${window.location.origin}/s/coach/${id}`;
  if (navigator.share) return navigator.share({ title: `Coach ${name}`, url });
  await navigator.clipboard?.writeText(url);
};


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

// Certifications are acronyms ("USPTA", "PTR") or phrases ("D3 NCAA champion") — preserve the source
// case exactly. Never title-case (it mangles acronyms into "Uspta"); just trim and drop empties.
const cleanCertifications = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);

const formatMoney = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(0)}` : null;
};

const formatDistance = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? `${numeric.toFixed(1)} mi` : "Distance unavailable";
};

// --- Presentational helpers for the redesigned coach card (no effect on matching/sorting) ---


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
    // camelCase keys the app's own data uses (detail API + already-mapped card model).
    // Including imageUrl preserves the card's correct search-list photo as a safety net,
    // so the fallback chain is real-detail-photo → real-search-photo → initials.
    record.profilePicture,
    record.avatarUrl,
    record.profileImage,
    record.imageUrl,
    // snake_case keys the raw search API returns.
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
  // No real photo → empty string so the card/profile renders initials, never a stock
  // stranger's face. Matches the profile page's "" → initials behavior.
  return "";
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
    certifications: cleanCertifications(toStringArray(profile.certifications)),
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
  const certifications = cleanCertifications(toStringArray(record.certifications ?? record.certification ?? []));
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
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [radiusMiles, setRadiusMiles] = useState<number>(
    () => getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES,
  );
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
      // Radius first, and outside the early return below: the header chip can change the
      // radius without changing the origin, and that has to reach this page. Syncing only
      // position was why moving the slider did nothing here.
      setRadiusMiles(getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES);

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
      page,
      locationFilter,
      locationSearchTerm,
    }),
    [
      appliedSearchTerm,
      locationFilter,
      locationSearchTerm,
      page,
      searchTerm,
    ],
  );

  const locationLabel = locationFilter?.label ?? (position ? "Current location" : "Select location");
  const hasLocationFilter = Boolean(locationFilter);
  const isSignedIn = Boolean(playerToken);
  const promptSignUp = useCallback(() => {
    navigate("/login", {
      state: {
        mode: "signup",
        from: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
          state: { findCoachesState: findCoachesStateSnapshot },
        },
      },
    });
  }, [findCoachesStateSnapshot, location.hash, location.pathname, location.search, navigate]);

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
      params.set("radius", radiusMiles.toString());

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
    radiusMiles,
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

  const resetFilters = () => {
    setSearchTerm("");
    setAppliedSearchTerm("");
    setPage(1);
    applyLocationFilter(null);
  };

  // Render in server-returned order. No client-side sort: it only reordered the
  // current page of ~12, which misrepresents the full result set (see
  // COACH_SEARCH_API_FINDINGS.md). The recommender's ranking is applied server-side.
  const filteredCoaches = useMemo(() => (mode !== "normal" ? [] : coaches), [coaches, mode]);

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
  const coachMatchBudgetRange = useMemo(
    () => parseBudgetRange(coachMatchSummaryItems.find((item) => item.label === "Budget")?.value),
    [coachMatchSummaryItems],
  );

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
  // Post-questionnaire "Your matches" framing: hide search/filters and lead with the ranked count.
  const isMatchedMode = shouldShowCoachMatchSummary;
  const matchedSubtitle =
    status === "loading"
      ? "Finding your matches..."
      : shouldShowError
        ? "Unable to load coaches"
        : `${filteredCoaches.length} ${filteredCoaches.length === 1 ? "coach" : "coaches"}, ranked just for you`;
  const renderCoachMatchPanel = () =>
    shouldShowCoachMatchSummary ? (
      <section className="fc-matched" aria-label="Matched for you">
        <div className="fc-matched__top">
          <span className="fc-matched__eyebrow">
            <Check size={15} strokeWidth={2.4} />
            Matched from your answers
          </span>
          <div className="fc-matched__actions">
            <button type="button" className="fc-matched__edit" onClick={openCoachMatchSurvey}>
              <Pencil size={13} strokeWidth={2} />
              Edit
            </button>
            <button type="button" className="fc-matched__clear" onClick={clearCoachMatchSummary}>
              {coachMatchClearing ? "Clearing…" : "Clear"}
            </button>
          </div>
        </div>
        <div className="fc-matched__chips">
          {coachMatchSummaryItems
            .filter((item) => item.label !== "Who")
            .map((item) => (
              <span key={item.label} className="fc-matched__chip">
                {item.value}
              </span>
            ))}
        </div>
      </section>
    ) : (
      <section className="fcv2-coach-match-banner" aria-label="Find my coach">
        <div className="fcv2-coach-match-banner__icon" aria-hidden="true">🎾</div>
        <div className="fcv2-coach-match-banner__content">
          <div className="fcv2-coach-match-banner__title">Not sure where to start?</div>
          <div className="fcv2-coach-match-banner__copy">
            Get matched in 5 questions
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
          {!isMatchedMode ? <TrustCard /> : null}
          <div className="fcv2-mobile-title-row">
            <div>
              <h1>{isMatchedMode ? "Your matches" : "Find a Coach"}</h1>
              <p>{isMatchedMode ? matchedSubtitle : resultsCountLabel}</p>
            </div>
          </div>

          {!isMatchedMode ? (
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
          ) : null}

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
              <h1>{isMatchedMode ? "Your matches" : "Find a Coach"}</h1>
              <p>
                <span>📍 {locationShortLabel}</span>
                <span>·</span>
                <span>{isMatchedMode ? matchedSubtitle : resultsCountLabel}</span>
              </p>
            </div>
          </section>

          {!isMatchedMode ? <TrustCard className="trust-card--desktop" /> : null}

          <section className="fcv2-search-panel">
            {!isMatchedMode ? (
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
            ) : null}

            {!isMatchedMode ? (
              <div className="fcv2-search-controls">
                </div>
            ) : null}

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
                  // Omit the group line unless there's a real non-zero group rate (formatMoney(0) === "$0").
                  const groupRate =
                    coach.groupRateValue && coach.groupRateValue > 0 ? formatMoney(coach.groupRateValue) : null;
                  const certLabel = coach.certifications[0] ?? "";
                  const privateFlag = isMatched ? budgetFlag(coach.hourlyRateValue, coachMatchBudgetRange) : null;
                  const groupFlag = isMatched ? budgetFlag(coach.groupRateValue, coachMatchBudgetRange) : null;
                  // One clean, short venue name (drops street/city/"Tennis Court"). See utils/venueLabel.
                  const rawLocation = coach.courts?.[0] ?? coach.cityLabel ?? "";
                  const venueLabel = normalizeVenueLabel(rawLocation);
                  const locationLabel = isDisplayableLocation(venueLabel) ? venueLabel : "";
                  const tags = coach.specialties.slice(0, 3);

                  return isMatched ? (
                    <CoachMatchCard
                      key={coach.id}
                      name={coach.name}
                      imageUrl={coach.imageUrl}
                      initials={coach.initials}
                      distanceLabel={formatDistance(coach.distanceMiles)}
                      matchPercent={matchPercent}
                      certLabel={certLabel || undefined}
                      yearsExperience={coach.yearsExperience}
                      studentCount={coach.studentCount}
                      levels={coach.levels}
                      reasons={reasons}
                      privateRate={privateRate}
                      groupRate={groupRate}
                      privateFlag={privateFlag}
                      groupFlag={groupFlag}
                      bio={coach.bio || "Coach bio coming soon."}
                      profileTo={`/coaches/${coach.id}`}
                      profileState={{ findCoachesState: findCoachesStateSnapshot }}
                      onBook={
                        isSignedIn
                          ? () =>
                              navigate(`/coaches/${coach.id}/book`, {
                                state: { findCoachesState: findCoachesStateSnapshot },
                              })
                          : promptSignUp
                      }
                    />
                  ) : (
                    <CoachSearchCard
                      key={coach.id}
                      name={coach.name}
                      imageUrl={coach.imageUrl}
                      initials={coach.initials}
                      distanceLabel={formatDistance(coach.distanceMiles)}
                      certLabel={certLabel || undefined}
                      yearsExperience={coach.yearsExperience}
                      studentCount={coach.studentCount}
                      privateRate={privateRate}
                      groupRate={groupRate}
                      bio={coach.bio || "Coach bio coming soon."}
                      tags={tags}
                      availabilityPhrase={deriveAvailabilityPhrase(coach)}
                      locationLabel={locationLabel || undefined}
                      profileTo={`/coaches/${coach.id}`}
                      profileState={{ findCoachesState: findCoachesStateSnapshot }}
                      onBook={
                        isSignedIn
                          ? () =>
                              navigate(`/coaches/${coach.id}/book`, {
                                state: { findCoachesState: findCoachesStateSnapshot },
                              })
                          : promptSignUp
                      }
                      onShare={() => shareCoach(coach.id, coach.name)}
                    />
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
                    {/* Closing returns to FindCoaches, now in "Your matches" (matched) mode. */}
                    <button
                      type="button"
                      className="fcv2-coach-match-banner__button"
                      onClick={() => setShowCoachMatchSurvey(false)}
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
