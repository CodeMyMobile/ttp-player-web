import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clock,
  CreditCard,
  Hourglass,
  Info,
  MapPin,
  MessageCircle,
  Share2,
  UserRound,
  Users,
} from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import {
  loadStripe,
  type PaymentRequest as StripePaymentRequest,
  type PaymentRequestPaymentMethodEvent,
  type Stripe,
} from "@stripe/stripe-js";

import MainLayout from "../components/MainLayout";
import { fetchCoachProfile, type CoachProfileRecord } from "../api/coachProfile";
import { bookGroupLessonWithCard, fetchPlayerLessonById, fetchPublicLessonById, type Lesson } from "../api/playerLessons";
import {
  createPlayerStripePaymentIntent,
  getPlayerStripePaymentMethods,
  getPlayerStripeSetupIntent,
  type PlayerStripePaymentMethod,
} from "../api/playerStripe";
import {
  consumePackageCredits,
  fetchCoachPackages,
  fetchPackageCredits,
  purchaseCoachPackage,
  type CoachPackage,
  type PackagePurchase,
} from "../api/playerPackages";
import { updatePlayerLesson } from "../api/player";
import AddCardForm from "../components/payments/AddCardForm";
import { getStoredAuthToken } from "../services/authToken";
import { packageAllowsLessonCreditType, type LessonCreditType } from "../utils/lessonPricing";

import "./PlayerLessonDetailsPage.css";

const normalizeLesson = (payload: Lesson | { lesson?: Lesson } | null | undefined): Lesson | null => {
  if (!payload) return null;
  if ("lesson" in payload && payload.lesson) return payload.lesson;
  return payload as Lesson;
};

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_STRIPE_PUBLISHABLEKEY ??
  "";

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseLessonStatus = (lesson: Lesson | null) => {
  if (!lesson) return null;
  const record = lesson as Record<string, unknown>;
  const playerId = record.player_id ?? record.playerId ?? record.user_id ?? record.userId;
  const groupPlayers = Array.isArray(record.group_players) ? record.group_players : [];
  const currentPlayerRecord =
    playerId != null
      ? groupPlayers.find((player) => {
          const participant = player as Record<string, unknown>;
          const candidateId = participant.player_id ?? participant.playerId ?? participant.id ?? participant.user_id ?? participant.userId;
          return candidateId != null && String(candidateId) === String(playerId);
        })
      : undefined;
  const currentPlayerStatus = currentPlayerRecord
    ? (currentPlayerRecord as Record<string, unknown>).payment_status ??
      (currentPlayerRecord as Record<string, unknown>).paymentStatus ??
      (currentPlayerRecord as Record<string, unknown>).status
    : undefined;
  return parseNumber(currentPlayerStatus ?? record.payment_status ?? record.paymentStatus ?? record.status);
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
};

const formatTimeRangeLabel = (startValue?: string | null, endValue?: string | null) => {
  if (!startValue) return "Time TBD";
  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return "Time TBD";
  const end = endValue ? new Date(endValue) : null;
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const startLabel = timeFormatter.format(start);
  const endLabel = end && !Number.isNaN(end.getTime()) ? timeFormatter.format(end) : null;
  const durationMinutes =
    end && !Number.isNaN(end.getTime()) ? Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0) : 0;
  return [endLabel ? `${startLabel} - ${endLabel}` : startLabel, durationMinutes ? `${durationMinutes} mins` : null]
    .filter(Boolean)
    .join(" · ");
};

const getCoachName = (lesson: Lesson | null) => {
  if (!lesson) return "Coach";
  const record = lesson as Record<string, unknown>;
  return String(record.full_name ?? lesson.coach_name ?? "Coach");
};

const getCoachProfileName = (profile: CoachProfileRecord | null) => {
  if (!profile) return null;
  const record = profile as CoachProfileRecord & {
    full_name?: string;
    name?: string;
  };
  const value = record.fullName ?? record.full_name ?? record.name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const getCoachAvatarUrl = (lesson: Lesson | null) => {
  if (!lesson) return null;
  const record = lesson as Record<string, unknown>;
  const value = record.profile_picture;
  return typeof value === "string" && value.trim() ? value : null;
};

const getCoachProfileAvatarUrl = (profile: CoachProfileRecord | null) => {
  if (!profile) return null;
  const record = profile as CoachProfileRecord & {
    profile_picture?: string;
    avatarUrl?: string;
  };
  const value = record.profilePicture ?? record.profile_picture ?? record.avatarUrl;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const getInitials = (name: string) => {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return "CO";
};

const getLocationTitle = (lesson: Lesson | null) => {
  if (!lesson) return "Location TBD";
  const record = lesson as Record<string, unknown>;
  return String(lesson.location_name ?? record.location_name ?? record.location ?? "Location TBD");
};

const getLessonTypeLabel = (lesson: Lesson | null) => {
  if (!lesson) return "Lesson";
  const record = lesson as Record<string, unknown>;
  return String(lesson.lesson_type_name ?? record.lesson_type_name ?? "Lesson");
};

const getLessonTitle = (lesson: Lesson | null) => {
  if (!lesson) return "Lesson details";
  const record = lesson as Record<string, unknown>;
  const metadata = record.metadata as Record<string, unknown> | undefined;
  const title =
    metadata?.title ??
    record.metadata_title ??
    lesson.lesson_type_name ??
    record.lesson_type_name;
  return typeof title === "string" && title.trim() ? title.trim() : "Lesson details";
};

const getLessonLevelLabel = (lesson: Lesson | null) => {
  if (!lesson) return null;
  const record = lesson as Record<string, unknown>;
  const metadata = record.metadata as Record<string, unknown> | undefined;
  const raw = metadata?.level ?? record.metadata_level;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

const getLessonDescription = (lesson: Lesson | null) => {
  if (!lesson) return "Lesson details will appear here once the session is ready.";
  const record = lesson as Record<string, unknown>;
  const metadata = record.metadata as Record<string, unknown> | undefined;
  const description = metadata?.description;
  if (typeof description === "string" && description.trim()) {
    return description.trim();
  }

  const kind = resolveLessonTypeForCredits(lesson);
  if (kind === "group") {
    return "Join a coach-led class built for shared reps, live feedback, and steady matchplay rhythm.";
  }
  if (kind === "semi") {
    return "Train in a small-format session with focused coaching, partner reps, and more individualized feedback.";
  }
  return "A focused one-on-one lesson built around your goals, technique work, and live corrections.";
};

const getLessonDateBadgeLabel = (lesson: Lesson | null) => {
  if (!lesson?.start_date_time) return "DATE TBD";
  const date = new Date(lesson.start_date_time);
  if (Number.isNaN(date.getTime())) return "DATE TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase()
    .replace(",", " ·");
};

const getLessonTypeVariantLabel = (lesson: Lesson | null) => {
  const kind = resolveLessonTypeForCredits(lesson);
  if (kind === "group") return "Open Group";
  if (kind === "semi") return "Semi-Private";
  return "Private Lesson";
};

const getLessonDurationMinutes = (lesson: Lesson | null) => {
  if (!lesson?.start_date_time || !lesson?.end_date_time) return 0;
  const start = new Date(lesson.start_date_time);
  const end = new Date(lesson.end_date_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0);
};

const getLessonCapacityDetails = (lesson: Lesson | null) => {
  if (!lesson) return null;
  const limit = parseNumber((lesson as Record<string, unknown>).player_limit) ?? (resolveLessonTypeForCredits(lesson) === "private" ? 1 : null);
  if (!limit) return null;
  const booked = parseNumber((lesson as Record<string, unknown>).current_player_count) ?? 0;
  const remaining = Math.max(limit - booked, 0);
  return { limit, booked, remaining };
};

const getLessonFormatSummary = (lesson: Lesson | null) => {
  const kind = resolveLessonTypeForCredits(lesson);
  if (kind === "group") {
    return "Coach-led class with shared drills, group pacing, and live tactical feedback.";
  }
  if (kind === "semi") {
    return "Small-group lesson with partner reps and more direct coaching attention.";
  }
  return "One-on-one coaching tailored to your goals, pace, and technical priorities.";
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

const getCoachPhoneNumber = (profile: CoachProfileRecord | null) => {
  if (!profile) return "";
  const record = profile as CoachProfileRecord & {
    contact?: { phone?: string };
    phone?: string;
    phoneNumber?: string;
    mobile?: string;
  };
  return String(
    record.contact?.phone ??
      record.phone ??
      record.phoneNumber ??
      record.mobile ??
      "",
  ).trim();
};

const parseMoney = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const formatMoney = (value: unknown) => {
  const amount = parseMoney(value);
  if (amount == null) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
};

const formatPackageLessonTypes = (types?: string[]) => {
  if (!Array.isArray(types) || types.length === 0) {
    return "All lesson types";
  }
  return types
    .map((type) => type.replace(/_/g, " "))
    .map((type) => type.charAt(0).toUpperCase() + type.slice(1))
    .join(", ");
};

const formatPackageValidity = (months?: number | null) => {
  if (!months || months <= 0) {
    return "No expiry listed";
  }
  return `Valid ${months} month${months === 1 ? "" : "s"}`;
};

const buildGoogleCalendarHref = (lesson: Lesson | null, title: string, description: string, location: string) => {
  if (!lesson?.start_date_time || !lesson?.end_date_time) {
    return null;
  }

  const start = new Date(lesson.start_date_time);
  const end = new Date(lesson.end_date_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const formatUtc = (date: Date) => date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatUtc(start)}/${formatUtc(end)}`,
    details: description,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const resolveLessonTypeForCredits = (lesson: Lesson | null): LessonCreditType => {
  if (!lesson) return "private";
  const record = lesson as Record<string, unknown>;
  const typeId = parseNumber(record.lessontype_id ?? record.lesson_type_id ?? record.lessonTypeId);
  const typeLabel = String(record.lesson_type_name ?? record.lessonTypeName ?? "").toLowerCase();
  if (typeId === 2 || typeLabel.includes("semi")) return "semi";
  if (typeId === 3 || typeId === 4 || typeLabel.includes("group") || typeLabel.includes("open group")) return "group";
  return "private";
};

const isGroupLessonType = (lesson: Lesson | null) => {
  if (!lesson) return false;
  const record = lesson as Record<string, unknown>;
  const typeId = parseNumber(record.lessontype_id ?? record.lesson_type_id ?? record.lessonTypeId);
  if (typeId === 3) return true;
  const typeLabel = String(record.lesson_type_name ?? record.lessonTypeName ?? "").toLowerCase();
  return typeLabel.includes("group") || typeLabel.includes("open group");
};

const extractPaymentMethods = (payload: PlayerStripePaymentMethod[] | Record<string, unknown> | null | undefined) => {
  if (!payload) return [] as PlayerStripePaymentMethod[];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.payment_methods)) return payload.payment_methods as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.data)) return payload.data as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.results)) return payload.results as PlayerStripePaymentMethod[];
  return [] as PlayerStripePaymentMethod[];
};

const isCreditEligibleForLesson = (purchase: PackagePurchase, lesson: Lesson | null) => {
  const remaining = Number(purchase.credits_remaining ?? 0);
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return false;
  }

  const lessonType = resolveLessonTypeForCredits(lesson);
  return packageAllowsLessonCreditType(purchase.lesson_types_allowed, lessonType);
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

const PlayerLessonDetailsPage = () => {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<"card" | "credits" | "apple-pay">("card");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PlayerStripePaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [setupIntentSecret, setSetupIntentSecret] = useState<string | null>(null);
  const [setupIntentLoading, setSetupIntentLoading] = useState(false);
  const [setupIntentError, setSetupIntentError] = useState<string | null>(null);
  const [credits, setCredits] = useState<PackagePurchase[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null);
  const [packages, setPackages] = useState<CoachPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [creditsPackageOpen, setCreditsPackageOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packagePurchaseError, setPackagePurchaseError] = useState<string | null>(null);
  const [purchasingPackage, setPurchasingPackage] = useState(false);
  const [isApplePayReady, setIsApplePayReady] = useState(false);
  const [applePayRequest, setApplePayRequest] = useState<StripePaymentRequest | null>(null);
  const [coachProfile, setCoachProfile] = useState<CoachProfileRecord | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const token = useMemo(() => getStoredAuthToken({ preferScheme: "token" }) ?? null, []);
  const isSignedIn = Boolean(token);
  const promptSignIn = useCallback(() => {
    navigate("/login", { state: { from: `${location.pathname}${location.search}` } });
  }, [location.pathname, location.search, navigate]);
  const lessonTotalAmountCents = useMemo(() => {
    if (!lesson) return null;
    const record = lesson as Record<string, unknown>;
    const baseRate =
      parseMoney(lesson.price_per_person) ??
      parseMoney(record.group_price_per_person) ??
      parseMoney(record.hourly_rate) ??
      parseMoney(record.price);
    if (!baseRate || baseRate <= 0) {
      return null;
    }
    const discountPercentage = parseMoney(record.discount_percentage) ?? 0;
    const discountedRate = baseRate - (baseRate * Math.max(Math.min(discountPercentage, 100), 0)) / 100;
    const creditFee = discountedRate * 0.03;
    const total = discountedRate + creditFee + 1;
    return Math.round(total * 100);
  }, [lesson]);
  const lessonPriceBreakdown = useMemo(() => {
    if (!lesson) return null;
    const record = lesson as Record<string, unknown>;
    const baseRate =
      parseMoney(lesson.price_per_person) ??
      parseMoney(record.group_price_per_person) ??
      parseMoney(record.hourly_rate) ??
      parseMoney(record.price);
    if (!baseRate || baseRate <= 0) {
      return null;
    }
    const discountPercentage = parseMoney(record.discount_percentage) ?? 0;
    const coachFee = baseRate - (baseRate * Math.max(Math.min(discountPercentage, 100), 0)) / 100;
    const creditFee = coachFee * 0.03;
    return {
      coachFee,
      creditFee,
      serviceFee: 1,
    };
  }, [lesson]);

  const loadLesson = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) {
        setLoading(false);
        setError("Missing lesson id.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const payload = token
          ? await fetchPlayerLessonById({ token, lessonId: id, signal })
          : await fetchPublicLessonById({ lessonId: id, signal });
        const normalized = normalizeLesson(payload);
        if (!normalized) {
          setLesson(null);
          setError("Lesson not found.");
          return;
        }
        setLesson(normalized);
      } catch (err) {
        const aborted =
          (err as { name?: string })?.name === "AbortError" ||
          (err instanceof Error && /aborted|aborterror/i.test(err.message));
        if (aborted) {
          return;
        }
        const errorWithData = err as Error & { status?: number; data?: { detail?: string; error?: string } };
        const detail = errorWithData.data?.detail ?? errorWithData.data?.error;
        if (!token && (detail === "not_public_lesson" || errorWithData.status === 401 || errorWithData.status === 403)) {
          promptSignIn();
          return;
        }
        const message =
          detail === "lesson_not_found"
            ? "Lesson not found."
            : err instanceof Error
              ? err.message
              : "Unable to load lesson details.";
        setLesson(null);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [id, promptSignIn, token],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void loadLesson(controller.signal);

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadLesson]);

  useEffect(() => {
    if (!isSignedIn || !lesson || !isGroupLessonType(lesson)) {
      return;
    }

    navigate(`/group-lessons/${lesson.id}`, { replace: true });
  }, [isSignedIn, lesson, navigate]);

  const lessonStatus = useMemo(() => parseLessonStatus(lesson), [lesson]);
  const isPaymentPending = lessonStatus === 0;
  const isConfirmed = lessonStatus === 1;
  const isCancelled = lessonStatus === 2;
  const lessonRecord = lesson as Record<string, unknown> | null;
  const coachId = useMemo(
    () => parseNumber(lessonRecord?.coach_id ?? lessonRecord?.coachId),
    [lessonRecord],
  );
  const playerId = useMemo(
    () => parseNumber(lessonRecord?.player_id ?? lessonRecord?.playerId),
    [lessonRecord],
  );
  const createdBy = useMemo(
    () => parseNumber(lessonRecord?.created_by ?? lessonRecord?.createdBy),
    [lessonRecord],
  );
  const isAwaitingCoachConfirmation =
    isPaymentPending && playerId != null && createdBy != null && String(playerId) === String(createdBy);
  const requiresPlayerAcceptance = isPaymentPending && !isAwaitingCoachConfirmation;
  const coachPhone = useMemo(() => getCoachPhoneNumber(coachProfile), [coachProfile]);
  const lessonTitle = useMemo(() => getLessonTitle(lesson), [lesson]);
  const lessonDescription = useMemo(() => getLessonDescription(lesson), [lesson]);
  const lessonTypeLabel = useMemo(() => getLessonTypeLabel(lesson), [lesson]);
  const lessonTypeVariantLabel = useMemo(() => getLessonTypeVariantLabel(lesson), [lesson]);
  const lessonLevelLabel = useMemo(() => getLessonLevelLabel(lesson), [lesson]);
  const lessonDateBadgeLabel = useMemo(() => getLessonDateBadgeLabel(lesson), [lesson]);
  const lessonDateLabel = useMemo(() => formatDateLabel(lesson?.start_date_time), [lesson]);
  const lessonTimeRange = useMemo(
    () => formatTimeRangeLabel(lesson?.start_date_time, lesson?.end_date_time),
    [lesson],
  );
  const lessonDurationMinutes = useMemo(() => getLessonDurationMinutes(lesson), [lesson]);
  const coachName = useMemo(
    () => getCoachProfileName(coachProfile) ?? getCoachName(lesson),
    [coachProfile, lesson],
  );
  const coachAvatarUrl = useMemo(
    () => getCoachProfileAvatarUrl(coachProfile) ?? getCoachAvatarUrl(lesson),
    [coachProfile, lesson],
  );
  const locationTitle = useMemo(() => getLocationTitle(lesson), [lesson]);
  const lessonCapacity = useMemo(() => getLessonCapacityDetails(lesson), [lesson]);
  const lessonFormatSummary = useMemo(() => getLessonFormatSummary(lesson), [lesson]);
  const coachAboutCopy = useMemo(() => {
    if (!coachProfile) return lessonFormatSummary;
    const record = coachProfile as CoachProfileRecord & {
      about?: string;
      bio?: string;
      summary?: string;
      title?: string;
      headlineBadge?: string;
    };
    return record.about || record.bio || record.summary || lessonFormatSummary;
  }, [coachProfile, lessonFormatSummary]);
  const coachTitle = useMemo(() => {
    const record = coachProfile as (CoachProfileRecord & { title?: string; headlineBadge?: string }) | null;
    return record?.title || record?.headlineBadge || "Tennis Coach";
  }, [coachProfile]);
  const googleCalendarHref = useMemo(
    () => buildGoogleCalendarHref(lesson, lessonTitle, lessonDescription, locationTitle),
    [lesson, lessonDescription, lessonTitle, locationTitle],
  );
  const statusVariant = !isSignedIn ? "payment" : isCancelled ? "cancelled" : isConfirmed ? "confirmed" : isAwaitingCoachConfirmation ? "awaiting" : "payment";
  const statusTitle = !isSignedIn
    ? "Sign in to book"
    : isConfirmed
    ? "Lesson confirmed"
    : isCancelled
      ? "Lesson cancelled"
    : isAwaitingCoachConfirmation
      ? "Awaiting coach confirmation"
      : "Payment pending";
  const statusBody = !isSignedIn
    ? "View the class details now. Sign in when you're ready to reserve a spot."
    : isConfirmed
    ? `${coachName} has confirmed your session. You’re set for ${lessonDateLabel} at ${lessonTimeRange.split(" · ")[0]}.`
    : isCancelled
      ? "This lesson has been cancelled. Contact your coach if you need help rebooking."
    : isAwaitingCoachConfirmation
      ? `${coachName} still needs to confirm this lesson. You’ll be notified as soon as they do.`
      : "Accept and pay to lock this lesson in.";
  const sidebarStatusLabel = !isSignedIn
    ? "Sign in required"
    : isConfirmed
    ? "Booked"
    : isCancelled
      ? "Cancelled"
    : isAwaitingCoachConfirmation
      ? "Pending coach"
      : "Needs payment";
  const sessionMetaChips = [
    lessonDateBadgeLabel,
    lessonLevelLabel,
    lessonTypeVariantLabel,
  ].filter(Boolean) as string[];
  const eligibleCredits = useMemo(
    () => credits.filter((purchase) => isCreditEligibleForLesson(purchase, lesson)),
    [credits, lesson],
  );
  const hasEligibleCredits = eligibleCredits.length > 0;
  const shouldUseGroupCredits = Boolean(isSignedIn && lesson && isGroupLessonType(lesson) && hasEligibleCredits);
  const creditLessonType = useMemo(() => resolveLessonTypeForCredits(lesson), [lesson]);
  const packageOptions = useMemo(() => {
    return packages
      .filter((pkg) => {
        if (!pkg.lesson_count || pkg.lesson_count <= 0) return false;
        return packageAllowsLessonCreditType(pkg.lesson_types_allowed, creditLessonType);
      })
      .sort((a, b) => a.lesson_count - b.lesson_count);
  }, [creditLessonType, packages]);
  const bestValuePackage = packageOptions.reduce<CoachPackage | null>((best, pkg) => {
    const total = parseMoney(pkg.total_price);
    const bestTotal = best ? parseMoney(best.total_price) : null;
    if (total == null) return best;
    if (!best || bestTotal == null) return pkg;
    return total / pkg.lesson_count < bestTotal / best.lesson_count ? pkg : best;
  }, null);
  const selectedPackage =
    packageOptions.find((pkg) => String(pkg.id) === selectedPackageId) ??
    bestValuePackage ??
    packageOptions[0] ??
    null;
  const selectedPackagePrice = selectedPackage ? parseMoney(selectedPackage.total_price) : null;
  const totalDueCents = useMemo(() => {
    if (!lessonPriceBreakdown) return lessonTotalAmountCents;
    const amount =
      paymentChoice === "credits"
        ? lessonPriceBreakdown.coachFee + lessonPriceBreakdown.serviceFee
        : lessonPriceBreakdown.coachFee + lessonPriceBreakdown.creditFee + lessonPriceBreakdown.serviceFee;
    return Math.round(amount * 100);
  }, [lessonPriceBreakdown, lessonTotalAmountCents, paymentChoice]);

  useEffect(() => {
    if (selectedPackageId || packageOptions.length === 0) return;
    const defaultPackage = bestValuePackage ?? packageOptions[0];
    setSelectedPackageId(String(defaultPackage.id));
  }, [bestValuePackage, packageOptions, selectedPackageId]);

  useEffect(() => {
    if (!token || !coachId) return;
    const controller = new AbortController();
    void fetchCoachProfile(coachId, { token, signal: controller.signal })
      .then((profile) => {
        setCoachProfile(profile);
      })
      .catch((err) => {
        const aborted =
          (err as { name?: string })?.name === "AbortError" ||
          (err instanceof Error && /aborted|aborterror/i.test(err.message));
        if (!aborted) {
          setCoachProfile(null);
        }
      });
    return () => controller.abort();
  }, [coachId, token]);

  const refreshCredits = useCallback(async (preferredPurchaseId?: number | string) => {
    if (!token || !coachId || !lesson) return;
    const creditsResponse = await fetchPackageCredits({
      token,
      coachId,
      includeExpired: false,
    });
    const eligible = (creditsResponse.purchases ?? []).filter(
      (purchase) => purchase.id != null && isCreditEligibleForLesson(purchase, lesson),
    );
    setCredits(eligible);
    const preferredCredit = preferredPurchaseId
      ? eligible.find((purchase) => String(purchase.id) === String(preferredPurchaseId))
      : null;
    setSelectedCreditId(preferredCredit?.id != null ? String(preferredCredit.id) : eligible.length ? String(eligible[0].id) : null);
    if (eligible.length) {
      setPaymentChoice("credits");
    }
  }, [coachId, lesson, token]);

  useEffect(() => {
    if (!token || !lesson || !requiresPlayerAcceptance) return;
    const coachId = parseNumber((lesson as Record<string, unknown>).coach_id);
    if (!coachId) return;
    let cancelled = false;
    const run = async () => {
      setPaymentMethodsLoading(true);
      setPaymentMethodsError(null);
      try {
        const methodsPayload = await getPlayerStripePaymentMethods(token);
        if (cancelled) return;
        const methods = extractPaymentMethods(methodsPayload as Record<string, unknown>);
        setPaymentMethods(methods);
        const defaultId =
          (!Array.isArray(methodsPayload) && methodsPayload
            ? (methodsPayload.default_payment_method_id as string | undefined) ??
              (methodsPayload.default_payment_method as string | undefined)
            : undefined) ??
          methods.find((method) => method.is_default || method.default || method.default_for_currency)?.id ??
          methods[0]?.id ??
          null;
        setSelectedPaymentMethodId(defaultId);
      } catch (err) {
        if (cancelled) return;
        setPaymentMethods([]);
        setPaymentMethodsError(err instanceof Error ? err.message : "Unable to load payment methods.");
      } finally {
        if (!cancelled) setPaymentMethodsLoading(false);
      }
      setCreditsLoading(true);
      setCreditsError(null);
      try {
        const creditsResponse = await fetchPackageCredits({
          token,
          coachId,
          includeExpired: false,
        });
        if (cancelled) return;
        const eligible = (creditsResponse.purchases ?? []).filter(
          (purchase) => purchase.id != null && isCreditEligibleForLesson(purchase, lesson),
        );
        setCredits(eligible);
        setSelectedCreditId(eligible.length ? String(eligible[0].id) : null);
        if (eligible.length) {
          setPaymentChoice("credits");
        }
      } catch (err) {
        if (cancelled) return;
        setCredits([]);
        setCreditsError(err instanceof Error ? err.message : "Unable to load credits.");
      } finally {
        if (!cancelled) setCreditsLoading(false);
      }
      setPackagesLoading(true);
      setPackagesError(null);
      try {
        const packageResponse = await fetchCoachPackages({
          token,
          coachId,
        });
        if (cancelled) return;
        setPackages((packageResponse.packages ?? []).filter((pkg) => pkg.is_active !== false));
      } catch (err) {
        if (cancelled) return;
        setPackages([]);
        setPackagesError(err instanceof Error ? err.message : "Unable to load packages.");
      } finally {
        if (!cancelled) setPackagesLoading(false);
      }
      setSetupIntentLoading(true);
      setSetupIntentError(null);
      try {
        const setupIntent = await getPlayerStripeSetupIntent(token);
        if (cancelled) return;
        setSetupIntentSecret(setupIntent.client_secret ?? null);
      } catch (err) {
        if (cancelled) return;
        setSetupIntentSecret(null);
        setSetupIntentError(err instanceof Error ? err.message : "Unable to load card setup.");
      } finally {
        if (!cancelled) setSetupIntentLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [lesson, requiresPlayerAcceptance, token]);

  useEffect(() => {
    let cancelled = false;
    setIsApplePayReady(false);
    setApplePayRequest(null);
    if (!isSignedIn || !requiresPlayerAcceptance || !stripePromise || !lessonTotalAmountCents || lessonTotalAmountCents <= 0) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const stripe = await stripePromise;
      if (!stripe || cancelled) return;
      const request = stripe.paymentRequest({
        country: "US",
        currency: "usd",
        total: {
          label: "The Tennis Plan",
          amount: lessonTotalAmountCents,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });
      const canPay = await request.canMakePayment();
      if (!cancelled && canPay?.applePay) {
        setIsApplePayReady(true);
        setApplePayRequest(request);
      }
    })().catch(() => {
      if (!cancelled) {
        setIsApplePayReady(false);
        setApplePayRequest(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, lessonTotalAmountCents, requiresPlayerAcceptance]);

  const handleCardAdded = useCallback(async () => {
    if (!token) return;
    try {
      const methodsPayload = await getPlayerStripePaymentMethods(token);
      const methods = extractPaymentMethods(methodsPayload as Record<string, unknown>);
      setPaymentMethods(methods);
      if (!selectedPaymentMethodId && methods[0]?.id) {
        setSelectedPaymentMethodId(methods[0].id);
      }
    } catch {
      // ignore refresh errors
    }
  }, [selectedPaymentMethodId, token]);

  const handleBuyPackageAndApply = useCallback(async () => {
    if (!token || !lesson || !coachId || !selectedPackage) return;
    setSubmitting(true);
    setPurchasingPackage(true);
    setActionError(null);
    setPackagePurchaseError(null);
    setActionSuccess(null);

    try {
      let paymentMethodId: string | null = null;
      let applePayEvent: PaymentRequestPaymentMethodEvent | null = null;

      if (paymentChoice === "apple-pay") {
        if (!stripePromise || selectedPackagePrice == null) {
          throw new Error("Apple Pay is not ready for package checkout.");
        }
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error("Stripe is unavailable.");
        }
        const packageRequest = stripe.paymentRequest({
          country: "US",
          currency: "usd",
          total: {
            label: selectedPackage.name || `${selectedPackage.lesson_count} lesson credits`,
            amount: Math.round(selectedPackagePrice * 100),
          },
          requestPayerName: true,
          requestPayerEmail: true,
        });
        const canPay = await packageRequest.canMakePayment();
        if (!canPay?.applePay) {
          throw new Error("Apple Pay is not available on this device.");
        }
        applePayEvent = await new Promise<PaymentRequestPaymentMethodEvent>((resolve, reject) => {
          const handlePayment = (event: PaymentRequestPaymentMethodEvent) => {
            packageRequest.off("cancel", handleCancel);
            resolve(event);
          };
          const handleCancel = () => {
            packageRequest.off("paymentmethod", handlePayment);
            reject(new Error("Apple Pay was cancelled."));
          };
          packageRequest.once("paymentmethod", handlePayment);
          packageRequest.once("cancel", handleCancel);
          try {
            packageRequest.show();
          } catch (error) {
            packageRequest.off("paymentmethod", handlePayment);
            packageRequest.off("cancel", handleCancel);
            reject(error);
          }
        });
        paymentMethodId = applePayEvent.paymentMethod.id;
      } else {
        paymentMethodId = selectedPaymentMethodId;
      }

      if (!paymentMethodId) {
        throw new Error("Select Apple Pay or a saved card to buy credits.");
      }

      const purchaseResponse = await purchaseCoachPackage({
        token,
        packageId: selectedPackage.id,
        paymentMethodId,
      });
      applePayEvent?.complete("success");
      await consumePackageCredits({
        token,
        coachId,
        lessonType: creditLessonType,
        lessonId: lesson.id,
        purchaseId: purchaseResponse.purchase?.id,
      });
      await updatePlayerLesson({
        token,
        lessonId: lesson.id,
        status: "CONFIRMED",
      });
      const boughtPurchaseId = purchaseResponse.purchase?.id;
      setCreditsPackageOpen(false);
      setPaymentChoice("credits");
      if (boughtPurchaseId != null) {
        setSelectedCreditId(String(boughtPurchaseId));
      }
      await Promise.all([refreshCredits(boughtPurchaseId), loadLesson()]);
      setActionSuccess("Lesson accepted successfully.");
    } catch (err) {
      setPackagePurchaseError(err instanceof Error ? err.message : "Unable to buy and apply credits.");
    } finally {
      setPurchasingPackage(false);
      setSubmitting(false);
    }
  }, [
    coachId,
    creditLessonType,
    lesson,
    loadLesson,
    paymentChoice,
    refreshCredits,
    selectedPackage,
    selectedPackagePrice,
    selectedPaymentMethodId,
    token,
  ]);

  const handleAcceptAndPay = useCallback(async () => {
    if (!token) {
      promptSignIn();
      return;
    }
    if (!lesson) return;
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      if (paymentChoice === "apple-pay") {
        if (!applePayRequest || !isApplePayReady) {
          throw new Error("Apple Pay is not available on this device.");
        }
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error("Stripe is unavailable.");
        }
        await new Promise<void>((resolve, reject) => {
          const request = applePayRequest;
          const handlePaymentMethod = async (event: PaymentRequestPaymentMethodEvent) => {
            try {
              if (isGroupLessonType(lesson)) {
                await bookGroupLessonWithCard({
                  token,
                  lessonId: lesson.id,
                  paymentMethodId: event.paymentMethod.id,
                });
                event.complete("success");
                resolve();
                return;
              }
              const intentResponse = await createPlayerStripePaymentIntent({
                token,
                lessonId: lesson.id,
                paymentMethodId: event.paymentMethod.id,
              });
              const intentRecord = intentResponse as Record<string, unknown>;
              const intentStatus = extractIntentStatus(intentRecord);
              if (intentStatus === "succeeded") {
                event.complete("success");
                resolve();
                return;
              }
              const nestedIntent = intentRecord?.payment_intent as Record<string, unknown> | undefined;
              const clientSecret =
                (intentRecord?.client_secret as string | undefined) ??
                (nestedIntent?.client_secret as string | undefined);
              if (!clientSecret) {
                throw new Error("Unable to initialize payment.");
              }
              const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
                clientSecret,
                { payment_method: event.paymentMethod.id },
                { handleActions: false },
              );
              if (confirmError) {
                throw new Error(confirmError.message || "Apple Pay failed.");
              }
              const paymentStatus = paymentIntent?.status?.toLowerCase();
              if (paymentStatus === "requires_action") {
                const { error: actionError, paymentIntent: actionIntent } = await stripe.confirmCardPayment(clientSecret);
                if (actionError) {
                  throw new Error(actionError.message || "Apple Pay failed.");
                }
                const actionStatus = actionIntent?.status?.toLowerCase();
                if (actionStatus && actionStatus !== "succeeded") {
                  throw new Error("Payment was not successful.");
                }
              } else if (paymentStatus && paymentStatus !== "succeeded") {
                throw new Error("Payment was not successful.");
              }
              event.complete("success");
              resolve();
            } catch (error) {
              event.complete("fail");
              reject(error);
            } finally {
              request.off("paymentmethod", handlePaymentMethod);
              request.off("cancel", handleCancel);
            }
          };
          const handleCancel = () => {
            request.off("paymentmethod", handlePaymentMethod);
            request.off("cancel", handleCancel);
            reject(new Error("Apple Pay was cancelled."));
          };
          request.on("paymentmethod", handlePaymentMethod);
          request.on("cancel", handleCancel);
          request.show().catch((error) => {
            request.off("paymentmethod", handlePaymentMethod);
            request.off("cancel", handleCancel);
            reject(error);
          });
        });
      } else if (paymentChoice === "credits") {
        const coachId = parseNumber((lesson as Record<string, unknown>).coach_id);
        if (!coachId) throw new Error("Missing coach details for this lesson.");
        if (!selectedCreditId) throw new Error("Select a credit package to continue.");
        await consumePackageCredits({
          token,
          coachId,
          lessonType: resolveLessonTypeForCredits(lesson),
          lessonId: lesson.id,
          purchaseId: selectedCreditId,
        });
        await updatePlayerLesson({
          token,
          lessonId: lesson.id,
          status: "CONFIRMED",
        });
      } else {
        if (!selectedPaymentMethodId) {
          throw new Error("Select a payment method to continue.");
        }
        if (isGroupLessonType(lesson)) {
          await bookGroupLessonWithCard({
            token,
            lessonId: lesson.id,
            paymentMethodId: selectedPaymentMethodId,
          });
        } else {
          if (!stripePromise) {
            throw new Error("Stripe is not configured in this environment.");
          }
          const intentResponse = await createPlayerStripePaymentIntent({
            token,
            lessonId: lesson.id,
            paymentMethodId: selectedPaymentMethodId,
          });
          const intentRecord = intentResponse as Record<string, unknown>;
          const intentStatusFromApi = extractIntentStatus(intentRecord);
          if (intentStatusFromApi === "succeeded") {
            await loadLesson();
            setActionSuccess("Lesson accepted successfully.");
            return;
          }
          const nestedIntent = intentRecord?.payment_intent as Record<string, unknown> | undefined;
          const clientSecret =
            (intentRecord?.client_secret as string | undefined) ??
            (nestedIntent?.client_secret as string | undefined);
          if (!clientSecret) {
            throw new Error("Unable to initialize payment.");
          }
          const stripe = await stripePromise;
          if (!stripe) throw new Error("Stripe is unavailable.");
          const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: selectedPaymentMethodId,
          });
          if (stripeError) {
            throw new Error(stripeError.message || "Card payment failed.");
          }
          const intentStatus = paymentIntent?.status?.toLowerCase();
          if (intentStatus && intentStatus !== "succeeded") {
            throw new Error("Payment was not successful.");
          }
        }
      }
      await loadLesson();
      setActionSuccess("Lesson accepted successfully.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to accept lesson.");
    } finally {
      setSubmitting(false);
    }
  }, [
    applePayRequest,
    isApplePayReady,
    lesson,
    loadLesson,
    paymentChoice,
    promptSignIn,
    selectedCreditId,
    selectedPaymentMethodId,
    token,
  ]);

  const handleMessageCoach = useCallback(async () => {
    if (!token) {
      promptSignIn();
      return;
    }
    if (!coachId || !lesson) return;
    setMessageLoading(true);
    setMessageError(null);
    try {
      const profile = coachProfile ?? (await fetchCoachProfile(coachId, { token }));
      if (!coachProfile) {
        setCoachProfile(profile);
      }
      const phone = getCoachPhoneNumber(profile);
      if (!phone) {
        throw new Error("Coach phone number is not available.");
      }
      const message = `Hi ${coachName}, I have a question about our ${getLessonTypeLabel(lesson).toLowerCase()} on ${formatDateLabel(lesson.start_date_time)}.`;
      const href = buildSmsHref(phone, message);
      if (!href) {
        throw new Error("Coach phone number is not available.");
      }
      window.location.href = href;
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Unable to open messages.");
    } finally {
      setMessageLoading(false);
    }
  }, [coachId, coachName, coachProfile, lesson, promptSignIn, token]);

  const handleShare = useCallback(async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    if (!shareUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: lessonTitle,
          text: `View ${lessonTitle} with ${coachName}`,
          url: shareUrl,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // ignore clipboard failures
    }
  }, [coachName, lessonTitle]);

  return (
    <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
      <div className="player-lesson-details">
        {loading ? (
          <div className="player-lesson-details__empty" role="status">
            Loading lesson details…
          </div>
        ) : error ? (
          <div className="player-lesson-details__empty player-lesson-details__empty--error" role="alert">
            <AlertCircle size={18} aria-hidden />
            <span>{error}</span>
          </div>
        ) : !lesson ? (
          <div className="player-lesson-details__empty" role="status">
            Lesson not found.
          </div>
        ) : (
          <div className="player-lesson-details__shell">
            <div className="player-lesson-details__topbar">
              {isSignedIn ? (
                <button
                  type="button"
                  className="player-lesson-details__back-link"
                  onClick={() => navigate("/player/calendar")}
                >
                  <ArrowLeft aria-hidden />
                  <span>Back to calendar</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="player-lesson-details__back-link"
                  onClick={promptSignIn}
                >
                  <ArrowLeft aria-hidden />
                  <span>Sign in</span>
                </button>
              )}
              <div className="player-lesson-details__topbar-title">Lesson details</div>
              <div className="player-lesson-details__topbar-actions">
                <button
                  type="button"
                  className="player-lesson-details__topbar-action"
                  onClick={() => void handleShare()}
                >
                  <Share2 aria-hidden />
                  <span>Share</span>
                </button>
              </div>
            </div>

            <div className="player-lesson-details__layout">
              <section className="player-lesson-details__content">
                <header className="player-lesson-details__hero">
                  <div className="player-lesson-details__badge-row">
                    {sessionMetaChips.map((chip) => (
                      <span
                        key={chip}
                        className={`player-lesson-details__hero-badge${
                          chip === lessonDateBadgeLabel ? " player-lesson-details__hero-badge--primary" : ""
                        }`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                  <div className="player-lesson-details__hero-body">
                    <h1 className="player-lesson-details__hero-title">{lessonTitle}</h1>
                    <p className="player-lesson-details__hero-copy">{lessonDescription}</p>
                    <div className="player-lesson-details__hero-meta">
                      <div className="player-lesson-details__hero-meta-item">
                        <Clock aria-hidden />
                        <span>{lessonTimeRange}</span>
                      </div>
                      <div className="player-lesson-details__hero-meta-item">
                        <MapPin aria-hidden />
                        <span>{locationTitle}</span>
                      </div>
                      <div className="player-lesson-details__hero-meta-item">
                        <UserRound aria-hidden />
                        <span>{lessonTypeLabel}</span>
                      </div>
                      {lessonCapacity ? (
                        <div className="player-lesson-details__hero-meta-item player-lesson-details__hero-meta-item--capacity">
                          <Users aria-hidden />
                          <span>
                            {lessonCapacity.limit === 1
                              ? "1 player session"
                              : `${lessonCapacity.booked} of ${lessonCapacity.limit} spots booked`}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </header>

                <section className={`player-lesson-details__status-banner player-lesson-details__status-banner--${statusVariant}`}>
                  <div className="player-lesson-details__status-banner-icon" aria-hidden>
                    {isConfirmed ? <CheckCircle2 size={20} /> : isCancelled ? <AlertCircle size={20} /> : isAwaitingCoachConfirmation ? <Hourglass size={20} /> : <CreditCard size={20} />}
                  </div>
                  <div className="player-lesson-details__status-banner-copy">
                    <strong>{statusTitle}</strong>
                    <span>{statusBody}</span>
                  </div>
                </section>

                <section className="player-lesson-details__section">
                  <h2 className="player-lesson-details__section-label">
                    {lessonCapacity && lessonCapacity.limit > 1 ? "Who's joining" : "Session format"}
                  </h2>
                  <div className="player-lesson-details__card">
                    <div className="player-lesson-details__card-block">
                      <h3 className="player-lesson-details__card-title">
                        {lessonCapacity && lessonCapacity.limit > 1
                          ? `${lessonCapacity.booked} of ${lessonCapacity.limit} player${lessonCapacity.limit === 1 ? "" : "s"} booked`
                          : lessonTypeVariantLabel}
                      </h3>
                      <p className="player-lesson-details__card-copy">
                        {lessonCapacity && lessonCapacity.limit > 1
                          ? lessonCapacity.remaining > 0
                            ? `${lessonCapacity.remaining} spot${lessonCapacity.remaining === 1 ? "" : "s"} still open for this session.`
                            : "This session is currently full."
                          : lessonFormatSummary}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="player-lesson-details__section">
                  <h2 className="player-lesson-details__section-label">Location</h2>
                  <div className="player-lesson-details__card">
                    <h3 className="player-lesson-details__card-title">{locationTitle}</h3>
                    <ul className="player-lesson-details__location-list">
                      <li>{lessonDateLabel}</li>
                      <li>{lessonTimeRange.split(" · ")[0]}</li>
                      {lessonDurationMinutes > 0 ? <li>{lessonDurationMinutes} min session</li> : null}
                    </ul>
                    <a
                      className="player-lesson-details__secondary-action"
                      href={`https://maps.google.com/?q=${encodeURIComponent(locationTitle)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get directions
                    </a>
                  </div>
                </section>

                <section className="player-lesson-details__section">
                  <h2 className="player-lesson-details__section-label">Your coach</h2>
                  <div className="player-lesson-details__card">
                    <div className="player-lesson-details__coach-panel">
                      {coachAvatarUrl ? (
                        <img className="player-lesson-details__coach-avatar" src={coachAvatarUrl} alt="" />
                      ) : (
                        <span className="player-lesson-details__coach-avatar player-lesson-details__coach-avatar--placeholder" aria-hidden>
                          {getInitials(coachName)}
                        </span>
                      )}
                      <div className="player-lesson-details__coach-meta">
                        <p className="player-lesson-details__coach-name">{coachName}</p>
                        <div className="player-lesson-details__coach-cert-list">
                          <span className="player-lesson-details__coach-cert">{coachTitle}</span>
                          <span className="player-lesson-details__coach-cert">{lessonTypeVariantLabel}</span>
                        </div>
                      </div>
                    </div>
                    <p className="player-lesson-details__card-copy">{coachAboutCopy}</p>
                    {coachId && isSignedIn ? (
                      <Link to={`/coaches/${coachId}`} className="player-lesson-details__coach-link">
                        View full profile →
                      </Link>
                    ) : null}
                  </div>
                </section>
              </section>

              <aside className="player-lesson-details__sidebar">
                <div className="player-lesson-details__booking-card">
                  <p className="player-lesson-details__booking-eyebrow">
                    {requiresPlayerAcceptance ? "Confirm this session" : "Your booking"}
                  </p>
                  <div className="player-lesson-details__booking-price">
                    {totalDueCents != null
                      ? `$${(totalDueCents / 100).toFixed(2)}`
                      : isCancelled
                        ? "Cancelled"
                      : isConfirmed
                        ? "Paid"
                        : "Pending"}
                  </div>
                  <p className="player-lesson-details__booking-subcopy">
                    {lessonTypeVariantLabel}
                  </p>

                  <div className="player-lesson-details__booking-list">
                    <div>
                      <CalendarDays aria-hidden />
                      <span>{lessonDateLabel}</span>
                    </div>
                    <div>
                      <Clock aria-hidden />
                      <span>{lessonTimeRange}</span>
                    </div>
                    <div>
                      <MapPin aria-hidden />
                      <span>{locationTitle}</span>
                    </div>
                    <div>
                      <UserRound aria-hidden />
                      <span>with {coachName}</span>
                    </div>
                  </div>

                  <div className={`player-lesson-details__booking-pill player-lesson-details__booking-pill--${statusVariant}`}>
                    {sidebarStatusLabel}
                  </div>

                  {lessonPriceBreakdown ? (
                    <div className="player-lesson-details__price-breakdown">
                      <div><span>Coach fee</span><strong>${lessonPriceBreakdown.coachFee.toFixed(2)}</strong></div>
                      {paymentChoice !== "credits" ? (
                        <div><span>Credit fee</span><strong>${lessonPriceBreakdown.creditFee.toFixed(2)}</strong></div>
                      ) : null}
                      <div><span>Service fee</span><strong>${lessonPriceBreakdown.serviceFee.toFixed(2)}</strong></div>
                    </div>
                  ) : null}

                  {isAwaitingCoachConfirmation ? (
                    <div className="player-lesson-details__info-card player-lesson-details__info-card--next">
                      <p className="player-lesson-details__info-title">What happens next</p>
                      <div className="player-lesson-details__steps">
                        <div className="player-lesson-details__step">
                          <span className="player-lesson-details__step-number">1</span>
                          <span>A confirmation email has been sent to your inbox</span>
                        </div>
                        <div className="player-lesson-details__step">
                          <span className="player-lesson-details__step-number">2</span>
                          <span>{coachName} will confirm this lesson soon</span>
                        </div>
                        <div className="player-lesson-details__step">
                          <span className="player-lesson-details__step-number">3</span>
                          <span>Your card won&apos;t be charged until {coachName} confirms</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isConfirmed ? (
                    <div className="player-lesson-details__info-inline">
                      <Info size={16} aria-hidden />
                      <p>Cancel at least 24 hours before your lesson for a full refund. Cancellations within 24 hours are non-refundable.</p>
                    </div>
                  ) : null}

                  {!isSignedIn ? (
                    <button
                      type="button"
                      className="player-lesson-details__primary-action"
                      onClick={promptSignIn}
                    >
                      Sign in to book
                    </button>
                  ) : requiresPlayerAcceptance ? (
                    <div className="player-lesson-details__payment-panel">
                      <p className="player-lesson-details__status-pending">
                        Choose how you want to pay.
                      </p>

                      <div className="player-lesson-details__payment-choice">
                        {hasEligibleCredits ? (
                          <label className={`player-lesson-details__payment-option${paymentChoice === "credits" ? " is-selected" : ""}`}>
                            <input
                              type="radio"
                              name="payment-choice"
                              checked={paymentChoice === "credits"}
                              onChange={() => setPaymentChoice("credits")}
                              disabled={!selectedCreditId}
                            />
                            <span>🎟️</span>
                            <span>{eligibleCredits.reduce((sum, credit) => sum + Number(credit.credits_remaining ?? 0), 0)} {creditLessonType} credits available</span>
                          </label>
                        ) : (
                          <div className={`player-lesson-details__credits-package${creditsPackageOpen ? " is-open" : ""}`}>
                            <button
                              type="button"
                              className="player-lesson-details__credits-package-toggle"
                              onClick={() => setCreditsPackageOpen((open) => !open)}
                            >
                              <span>🎟️</span>
                              <span>
                                <strong>Buy a lesson package</strong>
                                <small>Save up to 20% · pay with credits</small>
                              </span>
                              <ChevronDown aria-hidden size={18} />
                            </button>
                            {creditsPackageOpen ? (
                              <div className="player-lesson-details__credits-package-panel">
                                <p>Buy sessions now — one credit covers this lesson, the rest are yours to use any time.</p>
                                {packagesLoading ? <p>Loading packages…</p> : null}
                                {packagesError ? <p className="player-lesson-details__status-error">{packagesError}</p> : null}
                                {!packagesLoading && !packagesError && !packageOptions.length ? <p>No lesson packages are available right now.</p> : null}
                                {packageOptions.map((lessonPackage) => {
                                  const total = parseMoney(lessonPackage.total_price);
                                  const perSession = total != null ? total / lessonPackage.lesson_count : null;
                                  const savings =
                                    lessonPriceBreakdown && total != null
                                      ? Math.max(lessonPriceBreakdown.coachFee * lessonPackage.lesson_count - total, 0)
                                      : 0;
                                  const isSelectedPackage = selectedPackage?.id === lessonPackage.id;
                                  const isBestValue = bestValuePackage?.id === lessonPackage.id;
                                  const title = lessonPackage.name || `${lessonPackage.lesson_count} lesson package`;
                                  const description = lessonPackage.description?.trim();
                                  return (
                                    <button
                                      type="button"
                                      key={lessonPackage.id}
                                      className={`player-lesson-details__package-tier${isSelectedPackage ? " is-selected" : ""}`}
                                      onClick={() => setSelectedPackageId(String(lessonPackage.id))}
                                    >
                                      <span>
                                        <strong>
                                          {title}
                                          {isBestValue ? <em>Best value</em> : null}
                                        </strong>
                                        {description ? <small>{description}</small> : null}
                                        <small>
                                          {lessonPackage.lesson_count} credits ·{" "}
                                          {perSession != null ? `${formatMoney(perSession)}/credit` : formatPackageLessonTypes(lessonPackage.lesson_types_allowed)}
                                        </small>
                                        <small>
                                          {formatPackageValidity(lessonPackage.validity_months)} · {formatPackageLessonTypes(lessonPackage.lesson_types_allowed)}
                                        </small>
                                      </span>
                                      <span>
                                        <strong>{formatMoney(lessonPackage.total_price)}</strong>
                                        {savings > 0 ? <small>Save {formatMoney(savings)}</small> : null}
                                      </span>
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  className="player-lesson-details__buy-package"
                                  onClick={() => void handleBuyPackageAndApply()}
                                  disabled={!selectedPackage || submitting || purchasingPackage}
                                  aria-busy={purchasingPackage}
                                >
                                  {purchasingPackage ? "Buying package..." : "Buy with credit card"}
                                </button>
                                {packagePurchaseError ? <p className="player-lesson-details__status-error">{packagePurchaseError}</p> : null}
                              </div>
                            ) : null}
                          </div>
                        )}
                        <label className={`player-lesson-details__payment-option${paymentChoice === "apple-pay" ? " is-selected" : ""}`}>
                          <input
                            type="radio"
                            name="payment-choice"
                            checked={paymentChoice === "apple-pay"}
                            onChange={() => setPaymentChoice("apple-pay")}
                            disabled={!isApplePayReady}
                          />
                          Apple Pay
                        </label>
                        <label className={`player-lesson-details__payment-option${paymentChoice === "card" ? " is-selected" : ""}`}>
                          <input
                            type="radio"
                            name="payment-choice"
                            checked={paymentChoice === "card"}
                            onChange={() => setPaymentChoice("card")}
                          />
                          Card
                        </label>
                      </div>

                      {creditsLoading ? <p>Loading credits…</p> : null}
                      {creditsError ? <p className="player-lesson-details__status-error">{creditsError}</p> : null}

                      {paymentChoice === "apple-pay" ? (
                        <div className="player-lesson-details__payment-block">
                          <p>
                            {isApplePayReady
                              ? "Pay instantly with Apple Pay."
                              : "Apple Pay is not available on this device/browser."}
                          </p>
                        </div>
                      ) : (
                        <div className="player-lesson-details__payment-block">
                          {paymentMethodsLoading ? <p>Loading cards…</p> : null}
                          {paymentMethodsError ? <p className="player-lesson-details__status-error">{paymentMethodsError}</p> : null}
                          {paymentMethods.length > 0 ? (
                            <select
                              value={selectedPaymentMethodId ?? ""}
                              onChange={(event) => setSelectedPaymentMethodId(event.target.value)}
                              disabled={submitting}
                            >
                              {paymentMethods.map((method) => {
                                const card = method.card;
                                const label = `${card?.brand ?? "Card"} •••• ${card?.last4 ?? ""}`;
                                return (
                                  <option key={method.id} value={method.id}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                          ) : null}
                          {setupIntentError ? <p className="player-lesson-details__status-error">{setupIntentError}</p> : null}
                          {paymentMethods.length === 0 && stripePromise && setupIntentSecret ? (
                            <Elements stripe={stripePromise} options={{ appearance: { theme: "stripe" } }} key={setupIntentSecret}>
                              <AddCardForm clientSecret={setupIntentSecret} onCardAdded={handleCardAdded} />
                            </Elements>
                          ) : null}
                          {setupIntentLoading ? <p>Preparing secure card form…</p> : null}
                        </div>
                      )}

                      {actionError ? <p className="player-lesson-details__status-error">{actionError}</p> : null}
                      {actionSuccess ? <p className="player-lesson-details__status-success">{actionSuccess}</p> : null}
                      <button
                        type="button"
                        className="player-lesson-details__primary-action"
                        onClick={() => void handleAcceptAndPay()}
                        disabled={
                          submitting ||
                          (paymentChoice === "card" && !selectedPaymentMethodId) ||
                          (paymentChoice === "credits" && !selectedCreditId) ||
                          (paymentChoice === "apple-pay" && !isApplePayReady)
                        }
                      >
                        {submitting
                          ? "Processing…"
                          : shouldUseGroupCredits || paymentChoice === "credits"
                            ? "Pay with credits"
                          : paymentChoice === "apple-pay"
                            ? "Accept with Apple Pay"
                            : "Accept lesson"}
                      </button>
                    </div>
                  ) : null}

                  {messageError ? <p className="player-lesson-details__status-error">{messageError}</p> : null}

                  <div className="player-lesson-details__sidebar-actions">
                    {googleCalendarHref ? (
                      <a
                        className="player-lesson-details__secondary-action player-lesson-details__secondary-action--button"
                        href={googleCalendarHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Add to calendar
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="player-lesson-details__secondary-action player-lesson-details__secondary-action--button"
                      onClick={() => void handleMessageCoach()}
                      disabled={messageLoading || !coachId || (isSignedIn && !coachPhone)}
                    >
                      {messageLoading ? "Opening messages…" : `Message ${coachName.split(" ")[0] ?? "coach"}`}
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default PlayerLessonDetailsPage;
