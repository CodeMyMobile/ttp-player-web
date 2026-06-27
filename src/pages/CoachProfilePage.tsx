import moment from "moment";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  loadStripe,
  type PaymentRequest as StripePaymentRequest,
  type PaymentRequestPaymentMethodEvent,
  type Stripe,
} from "@stripe/stripe-js";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  Users,
  Wallet,
  X,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import JoinMyRosterBanner from "../components/coaches/JoinMyRosterBanner";
import BookingSlotList from "../components/coaches/BookingSlotList";
import { fetchCoachProfile, type CoachProfileRecord } from "../api/coachProfile";
import {
  consumePackageCredits,
  fetchCoachPackages,
  fetchPackageCredits,
  fetchPackageCreditsBalance,
  purchaseCoachPackage,
  type CoachPackage,
  type PackageCreditsBalanceResponse,
  type PackagePurchase,
} from "../api/playerPackages";
import {
  fetchAvailableLessons,
  cancelBooking,
  fetchCoachLessonsByDate,
  fetchCoachSchedule,
  joinLesson,
  type CoachScheduleEntry,
  type Lesson,
  requestPrivateLesson,
} from "../api/playerLessons";
import {
  createPlayerStripePaymentIntent,
  getPlayerStripePaymentMethods,
  type PlayerStripePaymentMethod,
} from "../api/playerStripe";
import { getPlayerCoachLessonHistory, getPlayerUpcomingLessons, updatePlayerLesson, type PlayerLesson } from "../api/player";
import { useAuth } from "../context/AuthContext";
import { useCoachRoster } from "../hooks/useCoachRoster";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";
import BookingStatusModal, { type BookingStatus } from "../components/booking/BookingStatusModal";
import LessonDetailCard from "../components/LessonDetailCard";
import LessonPaymentSummary from "../components/payments/LessonPaymentSummary";
import {
  calculateLessonPricing,
  packageAllowsLessonCreditType,
  resolveLessonCheckoutType,
  resolveLessonCreditType,
} from "../utils/lessonPricing";
import {
  findUpcomingLessonForSlot,
  getGroupParticipantBookingState,
} from "../utils/coachProfileBookingState.js";
import {
  filterCoachPackagesByLessonType,
  getCoachPackageLessonTypeOptions,
} from "../utils/coachPackageFilters.js";

import "./CoachProfilePage.css";
import "../components/coaches/coaches.css";

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_STRIPE_PUBLISHABLEKEY ??
  "";

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const parseStatusCode = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getLessonStatusCode = (lesson: unknown) => {
  const record = lesson as Record<string, unknown>;
  return parseStatusCode(record.payment_status ?? record.paymentStatus ?? record.status);
};

type LessonTypeFilter = "all" | "private" | "group";
type AnchorTab = "about" | "specialties" | "courts";
type BookingStep = "about" | "confirm" | "card" | "success";
type IntroWho = "Myself" | "My child" | "";
type PaymentChoice = "credits" | "card" | "wallet";
type PackageLessonTypeFilter = "all" | "private" | "group";

type FindCoachesStateSnapshot = {
  searchTerm: string;
  appliedSearchTerm: string;
  selectedRadius: number;
  appliedRadius: number;
  sortBy: string;
  locationFilter: {
    label: string;
    latitude: number;
    longitude: number;
    isCurrentLocation?: boolean;
  } | null;
  locationSearchTerm: string;
};

type CoachProfileRouteState = {
  resumeBookingSlotId?: string;
  resumePaymentChoice?: PaymentChoice;
  focusBookCta?: boolean;
  purchaseAfterAuth?: boolean;
  findCoachesState?: FindCoachesStateSnapshot;
};

type LoadedSlot = {
  id: string;
  type: Exclude<LessonTypeFilter, "all">;
  isoDate: string;
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  durationMin: number;
  court: string;
  priceLabel: string;
  start: string;
  end: string;
  className?: string;
  level?: string;
  description?: string;
  spotsLeft?: number;
  totalSpots?: number;
  locationId?: number | null;
  courtValue?: number | string | null;
  sourceLessonId?: number;
  bookingState?: "pending" | "confirmed";
  hourlyRate?: number | null;
  groupPricePerPerson?: number | null;
  discountPercentage?: number;
  lessonTypeName?: string;
  lessonTypeId?: number | null;
  coachId?: number | null;
  groupPlayers?: Array<Record<string, unknown>>;
};

type ApiBookingSlot = {
  id?: string;
  lessonId?: number;
  sourceLessonId?: number;
  time?: string;
  duration?: string;
  price?: string;
  lessonType?: string;
  lessonTypeId?: number | null;
  title?: string;
  location?: string;
  locationId?: number | null;
  court?: number | string | null;
  lessonStatus?: string | null;
  spotsRemaining?: number;
  totalSpots?: number | null;
  level?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  groupLessonPriceId?: number | null;
  groupPlayers?: Array<Record<string, unknown>>;
  group_players?: Array<Record<string, unknown>>;
  metadata?: {
    title?: string;
    level?: string;
    description?: string;
    levels?: string[];
  };
};

type ApiBookingDate = {
  id?: string;
  day?: string;
  date?: string;
  label?: string;
  slots?: ApiBookingSlot[];
};

type AvailableLessonSlot = {
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  schedule_id?: number;
  location_id?: number | null;
  location?: string;
  court?: number | string | null;
};

type AvailableLessonDay = {
  date?: string;
  day?: string;
  slots?: AvailableLessonSlot[];
};

type AvailableLessonsResponse = {
  availability?: AvailableLessonDay[];
};

type DayGroup = {
  isoDate: string;
  dayLabel: string;
  dateLabel: string;
  shortDateLabel: string;
  slots: LoadedSlot[];
};

type IntroFormState = {
  who: IntroWho;
  level: string;
  goals: string[];
  note: string;
};

type BookingConfirmationData = {
  status: BookingStatus;
  data: {
    coachName: string;
    coachInitials: string;
    lessonTitle?: string;
    lessonSubtitle?: string;
    skillRange?: string;
    lessonTypeLabel: string;
    isGroup?: boolean;
    durationMin: number;
    dateLabel: string;
    timeLabel: string;
    locationName: string;
    locationAddress: string;
    amountLabel: string;
    amount: string;
    etaText?: string;
    cancellationPolicyText: string;
  };
};

type CancelFlowState = "closed" | "confirm" | "success";

const SCHEDULE_WINDOW_DAYS = 7;
const INTRO_GOALS = [
  "Serve",
  "Groundstrokes",
  "Match strategy",
  "Doubles",
  "Fitness",
  "Tournament prep",
  "Just have fun",
];

const LEVEL_OPTIONS = [
  "Beginner",
  "Beginner+",
  "Intermediate",
  "Intermediate+",
  "Advanced",
  "Competitive",
];

// Skill order for the hero tagline level range (lowest → highest). Unknown labels sort last.
const LEVEL_SKILL_ORDER = ["beginner", "beginner+", "intermediate", "intermediate+", "advanced", "competitive"];
const levelSkillRank = (label: string) => {
  const index = LEVEL_SKILL_ORDER.indexOf(label.trim().toLowerCase());
  return index === -1 ? LEVEL_SKILL_ORDER.length : index;
};

const DISPLAY_LABEL_OVERRIDES: Record<string, string> = {
  private: "Private",
  semi: "Semi-Private",
  "semi private": "Semi-Private",
  group: "Group",
  clinics: "Clinics",
  hitting: "Hitting",
  mental: "Mental Game",
  "mental game": "Mental Game",
  en: "English",
  es: "Spanish",
  fr: "French",
  zh: "Chinese",
};

const formatDisplayLabel = (value: string) => {
  const cleaned = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return "";

  const normalized = cleaned.toLowerCase();
  const override = DISPLAY_LABEL_OVERRIDES[normalized];
  if (override) return override;

  return normalized
    .split(" ")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
};

const formatDisplayLabelList = (values?: string[]) =>
  (values ?? []).map(formatDisplayLabel).filter((item): item is string => item.length > 0);

const buildEmptyDayGroup = (date: moment.Moment): DayGroup => ({
  isoDate: date.format("YYYY-MM-DD"),
  dayLabel: date.format("ddd"),
  dateLabel: date.format("MMM D"),
  shortDateLabel: date.format("D"),
  slots: [],
});

const shortenLocationLabel = (value?: string | null) => {
  if (!value) return "Court TBD";
  const trimmed = value.trim();
  if (!trimmed) return "Court TBD";

  const [firstSegment] = trimmed.split(",");
  const base = firstSegment?.trim() || trimmed;
  const words = base.split(/\s+/).filter(Boolean);

  if (words.length <= 3) return base;

  return words.slice(0, 3).join(" ");
};

// §4 booking module — time-of-day bucketing now lives in the shared BookingSlotList component.

const useCoachProfile = (id?: string, token?: string) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CoachProfileRecord | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    if (!id) {
      setProfile(undefined);
      setError(undefined);
      setLoading(false);
      return () => controller.abort();
    }

    const coachId = Number.parseInt(id, 10);
    if (Number.isNaN(coachId)) {
      setProfile(undefined);
      setError("Invalid coach identifier.");
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setError(undefined);

    fetchCoachProfile(coachId, { signal: controller.signal, token })
      .then((data) => {
        if (!active) return;
        setProfile(data);
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        const status = (err as Error & { status?: number }).status;
        if (status === 404) {
          setProfile(undefined);
          setError(undefined);
          return;
        }
        setProfile(undefined);
        setError(err instanceof Error ? err.message : "Unable to load coach profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, token]);

  return { loading, profile, error };
};

const buildInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const formatCurrency = (value?: string | number | null) => {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value.replace(/[^0-9.]/g, ""))
        : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return typeof value === "string" ? value : undefined;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numeric);
};

const parseCurrency = (value?: string | number | null) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatCurrencyPrecise = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatPackageLessonTypes = (types?: string[]) => {
  if (!Array.isArray(types) || types.length === 0) return "All lesson types";
  return types
    .map((type) => type.replace(/[_-]/g, " "))
    .map((type) => type.charAt(0).toUpperCase() + type.slice(1))
    .join(", ");
};

const formatPackageValidity = (months?: number | null) => {
  if (!months || months <= 0) return "No expiry listed";
  return `Valid ${months} month${months === 1 ? "" : "s"}`;
};

const extractPaymentMethods = (payload: PlayerStripePaymentMethod[] | Record<string, unknown> | null | undefined) => {
  if (!payload) return [] as PlayerStripePaymentMethod[];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.payment_methods)) return payload.payment_methods as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.data)) return payload.data as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.results)) return payload.results as PlayerStripePaymentMethod[];
  return [] as PlayerStripePaymentMethod[];
};

const extractIntentStatus = (response: Record<string, unknown>) => {
  const nestedIntent = response.payment_intent as Record<string, unknown> | undefined;
  const raw =
    response.status ??
    response.payment_intent_status ??
    nestedIntent?.status ??
    (response.paymentIntent as Record<string, unknown> | undefined)?.status;
  return typeof raw === "string" ? raw.toLowerCase() : "";
};

const hasCreatedPaymentIntent = (response: Record<string, unknown>) => {
  const nestedIntent = response.payment_intent as Record<string, unknown> | undefined;
  const intentId = response.id ?? nestedIntent?.id;
  const clientSecret = response.client_secret ?? nestedIntent?.client_secret;
  return Boolean(intentId || clientSecret);
};

const extractBookingStatus = (value: unknown): BookingStatus | null => {
  if (typeof value === "number") {
    if (value === 1) return "CONFIRMED";
    if (value === 0) return "PENDING";
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === "1" || normalized.includes("confirmed") || normalized.includes("accepted") || normalized.includes("paid")) {
      return "CONFIRMED";
    }
    if (normalized === "0" || normalized.includes("pending") || normalized.includes("requested") || normalized.includes("request")) {
      return "PENDING";
    }
  }

  return null;
};

const extractApiMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.detail;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (payload instanceof Error && payload.message.trim()) {
    return payload.message;
  }

  return fallback;
};

const extractLessonHistory = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const nestedCandidates = [record.data, record.lessons, record.results, record.items];
  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    }
  }

  return [];
};

const normalizeUpcomingCoachLesson = (lesson: PlayerLesson, coachId: number | string): PlayerLesson | null => {
  const record = lesson as Record<string, unknown>;
  const lessonCoachId =
    record.coach_id ??
    record.coachId ??
    (record.coach && typeof record.coach === "object" ? (record.coach as Record<string, unknown>).id : undefined);
  if (lessonCoachId == null || String(lessonCoachId) !== String(coachId)) {
    return null;
  }

  const startRaw =
    record.start_date_time ??
    record.startDateTime ??
    record.startTime ??
    lesson.startTime;
  const start = startRaw ? moment(String(startRaw)) : null;
  if (!start?.isValid() || start.isBefore(moment())) {
    return null;
  }

  return lesson;
};

const getLessonMomentRange = (lesson: PlayerLesson) => {
  const record = lesson as Record<string, unknown>;
  const startRaw = record.start_date_time ?? record.startDateTime ?? record.startTime ?? lesson.startTime;
  const endRaw = record.end_date_time ?? record.endDateTime ?? record.endTime ?? lesson.endTime;
  const start = startRaw ? moment.utc(String(startRaw)) : null;
  const end = endRaw ? moment.utc(String(endRaw)) : null;
  if (!start?.isValid()) return null;
  const resolvedEnd = end?.isValid() ? end : start.clone().add(60, "minutes");
  return { start, end: resolvedEnd };
};

const getUpcomingLessonBookingState = (lesson: PlayerLesson): LoadedSlot["bookingState"] | null => {
  const status = getLessonStatusCode(lesson);
  if (status === 1) return "confirmed";
  if (status === 0) return "pending";
  return null;
};

const parseDurationMinutes = (label?: string) => {
  if (!label) return 60;
  const hr = label.match(/(\d+(?:\.\d+)?)\s*hr/i);
  if (hr) {
    return Math.round(Number.parseFloat(hr[1]) * 60);
  }
  const min = label.match(/(\d+)\s*min/i);
  if (min) {
    return Number.parseInt(min[1], 10);
  }
  return 60;
};

const normalizeDurationMinutes = (minutes: number) => {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} min`;
};

const normalizeDurationLabel = (label?: string) => {
  if (!label) return "1 hr";
  return normalizeDurationMinutes(parseDurationMinutes(label));
};

const resolveSlotDuration = (slotDuration?: string, lessonTypeDuration?: string) => {
  const slotMinutes = parseDurationMinutes(slotDuration);
  const lessonTypeMinutes = parseDurationMinutes(lessonTypeDuration);
  const minutes =
    slotDuration && slotMinutes > 0 && slotMinutes <= 240
      ? slotMinutes
      : lessonTypeDuration && lessonTypeMinutes > 0
        ? lessonTypeMinutes
        : slotMinutes;

  return {
    durationMin: minutes,
    durationLabel: normalizeDurationMinutes(minutes),
  };
};

const resolveSlotDurationSegments = (slotDuration?: string, lessonTypeDuration?: string) => {
  const slotMinutes = parseDurationMinutes(slotDuration);
  const lessonTypeMinutes = parseDurationMinutes(lessonTypeDuration);

  if (slotDuration && slotMinutes > 240 && lessonTypeMinutes > 0 && lessonTypeMinutes <= 240) {
    const segmentCount = Math.max(Math.floor(slotMinutes / lessonTypeMinutes), 1);
    return Array.from({ length: segmentCount }, (_, index) => ({
      offsetMin: index * lessonTypeMinutes,
      durationMin: lessonTypeMinutes,
      durationLabel: normalizeDurationMinutes(lessonTypeMinutes),
    }));
  }

  const resolved = resolveSlotDuration(slotDuration, lessonTypeDuration);
  return [{ offsetMin: 0, ...resolved }];
};

const parseClock = (isoDate: string, value?: string) => {
  if (!value) return null;
  const parsed = moment(`${isoDate} ${value}`, ["YYYY-MM-DD h:mm A", "YYYY-MM-DD HH:mm", moment.ISO_8601], true);
  return parsed.isValid() ? parsed : null;
};

const resolveLessonType = (lesson: Lesson) => {
  const checkoutType = resolveLessonCheckoutType({
    lesson_type_name: lesson.lesson_type_name,
    lessontype_id: (lesson as Record<string, unknown>).lessontype_id ?? (lesson as Record<string, unknown>).lesson_type_id,
  });
  return checkoutType === "private" ? "private" : "group";
};

const mapAvailableLessonToSlot = (lesson: Lesson): LoadedSlot | null => {
  const start = moment(lesson.start_date_time);
  const end = lesson.end_date_time ? moment(lesson.end_date_time) : null;
  if (!start.isValid()) return null;

  const lessonRecord = lesson as Record<string, unknown>;
  const type = resolveLessonType(lesson);
  const durationMin = end?.isValid() ? Math.max(end.diff(start, "minutes"), 1) : 60;
  const totalSpots = Number(lesson.player_limit ?? 0) || undefined;
  const currentPlayers = Number(lesson.current_player_count ?? 0) || 0;
  const spotsLeft = totalSpots ? Math.max(totalSpots - currentPlayers, 0) : undefined;
  const pricePerPerson =
    parseCurrency(lesson.price_per_person) ??
    parseCurrency(lessonRecord.price_per_person as string | number | null | undefined) ??
    parseCurrency(lessonRecord.group_price_per_person as string | number | null | undefined);
  const hourlyRate = parseCurrency(lessonRecord.hourly_rate as string | number | null | undefined);
  const discountPercentage =
    parseCurrency(lessonRecord.discount_percentage as string | number | null | undefined) ??
    parseCurrency(lessonRecord.discountPercentage as string | number | null | undefined) ??
    0;
  const lessonTypeName = String(lesson.lesson_type_name ?? lessonRecord.lesson_type_name ?? "");
  const lessonTypeId = Number(lessonRecord.lessontype_id ?? lessonRecord.lesson_type_id ?? lessonRecord.lessonTypeId);

  return {
    id: `${start.format("YYYY-MM-DD")}-${type}-${lesson.id}`,
    type,
    isoDate: start.format("YYYY-MM-DD"),
    dayLabel: start.format("ddd"),
    dateLabel: start.format("MMM D"),
    timeLabel: start.format("h:mm A"),
    durationLabel: normalizeDurationLabel(`${durationMin} min`),
    durationMin,
    court: shortenLocationLabel(lesson.location_name),
    priceLabel: formatCurrency(pricePerPerson ?? hourlyRate ?? 0) ?? "$0",
    start: lesson.start_date_time,
    end: lesson.end_date_time ?? start.clone().add(durationMin, "minutes").toISOString(),
    className: type === "group" ? lesson.metadata?.title ?? lesson.metadata_title ?? "Group lesson" : undefined,
    level: type === "group" ? lesson.metadata?.level ?? lesson.metadata_level ?? "All levels" : undefined,
    description: type === "group" ? lesson.metadata?.description ?? "Live coached group session." : undefined,
    spotsLeft,
    totalSpots,
    locationId: lesson.location_id ?? null,
    courtValue: null,
    sourceLessonId: lesson.id,
    bookingState: lesson.player_has_booking ? "confirmed" : undefined,
    groupPlayers: Array.isArray(lesson.group_players) ? lesson.group_players : undefined,
    hourlyRate,
    groupPricePerPerson: pricePerPerson,
    discountPercentage,
    lessonTypeName,
    lessonTypeId: Number.isFinite(lessonTypeId) ? lessonTypeId : null,
    coachId: Number(lesson.coach_id ?? lessonRecord.coach_id ?? 0) || null,
  };
};

const mapAvailabilitySlotToLoadedSlot = (
  day: AvailableLessonDay,
  slot: AvailableLessonSlot,
  index: number,
  privatePriceLabel: string,
): LoadedSlot | null => {
  const start = slot.start_time ? moment(slot.start_time) : null;
  const end = slot.end_time ? moment(slot.end_time) : null;
  if (!start?.isValid()) return null;

  const isoDate = day.date ?? start.format("YYYY-MM-DD");
  const durationMin =
    typeof slot.duration_minutes === "number" && slot.duration_minutes > 0
      ? slot.duration_minutes
      : end?.isValid()
        ? Math.max(end.diff(start, "minutes"), 1)
        : 60;

  return {
    id: `${isoDate}-private-${slot.schedule_id ?? index}`,
    type: "private",
    isoDate,
    dayLabel: start.format("ddd"),
    dateLabel: start.format("MMM D"),
    timeLabel: start.format("h:mm A"),
    durationLabel: normalizeDurationLabel(`${durationMin} min`),
    durationMin,
    court: shortenLocationLabel(slot.location),
    priceLabel: privatePriceLabel,
    start: start.toISOString(),
    end: end?.isValid() ? end.toISOString() : start.clone().add(durationMin, "minutes").toISOString(),
    locationId: slot.location_id ?? null,
    courtValue: slot.court ?? null,
    hourlyRate: parseCurrency(privatePriceLabel) ?? null,
    groupPricePerPerson: null,
    discountPercentage: 0,
    lessonTypeName: "Private",
    lessonTypeId: 1,
    coachId: null,
  };
};

const normalizeLessonTypeLabel = (lessonTypes?: string[]) => {
  if (!lessonTypes?.length) return "All lessons";
  return lessonTypes
    .map((type) =>
      type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(" · ");
};

const normalizeSingleLessonTypeLabel = (lessonType?: string) => {
  if (!lessonType) return "Lessons";
  return lessonType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const extractMetricNumber = (values: string[], pattern: RegExp) => {
  for (const value of values) {
    const match = value.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return undefined;
};

const buildGoogleCalendarUrl = (slot: LoadedSlot, coachName: string) => {
  const start = moment(slot.start).utc().format("YYYYMMDD[T]HHmmss[Z]");
  const end = moment(slot.end).utc().format("YYYYMMDD[T]HHmmss[Z]");
  const details = encodeURIComponent(`Lesson with ${coachName}`);
  const location = encodeURIComponent(slot.court);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Lesson with ${coachName}`)}&dates=${start}/${end}&details=${details}&location=${location}`;
};

const downloadIcs = (slot: LoadedSlot, coachName: string) => {
  const stamp = moment.utc().format("YYYYMMDD[T]HHmmss[Z]");
  const start = moment(slot.start).utc().format("YYYYMMDD[T]HHmmss[Z]");
  const end = moment(slot.end).utc().format("YYYYMMDD[T]HHmmss[Z]");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Tennis Plan//Coach Booking//EN",
    "BEGIN:VEVENT",
    `UID:${slot.id}@thetennisplan`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Lesson with ${coachName}`,
    `LOCATION:${slot.court}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${coachName.toLowerCase().replace(/\s+/g, "-")}-lesson.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const buildSmsHref = (phoneNumber: string, message: string) => {
  const trimmedPhoneNumber = phoneNumber.trim();
  if (!trimmedPhoneNumber) return "";

  const encodedMessage = encodeURIComponent(message);
  const isIos =
    typeof window !== "undefined" && /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const separator = isIos ? "&" : "?";

  return `sms:${trimmedPhoneNumber}${separator}body=${encodedMessage}`;
};

const CoachProfilePage = ({ bookMode = false }: { bookMode?: boolean } = {}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { displayName } = usePlayerIdentity();
  const rawAuthToken =
    user?.session?.access_token ??
    user?.access_token ??
    user?.token ??
    getStoredAuthToken({ preferScheme: "token" }) ??
    undefined;
  const authToken = isAuthenticated ? rawAuthToken : undefined;
  const isLoggedIn = Boolean(isAuthenticated && authToken);
  const { loading, profile, error: profileError } = useCoachProfile(id, authToken);

  const {
    rosterStatus,
    rosterLoading,
    rosterError,
    requestJoin,
    requestingJoin,
    requestJoinError,
    requestJoinSuccess,
  } = useCoachRoster(profile?.id, authToken);

  const [bookingType, setBookingType] = useState<LessonTypeFilter>("all");
  const [mobileSelectedDay, setMobileSelectedDay] = useState<string | null>(null);
  const [packageLessonType, setPackageLessonType] = useState<PackageLessonTypeFilter>("all");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [pendingSelectedDate, setPendingSelectedDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<AnchorTab>("about");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioCanExpand, setBioCanExpand] = useState(false);
  const [packages, setPackages] = useState<CoachPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [packageCredits, setPackageCredits] = useState<PackagePurchase[]>([]);
  const [creditsBalance, setCreditsBalance] = useState<PackageCreditsBalanceResponse | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PlayerStripePaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [datePickerLoading, setDatePickerLoading] = useState(false);
  const [slotsByDay, setSlotsByDay] = useState<DayGroup[]>([]);
  const [bookingStep, setBookingStep] = useState<BookingStep>("confirm");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<LoadedSlot | null>(null);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("card");
  const [bookingInFlight, setBookingInFlight] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmationData | null>(null);
  const [consumeError, setConsumeError] = useState<string | null>(null);
  const [consumingCredits, setConsumingCredits] = useState(false);
  const [creditsPackageOpen, setCreditsPackageOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packagePurchaseError, setPackagePurchaseError] = useState<string | null>(null);
  const [purchasingPackage, setPurchasingPackage] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const [applePayRequest, setApplePayRequest] = useState<StripePaymentRequest | null>(null);
  const [isApplePayReady, setIsApplePayReady] = useState(false);
  const [applePayLoading, setApplePayLoading] = useState(false);
  const stripeRef = useRef<Stripe | null>(null);
  const selectedSlotCreditType = useMemo(
    () =>
      selectedSlot
        ? resolveLessonCreditType({
            lesson_type_name: selectedSlot.lessonTypeName,
            lessontype_id: selectedSlot.lessonTypeId,
          })
        : null,
    [selectedSlot],
  );
  const effectiveCreditType = useMemo(() => {
    if (selectedSlotCreditType) return selectedSlotCreditType;
    if (bookingType === "private") return "private";
    if (bookingType === "group") return "group";
    return undefined;
  }, [bookingType, selectedSlotCreditType]);
  const effectiveCreditTypeLabel = effectiveCreditType
    ? effectiveCreditType === "group"
      ? "group"
      : effectiveCreditType === "semi"
        ? "semi-private"
        : "private"
    : "total";
  const creditBalanceByType = useMemo(() => {
    const totals: Record<"private" | "semi" | "group", number> = {
      private: 0,
      semi: 0,
      group: 0,
    };

    packageCredits.forEach((purchase) => {
      const remaining = Math.max(Number(purchase.credits_remaining ?? 0), 0);
      if (!remaining) return;

      const types = purchase.lesson_types_allowed ?? [];
      if (!types.length) {
        totals.private += remaining;
        return;
      }

      const normalizedTypes = new Set(
        types.map((type) => resolveLessonCreditType({ lesson_type_name: type })),
      );

      normalizedTypes.forEach((type) => {
        totals[type] += remaining;
      });
    });

    return totals;
  }, [packageCredits]);
  const creditBalanceSummary = useMemo(
    () =>
      [
        creditBalanceByType.private > 0 ? `${creditBalanceByType.private} private` : null,
        creditBalanceByType.semi > 0 ? `${creditBalanceByType.semi} semi-private` : null,
        creditBalanceByType.group > 0 ? `${creditBalanceByType.group} group` : null,
      ]
        .filter(Boolean)
        .join(" • "),
    [creditBalanceByType],
  );
  const [introForm, setIntroForm] = useState<IntroFormState>({ who: "", level: "", goals: [], note: "" });
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authPromptReturnState, setAuthPromptReturnState] = useState<Record<string, unknown> | undefined>();
  const [bookingFocusActive, setBookingFocusActive] = useState(false);
  const [upsellDismissed, setUpsellDismissed] = useState(false);
  const [coachHistoryLoaded, setCoachHistoryLoaded] = useState(false);
  const [hasCoachHistory, setHasCoachHistory] = useState(false);
  const [upcomingCoachLessons, setUpcomingCoachLessons] = useState<PlayerLesson[]>([]);
  const [upcomingCoachLessonsLoading, setUpcomingCoachLessonsLoading] = useState(false);
  const [upcomingLessonsExpanded, setUpcomingLessonsExpanded] = useState(false);
  const [cancelFlowState, setCancelFlowState] = useState<CancelFlowState>("closed");
  const [lessonToCancel, setLessonToCancel] = useState<PlayerLesson | null>(null);
  const [cancelInFlight, setCancelInFlight] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState<string | null>(null);

  const aboutRef = useRef<HTMLElement | null>(null);
  const specialtiesRef = useRef<HTMLElement | null>(null);
  const courtsRef = useRef<HTMLElement | null>(null);
  const desktopPackagesRef = useRef<HTMLElement | null>(null);
  const mobilePackagesRef = useRef<HTMLElement | null>(null);
  const desktopBookingRef = useRef<HTMLElement | null>(null);
  const mobileBookingRef = useRef<HTMLElement | null>(null);
  const bioRef = useRef<HTMLParagraphElement | null>(null);

  const coachName = profile?.name ?? profile?.fullName ?? "Coach";
  const coachFirstName = coachName.split(" ")[0] ?? "Coach";
  const coachAvatar = profile?.imageUrl ?? profile?.profilePicture ?? "";
  const coachTitle = profile?.title ?? profile?.headlineBadge ?? "Tennis Coach";
  const apiProfile = profile as CoachProfileRecord & {
    pricing?: { private?: number; semiPrivate?: number; group?: number };
    studentCount?: number;
    experienceYears?: string;
    formats?: string[];
    booking?: CoachProfileRecord["booking"] & { availableDates?: ApiBookingDate[] };
  };
  const coachContact = (profile as CoachProfileRecord & { contact?: { phone?: string; email?: string } } | undefined)?.contact;
  const coachPhone = coachContact?.phone?.trim() ?? "";
  const aboutCopy = profile?.about ?? profile?.bio ?? profile?.summary ?? "";
  const certifications = profile?.certifications ?? [];
  const specialties = useMemo(() => formatDisplayLabelList(profile?.specialties), [profile?.specialties]);
  const languages = useMemo(() => formatDisplayLabelList(profile?.languages), [profile?.languages]);
  const levels = useMemo(() => formatDisplayLabelList(profile?.levels), [profile?.levels]);
  const coachingLocations = profile?.coachingLocations?.length ? profile.coachingLocations : profile?.courts ?? [];
  const primaryLocationLabel = profile?.location ?? coachingLocations[0] ?? "Court TBD";
  const bookingLessonTypes = profile?.booking?.lessonTypes ?? [];
  const privateType = bookingLessonTypes.find((item) => item.id === "private");
  const groupType = bookingLessonTypes.find((item) => item.id === "group");
  const pricing = apiProfile?.pricing;
  const firstGroupSlotPriceLabel = useMemo(() => {
    const dates = apiProfile?.booking?.availableDates ?? [];
    for (const date of dates) {
      const groupSlot = (date.slots ?? []).find((slot) =>
        String(slot.lessonType ?? "").toLowerCase().includes("group") && slot.price,
      );
      if (groupSlot?.price) return groupSlot.price;
    }
    return undefined;
  }, [apiProfile?.booking?.availableDates]);
  const privatePriceLabel =
    privateType?.price ??
    profile?.lessonRates?.private ??
    formatCurrency(pricing?.private) ??
    profile?.pricePerHour ??
    "$0";
  const groupPriceLabel =
    groupType?.price ??
    profile?.lessonRates?.group ??
    formatCurrency(pricing?.group) ??
    firstGroupSlotPriceLabel ??
    undefined;
  const metrics = [
    ...(profile?.highlightChips?.map((chip) => chip.label) ?? []),
    ...(profile?.metrics?.map((metric) => `${metric.value} ${metric.label}`) ?? []),
  ];
  const distanceLabel = extractMetricNumber(metrics, /(\d+(?:\.\d+)?)\s*(?:mi|mile)s?\b/i);
  const experienceLabel = profile?.yearsExperience
    ? `${profile.yearsExperience} years`
    : apiProfile?.experienceYears
      ? `${apiProfile.experienceYears} yrs`
      : extractMetricNumber(metrics, /(\d+(?:-\d+)?\+?)\s*yrs?/i) ?? extractMetricNumber(metrics, /(\d+\+?)\s*years?/i) ?? "Experienced";
  const studentsLabel =
    typeof apiProfile?.studentCount === "number"
      ? `${apiProfile.studentCount}+`
      : extractMetricNumber(metrics, /(\d+\+?)\s*students?/i) ?? "Players coached";
  const heroLocationLabel = primaryLocationLabel.split(",").slice(0, 2).join(",").trim() || primaryLocationLabel;
  const cityLabel = heroLocationLabel || "Location TBD";
  // Mobile-redesign hero (v3): derived client-side from existing real fields only.
  const heroStudents =
    typeof apiProfile?.studentCount === "number" && Number.isFinite(apiProfile.studentCount)
      ? `${apiProfile.studentCount}+`
      : null;
  const heroExperience = profile?.yearsExperience
    ? `${profile.yearsExperience} yrs`
    : apiProfile?.experienceYears
      ? `${apiProfile.experienceYears} yrs`
      : null;
  const heroTagline = useMemo(() => {
    const sentence = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);
    const lowerLevels = [...levels]
      .sort((a, b) => levelSkillRank(a) - levelSkillRank(b))
      .map((level) => level.toLowerCase());
    const levelsPart =
      lowerLevels.length >= 2
        ? `${lowerLevels[0]} to ${lowerLevels[lowerLevels.length - 1]}`
        : lowerLevels[0] ?? "";
    const focus = specialties.slice(0, 3).map((item) => item.toLowerCase());
    const focusPart =
      focus.length <= 1
        ? focus.join("")
        : `${focus.slice(0, -1).join(", ")} & ${focus[focus.length - 1]}`;
    return [sentence(levelsPart), sentence(focusPart)].filter(Boolean).join(" · ");
  }, [levels, specialties]);
  // §3: lesson-format chip group renders only when the profile actually carries formats.
  const hasLessonFormats = Boolean(bookingLessonTypes.length || apiProfile?.formats?.length);
  const playerId =
    user?.session?.user_id ??
    user?.id ??
    (() => {
      if (typeof window === "undefined") return "guest";
      try {
        const loginRaw = localStorage.getItem("authLoginResponse");
        const parsed = loginRaw ? (JSON.parse(loginRaw) as Record<string, unknown>) : null;
        return String(parsed?.user_id ?? parsed?.id ?? "guest");
      } catch {
        return "guest";
      }
    })();
  const firstBookingKey = `coach-first-booking:${profile?.id ?? "coach"}:${playerId}`;

  const redirectToLogin = (returnState?: Record<string, unknown>) => {
    navigate("/login", {
      state: {
        from: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
          state: { focusBookCta: true, ...returnState },
        },
      },
    });
  };

  const openAuthPrompt = (returnState?: Record<string, unknown>) => {
    setAuthPromptReturnState({ focusBookCta: true, ...returnState });
    setAuthPromptOpen(true);
  };

  const continueToAuth = (mode: "signin" | "signup") => {
    navigate("/login", {
      state: {
        mode,
        from: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
          state: authPromptReturnState ?? { focusBookCta: true },
        },
      },
    });
  };

  const handlePrivateAuthError = (err: unknown) => {
    const status = (err as Error & { status?: number })?.status;
    if (status === 401 || status === 403) {
      logout?.();
      redirectToLogin({ reason: "session-expired" });
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (!profile?.id) {
      setPackages([]);
      return;
    }

    const controller = new AbortController();
    setPackagesLoading(true);
    setPackagesError(null);

    fetchCoachPackages({ token: authToken, coachId: profile.id, signal: controller.signal })
      .then((data) => setPackages((data?.packages ?? []).filter((item) => item.is_active !== false)))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setPackagesError(err instanceof Error ? err.message : "Unable to load packages.");
          setPackages([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPackagesLoading(false);
      });

    return () => controller.abort();
  }, [authToken, profile?.id]);

  useEffect(() => {
    if (!profile?.id || authLoading) return;

    if (!isLoggedIn || !authToken) {
      setPackageCredits([]);
      setCreditsBalance(null);
      setPaymentMethods([]);
      setPaymentMethodsLoading(false);
      setCreditsLoading(false);
      return;
    }

    const controller = new AbortController();
    setCreditsLoading(true);
    setPaymentMethodsLoading(true);
    setPaymentMethodsError(null);

    fetchPackageCredits({ token: authToken, coachId: profile.id, includeExpired: false, signal: controller.signal })
      .then((data) => setPackageCredits(data?.purchases ?? []))
      .catch((err) => {
        if (!controller.signal.aborted && !handlePrivateAuthError(err)) {
          setPackageCredits([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCreditsLoading(false);
      });

    fetchPackageCreditsBalance({
      token: authToken,
      coachId: profile.id,
      lessonType: effectiveCreditType,
      signal: controller.signal,
    })
      .then((data) => setCreditsBalance(data ?? null))
      .catch((err) => {
        if (!controller.signal.aborted && !handlePrivateAuthError(err)) {
          setCreditsBalance(null);
        }
      });

    getPlayerStripePaymentMethods(authToken)
      .then((response) => {
        const methods = extractPaymentMethods(response as PlayerStripePaymentMethod[] | Record<string, unknown>);
        setPaymentMethods(methods);
        setSelectedPaymentMethodId(methods.find((item) => item.is_default)?.id ?? methods[0]?.id ?? "");
      })
      .catch((err) => {
        if (!controller.signal.aborted && !handlePrivateAuthError(err)) {
          setPaymentMethods([]);
          setSelectedPaymentMethodId("");
          const status = (err as Error & { status?: number })?.status;
          setPaymentMethodsError(
            status === 402
              ? "Add a payment method before booking this lesson."
              : err instanceof Error
                ? err.message
                : "Unable to load payment methods.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentMethodsLoading(false);
      });

    return () => controller.abort();
  }, [authLoading, authToken, effectiveCreditType, isLoggedIn, profile?.id]);

  useEffect(() => {
    if (!profile?.id || authLoading) return;

    if (!isLoggedIn || !authToken) {
      setUpcomingCoachLessons([]);
      setUpcomingCoachLessonsLoading(false);
      return;
    }

    let active = true;
    setUpcomingCoachLessonsLoading(true);

    getPlayerUpcomingLessons(authToken)
      .then((response) => {
        if (!active) return;
        const upcomingSource = Array.isArray((response as { lessons?: PlayerLesson[] })?.lessons)
          ? ((response as { lessons?: PlayerLesson[] }).lessons ?? [])
          : (response?.data ?? []);
        const upcoming = upcomingSource
          .map((lesson) => normalizeUpcomingCoachLesson(lesson, profile.id))
          .filter((lesson): lesson is PlayerLesson => Boolean(lesson))
          .sort((a, b) => {
            const aStart = moment(
              String((a as Record<string, unknown>).start_date_time ?? a.startTime ?? ""),
            ).valueOf();
            const bStart = moment(
              String((b as Record<string, unknown>).start_date_time ?? b.startTime ?? ""),
            ).valueOf();
            return aStart - bStart;
          });
        setUpcomingCoachLessons(upcoming);
      })
      .catch(() => {
        if (active) {
          setUpcomingCoachLessons([]);
        }
      })
      .finally(() => {
        if (active) {
          setUpcomingCoachLessonsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, authToken, isLoggedIn, profile?.id]);

  useEffect(() => {
    if (!profile?.id || authLoading) return;

    if (!isLoggedIn || !authToken) {
      setCoachHistoryLoaded(true);
      setHasCoachHistory(false);
      return;
    }

    const controller = new AbortController();
    setCoachHistoryLoaded(false);

    getPlayerCoachLessonHistory({
      token: authToken,
      coachId: profile.id,
      date: moment().format("YYYY-MM-DD"),
      perPage: 1,
      page: 1,
      signal: controller.signal,
    })
      .then((response) => {
        const lessons = extractLessonHistory(response);
        setHasCoachHistory(lessons.length > 0);
      })
      .catch((err) => {
        if (!controller.signal.aborted && !handlePrivateAuthError(err)) {
          setHasCoachHistory(false);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCoachHistoryLoaded(true);
        }
      });

    return () => controller.abort();
  }, [authLoading, authToken, isLoggedIn, profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      setSlotsByDay([]);
      return;
    }

    let active = true;
    setScheduleLoading(true);

    const loadAvailability = async () => {
      const availableDates = apiProfile?.booking?.availableDates ?? [];
      if (availableDates.length) {
        const mappedDays = availableDates.map((day): DayGroup => {
          const isoDate = day.id ?? "";
          const slots = (day.slots ?? []).flatMap((slot, index): LoadedSlot[] => {
            const lessonType = String(slot.lessonType ?? "private").toLowerCase();
            const type = lessonType.includes("group") ? "group" : "private";
            const lessonTypeConfig = bookingLessonTypes.find((item) => item.id === slot.lessonType || item.id === lessonType);
            const durationSegments = resolveSlotDurationSegments(slot.duration, lessonTypeConfig?.duration);
            const parsedStart = parseClock(isoDate, slot.time);
            const groupPlayers = Array.isArray(slot.groupPlayers)
              ? slot.groupPlayers
              : Array.isArray(slot.group_players)
                ? slot.group_players
                : undefined;
            const bookingState = (() => {
              if (type === "group") {
                return getGroupParticipantBookingState(groupPlayers, user) ?? undefined;
              }
              const normalizedStatus = extractBookingStatus(slot.lessonStatus);
              if (normalizedStatus === "CONFIRMED") return "confirmed" as const;
              if (normalizedStatus === "PENDING") return "pending" as const;
              return undefined;
            })();

            return durationSegments.map(({ offsetMin, durationLabel, durationMin }, segmentIndex) => {
              const segmentStart = parsedStart?.clone().add(offsetMin, "minutes") ?? null;
              const segmentEnd = segmentStart ? segmentStart.clone().add(durationMin, "minutes") : null;
              const baseId = slot.id ?? `${isoDate}-${type}-${index}`;
              const id = durationSegments.length > 1 ? `${baseId}-${segmentIndex}` : baseId;
              const sourceLessonId = Number(slot.sourceLessonId ?? slot.lessonId ?? 0) || undefined;
              const metadata = slot.metadata ?? {};

              return {
                id,
                type,
                isoDate,
                dayLabel: day.day ?? moment(isoDate).format("ddd"),
                dateLabel: day.label ?? moment(isoDate).format("MMM D"),
                timeLabel: segmentStart?.isValid() ? segmentStart.format("h:mm A") : slot.time ?? "Time TBD",
                durationLabel,
                durationMin,
                court: shortenLocationLabel(slot.location ?? slot.title ?? primaryLocationLabel),
                priceLabel: slot.price ?? (type === "group" ? groupPriceLabel ?? "$0" : privatePriceLabel),
                start: slot.startDateTime ?? segmentStart?.toISOString() ?? `${isoDate}T09:00:00`,
                end: slot.endDateTime ?? segmentEnd?.toISOString() ?? `${isoDate}T10:00:00`,
                className: type === "group" ? slot.title ?? metadata.title ?? "Group lesson" : undefined,
                level: type === "group" ? slot.level ?? metadata.level ?? "All levels" : undefined,
                description: type === "group" ? slot.description ?? metadata.description ?? "Live coached group session." : undefined,
                spotsLeft: type === "group" ? slot.spotsRemaining : undefined,
                totalSpots: type === "group" ? slot.totalSpots ?? undefined : undefined,
                locationId: slot.locationId ?? null,
                courtValue: slot.court ?? null,
                sourceLessonId,
                bookingState,
                groupPlayers,
                hourlyRate: type === "private" ? parseCurrency(slot.price ?? privatePriceLabel) ?? null : null,
                groupPricePerPerson: type === "group" ? parseCurrency(slot.price ?? groupPriceLabel) ?? null : null,
                discountPercentage: 0,
                lessonTypeName: type === "group" ? String(slot.lessonType ?? "Group") : "Private",
                lessonTypeId: type === "group" ? Number(slot.lessonTypeId ?? 3) : 1,
                coachId: Number(profile?.id ?? 0) || null,
              };
            });
          });

          return {
            isoDate,
            dayLabel: day.day ?? moment(isoDate).format("ddd"),
            dateLabel: day.label ?? moment(isoDate).format("MMM D"),
            shortDateLabel: day.date ?? moment(isoDate).format("D"),
            slots,
          };
        });

        const daysByIso = new Map(mappedDays.map((day) => [day.isoDate, day]));
        const validMoments = mappedDays
          .map((day) => moment(day.isoDate, "YYYY-MM-DD", true))
          .filter((date) => date.isValid())
          .sort((a, b) => a.valueOf() - b.valueOf());
        const rangeStart = validMoments[0]?.clone().startOf("day") ?? moment().startOf("day");
        const minimumRangeEnd = rangeStart.clone().add(SCHEDULE_WINDOW_DAYS - 1, "days");
        const latestAvailable = validMoments[validMoments.length - 1]?.clone().startOf("day") ?? minimumRangeEnd;
        const rangeEnd = latestAvailable.isAfter(minimumRangeEnd) ? latestAvailable : minimumRangeEnd;
        const nextDays: DayGroup[] = [];

        for (let cursor = rangeStart.clone(); cursor.isSameOrBefore(rangeEnd, "day"); cursor.add(1, "day")) {
          const isoDate = cursor.format("YYYY-MM-DD");
          nextDays.push(daysByIso.get(isoDate) ?? buildEmptyDayGroup(cursor));
        }

        if (active) {
          setSlotsByDay(nextDays);
          setScheduleLoading(false);
        }
        return;
      }

      if (!authToken) {
        if (active) {
          const nextDays = Array.from({ length: SCHEDULE_WINDOW_DAYS }, (_, offset) =>
            buildEmptyDayGroup(moment().startOf("day").add(offset, "days")),
          );
          setSlotsByDay(nextDays);
          setScheduleLoading(false);
        }
        return;
      }

      const nextDays: DayGroup[] = [];

      for (let offset = 0; offset < SCHEDULE_WINDOW_DAYS; offset += 1) {
        const currentDay = moment().add(offset, "days");
        const isoDate = currentDay.format("YYYY-MM-DD");
        const weekday = currentDay.format("dddd").toUpperCase();

        const scheduleEntries = await fetchCoachSchedule({
          token: authToken,
          coachId: profile.id,
          day: weekday,
        }).catch(() => [] as CoachScheduleEntry[]);

        if (!scheduleEntries.length) {
          nextDays.push({
            isoDate,
            dayLabel: currentDay.format("ddd"),
            dateLabel: currentDay.format("MMM D"),
            shortDateLabel: currentDay.format("D"),
            slots: [],
          });
          continue;
        }

        const lessons = await fetchCoachLessonsByDate({
          token: authToken,
          coachId: profile.id,
          date: isoDate,
        }).catch(() => [] as Lesson[]);

        const occupiedRanges = lessons
          .map((lesson) => ({
            start: moment.utc(lesson.start_date_time),
            end: moment.utc(lesson.end_date_time),
          }))
          .filter((item) => item.start.isValid() && item.end.isValid());

        const privateSlots = scheduleEntries.flatMap((entry, entryIndex) => {
          const start = parseClock(isoDate, String(entry.from ?? ""));
          const end = parseClock(isoDate, String(entry.to ?? ""));
          if (!start || !end || !end.isAfter(start)) return [];

          const slots: LoadedSlot[] = [];
          let cursor = start.clone();
          let slotIndex = 0;

          while (cursor.clone().add(60, "minutes").isSameOrBefore(end)) {
            const slotEnd = cursor.clone().add(60, "minutes");
            const overlaps = occupiedRanges.some(
              (range) => cursor.isBefore(range.end) && slotEnd.isAfter(range.start),
            );

            if (!overlaps) {
              slots.push({
                id: `${isoDate}-private-${entryIndex}-${slotIndex}`,
                type: "private",
                isoDate,
                dayLabel: currentDay.format("ddd"),
                dateLabel: currentDay.format("MMM D"),
                timeLabel: cursor.format("h:mm A"),
                durationLabel: "1 hr",
                durationMin: 60,
                court: shortenLocationLabel(String(entry.location_name ?? entry.location ?? primaryLocationLabel)),
                priceLabel: privatePriceLabel,
                start: cursor.toISOString(),
                end: slotEnd.toISOString(),
                locationId:
                  typeof entry.location_id === "number"
                    ? entry.location_id
                    : entry.location_id != null
                      ? Number(entry.location_id)
                      : null,
                courtValue: entry.court ?? null,
                hourlyRate: parseCurrency(privatePriceLabel) ?? null,
                groupPricePerPerson: null,
                discountPercentage: 0,
                lessonTypeName: "Private",
                lessonTypeId: 1,
                coachId: Number(profile?.id ?? 0) || null,
              });
            }

            cursor = slotEnd;
            slotIndex += 1;
          }

          return slots;
        });

        const groupSlots = lessons
          .filter((lesson) => resolveLessonType(lesson) === "group")
          .map((lesson, index) => {
            const start = moment.utc(lesson.start_date_time);
            const end = moment.utc(lesson.end_date_time);
            const totalSpots = Number(lesson.player_limit ?? 0) || undefined;
            const currentPlayers = Number(lesson.current_player_count ?? 0) || 0;
            const spotsLeft = totalSpots ? Math.max(totalSpots - currentPlayers, 0) : undefined;

            return {
              id: `${isoDate}-group-${lesson.id}-${index}`,
              type: "group" as const,
              isoDate,
              dayLabel: currentDay.format("ddd"),
              dateLabel: currentDay.format("MMM D"),
              timeLabel: start.local().format("h:mm A"),
              durationLabel: end.isValid() ? `${end.diff(start, "minutes")} min` : groupType?.duration ?? "1 hr",
              durationMin: end.isValid() ? end.diff(start, "minutes") : 60,
              court: shortenLocationLabel(lesson.location_name ?? primaryLocationLabel),
              priceLabel: formatCurrency(lesson.price_per_person) ?? groupPriceLabel ?? "$0",
              start: lesson.start_date_time,
              end: lesson.end_date_time,
              className: lesson.metadata?.title ?? lesson.metadata_title ?? "Group lesson",
              level: lesson.metadata?.level ?? "All levels",
              description: lesson.metadata?.description ?? "Live coached group session.",
              spotsLeft,
              totalSpots,
              locationId: lesson.location_id ?? null,
              courtValue: null,
              sourceLessonId: lesson.id,
              bookingState: getGroupParticipantBookingState(lesson.group_players, user) ?? undefined,
              hourlyRate:
                parseCurrency((lesson as Record<string, unknown>).hourly_rate as string | number | null | undefined) ??
                parseCurrency(privatePriceLabel) ??
                null,
              groupPricePerPerson:
                parseCurrency(lesson.price_per_person) ??
                parseCurrency((lesson as Record<string, unknown>).group_price_per_person as string | number | null | undefined) ??
                null,
              discountPercentage:
                parseCurrency((lesson as Record<string, unknown>).discount_percentage as string | number | null | undefined) ?? 0,
              lessonTypeName: String(lesson.lesson_type_name ?? "Group"),
              lessonTypeId:
                Number((lesson as Record<string, unknown>).lessontype_id ?? (lesson as Record<string, unknown>).lesson_type_id) || 3,
              coachId: Number(lesson.coach_id ?? profile?.id ?? 0) || null,
              groupPlayers: Array.isArray(lesson.group_players) ? lesson.group_players : undefined,
            };
          });

        const slots = [...privateSlots, ...groupSlots].sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf());
        nextDays.push({
          isoDate,
          dayLabel: currentDay.format("ddd"),
          dateLabel: currentDay.format("MMM D"),
          shortDateLabel: currentDay.format("D"),
          slots,
        });
      }

      if (active) {
        setSlotsByDay(nextDays);
        setScheduleLoading(false);
      }
    };

    void loadAvailability();

    return () => {
      active = false;
    };
  }, [authToken, apiProfile?.booking?.availableDates, groupPriceLabel, groupType?.duration, primaryLocationLabel, privatePriceLabel, profile?.id, user]);

  const availableCredits = useMemo(() => {
    const balance = creditsBalance?.available;
    if (typeof balance === "number" && Number.isFinite(balance)) return balance;
    return packageCredits
      .filter((purchase) => {
        if (!effectiveCreditType) return true;
        const types = purchase.lesson_types_allowed ?? [];
        if (!types.length) return true;
        return types.some((type) => resolveLessonCreditType({ lesson_type_name: type }) === effectiveCreditType);
      })
      .reduce((sum, purchase) => sum + Math.max(Number(purchase.credits_remaining ?? 0), 0), 0);
  }, [creditsBalance?.available, effectiveCreditType, packageCredits]);

  const eligiblePackageCredits = useMemo(() => {
    return packageCredits.filter((purchase) => {
      if ((purchase.credits_remaining ?? 0) <= 0) return false;
      if (!selectedSlotCreditType) return true;
      const types = purchase.lesson_types_allowed ?? [];
      if (!types.length) return true;
      return types.some((type) => resolveLessonCreditType({ lesson_type_name: type }) === selectedSlotCreditType);
    });
  }, [packageCredits, selectedSlotCreditType]);

  const privateCredits = useMemo(
    () =>
      packageCredits
        .filter((purchase) => {
          const types = purchase.lesson_types_allowed ?? [];
          return !types.length || types.some((type) => type.toLowerCase().includes("private"));
        })
        .reduce((sum, purchase) => sum + Math.max(Number(purchase.credits_remaining ?? 0), 0), 0),
    [packageCredits],
  );

  const visibleDays = useMemo(() => {
    return slotsByDay.map((day) => ({
      ...day,
      slots: day.slots.filter((slot) => bookingType === "all" || slot.type === bookingType),
    }));
  }, [bookingType, slotsByDay]);

  useEffect(() => {
    if (selectedDate === "all") return;
    if (pendingSelectedDate === selectedDate) return;
    if (slotsByDay.some((day) => day.isoDate === selectedDate)) return;
    setSelectedDate(visibleDays[0]?.isoDate ?? "all");
  }, [pendingSelectedDate, selectedDate, slotsByDay, visibleDays]);

  const visibleSlots = useMemo(() => {
    if (selectedDate === "all") {
      return visibleDays.flatMap((day) => day.slots);
    }
    return visibleDays.find((day) => day.isoDate === selectedDate)?.slots ?? [];
  }, [selectedDate, visibleDays]);
  const hasGroupSlots = useMemo(
    () => slotsByDay.some((day) => day.slots.some((slot) => slot.type === "group")),
    [slotsByDay],
  );

  const routeState = (location.state as CoachProfileRouteState | null | undefined) ?? null;
  const findCoachesReturnState = routeState?.findCoachesState ?? null;
  const clearResumeState = useCallback(() => {
    navigate(location.pathname, {
      replace: true,
      state: findCoachesReturnState ? { findCoachesState: findCoachesReturnState } : null,
    });
  }, [findCoachesReturnState, location.pathname, navigate]);
  const handleBackToFindCoaches = useCallback(() => {
    navigate("/find-coaches", {
      state: findCoachesReturnState ? { findCoachesState: findCoachesReturnState } : undefined,
    });
  }, [findCoachesReturnState, navigate]);

  const isFirstBooking = useMemo(() => {
    const completedLocally =
      typeof window !== "undefined" ? localStorage.getItem(firstBookingKey) === "completed" : false;
    return !completedLocally && !hasCoachHistory;
  }, [firstBookingKey, hasCoachHistory]);

  useEffect(() => {
    const resumeState = routeState;
    const resumeBookingSlotId = resumeState?.resumeBookingSlotId;
    const hasResumeBookingState = Boolean(
      resumeState?.resumeBookingSlotId ||
        resumeState?.resumePaymentChoice ||
        resumeState?.focusBookCta ||
        resumeState?.purchaseAfterAuth,
    );
    if (!isLoggedIn || !hasResumeBookingState || bookingOpen || paymentSheetOpen) return;

    if (resumeState.focusBookCta) {
      setBookingFocusActive(true);
      const bookingNode =
        (desktopBookingRef.current && window.getComputedStyle(desktopBookingRef.current).display !== "none"
          ? desktopBookingRef.current
          : mobileBookingRef.current) ?? desktopBookingRef.current;
      bookingNode?.scrollIntoView({ behavior: "smooth", block: "center" });
      bookingNode?.focus?.({ preventScroll: true });
      window.setTimeout(() => setBookingFocusActive(false), 3500);
    }

    if (resumeState.purchaseAfterAuth && profile?.id) {
      navigate(`/coaches/${profile.id}/purchase`, { replace: true });
      return;
    }

    if (!resumeBookingSlotId) {
      clearResumeState();
      return;
    }

    const slot = slotsByDay.flatMap((day) => day.slots).find((entry) => entry.id === resumeBookingSlotId);
    if (!slot) return;

    setSelectedSlot(slot);
    if (resumeState?.resumePaymentChoice) {
      setPaymentChoice(resumeState.resumePaymentChoice);
      setPaymentSheetOpen(true);
    } else {
      setPaymentChoice("card");
      setPaymentSheetOpen(true);
      setBookingOpen(false);
    }
    clearResumeState();
  }, [
    bookingOpen,
    isFirstBooking,
    coachHistoryLoaded,
    clearResumeState,
    isLoggedIn,
    navigate,
    paymentSheetOpen,
    profile?.id,
    routeState,
    slotsByDay,
  ]);

  const nextAvailableSlot = visibleDays.flatMap((day) => day.slots)[0] ?? null;
  const slotsThisWeek = visibleDays.reduce((sum, day) => sum + day.slots.length, 0);
  const selectedSlotPricing = useMemo(
    () =>
      selectedSlot
        ? calculateLessonPricing({
            hourly_rate: selectedSlot.hourlyRate,
            group_price_per_person: selectedSlot.groupPricePerPerson,
            discount_percentage: selectedSlot.discountPercentage,
            lesson_type_name: selectedSlot.lessonTypeName,
            lessontype_id: selectedSlot.lessonTypeId,
          })
        : null,
    [selectedSlot],
  );
  const checkoutPackageOptions = useMemo(() => {
    if (!effectiveCreditType) return [];
    return packages
      .filter((pkg) => {
        if (pkg.is_active === false || !pkg.lesson_count || pkg.lesson_count <= 0) return false;
        return packageAllowsLessonCreditType(pkg.lesson_types_allowed, effectiveCreditType);
      })
      .sort((a, b) => a.lesson_count - b.lesson_count);
  }, [effectiveCreditType, packages]);
  const checkoutBestValuePackage = useMemo(
    () =>
      checkoutPackageOptions.reduce<CoachPackage | null>((best, pkg) => {
        const total = parseCurrency(pkg.total_price);
        const bestTotal = best ? parseCurrency(best.total_price) : undefined;
        if (total == null) return best;
        if (!best || bestTotal == null) return pkg;
        return total / pkg.lesson_count < bestTotal / best.lesson_count ? pkg : best;
      }, null),
    [checkoutPackageOptions],
  );
  const selectedCheckoutPackage = useMemo(
    () =>
      checkoutPackageOptions.find((pkg) => String(pkg.id) === selectedPackageId) ??
      checkoutBestValuePackage ??
      checkoutPackageOptions[0] ??
      null,
    [checkoutBestValuePackage, checkoutPackageOptions, selectedPackageId],
  );
  const selectedCheckoutPackageLabel = selectedCheckoutPackage
    ? `${selectedCheckoutPackage.lesson_count} sessions - ${formatCurrencyPrecise(parseCurrency(selectedCheckoutPackage.total_price) ?? 0)}`
    : "Choose a package";

  useEffect(() => {
    if (selectedPackageId || checkoutPackageOptions.length === 0) return;
    const defaultPackage = checkoutBestValuePackage ?? checkoutPackageOptions[0];
    setSelectedPackageId(String(defaultPackage.id));
  }, [checkoutBestValuePackage, checkoutPackageOptions, selectedPackageId]);

  const applePayAmount = selectedSlotPricing?.stripeAmountCents ?? 0;

  useEffect(() => {
    let cancelled = false;
    setApplePayRequest(null);
    setIsApplePayReady(false);

    if (!paymentSheetOpen || !stripePromise || !applePayAmount) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const stripe = await stripePromise;
      if (!stripe || cancelled) return;
      stripeRef.current = stripe;

      const request = stripe.paymentRequest({
        country: "US",
        currency: "usd",
        total: {
          label: "The Tennis Plan",
          amount: applePayAmount,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      const canPay = await request.canMakePayment();
      if (cancelled) return;
      setApplePayRequest(canPay?.applePay ? request : null);
      setIsApplePayReady(Boolean(canPay?.applePay));
    })().catch(() => {
      if (!cancelled) {
        setApplePayRequest(null);
        setIsApplePayReady(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [applePayAmount, paymentSheetOpen]);

  const upcomingLessonBySlotKey = useMemo(() => {
    const map = new Map<string, PlayerLesson>();

    slotsByDay.forEach((day) => {
      day.slots.forEach((slot) => {
        const slotStart = moment.utc(slot.start);
        const slotEnd = moment.utc(slot.end);
        if (!slotStart.isValid() || !slotEnd.isValid()) return;

        const matchingLesson = findUpcomingLessonForSlot({
          slot,
          upcomingLessons: upcomingCoachLessons,
          currentUser: user,
          getLessonRange: getLessonMomentRange,
          overlapsRange: (range: { start: moment.Moment; end: moment.Moment }) => {
            return slotStart.isBefore(range.end) && slotEnd.isAfter(range.start);
          },
        });

        if (matchingLesson) {
          map.set(slot.id, matchingLesson);
        }
      });
    });

    return map;
  }, [slotsByDay, upcomingCoachLessons, user]);

  const privatePackages = useMemo(
    () =>
      packages.filter((pkg) => {
        const types = pkg.lesson_types_allowed ?? [];
        return !types.length || types.some((type) => type.toLowerCase().includes("private"));
      }),
    [packages],
  );

  const upsellPackage = useMemo(() => {
    if (!privatePackages.length) return null;

    const privateLessonRate = parseCurrency(privatePriceLabel);
    return [...privatePackages].sort((a, b) => {
      const aTotal = parseCurrency(a.total_price);
      const bTotal = parseCurrency(b.total_price);
      const aSavings =
        privateLessonRate && aTotal != null ? privateLessonRate * Math.max(a.lesson_count, 1) - aTotal : 0;
      const bSavings =
        privateLessonRate && bTotal != null ? privateLessonRate * Math.max(b.lesson_count, 1) - bTotal : 0;

      if (bSavings !== aSavings) return bSavings - aSavings;
      return Math.max(b.lesson_count, 1) - Math.max(a.lesson_count, 1);
    })[0];
  }, [privatePackages, privatePriceLabel]);

  const packageLessonTypeOptions = useMemo(() => {
    return getCoachPackageLessonTypeOptions({
      packages,
      hasGroupSlots,
      privatePriceLabel,
      groupPriceLabel,
    }) as Array<{ id: PackageLessonTypeFilter; label: string }>;
  }, [groupPriceLabel, hasGroupSlots, packages, privatePriceLabel]);

  useEffect(() => {
    if (!packageLessonTypeOptions.length) return;
    if (packageLessonTypeOptions.some((option) => option.id === packageLessonType)) return;
    setPackageLessonType(packageLessonTypeOptions[0]?.id ?? "all");
  }, [packageLessonType, packageLessonTypeOptions]);

  useEffect(() => {
    const nextPackageType =
      bookingType === "private" || bookingType === "group" ? bookingType : "all";
    if (packageLessonType === nextPackageType) return;
    if (!packageLessonTypeOptions.some((option) => option.id === nextPackageType)) return;
    setPackageLessonType(nextPackageType);
  }, [bookingType, packageLessonType, packageLessonTypeOptions]);

  const filteredPackageOffers = useMemo(() => {
    return filterCoachPackagesByLessonType(packages, packageLessonType);
  }, [packageLessonType, packages]);

  const selectedPackageCredits = useMemo(() => {
    return packageCredits
      .filter((purchase) => {
        if (packageLessonType === "all") return true;
        const types = purchase.lesson_types_allowed ?? [];
        if (!types.length) return true;
        return types.some((type) => {
          const normalized = type.toLowerCase();
          return packageLessonType === "private" ? normalized.includes("private") : normalized.includes("group");
        });
      })
      .reduce((sum, purchase) => sum + Math.max(Number(purchase.credits_remaining ?? 0), 0), 0);
  }, [packageCredits, packageLessonType]);

  const featuredPackageId = useMemo(() => {
    const lessonRate =
      packageLessonType === "private"
        ? parseCurrency(privatePriceLabel)
        : packageLessonType === "group"
          ? parseCurrency(groupPriceLabel ?? undefined)
          : null;

    const ranked = [...filteredPackageOffers].sort((a, b) => {
      const aTotal = parseCurrency(a.total_price);
      const bTotal = parseCurrency(b.total_price);
      const aBase = lessonRate != null ? lessonRate * Math.max(a.lesson_count, 1) : null;
      const bBase = lessonRate != null ? lessonRate * Math.max(b.lesson_count, 1) : null;
      const aSavings = aTotal != null && aBase != null ? Math.max(aBase - aTotal, 0) : 0;
      const bSavings = bTotal != null && bBase != null ? Math.max(bBase - bTotal, 0) : 0;

      if (bSavings !== aSavings) return bSavings - aSavings;
      return Math.max(b.lesson_count, 1) - Math.max(a.lesson_count, 1);
    })[0];

    return ranked?.id;
  }, [filteredPackageOffers, groupPriceLabel, packageLessonType, privatePriceLabel]);

  const onboardingPrefill = useMemo(() => {
    if (typeof window === "undefined") {
      return { who: "" as IntroWho, level: "", goals: [] as string[] };
    }
    try {
      const profileRaw = localStorage.getItem("playerPersonalDetails");
      const loginRaw = localStorage.getItem("authLoginResponse");
      const profileData = profileRaw ? (JSON.parse(profileRaw) as Record<string, unknown>) : {};
      const loginData = loginRaw ? (JSON.parse(loginRaw) as Record<string, unknown>) : {};
      const combined = { ...loginData, ...profileData };

      const who =
        combined.introWho === "My child" || combined.lesson_for === "child"
          ? "My child"
          : combined.introWho === "Myself" || combined.lesson_for === "self"
            ? "Myself"
            : "";
      const level =
        typeof combined.introLevel === "string"
          ? combined.introLevel
          : typeof combined.level === "string"
            ? combined.level
            : "";
      const goalsRaw = combined.introGoals ?? combined.goals ?? combined.focus_areas;
      const goals = Array.isArray(goalsRaw)
        ? goalsRaw.filter((item): item is string => typeof item === "string")
        : [];

      return { who: who as IntroWho, level, goals };
    } catch {
      return { who: "" as IntroWho, level: "", goals: [] as string[] };
    }
  }, []);

  useEffect(() => {
    setIntroForm((current) => ({
      who: current.who || onboardingPrefill.who,
      level: current.level || onboardingPrefill.level,
      goals: current.goals.length ? current.goals : onboardingPrefill.goals,
      note: current.note,
    }));
  }, [onboardingPrefill]);

  const hasPrefill = Boolean(onboardingPrefill.who || onboardingPrefill.level || onboardingPrefill.goals.length);
  const modalOpen = bookingOpen || paymentSheetOpen || Boolean(bookingConfirmation) || cancelFlowState !== "closed";

  useEffect(() => {
    setBioExpanded(false);
  }, [aboutCopy]);

  useEffect(() => {
    const measureBioOverflow = () => {
      const node = bioRef.current;
      if (!node) {
        setBioCanExpand(false);
        return;
      }

      if (bioExpanded) {
        setBioCanExpand(true);
        return;
      }

      setBioCanExpand(node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1);
    };

    const frameId = window.requestAnimationFrame(measureBioOverflow);
    const node = bioRef.current;
    const observer = typeof ResizeObserver !== "undefined" && node ? new ResizeObserver(measureBioOverflow) : null;
    observer?.observe(node);
    window.addEventListener("resize", measureBioOverflow);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener("resize", measureBioOverflow);
    };
  }, [aboutCopy, bioExpanded]);

  const sectionRefs: Record<AnchorTab, RefObject<HTMLElement>> = {
    about: aboutRef as RefObject<HTMLElement>,
    specialties: specialtiesRef as RefObject<HTMLElement>,
    courts: courtsRef as RefObject<HTMLElement>,
  };

  const scrollToSection = (tab: AnchorTab) => {
    setActiveTab(tab);
    const node = sectionRefs[tab].current;
    if (!node) return;
    const chromeHeight =
      document.querySelector<HTMLElement>(".coach-profile-fixed-chrome")?.getBoundingClientRect().height ?? 190;
    const top = node.getBoundingClientRect().top + window.scrollY - chromeHeight - 16;
    window.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      const offsets: Array<{ id: AnchorTab; top: number }> = [
        { id: "about", top: aboutRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY },
        { id: "specialties", top: specialtiesRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY },
        { id: "courts", top: courtsRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY },
      ];

      const current =
        offsets
          .filter((item) => item.top <= 240)
          .sort((a, b) => b.top - a.top)[0]?.id ?? "about";
      setActiveTab(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!modalOpen || typeof window === "undefined") return;

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previousBodyOverflow = bodyStyle.overflow;
    const previousBodyPosition = bodyStyle.position;
    const previousBodyTop = bodyStyle.top;
    const previousBodyWidth = bodyStyle.width;
    const previousHtmlOverflow = htmlStyle.overflow;

    htmlStyle.overflow = "hidden";
    bodyStyle.overflow = "hidden";
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = "100%";

    return () => {
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.overflow = previousBodyOverflow;
      bodyStyle.position = previousBodyPosition;
      bodyStyle.top = previousBodyTop;
      bodyStyle.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [modalOpen]);

  const openBookingFlow = (slot: LoadedSlot) => {
    if (!isLoggedIn) {
      openAuthPrompt({ resumeBookingSlotId: slot.id, resumePaymentChoice: "card" });
      return;
    }

    setUpsellDismissed(false);
    setSelectedSlot(slot);
    setPaymentChoice("card");
    setPaymentMethodsError(null);
    setBookingError(null);
    setBookingSuccess(null);
    setConsumeError(null);
    setPackagePurchaseError(null);
    setCreditsPackageOpen(false);
    setPaymentSheetOpen(true);
    setBookingOpen(false);
  };

  const closeBookingFlow = () => {
    setBookingOpen(false);
    setBookingStep("confirm");
  };

  const closePaymentSheet = () => {
    setPaymentSheetOpen(false);
    setPaymentMethodsError(null);
    setConsumeError(null);
    setPackagePurchaseError(null);
    setBookingInFlight(null);
    setConsumingCredits(false);
    setPurchasingPackage(false);
  };

  const openPaymentSheet = (choice: PaymentChoice = "card", slotOverride?: LoadedSlot) => {
    const targetSlot = slotOverride ?? selectedSlot;

    if (!isLoggedIn) {
      openAuthPrompt(targetSlot ? { resumeBookingSlotId: targetSlot.id, resumePaymentChoice: choice } : undefined);
      return;
    }

    if (slotOverride) {
      setSelectedSlot(slotOverride);
    }
    setPaymentChoice(choice);
    setPaymentSheetOpen(true);
    setBookingOpen(false);
    setPaymentMethodsError(null);
    setBookingError(null);
    setBookingSuccess(null);
    setConsumeError(null);
    setPackagePurchaseError(null);
    setCreditsPackageOpen(false);
  };

  const buildBookingConfirmation = (slot: LoadedSlot, statusOverride?: BookingStatus): BookingConfirmationData => {
    const isGroup = slot.type === "group";
    const status = statusOverride ?? (isGroup ? "CONFIRMED" : "PENDING");
    const pricing = calculateLessonPricing({
      hourly_rate: slot.hourlyRate,
      group_price_per_person: slot.groupPricePerPerson,
      discount_percentage: slot.discountPercentage,
      lesson_type_name: slot.lessonTypeName,
      lessontype_id: slot.lessonTypeId,
    });
    return {
      status,
      data: {
        coachName,
        coachInitials: buildInitials(coachName),
        lessonTitle: isGroup ? slot.className : undefined,
        lessonSubtitle: isGroup ? slot.description : undefined,
        lessonTypeLabel: isGroup ? slot.className ?? "Group lesson" : "Private lesson",
        isGroup,
        durationMin: slot.durationMin,
        dateLabel: `${slot.dayLabel}, ${slot.dateLabel}`,
        timeLabel: slot.timeLabel,
        locationName: slot.court,
        locationAddress: slot.court,
        amountLabel: pricing.isOpenGroup ? "Lesson total" : isGroup ? "Amount charged" : "Lesson total",
        amount: formatCurrencyPrecise(pricing.totalFee),
        etaText: status === "PENDING" ? "~24 hrs" : undefined,
        cancellationPolicyText:
          "Cancellation policy: Free cancellation up to 24 hours before your lesson. Cancellations within 24 hours may be subject to a fee.",
      },
    };
  };

  const applyLessonConfirmedStatus = (slot: LoadedSlot, nextStatus: BookingStatus = "PENDING") => {
    setSlotsByDay((prev) =>
      prev.map((day) => ({
        ...day,
        slots: day.slots.map((entry) => {
          if (entry.id !== slot.id) return entry;
          if (entry.type === "group") {
            const nextSpots = entry.spotsLeft != null ? Math.max(entry.spotsLeft - 1, 0) : entry.spotsLeft;
            return { ...entry, spotsLeft: nextSpots, bookingState: nextStatus === "CONFIRMED" ? "confirmed" : "pending" };
          }
          return { ...entry, bookingState: nextStatus === "CONFIRMED" ? "confirmed" : "pending" };
        }),
      })),
    );
  };

  const handleBookingComplete = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(firstBookingKey, "completed");
    }
  };

  const buildSessionPrepMetadata = () => ({
    session_prep: {
      who_for: introForm.who === "My child" ? "my_child" : "myself",
      level: introForm.level || undefined,
      goals: introForm.goals.length ? introForm.goals : undefined,
      note: introForm.note.trim() || undefined,
    },
  });

  const lessonToCancelRange = useMemo(
    () => (lessonToCancel ? getLessonMomentRange(lessonToCancel) : null),
    [lessonToCancel],
  );
  const isCancellationWindowClosed = useMemo(() => {
    if (!lessonToCancelRange?.start?.isValid()) {
      return true;
    }
    return lessonToCancelRange.start.diff(moment.utc(), "hours", true) < 24;
  }, [lessonToCancelRange]);

  const openCancelFlow = (lesson: Lesson) => {
    setLessonToCancel(lesson as PlayerLesson);
    setCancelFlowState("confirm");
    setCancelError(null);
    setCancelSuccessMessage(null);
  };

  const closeCancelFlow = () => {
    if (cancelInFlight) return;
    setCancelFlowState("closed");
    setLessonToCancel(null);
    setCancelError(null);
  };

  const handleCancelLesson = async () => {
    if (!lessonToCancel?.id) return;
    if (!authToken) {
      setCancelError("Sign in to cancel this booking.");
      return;
    }
    if (isCancellationWindowClosed) {
      setCancelError("Cancellation is only available more than 24 hours before the lesson starts.");
      return;
    }

    setCancelInFlight(true);
    setCancelError(null);

    try {
      const response = await cancelBooking({
        token: authToken,
        lessonId: Number(lessonToCancel.id),
      });
      setCancelSuccessMessage(
        extractApiMessage(response, "Your lesson has been cancelled and any eligible refund has been initiated."),
      );
      setUpcomingCoachLessons((prev) => prev.filter((lesson) => String(lesson.id) !== String(lessonToCancel.id)));
      const cancelledRange = getLessonMomentRange(lessonToCancel);
      if (cancelledRange) {
        setSlotsByDay((prev) =>
          prev.map((day) => ({
            ...day,
            slots: day.slots.map((slot) => {
              const slotStart = moment.utc(slot.start);
              const slotEnd = moment.utc(slot.end);
              if (!slotStart.isValid() || !slotEnd.isValid()) {
                return slot;
              }
              const overlaps = slotStart.isBefore(cancelledRange.end) && slotEnd.isAfter(cancelledRange.start);
              return overlaps ? { ...slot, bookingState: undefined } : slot;
            }),
          })),
        );
      }
      setCancelFlowState("success");
    } catch (error) {
      if (handlePrivateAuthError(error)) {
        return;
      }
      setCancelError(extractApiMessage(error, "Unable to cancel this booking right now."));
    } finally {
      setCancelInFlight(false);
    }
  };

  const requestApplePayPaymentMethod = async () => {
    if (!stripePromise) {
      throw new Error("Stripe isn't configured for Apple Pay.");
    }
    if (!applePayAmount) {
      throw new Error("Missing payment amount for Apple Pay.");
    }
    if (!isApplePayReady || !applePayRequest) {
      throw new Error("Apple Pay isn't available on this device.");
    }

    const stripe = stripeRef.current ?? (await stripePromise);
    if (!stripe) {
      throw new Error("Stripe is not available for Apple Pay.");
    }
    stripeRef.current = stripe;

    return new Promise<{
      paymentMethodId: string;
      complete: (status: "success" | "fail") => void;
    }>((resolve, reject) => {
      const request = applePayRequest;
      request.update({
        total: {
          label: "The Tennis Plan",
          amount: applePayAmount,
        },
      });

      const handlePaymentMethod = (event: PaymentRequestPaymentMethodEvent) => {
        resolve({
          paymentMethodId: event.paymentMethod.id,
          complete: (status) => event.complete(status),
        });
      };

      const handleCancel = () => {
        reject(new Error("Apple Pay was canceled."));
      };

      request.once("paymentmethod", handlePaymentMethod);
      request.once("cancel", handleCancel);

      try {
        request.show();
      } catch (error) {
        request.off("paymentmethod", handlePaymentMethod);
        request.off("cancel", handleCancel);
        reject(error);
      }
    });
  };

  const requestPackageApplePayPaymentMethod = async (lessonPackage: CoachPackage) => {
    if (!stripePromise) {
      throw new Error("Stripe isn't configured for Apple Pay.");
    }
    if (!isApplePayReady) {
      throw new Error("Apple Pay isn't available on this device.");
    }

    const packageTotal = parseCurrency(lessonPackage.total_price);
    if (packageTotal == null) {
      throw new Error("Missing package total for Apple Pay.");
    }

    const stripe = stripeRef.current ?? (await stripePromise);
    if (!stripe) {
      throw new Error("Stripe is not available for Apple Pay.");
    }
    stripeRef.current = stripe;

    const request = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: lessonPackage.name || `${lessonPackage.lesson_count} lesson credits`,
        amount: Math.round(packageTotal * 100),
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    const canPay = await request.canMakePayment();
    if (!canPay) {
      throw new Error("Apple Pay isn't available on this device.");
    }

    return new Promise<{
      paymentMethodId: string;
      complete: (status: "success" | "fail") => void;
    }>((resolve, reject) => {
      const handlePaymentMethod = (event: PaymentRequestPaymentMethodEvent) => {
        resolve({
          paymentMethodId: event.paymentMethod.id,
          complete: (status) => event.complete(status),
        });
      };

      const handleCancel = () => {
        reject(new Error("Apple Pay was canceled."));
      };

      request.once("paymentmethod", handlePaymentMethod);
      request.once("cancel", handleCancel);

      try {
        request.show();
      } catch (error) {
        request.off("paymentmethod", handlePaymentMethod);
        request.off("cancel", handleCancel);
        reject(error);
      }
    });
  };

  const handleBuyCheckoutPackage = async () => {
    if (!authToken || !profile?.id) {
      setPackagePurchaseError("Sign in to buy credits.");
      return;
    }
    if (!selectedCheckoutPackage) {
      setPackagePurchaseError("Choose a lesson package to continue.");
      return;
    }

    setPurchasingPackage(true);
    setPackagePurchaseError(null);
    setPaymentMethodsError(null);

    let applePayCompletion: ((status: "success" | "fail") => void) | null = null;

    try {
      let paymentMethodId = selectedPaymentMethodId;
      if (paymentChoice === "wallet") {
        setApplePayLoading(true);
        const applePayResult = await requestPackageApplePayPaymentMethod(selectedCheckoutPackage);
        paymentMethodId = applePayResult.paymentMethodId;
        applePayCompletion = applePayResult.complete;
      }

      if (!paymentMethodId) {
        throw new Error("Choose Apple Pay or a saved card to buy credits.");
      }

      await purchaseCoachPackage({
        token: authToken,
        packageId: selectedCheckoutPackage.id,
        paymentMethodId,
      });

      const [creditsResponse, balanceResponse] = await Promise.all([
        fetchPackageCredits({
          token: authToken,
          coachId: profile.id,
          includeExpired: false,
        }),
        fetchPackageCreditsBalance({
          token: authToken,
          coachId: profile.id,
          lessonType: effectiveCreditType,
        }),
      ]);

      setPackageCredits(creditsResponse?.purchases ?? []);
      setCreditsBalance(balanceResponse ?? null);
      setCreditsPackageOpen(false);
      setPaymentChoice("credits");
      applePayCompletion?.("success");
    } catch (err) {
      applePayCompletion?.("fail");
      if (handlePrivateAuthError(err)) {
        return;
      }
      setPackagePurchaseError(err instanceof Error ? err.message : "Unable to buy credits.");
    } finally {
      setPurchasingPackage(false);
      setApplePayLoading(false);
    }
  };

  const confirmBookLesson = async () => {
    if (!selectedSlot || !profile?.id) {
      setBookingError("Please select a lesson to continue.");
      return;
    }

    if (!authToken || !isLoggedIn) {
      redirectToLogin({ resumeBookingSlotId: selectedSlot.id, resumePaymentChoice: paymentChoice });
      return;
    }

    if (paymentChoice === "card" && !selectedPaymentMethodId) {
      setPaymentMethodsError("Choose a payment method to book this lesson.");
      return;
    }

    setBookingInFlight(selectedSlot.id);
    setBookingError(null);
    setBookingSuccess(null);
    setConsumeError(null);

    let applePayCompletion: ((status: "success" | "fail") => void) | null = null;

    try {
      let resolvedBookingStatus: BookingStatus = selectedSlot.type === "group" ? "CONFIRMED" : "PENDING";
      let walletPaymentMethodId: string | undefined;

      if (paymentChoice === "wallet") {
        setApplePayLoading(true);
        const applePayResult = await requestApplePayPaymentMethod();
        walletPaymentMethodId = applePayResult.paymentMethodId;
        applePayCompletion = applePayResult.complete;
      }

      if (paymentChoice === "credits") {
        setConsumingCredits(true);
        if (!availableCredits) {
          throw new Error("No eligible credits available.");
        }
      }

      const isOpenGroup = selectedSlotPricing?.isOpenGroup ?? false;
      const creditLessonType = selectedSlotCreditType ?? resolveLessonCreditType({
        lesson_type_name: selectedSlot.lessonTypeName,
        lessontype_id: selectedSlot.lessonTypeId,
      });
      const eligiblePurchase = eligiblePackageCredits[0];

      if (selectedSlot.type === "group" && selectedSlot.sourceLessonId) {
        if (paymentChoice === "credits") {
          await updatePlayerLesson({
            token: authToken,
            lessonId: selectedSlot.sourceLessonId,
            status: "CONFIRMED",
          });
          if (eligiblePurchase?.id) {
            await consumePackageCredits({
              token: authToken,
              coachId: profile.id,
              lessonType: creditLessonType,
              lessonId: selectedSlot.sourceLessonId,
              purchaseId: eligiblePurchase.id,
            }).catch(() => undefined);
          }
        } else if (isOpenGroup) {
          await joinLesson({
            token: authToken,
            lessonId: selectedSlot.sourceLessonId,
            coachId: selectedSlot.coachId ?? profile.id,
            startDateTime: moment(selectedSlot.start).utc().toISOString(),
            endDateTime: moment(selectedSlot.end).utc().toISOString(),
            startDateTimeTz: moment(selectedSlot.start).toISOString(),
            endDateTimeTz: moment(selectedSlot.end).toISOString(),
            locationId: selectedSlot.locationId ?? 0,
            court: selectedSlot.courtValue ?? 0,
            status: "CONFIRMED",
          });
          resolvedBookingStatus = "CONFIRMED";
        } else {
          const intentResponse = await createPlayerStripePaymentIntent({
            token: authToken,
            lessonId: selectedSlot.sourceLessonId,
            paymentMethodId: paymentChoice === "wallet" ? walletPaymentMethodId : selectedPaymentMethodId,
          });
          const intentRecord = intentResponse as Record<string, unknown>;
          const intentStatus = extractIntentStatus(intentRecord);
          if (!hasCreatedPaymentIntent(intentRecord)) {
            throw new Error("Unable to start payment for this lesson.");
          }
          resolvedBookingStatus = intentStatus === "succeeded" ? "CONFIRMED" : "PENDING";
        }
      } else {
        if (!selectedSlot.locationId) {
          throw new Error("Missing location details for this lesson.");
        }
        const privateLessonResponse = await requestPrivateLesson({
          token: authToken,
          coachId: Number(profile.id),
          startDateTime: moment(selectedSlot.start).utc().toISOString(),
          endDateTime: moment(selectedSlot.end).utc().toISOString(),
          startDateTimeTz: moment(selectedSlot.start).toISOString(),
          endDateTimeTz: moment(selectedSlot.end).toISOString(),
          locationId: selectedSlot.locationId,
          court: selectedSlot.courtValue ?? 0,
          status: "PENDING",
          paymentMethodId: paymentChoice === "card" ? selectedPaymentMethodId : undefined,
          metadata: buildSessionPrepMetadata(),
        });
        const privateLessonRecord = privateLessonResponse.lesson as Record<string, unknown> | undefined;
        resolvedBookingStatus =
          extractBookingStatus(
            privateLessonResponse.status ??
              privateLessonRecord?.status ??
              privateLessonRecord?.booking_status,
          ) ?? "PENDING";
        const createdLessonId =
          Number(privateLessonResponse.id ?? privateLessonResponse.lesson_id ?? privateLessonResponse.lesson?.id ?? 0) || 0;
        if (!createdLessonId) {
          throw new Error("Unable to create this lesson.");
        }
        if (paymentChoice === "wallet") {
          const intentResponse = await createPlayerStripePaymentIntent({
            token: authToken,
            lessonId: createdLessonId,
            paymentMethodId: walletPaymentMethodId,
          });
          const intentRecord = intentResponse as Record<string, unknown>;
          if (!hasCreatedPaymentIntent(intentRecord)) {
            throw new Error("Unable to start payment for this lesson.");
          }
          resolvedBookingStatus = extractBookingStatus(
            privateLessonResponse.status ??
              privateLessonRecord?.status ??
              privateLessonRecord?.booking_status,
          ) ?? (extractIntentStatus(intentRecord) === "succeeded" ? "CONFIRMED" : "PENDING");
        }
        if (paymentChoice === "credits" && eligiblePurchase?.id) {
          await consumePackageCredits({
            token: authToken,
            coachId: profile.id,
            lessonId: createdLessonId,
            lessonType: creditLessonType,
            purchaseId: eligiblePurchase.id,
          }).catch(() => undefined);
        }
      }

      applePayCompletion?.("success");
      applyLessonConfirmedStatus(selectedSlot, resolvedBookingStatus);
      handleBookingComplete();
      setBookingConfirmation(buildBookingConfirmation(selectedSlot, resolvedBookingStatus));
      setBookingSuccess(null);
      closePaymentSheet();
      setSelectedSlot(null);
    } catch (err) {
      applePayCompletion?.("fail");
      if (handlePrivateAuthError(err)) {
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to complete this booking.";
      setBookingError(message);
      setPaymentMethodsError(message);
    } finally {
      setBookingInFlight(null);
      setConsumingCredits(false);
      setApplePayLoading(false);
    }
  };

  const canContinueIntro = Boolean(introForm.level && introForm.goals.length);
  const playerName = displayName.trim() || "A Tennis Plan player";
  const smsMessage =
    `Hi ${coachFirstName}, I found your profile on The Tennis Plan and would like to learn more about lessons.\n\n` +
    `Thanks,\n${playerName}`;
  const smsHref = buildSmsHref(coachPhone, smsMessage);
  const handleOpenPurchaseModal = () => {
    if (!profile?.id) {
      return;
    }
    if (!isLoggedIn) {
      openAuthPrompt({
        purchaseAfterAuth: true,
        focusBookCta: true,
      });
      return;
    }
    navigate(`/coaches/${profile.id}/purchase`);
  };

  const handleOpenPackageCheckoutFromPayment = () => {
    if (!profile?.id || !selectedSlot) {
      return;
    }

    navigate(`/coaches/${profile.id}/purchase`, {
      state: {
        returnTo: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
          state: {
            resumeBookingSlotId: selectedSlot.id,
            resumePaymentChoice: "credits",
            focusBookCta: true,
          },
        },
      },
    });
  };

  const availabilityLabels = useMemo(() => {
    if (Array.isArray(profile?.availability)) {
      return formatDisplayLabelList(
        profile.availability.filter((item): item is string => typeof item === "string" && item.trim().length > 0),
      );
    }
    if (typeof profile?.availability === "string") {
      return formatDisplayLabelList(
        profile.availability
          .split(/[•,|]/)
          .map((item) => item.trim())
          .filter(Boolean),
      );
    }
    return [];
  }, [profile?.availability]);
  const lessonFormatLabels = useMemo(() => {
    if (bookingLessonTypes.length) {
      return bookingLessonTypes.map((item) => item.label);
    }
    if (Array.isArray(apiProfile?.formats) && apiProfile.formats.length) {
      return apiProfile.formats.map((item) => {
        const normalized = item.toLowerCase();
        if (normalized === "semi") return "Semi-private lesson";
        if (normalized === "group") return "Group lesson";
        if (normalized === "private") return "Private lesson";
        return `${formatDisplayLabel(item)} lesson`;
      });
    }
    return ["Private lesson", "Group lesson"];
  }, [apiProfile?.formats, bookingLessonTypes]);
  const handleDateSelection = async (isoDate: string) => {
    if (!isoDate) return;

    setPendingSelectedDate(isoDate);
    setSelectedDate(isoDate);
    setShowDatePicker(false);

    if (slotsByDay.some((day) => day.isoDate === isoDate)) {
      setPendingSelectedDate(null);
      return;
    }

    if (!authToken || !profile?.id) {
      setSlotsByDay((prev) =>
        [...prev, {
          isoDate,
          dayLabel: moment(isoDate).format("ddd"),
          dateLabel: moment(isoDate).format("MMM D"),
          shortDateLabel: moment(isoDate).format("D"),
          slots: [],
        }].sort((a, b) => moment(a.isoDate).valueOf() - moment(b.isoDate).valueOf()),
      );
      setSelectedDate(isoDate);
      setPendingSelectedDate(null);
      return;
    }

    setDatePickerLoading(true);
    try {
      const response = (await fetchAvailableLessons({
        token: authToken,
        coach_id: Number(profile.id),
        start_date: isoDate,
        end_date: isoDate,
      })) as AvailableLessonsResponse & { data?: Lesson[] };
      const availability = Array.isArray(response?.availability) ? response.availability : [];
      const slots = availability
        .flatMap((day) =>
          (day.slots ?? []).map((slot, index) => mapAvailabilitySlotToLoadedSlot(day, slot, index, privatePriceLabel)),
        )
        .concat(
          Array.isArray(response?.data)
            ? response.data.map((lesson) => mapAvailableLessonToSlot(lesson))
            : [],
        )
        .filter((slot): slot is LoadedSlot => Boolean(slot))
        .sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf());

      setSlotsByDay((prev) =>
        [...prev.filter((day) => day.isoDate !== isoDate), {
          isoDate,
          dayLabel: moment(isoDate).format("ddd"),
          dateLabel: moment(isoDate).format("MMM D"),
          shortDateLabel: moment(isoDate).format("D"),
          slots,
        }].sort((a, b) => moment(a.isoDate).valueOf() - moment(b.isoDate).valueOf()),
      );
      setSelectedDate(isoDate);
    } catch {
      setSlotsByDay((prev) =>
        [...prev.filter((day) => day.isoDate !== isoDate), {
          isoDate,
          dayLabel: moment(isoDate).format("ddd"),
          dateLabel: moment(isoDate).format("MMM D"),
          shortDateLabel: moment(isoDate).format("D"),
          slots: [],
        }].sort((a, b) => moment(a.isoDate).valueOf() - moment(b.isoDate).valueOf()),
      );
      setSelectedDate(isoDate);
    } finally {
      setPendingSelectedDate(null);
      setDatePickerLoading(false);
    }
  };

  // The mobile details pre-sheet was removed in PR 3a: tapping a slot now opens the
  // confirm-and-pay drawer directly (openBookingFlow), matching desktop.

  const renderMobileBookingModule = () => {
    const filterByType = (list: LoadedSlot[]) =>
      list.filter((slot) => bookingType === "all" || slot.type === bookingType);

    const dayEntries = slotsByDay.map((day) => ({ day, slots: filterByType(day.slots) }));
    const firstAvailableIso = dayEntries.find((entry) => entry.slots.length > 0)?.day.isoDate ?? null;
    const activeIso =
      mobileSelectedDay &&
      dayEntries.some((entry) => entry.day.isoDate === mobileSelectedDay && entry.slots.length > 0)
        ? mobileSelectedDay
        : firstAvailableIso;
    const activeEntry = dayEntries.find((entry) => entry.day.isoDate === activeIso) ?? null;
    const daySlots = (activeEntry?.slots ?? [])
      .slice()
      .sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf());
    const isLoading = scheduleLoading || datePickerLoading;

    return (
      <div className="coach-bm">
        {!bookMode ? (
          <p className="coach-bm__eyebrow">
            <span className="coach-bm__edot" aria-hidden />
            Book a lesson
          </p>
        ) : null}

        <div className="coach-bm__segmented">
          {(["all", "private", "group"] as LessonTypeFilter[])
            .filter((type) => type !== "group" || Boolean(groupPriceLabel) || hasGroupSlots)
            .map((type) => (
              <button
                key={type}
                type="button"
                className={`coach-bm__seg${bookingType === type ? " is-active" : ""}`}
                onClick={() => setBookingType(type)}
              >
                {type === "all" ? "All" : type === "private" ? "Private" : "Group"}
              </button>
            ))}
        </div>

        {isLoading ? (
          <div className="coach-empty-card">Loading availability…</div>
        ) : firstAvailableIso == null ? (
          <div className="coach-bm__empty">No availability posted yet. Try messaging the coach.</div>
        ) : (
          <>
            <div className="coach-bm__daystrip">
              {dayEntries.map(({ day, slots }) => {
                const isActive = day.isoDate === activeIso;
                const isEmpty = slots.length === 0;
                return (
                  <button
                    key={day.isoDate}
                    type="button"
                    className={`coach-bm__day${isActive ? " is-active" : ""}${isEmpty ? " is-empty" : ""}`}
                    onClick={() => {
                      if (!isEmpty) setMobileSelectedDay(day.isoDate);
                    }}
                    disabled={isEmpty}
                  >
                    <span className="coach-bm__day-d">{day.dayLabel}</span>
                    <span className="coach-bm__day-dt">{day.dateLabel}</span>
                    <span className="coach-bm__day-cnt">{isEmpty ? "—" : `${slots.length} open`}</span>
                  </button>
                );
              })}
            </div>

            {!bookMode && daySlots.length > 0 && activeEntry ? (
              <div className="coach-bm__ctx">
                <span>
                  {daySlots.length} open · {activeEntry.day.dayLabel} {activeEntry.day.dateLabel}
                </span>
                <span className="coach-bm__next">
                  <span className="coach-bm__next-dot" aria-hidden />
                  Next: {daySlots[0].timeLabel}
                </span>
              </div>
            ) : null}

            {bookMode ? (
              <div className="coach-book-keeps">
                <Heart size={16} />
                <span>
                  <b>No lesson commission.</b> Coaches keep their full rate — the fees cover booking and card costs.
                </span>
              </div>
            ) : null}
            {daySlots.length === 0 ? (
              <div className="coach-bm__empty">
                No {bookingType === "all" ? "" : `${bookingType} `}times on this day. Try another day above.
              </div>
            ) : (
              <BookingSlotList
                slots={daySlots}
                showTypeBadge={bookingType === "all"}
                onSelectSlot={openBookingFlow}
              />
            )}
          </>
        )}
      </div>
    );
  };

  const renderBookingPanel = (variant: "mobile" | "desktop") => (
    <aside
      ref={variant === "desktop" ? desktopBookingRef : mobileBookingRef}
      className={`coach-profile-booking-rail coach-profile-booking-rail--${variant}${bookingFocusActive ? " coach-profile-booking-rail--focus" : ""}`}
      tabIndex={-1}
    >
      {/* Book page (bookMode) is focused on slot selection — the slot rows carry price, so the
          rail's price card is suppressed there (already hidden on mobile via CSS). */}
      {!bookMode ? (
        <div className="coach-profile-price-card coach-profile-booking-block">
          <div className="coach-profile-price-card__row">
            <div className="coach-profile-price-card__value">
              <h3>{privatePriceLabel}</h3>
            </div>
          </div>
          {groupPriceLabel ? <p className="coach-profile-price-card__sub">{groupPriceLabel}/hr group lessons</p> : null}
          <div className={`coach-profile-availability coach-profile-availability--inline${slotsThisWeek > 0 ? " coach-profile-availability--open" : ""}`}>
            <span className="coach-profile-availability__dot" />
            <span>{slotsThisWeek > 0 ? `${slotsThisWeek} slots available this week` : "No slots this week"}</span>
          </div>
        </div>
      ) : null}

      {!bookMode && variant !== "mobile" && isLoggedIn && !creditsLoading ? (
        <div className="coach-credit-strip coach-profile-booking-block">
          <div className="coach-credit-strip__copy">
            <Wallet size={16} />
            <div>
              <span>{creditBalanceSummary || "0 credits"}</span>
              <small>
                {creditBalanceSummary
                  ? `Eligible now: ${availableCredits} ${effectiveCreditTypeLabel === "total" ? "" : `${effectiveCreditTypeLabel} `}credit${availableCredits === 1 ? "" : "s"}`
                  : "Buy a package to apply credits at booking"}
              </small>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const isMobileViewport =
                typeof window !== "undefined" &&
                window.matchMedia("(max-width: 1023px)").matches;
              const target = isMobileViewport
                ? mobilePackagesRef.current ?? desktopPackagesRef.current
                : desktopPackagesRef.current ?? mobilePackagesRef.current;
              target?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {availableCredits > 0 ? "Top up" : "View packages"}
          </button>
        </div>
      ) : null}

      {/* Suppressed on the focused book page (both viewports). Future enhancement: re-home this
          "your upcoming lessons" context into the confirm-and-pay drawer (tracked, not built now). */}
      {!bookMode && isLoggedIn && (upcomingCoachLessonsLoading || upcomingCoachLessons.length > 0) ? (
        <div className="coach-profile-upcoming-card coach-profile-booking-block">
          <div className="coach-profile-section__header coach-profile-section__header--compact coach-profile-upcoming-card__header">
            <div>
              <h2>Your lessons with {coachFirstName}</h2>
              {!upcomingCoachLessonsLoading ? (
                <p className="coach-profile-upcoming-card__count">
                  {upcomingCoachLessons.length} upcoming lesson{upcomingCoachLessons.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
            {!upcomingCoachLessonsLoading && upcomingCoachLessons.length > 0 ? (
              <button
                type="button"
                className="coach-profile-upcoming-card__toggle"
                onClick={() => setUpcomingLessonsExpanded((value) => !value)}
                aria-expanded={upcomingLessonsExpanded}
                aria-controls="coach-profile-upcoming-list"
              >
                <span>{upcomingLessonsExpanded ? "Hide" : "Show"}</span>
                {upcomingLessonsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            ) : null}
          </div>
          {upcomingCoachLessonsLoading ? (
            <div className="coach-empty-card">Loading your upcoming lessons…</div>
          ) : upcomingCoachLessons.length > 0 && upcomingLessonsExpanded ? (
            <div className="coach-profile-upcoming-list" id="coach-profile-upcoming-list">
              {upcomingCoachLessons.map((lesson) => (
                <LessonDetailCard
                  key={String(lesson.id)}
                  lesson={lesson as Lesson}
                  statusLabel={getLessonStatusCode(lesson) === 0 ? "Requested" : undefined}
                  footerActionLabel={
                    resolveLessonType(lesson as Lesson) === "private" &&
                    getLessonStatusCode(lesson) !== 2
                      ? "Cancel lesson"
                      : undefined
                  }
                  footerActionTone="danger"
                  onFooterAction={(entry) => openCancelFlow(entry)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {cancelFlowState !== "closed" && lessonToCancel ? (
        <div className={`coach-profile-cancel-flow coach-profile-cancel-flow--${cancelFlowState}`}>
          <div
            className="coach-profile-cancel-backdrop"
            onClick={cancelFlowState === "confirm" ? closeCancelFlow : undefined}
          />
          <div className="coach-profile-cancel-dialog" role="dialog" aria-modal="true">
            {cancelFlowState === "confirm" ? (
              <>
                <div className="coach-profile-cancel-header">
                  <button
                    type="button"
                    className="coach-profile-cancel-back"
                    onClick={closeCancelFlow}
                    aria-label="Back"
                  >
                    <ArrowLeft aria-hidden />
                  </button>
                  <div className="coach-profile-cancel-title">Cancel lesson</div>
                </div>
                <div className="coach-profile-cancel-body">
                  <h2 className="coach-profile-cancel-headline">Cancel and request any eligible refund</h2>
                  <p className="coach-profile-cancel-copy">
                    You&apos;re more than 24 hours out, so this lesson can be cancelled now and any eligible refund will be initiated.
                  </p>

                  <div className="coach-profile-cancel-session-card">
                    <h3>{coachName}</h3>
                    <div className="coach-profile-cancel-session-list">
                      <div>
                        <span aria-hidden>📅</span>
                        <span>{lessonToCancelRange?.start?.isValid() ? lessonToCancelRange.start.local().format("dddd, MMM D") : "Date TBD"}</span>
                      </div>
                      <div>
                        <span aria-hidden>🕐</span>
                        <span>
                          {lessonToCancelRange?.start?.isValid() ? lessonToCancelRange.start.local().format("h:mm A") : "Time TBD"}
                          {lessonToCancelRange?.end?.isValid() ? ` · ${lessonToCancelRange.end.diff(lessonToCancelRange.start, "minutes")} min` : ""}
                        </span>
                      </div>
                      <div>
                        <span aria-hidden>📍</span>
                        <span>{String((lessonToCancel as Record<string, unknown>).location_name ?? "Location TBD")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="coach-profile-cancel-refund-card">
                    <span aria-hidden>✓</span>
                    <div>
                      <strong>Refund initiated</strong>
                      <p>Your lesson request will be cancelled and any refund will go back to the original payment method.</p>
                    </div>
                  </div>

                  <div className="coach-profile-cancel-note">
                    <span aria-hidden>👋</span>
                    <p>This slot will open back up on the coach&apos;s calendar once the cancellation is processed.</p>
                  </div>

                  {cancelError ? <p className="coach-profile-cancel-error">{cancelError}</p> : null}
                </div>
                <div className="coach-profile-cancel-footer">
                  <button
                    type="button"
                    className="coach-profile-cancel-secondary"
                    onClick={closeCancelFlow}
                    disabled={cancelInFlight}
                  >
                    Keep lesson
                  </button>
                  <button
                    type="button"
                    className="coach-profile-cancel-primary"
                    onClick={() => void handleCancelLesson()}
                    disabled={cancelInFlight || isCancellationWindowClosed}
                  >
                    {cancelInFlight ? "Cancelling..." : "Yes, cancel"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="coach-profile-cancel-header coach-profile-cancel-header--centered">
                  <div className="coach-profile-cancel-title">Lesson cancelled</div>
                </div>
                <div className="coach-profile-cancel-body coach-profile-cancel-body--success">
                  <div className="coach-profile-cancel-success-mark" aria-hidden>
                    ✓
                  </div>
                  <h2 className="coach-profile-cancel-headline">Lesson cancelled</h2>
                  <p className="coach-profile-cancel-copy">
                    Your lesson with {coachName} has been cancelled.
                  </p>
                  <div className="coach-profile-cancel-refund-card">
                    <span aria-hidden>💰</span>
                    <div>
                      <strong>Refund processing</strong>
                      <p>
                        {cancelSuccessMessage ??
                          "If a payment was taken, the refund has been initiated to the original payment method."}
                      </p>
                    </div>
                  </div>
                  <div className="coach-profile-cancel-success-card">
                    <strong>Want to rebook?</strong>
                    <p>Pick another available time below when you&apos;re ready.</p>
                  </div>
                </div>
                <div className="coach-profile-cancel-footer coach-profile-cancel-footer--single">
                  <button
                    type="button"
                    className="coach-profile-cancel-primary"
                    onClick={closeCancelFlow}
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <section className="coach-booking-card coach-profile-booking-block">
        {variant === "mobile" ? (
          renderMobileBookingModule()
        ) : (
        <>
        {!bookMode ? (
          <div className="coach-profile-section__header coach-profile-section__header--compact">
            <h2>Book a lesson</h2>
          </div>
        ) : null}

        <div className="coach-booking-toggle">
          {(["all", "private", "group"] as LessonTypeFilter[])
            .filter((type) => type !== "group" || Boolean(groupPriceLabel) || hasGroupSlots)
            .map((type) => (
              <button
                key={type}
                type="button"
                className={bookingType === type ? "is-active" : ""}
                onClick={() => setBookingType(type)}
              >
                {type === "all" ? "All" : type === "private" ? "Private" : "Group"}
              </button>
            ))}
        </div>

        <div className="coach-day-strip">
          <button
            type="button"
            className={selectedDate === "all" ? "coach-day-chip is-active" : "coach-day-chip"}
            onClick={() => setSelectedDate("all")}
          >
            <span>All</span>
          </button>
          {visibleDays.map((day) => (
            <button
              key={day.isoDate}
              type="button"
              className={selectedDate === day.isoDate ? "coach-day-chip is-active" : "coach-day-chip"}
              onClick={() => setSelectedDate(day.isoDate)}
            >
              <span>{day.dayLabel} {day.shortDateLabel}</span>
            </button>
          ))}
          <button
            type="button"
            className={`coach-day-chip coach-day-chip--icon${showDatePicker ? " is-active" : ""}`}
            onClick={() => setShowDatePicker((value) => !value)}
            aria-label="Pick a date"
          >
            <span className="coach-day-chip__icon-emoji" aria-hidden="true">📅</span>
          </button>
        </div>

        {showDatePicker ? (
          <div className="coach-date-picker">
            <input
              type="date"
              onChange={(event) => {
                void handleDateSelection(event.target.value);
              }}
            />
          </div>
        ) : null}

        {bookMode ? (
          <div className="coach-book-keeps">
            <Heart size={16} />
            <span>
              <b>No lesson commission.</b> Coaches keep their full rate — the fees cover booking and card costs.
            </span>
          </div>
        ) : null}

        {scheduleLoading || datePickerLoading ? <div className="coach-empty-card">Loading availability…</div> : null}
        {!scheduleLoading && !datePickerLoading && visibleSlots.length > 0 ? (
          <div className="coach-slot-list coach-slot-list--aside">
            <BookingSlotList
              slots={visibleSlots}
              showTypeBadge={bookingType === "all"}
              onSelectSlot={openBookingFlow}
              resolveBookingState={(slot) => {
                const upcomingLesson = upcomingLessonBySlotKey.get(slot.id);
                return slot.type === "group"
                  ? slot.bookingState ??
                      getGroupParticipantBookingState(slot.groupPlayers, user) ??
                      (upcomingLesson ? getGroupParticipantBookingState(upcomingLesson.group_players, user) : null)
                  : slot.bookingState ?? (upcomingLesson ? getUpcomingLessonBookingState(upcomingLesson) : null);
              }}
            />
          </div>
        ) : null}

        {!scheduleLoading && !datePickerLoading && visibleSlots.length === 0 ? (
          <div className="coach-empty-card coach-empty-card--purple">
            {selectedDate === "all" ? null : <div className="coach-empty-card__emoji">🎾</div>}
            <strong>{selectedDate === "all" ? "No lessons for this filter" : "No lessons on this day"}</strong>
            <p>
              {selectedDate === "all"
                ? nextAvailableSlot
                  ? `Next available: ${nextAvailableSlot.dayLabel} ${nextAvailableSlot.dateLabel} · ${nextAvailableSlot.timeLabel}`
                  : "No availability posted yet."
                : "Try a different day"}
            </p>
            {selectedDate === "all" ? (
              <div className="coach-empty-card__actions">
                <button type="button" onClick={() => setSelectedDate("all")}>
                  See all availability
                </button>
                {smsHref ? (
                  <a href={smsHref} className="is-secondary coach-empty-card__link">
                    Message coach
                  </a>
                ) : (
                  <button type="button" className="is-secondary" disabled>
                    Message coach
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        </>
        )}

        <div
          ref={variant === "desktop" ? desktopPackagesRef : mobilePackagesRef}
          className={`coach-profile-section coach-profile-section--packages coach-profile-booking-block${
            variant === "mobile" && packages.length === 0 ? " coach-profile-section--packages-hidden-mobile" : ""
          }`}
        >
          {packagesLoading ? <div className="coach-empty-card">Loading packages…</div> : null}
          {packagesError ? <div className="coach-empty-card">{packagesError}</div> : null}
          {!packagesLoading && !packagesError ? (
            <div id="packages-section" className="coach-package-section">
              {isLoggedIn ? (
                <div className="coach-package-summary">
                  <div className="coach-package-summary__eyebrow">Your credits with {coachFirstName}</div>
                  <div className="coach-package-summary__body">
                    <div className="coach-package-summary__count">
                      <strong>{selectedPackageCredits}</strong>
                      <span>
                        {packageLessonType === "all"
                          ? "credits"
                          : packageLessonType === "private"
                            ? "private credits"
                            : "group credits"}
                      </span>
                    </div>
                    <p>
                      {selectedPackageCredits > 0
                        ? "Select a slot above and your credit will be applied automatically - no payment needed."
                        : packageLessonType === "all"
                          ? "Buy a package to apply credits automatically at booking."
                          : `Buy a ${packageLessonType} package to apply credits automatically at booking.`}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="coach-package-section__intro">
                <div>
                  <h2>Top up your credits</h2>
                  <p>Lock in more lessons at today&apos;s rate</p>
                </div>
              </div>

              {packageLessonTypeOptions.length > 0 ? (
                <div className="coach-package-filters" role="tablist" aria-label="Filter packages by lesson type">
                  {packageLessonTypeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={packageLessonType === option.id ? "is-active" : ""}
                      onClick={() => setPackageLessonType(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="coach-package-list">
                {filteredPackageOffers.length > 0 ? (
                  filteredPackageOffers.map((pkg) => {
                    const total = formatCurrency(pkg.total_price) ?? `${pkg.total_price}`;
                    const numericTotal = parseCurrency(pkg.total_price);
                    const lessonCount = Math.max(pkg.lesson_count, 1);
                    const perLessonValue = numericTotal != null ? numericTotal / lessonCount : null;
                    const lessonRate =
                      packageLessonType === "private"
                        ? parseCurrency(privatePriceLabel)
                        : packageLessonType === "group"
                          ? parseCurrency(groupPriceLabel ?? undefined)
                          : null;
                    const baseTotal = lessonRate != null ? lessonRate * lessonCount : null;
                    const savingsAmount =
                      numericTotal != null && baseTotal != null ? Math.max(baseTotal - numericTotal, 0) : 0;
                    const savingsPercent =
                      numericTotal != null && baseTotal != null && baseTotal > 0
                        ? Math.round((savingsAmount / baseTotal) * 100)
                        : 0;
                    const sublabel =
                      savingsPercent > 0 && perLessonValue != null
                        ? `Save ${savingsPercent}% · ${formatCurrencyPrecise(perLessonValue)}/lesson`
                        : pkg.validity_months
                          ? `Valid ${pkg.validity_months} month${pkg.validity_months === 1 ? "" : "s"} · ${
                              perLessonValue != null ? `${formatCurrencyPrecise(perLessonValue)}/lesson` : `${lessonCount} credits`
                            }`
                          : perLessonValue != null
                            ? `${formatCurrencyPrecise(perLessonValue)}/lesson`
                            : `${lessonCount} credits`;
                    const isFeatured = pkg.id === featuredPackageId;

                    return (
                      <article
                        key={String(pkg.id)}
                        className={`coach-package-card${isFeatured ? " coach-package-card--featured" : ""}`}
                      >
                        <button type="button" className="coach-package-card__button" onClick={handleOpenPurchaseModal}>
                          {isFeatured ? <span className="coach-package-card__ribbon">Best value</span> : null}
                          <div className="coach-package-card__top">
                            <div>
                              <h3>{pkg.name || `${lessonCount} lessons`}</h3>
                              <p className="coach-package-card__sub">{sublabel}</p>
                            </div>
                            <div className="coach-package-card__price-total">
                              <strong>{total}</strong>
                              <small>total</small>
                            </div>
                          </div>
                          <p className="coach-package-card__meta">
                            {pkg.description?.trim() ||
                              `${lessonCount} ${
                                packageLessonType === "all"
                                  ? "lessons"
                                  : `${normalizeSingleLessonTypeLabel(packageLessonType).toLowerCase()} lessons`
                              }`}
                          </p>
                          {pkg.lesson_types_allowed?.length ? (
                            <p className="coach-package-card__eyebrow">{normalizeLessonTypeLabel(pkg.lesson_types_allowed)}</p>
                          ) : null}
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <div className="coach-empty-card">No packages are available for this lesson type yet.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </aside>
  );

  // Booking overlays (confirm-and-pay drawer + status modal + auth prompt). Rendered from BOTH the
  // bookMode return and the main return so the drawer mounts on the dedicated book page too.
  // Mount/placement only — no payment-logic change.
  const renderBookingOverlays = () => (
    <>
        {paymentSheetOpen && selectedSlot ? (
          <div className="coach-payment-modal" role="dialog" aria-modal="true">
            <div className="coach-payment-modal__backdrop" onClick={closePaymentSheet} />
            <div className="coach-payment-modal__panel">
              <div className="coach-payment-modal__header">
                <button type="button" className="coach-payment-modal__back" onClick={closePaymentSheet}>
                  <ChevronLeft size={18} /> Back
                </button>
                <div className="coach-payment-modal__header-copy">
                  <h3 className="coach-payment-modal__title">Confirm & pay</h3>
                </div>
                <button type="button" className="coach-payment-modal__close" onClick={closePaymentSheet} aria-label="Close payment selection">
                  ×
                </button>
              </div>

              <div className="coach-payment-modal__body">
                {(consumeError || paymentMethodsError || bookingError || packagePurchaseError) ? (
                  <div className="coach-payment-modal__status-stack">
                    {consumeError ? <p className="coach-payment-modal__error">{consumeError}</p> : null}
                    {paymentMethodsError ? <p className="coach-payment-modal__error">{paymentMethodsError}</p> : null}
                    {bookingError ? <p className="coach-payment-modal__error">{bookingError}</p> : null}
                    {packagePurchaseError ? <p className="coach-payment-modal__error">{packagePurchaseError}</p> : null}
                  </div>
                ) : null}

                <div className="coach-payment-modal__summary">
                  <div className="coach-payment-modal__summary-coach">
                    {coachAvatar ? (
                      <img src={coachAvatar} alt={coachName} className="coach-payment-modal__summary-avatar" />
                    ) : (
                      <span className="coach-payment-modal__summary-avatar coach-payment-modal__summary-avatar--fallback">{buildInitials(coachName)}</span>
                    )}
                    <div>
                      <div className="coach-payment-modal__summary-name">{coachName}</div>
                      <div className="coach-payment-modal__summary-title">{coachTitle}</div>
                    </div>
                  </div>

                  <div className="coach-payment-modal__summary-details">
                    <div><span>Type</span><strong>{selectedSlot.type === "private" ? "Private lesson" : selectedSlot.className ?? "Group lesson"}</strong></div>
                    <div><span>Date & time</span><strong>{selectedSlot.dayLabel} {selectedSlot.dateLabel} · {selectedSlot.timeLabel}</strong></div>
                    <div><span>Duration</span><strong>{selectedSlot.durationLabel}</strong></div>
                    <div><span>Location</span><strong>{selectedSlot.court}</strong></div>
                  </div>
                </div>

                <section className="coach-payment-modal__section">
                  <div className="coach-payment-modal__section-label">Payment method</div>

                  <div className="coach-payment-modal__choices">
                    {availableCredits ? (
                      <label className={`coach-payment-choice${paymentChoice === "credits" ? " coach-payment-choice--active" : ""}`}>
                        <input
                          type="radio"
                          name="payment-choice"
                          value="credits"
                          checked={paymentChoice === "credits"}
                          onChange={() => setPaymentChoice("credits")}
                        />
                        <div className="coach-payment-choice__icon" aria-hidden="true">🎟️</div>
                        <div className="coach-payment-choice__body">
                          <div className="coach-payment-choice__title-row">
                            <span className="coach-payment-choice__title">Use credits</span>
                          </div>
                          <p className="coach-payment-choice__subtitle">
                            {availableCredits} {effectiveCreditTypeLabel === "total" ? "" : `${effectiveCreditTypeLabel} `}credit{availableCredits === 1 ? "" : "s"} available{creditBalanceSummary ? ` • ${creditBalanceSummary} total by type` : ""}
                          </p>
                        </div>
                        {paymentChoice === "credits" ? <span className="coach-payment-choice__check">✓</span> : null}
                      </label>
                    ) : (
                      <div className={`coach-payment-choice coach-payment-choice--package${creditsPackageOpen ? " coach-payment-choice--package-open" : ""}`}>
                        <button
                          type="button"
                          className="coach-payment-choice__package-toggle"
                          onClick={() => setCreditsPackageOpen((open) => !open)}
                          aria-expanded={creditsPackageOpen}
                        >
                          <div className="coach-payment-choice__icon" aria-hidden="true">🎟️</div>
                          <div className="coach-payment-choice__body">
                            <div className="coach-payment-choice__title-row">
                              <span className="coach-payment-choice__title">Buy a lesson package</span>
                            </div>
                            <p className="coach-payment-choice__subtitle">Save up to 20% · pay with credits</p>
                          </div>
                          <ChevronDown className="coach-payment-choice__chevron" aria-hidden size={18} />
                        </button>
                        {creditsPackageOpen ? (
                          <div className="coach-payment-choice__package-panel">
                            <p className="coach-payment-choice__package-intro">
                              Buy sessions now — one credit covers this lesson, the rest are yours to use any time.
                            </p>
                            {packagesLoading ? <p className="coach-payment-modal__hint">Loading packages...</p> : null}
                            {packagesError ? <p className="coach-payment-modal__error">{packagesError}</p> : null}
                            {!packagesLoading && !packagesError && checkoutPackageOptions.length === 0 ? (
                              <p className="coach-payment-modal__hint">No lesson packages are available right now.</p>
                            ) : null}
                            {checkoutPackageOptions.map((lessonPackage) => {
                              const isSelectedPackage = selectedCheckoutPackage?.id === lessonPackage.id;
                              const total = parseCurrency(lessonPackage.total_price);
                              const perCredit = total != null ? total / lessonPackage.lesson_count : null;
                              const savings =
                                selectedSlotPricing && total != null
                                  ? Math.max(selectedSlotPricing.coachFee * lessonPackage.lesson_count - total, 0)
                                  : 0;
                              const isBestValue = checkoutBestValuePackage?.id === lessonPackage.id;
                              const title = lessonPackage.name || `${lessonPackage.lesson_count} lesson package`;
                              const description = lessonPackage.description?.trim();
                              return (
                                <button
                                  type="button"
                                  key={lessonPackage.id}
                                  className={`coach-payment-package-option${isSelectedPackage ? " coach-payment-package-option--selected" : ""}`}
                                  onClick={() => setSelectedPackageId(String(lessonPackage.id))}
                                >
                                  <span>
                                    <span className="coach-payment-package-option__title">
                                      {title}
                                      {isBestValue ? <span className="coach-payment-package-option__badge">Best value</span> : null}
                                    </span>
                                    {description ? <span className="coach-payment-package-option__description">{description}</span> : null}
                                    <span className="coach-payment-package-option__meta">
                                      {lessonPackage.lesson_count} credits ·{" "}
                                      {perCredit != null
                                        ? `${formatCurrencyPrecise(perCredit)}/credit`
                                        : formatPackageLessonTypes(lessonPackage.lesson_types_allowed)}
                                    </span>
                                    <span className="coach-payment-package-option__meta">
                                      {formatPackageValidity(lessonPackage.validity_months)} ·{" "}
                                      {formatPackageLessonTypes(lessonPackage.lesson_types_allowed)}
                                    </span>
                                  </span>
                                  <span className="coach-payment-package-option__price">
                                    <strong>{total != null ? formatCurrencyPrecise(total) : formatCurrency(lessonPackage.total_price)}</strong>
                                    {savings > 0 ? <small>Save {formatCurrencyPrecise(savings)}</small> : null}
                                  </span>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              className="coach-payment-choice__package-buy"
                              onClick={handleOpenPackageCheckoutFromPayment}
                              disabled={!selectedCheckoutPackage}
                            >
                              Buy with credit card
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <label className={`coach-payment-choice${paymentChoice === "wallet" ? " coach-payment-choice--active" : ""}${!isApplePayReady ? " coach-payment-choice--disabled" : ""}`}>
                      <input
                        type="radio"
                        name="payment-choice"
                        value="wallet"
                        checked={paymentChoice === "wallet"}
                        onChange={() => setPaymentChoice("wallet")}
                        disabled={!isApplePayReady}
                      />
                      <div className="coach-payment-choice__icon" aria-hidden="true">🍎</div>
                      <div className="coach-payment-choice__body">
                        <div className="coach-payment-choice__title-row">
                          <span className="coach-payment-choice__title">Apple Pay / wallet</span>
                        </div>
                        <p className="coach-payment-choice__subtitle">
                          {isApplePayReady
                            ? "Pay with Apple Pay on this device."
                            : stripePromise
                              ? "Apple Pay is not available on this device or browser."
                              : "Stripe is not configured for Apple Pay."}
                        </p>
                      </div>
                      {paymentChoice === "wallet" ? <span className="coach-payment-choice__check">✓</span> : null}
                    </label>
                  </div>

                  <div className="coach-payment-modal__saved-label">Saved cards</div>

                  {paymentMethodsLoading ? <p className="coach-payment-modal__hint">Loading your cards…</p> : null}

                  {paymentChoice === "card" && !paymentMethodsLoading && paymentMethods.length === 0 ? (
                    <div className="coach-payment-modal__empty">
                      <strong>No payment method on file</strong>
                      <p>Add a card before booking this lesson.</p>
                      <Link
                        to="/settings/payment-methods"
                        state={{
                          from: {
                            pathname: location.pathname,
                            search: location.search,
                            hash: location.hash,
                            state: selectedSlot ? { resumeBookingSlotId: selectedSlot.id, resumePaymentChoice: "card" } : undefined,
                          },
                        }}
                      >
                        Add payment method
                      </Link>
                    </div>
                  ) : null}

                  {paymentMethods.length > 0 ? (
                    <div className="coach-payment-modal__list" role="radiogroup" aria-label="Payment methods">
                      {paymentMethods.map((method) => {
                        const brand = (method.card?.brand ?? "Card").toString();
                        const last4 = method.card?.last4 ?? "••••";
                        const expMonth = method.card?.exp_month;
                        const expYear = method.card?.exp_year;
                        const isActive = paymentChoice === "card" && selectedPaymentMethodId === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            className={`coach-payment-card${isActive ? " coach-payment-card--active" : ""}`}
                            onClick={() => {
                              setPaymentChoice("card");
                              setSelectedPaymentMethodId(method.id);
                            }}
                          >
                            <div className="coach-payment-card__brand-badge">
                              <span className="coach-payment-card__brand-mark">{brand === "visa" || brand === "Visa" ? "VISA" : brand.toUpperCase()}</span>
                            </div>
                            <div className="coach-payment-card__meta">
                              <span className="coach-payment-card__last4">•••• {last4}</span>
                              <span className="coach-payment-card__expiry">
                                {expMonth && expYear ? `Expires ${expMonth.toString().padStart(2, "0")}/${`${expYear}`.slice(-2)}` : "Saved card"}
                                {method.is_default ? " · Default" : ""}
                              </span>
                            </div>
                            {isActive ? <span className="coach-payment-choice__check">✓</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <Link
                    to="/settings/payment-methods"
                    className="coach-payment-modal__add-card"
                    state={{
                      from: {
                        pathname: location.pathname,
                        search: location.search,
                        hash: location.hash,
                        state: selectedSlot ? { resumeBookingSlotId: selectedSlot.id, resumePaymentChoice: "card" } : undefined,
                      },
                    }}
                  >
                    + Add new card
                  </Link>
                </section>

                <section className="coach-payment-modal__section">
                  {paymentChoice === "credits" ? (
                    <div className="coach-payment-modal__price-breakdown">
                      <div className="coach-payment-modal__price-row">
                        <span>Lesson value</span>
                        <strong>{selectedSlot.priceLabel}</strong>
                      </div>
                      <div className="coach-payment-modal__price-row">
                        <span>Credits applied</span>
                        <strong>1 credit</strong>
                      </div>
                      <div className="coach-payment-modal__price-row coach-payment-modal__price-row--total">
                        <span>Total</span>
                        <strong>{formatCurrencyPrecise(0)}</strong>
                      </div>
                    </div>
                  ) : selectedSlotPricing ? (
                    <>
                      <LessonPaymentSummary
                        pricing={{
                          hourly_rate: selectedSlot.hourlyRate,
                          group_price_per_person: selectedSlot.groupPricePerPerson,
                          discount_percentage: selectedSlot.discountPercentage,
                          lesson_type_name: selectedSlot.lessonTypeName,
                          lessontype_id: selectedSlot.lessonTypeId,
                        }}
                        formatMoney={formatCurrencyPrecise}
                      />
                      <p className="coach-payment-modal__hint">
                        {selectedSlotPricing.isOpenGroup
                          ? "Open Group uses the lesson join flow from this screen."
                          : selectedSlot.type === "private"
                            ? "Private lesson requests are created from this screen and stay pending until the coach confirms them."
                            : "Saved card checkout uses the existing lesson payment intent flow."}
                      </p>
                    </>
                  ) : null}
                </section>
              </div>

              <div className="coach-payment-modal__actions">
                <Link
                  to="/settings/payment-methods"
                  className="coach-payment-modal__link"
                  state={{
                    from: {
                      pathname: location.pathname,
                      search: location.search,
                      hash: location.hash,
                      state: selectedSlot ? { resumeBookingSlotId: selectedSlot.id, resumePaymentChoice: "card" } : undefined,
                    },
                  }}
                >
                  Manage payment methods
                </Link>
                <button
                  type="button"
                  className="coach-payment-modal__confirm"
                  disabled={
                    bookingInFlight !== null ||
                    purchasingPackage ||
                    (paymentChoice === "wallet" && (!isApplePayReady || applePayLoading)) ||
                    (paymentChoice === "card" && (!selectedPaymentMethodId || paymentMethodsLoading)) ||
                    (paymentChoice === "credits" && (!availableCredits || consumingCredits))
                  }
                  onClick={() => void confirmBookLesson()}
                >
                  {bookingInFlight || consumingCredits
                    ? "Booking…"
                    : paymentChoice === "credits"
                      ? "Confirm with credits"
                      : paymentChoice === "wallet"
                        ? applePayLoading
                          ? "Opening Apple Pay..."
                          : selectedSlot?.type === "private"
                            ? "Request with Apple Pay"
                            : "Pay with Apple Pay"
                        : selectedSlotPricing?.isOpenGroup
                          ? "Join lesson"
                        : selectedSlot?.type === "private"
                          ? "Send request"
                          : "Pay now"}
                </button>
                {/* TODO(capture-model): charge-timing copy ("charged when accepted" / refund terms)
                    depends on the unconfirmed Stripe capture model — left out until backend confirms.
                    This line is the responsiveness reassurance only (a static placeholder per PR 1). */}
                {selectedSlot?.type === "private" ? (
                  <p className="coach-payment-modal__responds">
                    <Clock3 size={14} /> {coachFirstName} usually responds within 24 hours
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {bookingConfirmation ? (
          <BookingStatusModal
            open={Boolean(bookingConfirmation)}
            status={bookingConfirmation.status}
            data={bookingConfirmation.data}
            onClose={() => setBookingConfirmation(null)}
            onPrimary={() => setBookingConfirmation(null)}
            onSecondary={() => navigate("/")}
            onAddToCalendar={() => {
              if (selectedSlot) {
                downloadIcs(selectedSlot, coachName);
              }
            }}
            onShareWithFriends={() => {
              if (navigator.share) {
                void navigator.share({
                  title: bookingConfirmation.data.lessonTypeLabel,
                  text: `Join me for ${bookingConfirmation.data.lessonTypeLabel} with ${bookingConfirmation.data.coachName}.`,
                });
              }
            }}
          />
        ) : null}

        {authPromptOpen ? (
          <div className="coach-auth-sheet" role="dialog" aria-modal="true" aria-label="Sign up to book">
            <button
              type="button"
              className="coach-auth-sheet__backdrop"
              aria-label="Close sign up prompt"
              onClick={() => setAuthPromptOpen(false)}
            />
            <div className="coach-auth-sheet__panel">
              <button
                type="button"
                className="coach-auth-sheet__close"
                aria-label="Close sign up prompt"
                onClick={() => setAuthPromptOpen(false)}
              >
                <X size={18} />
              </button>
              <div className="coach-auth-sheet__handle" />
              <div className="coach-auth-sheet__coach">
                {coachAvatar ? (
                  <img src={coachAvatar} alt="" />
                ) : (
                  <span>{buildInitials(coachName)}</span>
                )}
                <div>
                  <small>You&apos;re booking with</small>
                  <strong>{coachName}</strong>
                  <p>
                    {privatePriceLabel}/hr
                    {slotsThisWeek > 0 ? ` · ${slotsThisWeek} slots this week` : ""}
                  </p>
                </div>
              </div>
              <div className="coach-auth-sheet__copy">
                <h2>Create a free account to book</h2>
                <p>Sign up in 30 seconds to request a lesson with {coachFirstName}.</p>
              </div>
              <div className="coach-auth-sheet__actions">
                <button type="button" className="coach-auth-sheet__primary" onClick={() => continueToAuth("signup")}>
                  Create free account
                </button>
                <div className="coach-auth-sheet__divider">
                  <span />
                  <small>or</small>
                  <span />
                </div>
                <button type="button" className="coach-auth-sheet__secondary" onClick={() => continueToAuth("signin")}>
                  Sign in to existing account
                </button>
              </div>
              <p className="coach-auth-sheet__legal">
                By continuing you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        ) : null}
    </>
  );

  if (loading) {
    return (
      <MainLayout
      mobileChrome="home"
      desktopChrome="home"
      showDesktopNav={true}
      onMobileBack={handleBackToFindCoaches}
      hideMobileLocation
    >
        <div className="coach-profile-page coach-profile-page--loading">
          <div className="coach-profile-loading-card" />
        </div>
      </MainLayout>
    );
  }

  if (profileError || !profile) {
    return (
      <MainLayout
      mobileChrome="home"
      desktopChrome="home"
      showDesktopNav={true}
      onMobileBack={handleBackToFindCoaches}
      hideMobileLocation
    >
        <div className="coach-profile-page">
          <div className="coach-profile-empty">
            <div className="coach-profile-empty__icon">
              <MessageCircle strokeWidth={2.2} />
            </div>
            <h1 className="coach-profile-empty__title">{profileError ? "We couldn’t load this coach" : "Coach not found"}</h1>
            <p className="coach-profile-empty__copy">
              {profileError ?? "That profile isn’t available right now. Return to the coach list and try another profile."}
            </p>
            <Link
              to="/find-coaches"
              state={findCoachesReturnState ? { findCoachesState: findCoachesReturnState } : undefined}
              className="coach-profile-empty__action"
            >
              <ArrowLeft size={16} /> Back to Coaches
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Focused "book a lesson" page: slim coach header + the existing booking panel, profile chrome hidden.
  // TODO(PR3): extract useCoachBooking + <CoachBookingPanel>; book mode reuses renderBookingPanel for now.
  if (bookMode) {
    return (
      <MainLayout
        mobileChrome="home"
        desktopChrome="home"
        showDesktopNav={true}
        onMobileBack={handleBackToFindCoaches}
        hideMobileLocation
        pageClassName="coach-book-layout"
      >
        <div className="coach-profile-page coach-book-page">
          <div className="coach-profile-shell coach-profile-shell--layout">
            <div className="coach-book-page__body">
              <header className="coach-book-head">
                {/* Desktop-only: the top-nav back is hidden >=1024px, so this is the only desktop back. */}
                <button
                  type="button"
                  className="coach-profile-top-action coach-book-head__back"
                  onClick={handleBackToFindCoaches}
                >
                  <ArrowLeft size={16} /> <span className="coach-profile-top-action__label">Back</span>
                </button>
                <h1 className="coach-book-head__eyebrow">
                  <span className="coach-book-head__dot" aria-hidden /> Book a lesson with {coachName}
                </h1>
              </header>
              {renderBookingPanel("mobile")}
              {renderBookingPanel("desktop")}
            </div>
          </div>
          {renderBookingOverlays()}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      mobileChrome="home"
      desktopChrome="home"
      showDesktopNav={true}
      onMobileBack={handleBackToFindCoaches}
      hideMobileLocation
    >
      <div className="coach-profile-page">
        <div className="coach-profile-shell coach-profile-shell--layout">
          {/* <JoinMyRosterBanner
            coachName={coachName}
            rosterStatus={rosterStatus}
            canRequest={Boolean(authToken)}
            onRequestJoin={requestJoin}
            requestingJoin={requestingJoin}
            joinError={requestJoinError ?? undefined}
            joinSuccess={requestJoinSuccess}
            rosterError={rosterError ?? undefined}
            rosterLoading={rosterLoading}
          /> */}

          <div className="coach-profile-layout-v2">
            <div className="coach-profile-main-v2">
              <div className="coach-profile-fixed-chrome">
                <div className="coach-profile-chrome-header">
                  <button type="button" className="coach-profile-top-action" onClick={handleBackToFindCoaches}>
                    <ArrowLeft size={16} /> <span className="coach-profile-top-action__label">Find a Coach</span>
                  </button>
                  {smsHref ? (
                    <a
                      href={smsHref}
                      className="coach-profile-top-action coach-profile-top-action--outline coach-profile-top-action--mobile-only"
                    >
                      <MessageCircle size={16} /> Message
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="coach-profile-top-action coach-profile-top-action--outline coach-profile-top-action--mobile-only"
                      disabled
                    >
                      <MessageCircle size={16} /> Message
                    </button>
                  )}
                </div>

                <div className="coach-profile-sticky-chrome coach-profile-sticky-chrome--inline">
                  {(["about", "specialties", "courts"] as AnchorTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`coach-profile-tab${activeTab === tab ? " coach-profile-tab--active" : ""}`}
                      onClick={() => scrollToSection(tab)}
                    >
                      {tab === "about" ? "About" : tab === "specialties" ? "Specialties" : "Courts"}
                    </button>
                  ))}
                </div>

                <div className="coach-profile-compact-bar">
                  <div className="coach-profile-compact-bar__identity">
                    <div className="coach-profile-compact-bar__avatar-wrap">
                      {coachAvatar ? (
                        <img src={coachAvatar} alt={coachName} className="coach-profile-compact-bar__avatar" />
                      ) : (
                        <div className="coach-profile-compact-bar__avatar coach-profile-compact-bar__avatar--fallback">
                          {buildInitials(coachName)}
                        </div>
                      )}
                      <span className="coach-profile-compact-bar__verified-badge" aria-label="Verified coach">
                        <CheckCircle2 size={8} />
                      </span>
                    </div>
                    <div className="coach-profile-compact-bar__copy">
                      <strong>{coachName}</strong>
                      <div className="coach-profile-compact-bar__meta">
                        {certifications[0] ? <span>{certifications[0]}</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="coach-profile-compact-bar__price">
                    <span className="coach-profile-compact-bar__price-currency">$</span>
                    <span className="coach-profile-compact-bar__price-value">{privatePriceLabel.replace(/[^0-9.]/g, "")}</span>
                    <span className="coach-profile-compact-bar__price-unit">/hr</span>
                  </div>
                </div>
              </div>

              <section className="coach-hero-m" aria-label="Coach overview">
                <div className="coach-hero-m__row">
                  <div className="coach-hero-m__avatar">
                    {coachAvatar ? (
                      <img src={coachAvatar} alt={coachName} />
                    ) : (
                      <span className="coach-hero-m__avatar-fallback">{buildInitials(coachName)}</span>
                    )}
                  </div>
                  <div className="coach-hero-m__id">
                    <h1>{coachName}</h1>
                    {certifications[0] ? (
                      <span className="coach-hero-m__cert">
                        <span className="coach-hero-m__cert-dot" aria-hidden />
                        {certifications[0]}
                      </span>
                    ) : null}
                  </div>
                  <div className="coach-hero-m__price">
                    <div className="coach-hero-m__amt">
                      {privatePriceLabel}
                      <small>/hr</small>
                    </div>
                    {groupPriceLabel ? (
                      <span className="coach-hero-m__grp">Group {groupPriceLabel}/hr</span>
                    ) : null}
                  </div>
                </div>
                {heroTagline ? <p className="coach-hero-m__tagline">{heroTagline}</p> : null}
                {heroStudents || heroExperience ? (
                  <div className="coach-hero-m__stats">
                    {heroStudents ? (
                      <div className="coach-hero-m__stat">
                        <div className="coach-hero-m__stat-num">{heroStudents}</div>
                        <div className="coach-hero-m__stat-lbl">Students coached</div>
                      </div>
                    ) : null}
                    {heroExperience ? (
                      <div className="coach-hero-m__stat">
                        <div className="coach-hero-m__stat-num">{heroExperience}</div>
                        <div className="coach-hero-m__stat-lbl">Experience</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="coach-hero-m__actions">
                  {smsHref ? (
                    <a href={smsHref} className="coach-hero-m__btn coach-hero-m__btn--secondary">
                      <MessageCircle size={17} /> Message
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="coach-hero-m__btn coach-hero-m__btn--secondary"
                      disabled
                    >
                      <MessageCircle size={17} /> Message
                    </button>
                  )}
                  <button
                    type="button"
                    className="coach-hero-m__btn coach-hero-m__btn--primary"
                    onClick={() =>
                      mobileBookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  >
                    See availability
                  </button>
                </div>
              </section>

              <section className="coach-profile-hero-v2">
                <div className="coach-profile-hero-v2__identity">
                  <div className="coach-profile-hero-v2__avatar-wrap">
                    {coachAvatar ? (
                      <img src={coachAvatar} alt={coachName} className="coach-profile-hero-v2__avatar" />
                    ) : (
                      <div className="coach-profile-hero-v2__avatar coach-profile-hero-v2__avatar--fallback">{buildInitials(coachName)}</div>
                    )}
                    <span className="coach-profile-verified-badge" aria-label="Verified coach">
                      <CheckCircle2 size={18} />
                    </span>
                  </div>
                  <div className="coach-profile-hero-v2__copy">
                    <div className="coach-profile-hero-v2__header">
                      <div className="coach-profile-hero-v2__header-copy">
                        <h1>{coachName}</h1>
                        <div className="coach-profile-mobile-meta">
                          {certifications[0] ? <span>{certifications[0]}</span> : null}
                          {certifications[0] ? <span>·</span> : null}
                          <span>{privatePriceLabel}/hr</span>
                        </div>
                      </div>
                      <div className="coach-profile-hero-v2__actions">
                        {smsHref ? (
                          <a href={smsHref} className="coach-profile-top-action coach-profile-top-action--outline">
                            <MessageCircle size={16} /> Message
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="coach-profile-top-action coach-profile-top-action--outline"
                            disabled
                          >
                            <MessageCircle size={16} /> Message
                          </button>
                        )}
                        <span className="coach-profile-hero-v2__location-note">{cityLabel}</span>
                      </div>
                    </div>
                    <div className="coach-profile-hero-v2__chips">
                      {certifications.map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--purple">
                          {item}
                        </span>
                      ))}
                    </div>
                    <div className="coach-profile-hero-v2__stats">
                      <span>
                        <MapPin size={14} /> {distanceLabel ? `${distanceLabel} away` : heroLocationLabel}
                      </span>
                      <span>
                        <Clock3 size={14} /> {experienceLabel} exp
                      </span>
                      <span>
                        <Users size={14} /> {studentsLabel}
                      </span>
                    </div>
                    <p ref={bioRef} className={`coach-profile-bio${bioExpanded ? " coach-profile-bio--expanded" : ""}`}>{aboutCopy}</p>
                    {bioCanExpand || bioExpanded ? (
                      <button type="button" className="coach-profile-inline-link" onClick={() => setBioExpanded((value) => !value)}>
                        {bioExpanded ? "See less" : "See more"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>

              <div className="coach-sections-m">
                {aboutCopy ? (
                  <section className="coach-sec-m" aria-label="About">
                    <p className="coach-sec-m__eyebrow">
                      <span className="coach-sec-m__edot" aria-hidden />
                      About
                    </p>
                    <p className={`coach-sec-m__bio${bioExpanded ? "" : " coach-sec-m__bio--clamped"}`}>{aboutCopy}</p>
                    {aboutCopy.length > 160 ? (
                      <button
                        type="button"
                        className="coach-sec-m__seemore"
                        onClick={() => setBioExpanded((value) => !value)}
                      >
                        {bioExpanded ? "See less" : "See more"}
                      </button>
                    ) : null}
                  </section>
                ) : null}

                {levels.length || specialties.length || hasLessonFormats || availabilityLabels.length ? (
                  <section className="coach-sec-m" aria-label={`What ${coachFirstName} teaches`}>
                    <p className="coach-sec-m__eyebrow">
                      <span className="coach-sec-m__edot" aria-hidden />
                      What {coachFirstName} teaches
                    </p>
                    {levels.length ? (
                      <div className="coach-sec-m__chip-group">
                        <p className="coach-sec-m__chip-label">Player levels</p>
                        <div className="coach-sec-m__chips">
                          {levels.map((level) => (
                            <span key={level} className="coach-sec-m__chip">{level}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {specialties.length ? (
                      <div className="coach-sec-m__chip-group">
                        <p className="coach-sec-m__chip-label">Focus areas</p>
                        <div className="coach-sec-m__chips">
                          {specialties.map((item) => (
                            <span key={item} className="coach-sec-m__chip">{item}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {hasLessonFormats ? (
                      <div className="coach-sec-m__chip-group">
                        <p className="coach-sec-m__chip-label">Lesson formats</p>
                        <div className="coach-sec-m__chips">
                          {lessonFormatLabels.map((format) => (
                            <span key={format} className="coach-sec-m__chip">{format}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {availabilityLabels.length ? (
                      <div className="coach-sec-m__chip-group">
                        <p className="coach-sec-m__chip-label">Typically available</p>
                        <div className="coach-sec-m__chips">
                          {availabilityLabels.map((label) => (
                            <span key={label} className="coach-sec-m__chip coach-sec-m__chip--avail">
                              <span className="coach-sec-m__pulse" aria-hidden />
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {coachingLocations.length ? (
                  <section className="coach-sec-m" aria-label="Where you'll play">
                    <p className="coach-sec-m__eyebrow">
                      <span className="coach-sec-m__edot" aria-hidden />
                      Where you'll play
                    </p>
                    {coachingLocations.map((court, index) => (
                      <div
                        key={`${court}-${index}`}
                        className={`coach-sec-m__court${index === 0 ? "" : " coach-sec-m__court--secondary"}`}
                      >
                        <span className="coach-sec-m__court-pin" aria-hidden>
                          <MapPin size={18} />
                        </span>
                        <div className="coach-sec-m__court-body">
                          <div className="coach-sec-m__court-name">{shortenLocationLabel(court)}</div>
                          <div className="coach-sec-m__court-meta">
                            <span className="coach-sec-m__court-tag">{index === 0 ? "Primary" : "Secondary"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </section>
                ) : null}

                {packages.length ? (
                  <section className="coach-sec-m" aria-label="Lesson packages">
                    <button
                      type="button"
                      className="coach-sec-m__pkg"
                      onClick={() =>
                        mobilePackagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      <span className="coach-sec-m__pkg-txt">
                        <b>Lesson packages</b> — book in bulk and lock in today's rate.
                      </span>
                      <span className="coach-sec-m__pkg-cta">
                        View <ChevronRight size={13} />
                      </span>
                    </button>
                  </section>
                ) : null}
              </div>

              {renderBookingPanel("mobile")}

              <section ref={aboutRef} className="coach-profile-section coach-profile-section--split" id="about">
                <div className="coach-profile-section__header">
                  <h2>About</h2>
                </div>
                <div className="coach-profile-stat-grid">
                  <article className="coach-profile-stat-card">
                    <div className="coach-profile-stat-card__icon">
                      <CalendarDays size={20} />
                    </div>
                    <span>Experience</span>
                    <strong>{experienceLabel}</strong>
                  </article>
                  <article className="coach-profile-stat-card">
                    <div className="coach-profile-stat-card__icon">
                      <Users size={20} />
                    </div>
                    <span>Students</span>
                    <strong>{studentsLabel}</strong>
                  </article>
                  <article className="coach-profile-stat-card">
                    <div className="coach-profile-stat-card__icon">
                      <MessageCircle size={20} />
                    </div>
                    <span>Languages</span>
                    <strong>{languages.join(", ") || "English"}</strong>
                  </article>
                </div>

                <div className="coach-detail-stack">
                  <div>
                    <h3>Certifications</h3>
                    <div className="coach-chip-row">
                      {certifications.map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--purple">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section ref={specialtiesRef} className="coach-profile-section coach-profile-section--split" id="specialties">
                <div className="coach-profile-section__header">
                  <h2>Specialties</h2>
                </div>
                <div className="coach-detail-stack">
                  <div>
                    <h3>Focus areas</h3>
                    <div className="coach-chip-row">
                      {specialties.map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--soft">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Player levels</h3>
                    <div className="coach-chip-row">
                      {levels.map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--purple">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Lesson formats</h3>
                    <div className="coach-chip-row">
                      {lessonFormatLabels.map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--blue">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Availability</h3>
                    <div className="coach-chip-row">
                      {(availabilityLabels.length ? availabilityLabels : [profile?.availability || "Schedule shared after booking"]).map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--green">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section ref={courtsRef} className="coach-profile-section coach-profile-section--split" id="courts">
                <div className="coach-profile-section__header">
                  <h2>Courts</h2>
                </div>
                <div className="coach-court-grid">
                  {coachingLocations.map((location, index) => (
                    <article key={location} className="coach-court-card">
                      <div className={`coach-court-card__icon${index === 0 ? " coach-court-card__icon--primary" : ""}`}>
                        <MapPin size={18} />
                      </div>
                      <div>
                        <strong>{location}</strong>
                        <span>{index === 0 ? "Primary location" : "Secondary location"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            {renderBookingPanel("desktop")}
          </div>
        </div>

        {bookingOpen && selectedSlot ? (
          <div className="coach-booking-flow" role="dialog" aria-modal="true">
            <div className="coach-booking-flow__backdrop" onClick={closeBookingFlow} />
            <div className="coach-booking-flow__panel">
              <div className="coach-booking-flow__topbar">
                <button
                  type="button"
                  className="coach-booking-flow__back"
                  onClick={() => {
                    if (bookingStep === "about") {
                      closeBookingFlow();
                      return;
                    }
                    if (bookingStep === "confirm") {
                      setBookingStep(isFirstBooking ? "about" : "confirm");
                      if (!isFirstBooking) closeBookingFlow();
                      return;
                    }
                    closeBookingFlow();
                  }}
                >
                  <ChevronLeft size={18} /> Back
                </button>
                <button type="button" className="coach-booking-flow__close" onClick={closeBookingFlow}>
                  <X size={18} />
                </button>
              </div>

              {bookingStep === "about" ? (
                <div className="coach-booking-step">
                  <div className="coach-booking-step__coach-card">
                    {coachAvatar ? <img src={coachAvatar} alt="" /> : <span>{buildInitials(coachName)}</span>}
                    <div>
                      <p>Your first lesson with {coachName}</p>
                      <strong>Help {coachFirstName} prepare for your session</strong>
                    </div>
                  </div>

                  {hasPrefill ? <div className="coach-prefill-banner">Pre-filled from your preferences — just check and confirm.</div> : null}

                  <div className="coach-form-group">
                    <label>Who is this lesson for?</label>
                    <div className="coach-chip-row">
                      {(["Myself", "My child"] as IntroWho[]).map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`coach-choice-chip${introForm.who === value ? " is-active" : ""}`}
                          onClick={() => setIntroForm((current) => ({ ...current, who: value }))}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="coach-form-group">
                    <label>Your current level</label>
                    <div className="coach-chip-row">
                      {LEVEL_OPTIONS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`coach-choice-chip${introForm.level === value ? " is-active" : ""}`}
                          onClick={() => setIntroForm((current) => ({ ...current, level: value }))}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="coach-form-group">
                    <label>What do you want to work on?</label>
                    <div className="coach-chip-row">
                      {INTRO_GOALS.map((goal) => {
                        const active = introForm.goals.includes(goal);
                        return (
                          <button
                            key={goal}
                            type="button"
                            className={`coach-choice-chip${active ? " is-active" : ""}`}
                            onClick={() =>
                              setIntroForm((current) => ({
                                ...current,
                                goals: active ? current.goals.filter((item) => item !== goal) : [...current.goals, goal],
                              }))
                            }
                          >
                            {goal}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="coach-form-group">
                    <label>Anything else?</label>
                    <textarea
                      value={introForm.note}
                      onChange={(event) => setIntroForm((current) => ({ ...current, note: event.target.value }))}
                      placeholder="Injuries, upcoming tournaments, doubles goals, match prep..."
                    />
                  </div>

                  <div className="coach-booking-step__footer">
                    <button
                      type="button"
                      className="coach-secondary-button"
                      onClick={() => openPaymentSheet("card")}
                    >
                      Skip to payment
                    </button>
                    <button
                      type="button"
                      className="coach-primary-button"
                      disabled={!canContinueIntro}
                      onClick={() => openPaymentSheet("card")}
                    >
                      Continue to payment
                    </button>
                  </div>
                </div>
              ) : null}

              {bookingStep === "confirm" ? (
                <div className="coach-booking-step">
                  {(() => {
                    const upsellTotal = upsellPackage ? parseCurrency(upsellPackage.total_price) : undefined;
                    const upsellTotalLabel = upsellPackage ? formatCurrency(upsellPackage.total_price) ?? `${upsellPackage.total_price}` : "";
                    const upsellPerSession =
                      upsellPackage && upsellTotal != null
                        ? formatCurrency(upsellTotal / Math.max(upsellPackage.lesson_count, 1))
                        : undefined;
                    const privateLessonRate = parseCurrency(privatePriceLabel);
                    const upsellSavingsAmount =
                      upsellPackage && upsellTotal != null && privateLessonRate
                        ? Math.max(privateLessonRate * Math.max(upsellPackage.lesson_count, 1) - upsellTotal, 0)
                        : 0;
                    const upsellSavingsPercent =
                      upsellPackage && upsellTotal != null && privateLessonRate
                        ? Math.round((upsellSavingsAmount / Math.max(privateLessonRate * Math.max(upsellPackage.lesson_count, 1), 1)) * 100)
                        : 0;
                    const upsellTitle =
                      upsellPackage?.name?.trim() || `${upsellPackage?.lesson_count ?? 0}-session package`;
                    const upsellCopy =
                      upsellPackage?.description?.trim() ||
                      (upsellPerSession && upsellSavingsAmount > 0
                        ? `${upsellPerSession}/session · save ${formatCurrency(upsellSavingsAmount) ?? `$${Math.round(upsellSavingsAmount)}`}${upsellSavingsPercent > 0 ? ` (${upsellSavingsPercent}%)` : ""}`
                        : upsellPackage
                          ? `${upsellPackage.lesson_count} lessons with ${coachFirstName}`
                          : "");

                    return (
                      <>
                  <div className="coach-booking-step__coach-card">
                    {coachAvatar ? <img src={coachAvatar} alt="" /> : <span>{buildInitials(coachName)}</span>}
                    <div>
                      <strong>{coachName}</strong>
                      <p>{certifications[0] ?? coachTitle}</p>
                    </div>
                  </div>

                  <div className="coach-summary-table">
                    <div><span>Type</span><strong>{selectedSlot.type === "private" ? "Private lesson" : selectedSlot.className ?? "Group lesson"}</strong></div>
                    <div><span>Date & time</span><strong>{selectedSlot.dayLabel} {selectedSlot.dateLabel} · {selectedSlot.timeLabel}</strong></div>
                    <div><span>Duration</span><strong>{selectedSlot.durationLabel}</strong></div>
                    <div><span>Location</span><strong>{selectedSlot.court}</strong></div>
                  </div>

                  {selectedSlotPricing ? (
                    <LessonPaymentSummary
                      pricing={{
                        hourly_rate: selectedSlot.hourlyRate,
                        group_price_per_person: selectedSlot.groupPricePerPerson,
                        discount_percentage: selectedSlot.discountPercentage,
                        lesson_type_name: selectedSlot.lessonTypeName,
                        lessontype_id: selectedSlot.lessonTypeId,
                      }}
                      formatMoney={formatCurrencyPrecise}
                    />
                  ) : (
                    <div className="coach-total-box">
                      <span>Total price</span>
                      <strong>{selectedSlot.priceLabel}</strong>
                    </div>
                  )}

                  {privateCredits === 0 && selectedSlot.type === "private" && upsellPackage && !upsellDismissed ? (
                    <div className="coach-upsell-card">
                      <button type="button" className="coach-upsell-card__close" onClick={() => setUpsellDismissed(true)}>
                        <X size={14} />
                      </button>
                      <p>Save on repeat sessions</p>
                      <strong>{upsellTitle}</strong>
                      <span>{upsellCopy}</span>
                      <div className="coach-upsell-card__actions">
                        <button type="button" className="coach-primary-button coach-primary-button--small" onClick={handleOpenPurchaseModal}>
                          Buy package{upsellTotalLabel ? ` · ${upsellTotalLabel}` : ""}
                        </button>
                        <button type="button" className="coach-secondary-button coach-secondary-button--small" onClick={() => setUpsellDismissed(true)}>Just this lesson</button>
                      </div>
                    </div>
                  ) : null}

                  <button type="button" className="coach-primary-button" onClick={() => openPaymentSheet("card")}>
                    Continue to payment
                  </button>
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {renderBookingOverlays()}
      </div>
    </MainLayout>
  );
};

export default CoachProfilePage;
