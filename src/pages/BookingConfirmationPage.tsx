import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Apple,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import {
  loadStripe,
  type PaymentRequest as StripePaymentRequest,
  type PaymentRequestPaymentMethodEvent,
  type Stripe,
} from "@stripe/stripe-js";
import moment from "moment";

import MainLayout from "../components/MainLayout";
import BookingStatusModal, { type BookingStatus } from "../components/booking/BookingStatusModal";
import AddCardForm from "../components/payments/AddCardForm";
import { findCoachProfile, type GroupParticipant } from "../data/mockCoachProfiles";
import { fetchCoachProfile, type CoachProfileRecord } from "../api/coachProfile";
import {
  fetchUpcomingGroupLessonById,
  mapUpcomingGroupLesson,
  type GroupLesson,
} from "../api/groupLessons";
import {
  fetchCoachPackages,
  fetchPackageCredits,
  fetchPackageCreditsBalance,
  purchaseCoachPackage,
  type CoachPackage,
  consumePackageCredits,
  type PackageCreditsBalanceResponse,
  type PackagePurchase,
} from "../api/playerPackages";
import {
  getPlayerStripePaymentMethods,
  getPlayerStripeSetupIntent,
  createPlayerStripePaymentIntent,
  type PlayerStripePaymentMethod,
  type PlayerStripePaymentMethodListResponse,
} from "../api/playerStripe";
import { bookGroupLessonWithCard, joinLesson } from "../api/playerLessons";
import { updatePlayerLesson } from "../api/player";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import {
  getGroupLessonCheckoutButtonLabel,
  isGroupLessonCheckoutDisabled,
} from "../utils/groupLessonCancellation";
import { packageAllowsLessonCreditType, resolveLessonCreditType } from "../utils/lessonPricing";

import "./BookingConfirmationPage.css";

type NormalizedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
};

type LocationState = {
  coachId?: number;
  dateId?: string;
  slotId?: string;
  groupLessonId?: string;
  lessonOrigin?: string;
  sourceLessonId?: number | string;
};

type PendingCreditConfirm = {
  lessonId: number | string;
};

const MINUTES_PER_DAY = 24 * 60;

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_STRIPE_PUBLISHABLEKEY ??
  "";

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const parseTimeToMinutes = (timeLabel: string) => {
  const match = timeLabel.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const [, hourPart, minutePart, periodRaw] = match;
  let hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const period = periodRaw.toUpperCase();
  hours %= 12;
  if (period === "PM") {
    hours += 12;
  }

  return hours * 60 + minutes;
};

const parseDurationToMinutes = (durationLabel: string) => {
  const match = durationLabel.match(/(\d+)\s*min/i);
  if (!match) {
    return null;
  }

  const [, durationPart] = match;
  const duration = Number.parseInt(durationPart, 10);
  return Number.isNaN(duration) ? null : duration;
};

const parsePriceToCents = (value?: string) => {
  if (!value) return null;
  if (/credit/i.test(value)) return null;
  const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100);
};

const parsePriceValue = (value?: string) => {
  if (!value) return null;
  if (/credit/i.test(value)) return null;
  const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const parseCurrencyValue = (value?: number | string | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }
  return null;
};

const formatMoney = (value?: number | string | null) => {
  const numeric = parseCurrencyValue(value);
  if (numeric == null) {
    return typeof value === "string" && value.trim() ? value : "--";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
  }).format(numeric);
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

const isGenericCoachName = (value?: string | null) => {
  if (!value) {
    return true;
  }
  return value.trim().toLowerCase() === "coach";
};

const extractIntentStatus = (response: Record<string, unknown>) => {
  const nestedIntent = response.payment_intent as Record<string, unknown> | undefined;
  const camelIntent = response.paymentIntent as Record<string, unknown> | undefined;
  const raw =
    response.status ??
    response.payment_intent_status ??
    nestedIntent?.status ??
    camelIntent?.status;
  return typeof raw === "string" ? raw.toLowerCase() : "";
};

const isGroupBookingResponseSuccessful = (response: unknown) => {
  if (!response || typeof response !== "object") {
    return false;
  }

  const record = response as Record<string, unknown>;
  if (extractIntentStatus(record) === "succeeded") {
    return true;
  }

  if (record.participant && typeof record.participant === "object") {
    return true;
  }

  if (record.lesson && typeof record.lesson === "object") {
    return true;
  }

  if (record.id || record.lesson_id) {
    return true;
  }

  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  return message.includes("booked successfully");
};

const formatLevelRange = (level: number) => {
  const upperBound = (level + 0.5).toFixed(1);
  return `${level.toFixed(1)} - ${upperBound}`;
};

const formatMinutesToTimeLabel = (totalMinutes: number) => {
  const minutesNormalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(minutesNormalized / 60);
  const minutes = minutesNormalized % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const buildTimeRangeLabel = (startLabel: string, durationLabel: string) => {
  const startMinutes = parseTimeToMinutes(startLabel);
  const durationMinutes = parseDurationToMinutes(durationLabel);

  if (startMinutes == null || durationMinutes == null) {
    return startLabel;
  }

  const endMinutes = startMinutes + durationMinutes;
  return `${formatMinutesToTimeLabel(startMinutes)} - ${formatMinutesToTimeLabel(endMinutes)}`;
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatExpiry = (month?: number, year?: number) => {
  if (!month || !year) return "Unknown";
  const monthString = month < 10 ? `0${month}` : `${month}`;
  const yearString = `${year}`.slice(-2);
  return `${monthString}/${yearString}`;
};

const normalizeBrand = (brand?: string) => {
  if (!brand) return "Card";
  const normalized = brand.trim();
  if (!normalized) return "Card";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const resolveDefaultId = (payload: PlayerStripePaymentMethodListResponse | PlayerStripePaymentMethod[] | null | undefined) => {
  if (!payload || Array.isArray(payload)) {
    return undefined;
  }
  return (
    payload.default_payment_method_id ||
    payload.default_payment_method ||
    (typeof payload["defaultPaymentMethodId"] === "string" ? (payload as Record<string, string>)["defaultPaymentMethodId"] : undefined)
  );
};

const extractPaymentMethods = (
  payload: PlayerStripePaymentMethodListResponse | PlayerStripePaymentMethod[] | null | undefined,
): PlayerStripePaymentMethod[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.payment_methods)) return payload.payment_methods;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray((payload as { paymentMethods?: PlayerStripePaymentMethod[] }).paymentMethods)) {
    return (payload as { paymentMethods?: PlayerStripePaymentMethod[] }).paymentMethods ?? [];
  }
  return [];
};

const toNormalizedPaymentMethod = (method: PlayerStripePaymentMethod, defaultId?: string): NormalizedPaymentMethod => {
  const card = method.card ?? (method as unknown as { card: PlayerStripePaymentMethod["card"] }).card;
  const expMonth = card?.exp_month ?? (method as unknown as { exp_month?: number }).exp_month;
  const expYear = card?.exp_year ?? (method as unknown as { exp_year?: number }).exp_year;
  const last4 = card?.last4 ?? (method as unknown as { last4?: string }).last4 ?? "";
  const brand = normalizeBrand(card?.brand ?? (method as unknown as { brand?: string }).brand);
  const isDefaultExplicit = Boolean(method.is_default ?? method.default ?? method.default_for_currency);
  const isDefault = isDefaultExplicit || (defaultId ? method.id === defaultId : false);

  return {
    id: method.id,
    brand,
    last4,
    expMonth,
    expYear,
    isDefault,
  };
};

const extractPlayerCapacity = (lessonDurationLabel?: string) => {
  if (!lessonDurationLabel) {
    return undefined;
  }

  const rangeMatch = lessonDurationLabel.match(/(\d+)\s*-\s*(\d+)\s*players?/i);
  if (rangeMatch) {
    const [, , maxPart] = rangeMatch;
    const maxPlayers = Number.parseInt(maxPart, 10);
    if (!Number.isNaN(maxPlayers)) {
      return maxPlayers;
    }
  }

  const singleMatch = lessonDurationLabel.match(/(\d+)\s*players?/i);
  if (singleMatch) {
    const [, countPart] = singleMatch;
    const players = Number.parseInt(countPart, 10);
    if (!Number.isNaN(players)) {
      return players;
    }
  }

  return undefined;
};

const dayNameMap: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const extractNumericLessonId = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const extractGroupClassOccurrenceId = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^group-class-\d+-\d{4}-\d{2}-\d{2}$/i.test(trimmed) ? trimmed : undefined;
};

const pickFirstValue = (record: Record<string, unknown> | undefined, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const getBookableGroupLessonId = (lesson: GroupLesson | null, fallbackId?: string | number) => {
  const sourceRecord =
    lesson?.sourceLesson && typeof lesson.sourceLesson === "object"
      ? (lesson.sourceLesson as Record<string, unknown>)
      : undefined;
  const materializedLessonId = pickFirstValue(sourceRecord, [
    "sourceLessonId",
    "source_lesson_id",
    "lessonId",
    "lesson_id",
    "backendLessonId",
    "backend_lesson_id",
  ]);
  const occurrenceId = pickFirstValue(sourceRecord, [
    "occurrenceId",
    "occurrence_id",
    "id",
  ]);

  return (
    extractNumericLessonId(materializedLessonId) ??
    extractNumericLessonId(lesson?.id) ??
    extractNumericLessonId(fallbackId) ??
    extractGroupClassOccurrenceId(occurrenceId) ??
    extractGroupClassOccurrenceId(lesson?.id) ??
    extractGroupClassOccurrenceId(fallbackId)
  );
};

const getMaterializedGroupLessonId = (lesson: GroupLesson | null, fallbackId?: string | number) => {
  const sourceRecord =
    lesson?.sourceLesson && typeof lesson.sourceLesson === "object"
      ? (lesson.sourceLesson as Record<string, unknown>)
      : undefined;
  const materializedLessonId = pickFirstValue(sourceRecord, [
    "sourceLessonId",
    "source_lesson_id",
    "lessonId",
    "lesson_id",
    "backendLessonId",
    "backend_lesson_id",
  ]);

  return (
    extractNumericLessonId(materializedLessonId) ??
    extractNumericLessonId(lesson?.id) ??
    extractNumericLessonId(fallbackId)
  );
};

const normalizeIdentityValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value).trim();
};

const buildInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const [first, second] = parts;
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
};

const getCardBrandMark = (brand?: string) => {
  const normalized = (brand ?? "Card").toLowerCase();
  if (normalized.includes("visa")) {
    return "VISA";
  }
  if (normalized.includes("master")) {
    return "MC";
  }
  if (normalized.includes("amex") || normalized.includes("american")) {
    return "AMEX";
  }
  return (brand ?? "CARD").toUpperCase();
};

const getCardBrandClass = (brand?: string) => {
  const normalized = (brand ?? "Card").toLowerCase();
  if (normalized.includes("visa")) {
    return "is-visa";
  }
  if (normalized.includes("master")) {
    return "is-mastercard";
  }
  if (normalized.includes("amex") || normalized.includes("american")) {
    return "is-amex";
  }
  return "is-generic";
};

const BookingConfirmationPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as LocationState | undefined;
  const searchParams = new URLSearchParams(location.search);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("apple-pay");
  const [paymentMethods, setPaymentMethods] = useState<NormalizedPaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);
  const [setupIntentLoading, setSetupIntentLoading] = useState(false);
  const [setupIntentError, setSetupIntentError] = useState<string | null>(null);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const stripeEnabled = Boolean(stripePromise);
  const stripeRef = useRef<Stripe | null>(null);

  const coachIdFromState = state?.coachId;
  const dateIdFromState = state?.dateId;
  const slotIdFromState = state?.slotId;
  const groupLessonIdFromState = state?.groupLessonId;

  const coachIdParam = searchParams.get("coach");
  const dateIdParam = searchParams.get("date");
  const slotIdParam = searchParams.get("slot");
  const groupLessonParam = searchParams.get("groupLesson");

  const coachId = coachIdFromState ?? (coachIdParam ? Number.parseInt(coachIdParam, 10) : undefined);
  const dateId = dateIdFromState ?? dateIdParam ?? undefined;
  const slotId = slotIdFromState ?? slotIdParam ?? undefined;
  const groupLessonId = groupLessonIdFromState ?? groupLessonParam ?? undefined;

  const authToken = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "Token" }) ??
      undefined,
    [user],
  );

  const [credits, setCredits] = useState<PackagePurchase[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<PackageCreditsBalanceResponse | null>(null);
  const [packages, setPackages] = useState<CoachPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [isCreditsPackageOpen, setIsCreditsPackageOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [isPurchasingPackage, setIsPurchasingPackage] = useState(false);
  const [packagePurchaseError, setPackagePurchaseError] = useState<string | null>(null);
  const [hasAutoSelectedCredits, setHasAutoSelectedCredits] = useState(false);
  const [isConsumingCredits, setIsConsumingCredits] = useState(false);
  const [consumeError, setConsumeError] = useState<string | null>(null);
  const [pendingCreditConfirm, setPendingCreditConfirm] = useState<PendingCreditConfirm | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [groupLesson, setGroupLesson] = useState<GroupLesson | null>(null);
  const [groupLessonLoading, setGroupLessonLoading] = useState(false);
  const [groupLessonError, setGroupLessonError] = useState<string | null>(null);
  const [groupLessonCoachProfile, setGroupLessonCoachProfile] = useState<CoachProfileRecord | null>(null);
  const resolvedCoachId = coachId ?? groupLesson?.coachId;
  const [isApplePayReady, setIsApplePayReady] = useState(false);
  const [applePayRequest, setApplePayRequest] = useState<StripePaymentRequest | null>(null);

  const profile = resolvedCoachId != null ? findCoachProfile(resolvedCoachId) : undefined;

  const selectedDate = profile?.booking.availableDates.find((date) => date.id === dateId);
  const selectedSlot = selectedDate?.slots.find((slot) => slot.id === slotId);
  const applePayAmount = useMemo(
    () => parsePriceToCents(groupLesson?.pricePerPlayer ?? selectedSlot?.price ?? ""),
    [groupLesson?.pricePerPlayer, selectedSlot?.price],
  );

  const fetchPaymentMethods = useCallback(async () => {
    if (!authToken) {
      setPaymentMethodsError("Sign in to manage your saved cards.");
      setPaymentMethods([]);
      setPaymentMethodsLoading(false);
      return [];
    }

    setPaymentMethodsLoading(true);
    setPaymentMethodsError(null);
    try {
      const payload = await getPlayerStripePaymentMethods(authToken);
      const defaultId = resolveDefaultId(payload);
      const normalized = extractPaymentMethods(payload).map((method) => toNormalizedPaymentMethod(method, defaultId));
      setPaymentMethods(normalized);
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load saved cards.";
      setPaymentMethodsError(message);
      setPaymentMethods([]);
      return [];
    } finally {
      setPaymentMethodsLoading(false);
    }
  }, [authToken]);

  const refreshSetupIntent = useCallback(async () => {
    if (!stripeEnabled) {
      setSetupIntentClientSecret(null);
      setSetupIntentError(null);
      setSetupIntentLoading(false);
      return;
    }

    if (!authToken) {
      setSetupIntentClientSecret(null);
      setSetupIntentError("Sign in to add a payment method.");
      setSetupIntentLoading(false);
      return;
    }

    setSetupIntentLoading(true);
    setSetupIntentError(null);
    setSetupIntentClientSecret(null);

    try {
      const { client_secret: clientSecret } = await getPlayerStripeSetupIntent(authToken);
      if (!clientSecret) {
        throw new Error("Missing Stripe setup intent. Please try again.");
      }
      setSetupIntentClientSecret(clientSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start a secure card session.";
      setSetupIntentClientSecret(null);
      setSetupIntentError(message);
    } finally {
      setSetupIntentLoading(false);
    }
  }, [authToken, stripeEnabled]);

  useEffect(() => {
    void fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  useEffect(() => {
    if (!stripeEnabled) {
      return;
    }
    void refreshSetupIntent();
  }, [refreshSetupIntent, stripeEnabled]);

  useEffect(() => {
    let cancelled = false;
    setIsApplePayReady(false);
    setApplePayRequest(null);

    if (!stripePromise || !applePayAmount) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const stripe = await stripePromise;
      if (!stripe || cancelled) {
        return;
      }
      stripeRef.current = stripe;
      const paymentRequest = stripe.paymentRequest({
        country: "US",
        currency: "usd",
        total: {
          label: "The Tennis Plan",
          amount: applePayAmount,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });
      const canPay = await paymentRequest.canMakePayment();
      if (!cancelled && canPay?.applePay) {
        setIsApplePayReady(true);
        setApplePayRequest(paymentRequest);
        return;
      }
      if (!cancelled) {
        setIsApplePayReady(false);
        setApplePayRequest(null);
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
  }, [applePayAmount, stripePromise]);

  useEffect(() => {
    if (paymentMethodsLoading || hasInitializedSelection) {
      return;
    }
    if (paymentMethod === "apple-pay" && paymentMethods.length > 0) {
      const defaultId = paymentMethods.find((method) => method.isDefault)?.id ?? paymentMethods[0]?.id;
      if (defaultId) {
        setPaymentMethod(defaultId);
      }
    }
    setHasInitializedSelection(true);
  }, [hasInitializedSelection, paymentMethod, paymentMethods, paymentMethodsLoading]);

  useEffect(() => {
    if (paymentMethodsLoading) {
      return;
    }
    if (paymentMethod === "apple-pay" || paymentMethod === "credits" || paymentMethod === "new-card") {
      return;
    }
    if (paymentMethods.some((method) => method.id === paymentMethod)) {
      return;
    }
    const fallbackId = paymentMethods.find((method) => method.isDefault)?.id ?? paymentMethods[0]?.id ?? "apple-pay";
    setPaymentMethod(fallbackId);
  }, [paymentMethod, paymentMethods, paymentMethodsLoading]);

  const handleCardAdded = useCallback(
    async (paymentMethodId?: string) => {
      const updatedMethods = await fetchPaymentMethods();
      await refreshSetupIntent();
      if (paymentMethodId) {
        setPaymentMethod(paymentMethodId);
        setHasInitializedSelection(true);
        return;
      }
      const nextId =
        updatedMethods.find((method) => method.isDefault)?.id ?? updatedMethods[0]?.id ?? "apple-pay";
      setPaymentMethod(nextId);
      setHasInitializedSelection(true);
    },
    [fetchPaymentMethods, refreshSetupIntent],
  );

  const refreshGroupLesson = useCallback(async () => {
    if (!groupLessonId || !authToken) {
      return null;
    }

    const response = await fetchUpcomingGroupLessonById({
      token: authToken,
      lessonId: groupLessonId,
    });
    const nextLesson = mapUpcomingGroupLesson(response.lesson);
    setGroupLesson(nextLesson);
    setGroupLessonError(null);
    return nextLesson;
  }, [authToken, groupLessonId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (!groupLessonId) {
      setGroupLesson(null);
      setGroupLessonError(null);
      setGroupLessonLoading(false);
      return () => controller.abort();
    }

    if (!authToken) {
      setGroupLesson(null);
      setGroupLessonError("Sign in to view this group lesson.");
      setGroupLessonLoading(false);
      return () => controller.abort();
    }

    setGroupLessonLoading(true);
    setGroupLessonError(null);

    fetchUpcomingGroupLessonById({
      token: authToken,
      lessonId: groupLessonId,
      signal: controller.signal,
    })
      .then((response) => {
        if (cancelled) return;
        setGroupLesson(mapUpcomingGroupLesson(response.lesson));
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load group lesson.";
        setGroupLessonError(message);
        setGroupLesson(null);
      })
      .finally(() => {
        if (cancelled) return;
        setGroupLessonLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authToken, groupLessonId]);

  useEffect(() => {
    const controller = new AbortController();

    if (!groupLessonId || !resolvedCoachId || !authToken) {
      setGroupLessonCoachProfile(null);
      return () => controller.abort();
    }

    fetchCoachProfile(resolvedCoachId, {
      token: authToken,
      signal: controller.signal,
    })
      .then((profileRecord) => {
        if (controller.signal.aborted) return;
        setGroupLessonCoachProfile(profileRecord ?? null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setGroupLessonCoachProfile(null);
      });

    return () => controller.abort();
  }, [authToken, groupLessonId, resolvedCoachId]);

  const lessonDetails = selectedSlot ? profile?.booking.lessonTypes.find((type) => type.id === selectedSlot.lessonType) : undefined;

  const isProfileGroupLesson = selectedSlot?.lessonType === "group";
  const isProfileSemiPrivate = selectedSlot?.lessonType === "semi";
  const isGroupLesson = Boolean(groupLesson) || isProfileGroupLesson;
  const selectedSlotRecord = selectedSlot as (typeof selectedSlot & Record<string, unknown>) | undefined;
  const sourceLessonId =
    groupLesson?.id ??
    state?.sourceLessonId ??
    pickFirstValue(selectedSlotRecord, [
      "sourceLessonId",
      "source_lesson_id",
      "lessonId",
      "lesson_id",
      "backendLessonId",
      "backend_lesson_id",
    ]);
  const numericSourceLessonId = extractNumericLessonId(sourceLessonId);
  const materializedCreditLessonId =
    getMaterializedGroupLessonId(groupLesson, groupLessonId) ??
    numericSourceLessonId ??
    extractNumericLessonId(selectedSlot?.id) ??
    extractNumericLessonId(slotId);
  const isOpenGroupLesson = Boolean(groupLessonId || groupLesson || isProfileGroupLesson);
  const isCoachCreatedSemiPrivateLesson = !isOpenGroupLesson && isProfileSemiPrivate;
  const isCoachCreatedPrivateLesson =
    !isOpenGroupLesson &&
    !isProfileSemiPrivate &&
    selectedSlot?.lessonType === "private" &&
    Boolean(numericSourceLessonId);
  const isPlayerRequestedPrivateLesson =
    !isOpenGroupLesson &&
    !isCoachCreatedSemiPrivateLesson &&
    !isCoachCreatedPrivateLesson &&
    selectedSlot?.lessonType === "private";
  const requiresPlayerSideCreditConfirm =
    isOpenGroupLesson || isCoachCreatedPrivateLesson || isCoachCreatedSemiPrivateLesson;
  const isInstantlyConfirmed = requiresPlayerSideCreditConfirm;

  const timeRange = groupLesson
    ? (() => {
        if (groupLesson.startDateTime && groupLesson.endDateTime) {
          const start = moment.utc(groupLesson.startDateTime);
          const end = moment.utc(groupLesson.endDateTime);
          if (start.isValid() && end.isValid()) {
            return `${start.format("h:mm A")} – ${end.format("h:mm A")}`;
          }
        }
        return buildTimeRangeLabel(groupLesson.startTime, `${groupLesson.durationMinutes} min`);
      })()
    : selectedSlot
      ? buildTimeRangeLabel(selectedSlot.time, selectedSlot.duration)
      : undefined;
  const resolvedProfileLocation =
    groupLessonCoachProfile?.locations?.find((item) => item.id === groupLesson?.locationId)?.label ??
    groupLessonCoachProfile?.coachingLocations?.find((item) => item === groupLesson?.locationName) ??
    groupLessonCoachProfile?.coachingLocations?.[0];
  const locationLabel =
    groupLesson?.locationName ??
    resolvedProfileLocation ??
    profile?.location ??
    profile?.coachingLocations[0];
  const resolvedCoachName =
    (isGenericCoachName(groupLesson?.coachName) ? undefined : groupLesson?.coachName) ??
    groupLessonCoachProfile?.fullName ??
    profile?.name ??
    "your coach";
  const coachName = resolvedCoachName;
  const coachFirstName = resolvedCoachName.split(" ")[0] ?? resolvedCoachName;
  const lessonDateLabel = groupLesson
    ? groupLesson.startDateTime
      ? moment.utc(groupLesson.startDateTime).format("dddd, MMMM D")
      : groupLesson.date
    : selectedDate
      ? `${dayNameMap[selectedDate.day] ?? selectedDate.day}, ${selectedDate.label}`
      : undefined;

  const capacity = groupLesson
    ? groupLesson.totalSpots
    : isProfileGroupLesson
      ? extractPlayerCapacity(lessonDetails?.duration)
      : undefined;
  const spotsLabel = useMemo(() => {
    if (groupLesson) {
      const remaining = Math.max(groupLesson.availableSpots, 0);
      return `${remaining} spot${remaining === 1 ? "" : "s"} available`;
    }

    if (!selectedSlot || !isProfileGroupLesson) {
      return undefined;
    }

    const remaining = Math.max(selectedSlot.spotsRemaining, 0);
    if (capacity) {
      return `${Math.min(remaining, capacity)}/${capacity} spots available`;
    }

    return `${remaining} spot${remaining === 1 ? "" : "s"} available`;
  }, [capacity, groupLesson, isProfileGroupLesson, selectedSlot]);

  const participants = useMemo<GroupParticipant[]>(() => {
    if (groupLesson) {
      return groupLesson.participants;
    }

    if (!isProfileGroupLesson) {
      return [];
    }

    return selectedSlot?.participants ?? [];
  }, [groupLesson, isProfileGroupLesson, selectedSlot]);

  const participantCount = participants.length;
  const openSpots = useMemo(() => {
    if (groupLesson) {
      return Math.max(groupLesson.availableSpots, 0);
    }

    if (!isProfileGroupLesson) {
      return 0;
    }

    if (capacity != null) {
      return Math.max(capacity - participantCount, 0);
    }

    return Math.max(selectedSlot?.spotsRemaining ?? 0, 0);
  }, [capacity, groupLesson, isProfileGroupLesson, participantCount, selectedSlot]);

  const currentUserIdentity = useMemo(() => {
    const userRecord = user as Record<string, unknown> | undefined;
    const sessionRecord =
      userRecord?.session && typeof userRecord.session === "object"
        ? (userRecord.session as Record<string, unknown>)
        : undefined;
    const profileRecord =
      userRecord?.profile && typeof userRecord.profile === "object"
        ? (userRecord.profile as Record<string, unknown>)
        : undefined;

    return {
      id: normalizeIdentityValue(
        userRecord?.id ??
          userRecord?.user_id ??
          userRecord?.player_id ??
          sessionRecord?.user_id ??
          sessionRecord?.id ??
          profileRecord?.user_id ??
          profileRecord?.id,
      ),
      email: normalizeIdentityValue(
        userRecord?.email ?? userRecord?.user_email ?? sessionRecord?.email ?? profileRecord?.email,
      )?.toLowerCase(),
      phone: normalizeIdentityValue(
        userRecord?.phone ?? userRecord?.phone_number ?? sessionRecord?.phone ?? profileRecord?.phone,
      ),
    };
  }, [user]);

  const currentPlayerParticipantId = useMemo(() => {
    const groupPlayers = groupLesson?.groupPlayers ?? [];
    const playerRecord = groupPlayers.find((player) => {
      if (currentUserIdentity.id && player.playerId != null && String(player.playerId) === currentUserIdentity.id) {
        return true;
      }
      if (currentUserIdentity.email && player.email?.toLowerCase() === currentUserIdentity.email) {
        return true;
      }
      if (currentUserIdentity.phone && player.phone && String(player.phone) === currentUserIdentity.phone) {
        return true;
      }
      return false;
    });
    return playerRecord?.participantId ?? playerRecord?.id;
  }, [currentUserIdentity, groupLesson?.groupPlayers]);

  useEffect(() => {
    const controller = new AbortController();

    if (!resolvedCoachId) {
      setCredits([]);
      setCreditsError(null);
      setCreditsLoading(false);
      setCreditsBalance(null);
      return () => controller.abort();
    }

    if (!authToken) {
      setCredits([]);
      setCreditsError("Sign in to view credits.");
      setCreditsLoading(false);
      setCreditsBalance(null);
      return () => controller.abort();
    }

    setCreditsLoading(true);
    setCreditsError(null);

    fetchPackageCredits({
      token: authToken,
      coachId: resolvedCoachId,
      includeExpired: false,
      signal: controller.signal,
    })
      .then((data) => {
        setCredits(data?.purchases ?? []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unable to load credits.";
        setCreditsError(message);
        setCredits([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCreditsLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, resolvedCoachId]);

  const lessonType = groupLesson ? "group" : selectedSlot?.lessonType ?? "private";
  const creditLessonType = resolveLessonCreditType({
    lesson_type_name: lessonDetails?.label ?? lessonType,
  });

  useEffect(() => {
    const controller = new AbortController();

    if (!resolvedCoachId || !authToken) {
      setCreditsBalance(null);
      return () => controller.abort();
    }

    fetchPackageCreditsBalance({
      token: authToken,
      coachId: resolvedCoachId,
      lessonType: creditLessonType,
      signal: controller.signal,
    })
      .then((data) => {
        setCreditsBalance(data ?? null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCreditsBalance(null);
      });

    return () => controller.abort();
  }, [authToken, creditLessonType, resolvedCoachId]);

  useEffect(() => {
    setHasAutoSelectedCredits(false);
    setIsCreditsPackageOpen(false);
    setSelectedPackageId(null);
    setPackagePurchaseError(null);
  }, [creditLessonType, resolvedCoachId]);

  useEffect(() => {
    const controller = new AbortController();

    if (!resolvedCoachId || !authToken) {
      setPackages([]);
      setPackagesError(null);
      setPackagesLoading(false);
      return () => controller.abort();
    }

    setPackagesLoading(true);
    setPackagesError(null);

    fetchCoachPackages({
      token: authToken,
      coachId: resolvedCoachId,
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setPackages((data?.packages ?? []).filter((pkg) => pkg.is_active !== false));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setPackages([]);
        setPackagesError(err instanceof Error ? err.message : "Unable to load packages.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPackagesLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, resolvedCoachId]);

  const rosterCaption = useMemo(() => {
    if (groupLesson) {
      const base = `${participantCount}/${groupLesson.totalSpots} players confirmed`;
      if (openSpots === 0) {
        return `${base} • Full`;
      }
      return `${base} • ${openSpots} spot${openSpots === 1 ? "" : "s"} open`;
    }

    if (!isProfileGroupLesson) {
      return undefined;
    }

    if (capacity != null) {
      const base = `${participantCount}/${capacity} players confirmed`;
      if (openSpots === 0) {
        return `${base} • Full`;
      }
      return `${base} • ${openSpots} spot${openSpots === 1 ? "" : "s"} open`;
    }

    if (participantCount === 0) {
      return openSpots > 0
        ? `${openSpots} spot${openSpots === 1 ? "" : "s"} open`
        : "No spots currently available";
    }

    const base = `${participantCount} player${participantCount === 1 ? "" : "s"} confirmed`;
    return openSpots > 0 ? `${base} • ${openSpots} spot${openSpots === 1 ? "" : "s"} open` : base;
  }, [capacity, groupLesson, isProfileGroupLesson, openSpots, participantCount]);

  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return "";
    }
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  };

  const eligibleCredits = useMemo(() => {
    const allowedForLesson = (purchase: PackagePurchase) => {
      return packageAllowsLessonCreditType(purchase.lesson_types_allowed, creditLessonType);
    };
    return credits.filter(
      (purchase) => (purchase.credits_remaining ?? 0) > 0 && allowedForLesson(purchase),
    );
  }, [creditLessonType, credits]);

  const creditSummary = useMemo(() => {
    const totals = eligibleCredits.reduce(
      (acc, purchase) => {
        const remaining = Number(purchase.credits_remaining ?? 0);
        return { ...acc, remaining: acc.remaining + (Number.isFinite(remaining) ? remaining : 0) };
      },
      { remaining: 0 },
    );

    const nextExpiry = eligibleCredits
      .map((purchase) => purchase.expires_at)
      .filter(Boolean)
      .map((value) => new Date(value as string))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return {
      remaining: totals.remaining,
      nextExpiry: nextExpiry ? formatDateLabel(nextExpiry.toISOString()) : undefined,
    };
  }, [eligibleCredits]);

  const lessonLabel = groupLesson
    ? groupLesson.title
    : lessonDetails?.label ?? (selectedSlot?.lessonType === "private" ? "Private lesson" : "Group lesson");
  const coachAvatar =
    groupLesson?.coachAvatarUrl || groupLessonCoachProfile?.profilePicture || profile?.imageUrl;
  const coachTitle = profile?.title ?? (groupLesson ? `${groupLesson.skillLabel} • Group session` : undefined);
  const coachRating = profile?.rating;
  const coachReviewCount = profile?.reviewCount;
  const durationLabel = groupLesson ? `${groupLesson.durationMinutes} min` : selectedSlot?.duration;
  const confirmTitle = groupLesson ? "Checkout" : `Confirm your lesson with ${coachName}`;
  const backButtonLabel = groupLesson ? "Back to lesson details" : "Back to availability";
  const backButtonDestination = groupLesson ? `/group-lessons/${groupLesson.id}` : undefined;
  const adjustCopy = groupLesson
    ? "You can return to the lesson details to review what's included before confirming."
    : "You can return to availability and pick a different time or lesson type at any point before submitting your request.";
  const adjustButtonLabel = groupLesson ? "Back to lesson details" : "Choose a different slot";

  const handleAdjustNavigation = () => {
    if (groupLesson) {
      navigate(`/group-lessons/${groupLesson.id}`);
      return;
    }
    navigate(-1);
  };

  const headlineSubtitle = isGroupLesson
    ? `Review your session details, choose a payment method, and confirm your spot instantly.`
    : `Lock in your preferred time. We’ll notify ${coachFirstName} once you submit the request.`;

  const selectedSavedCard = paymentMethods.find((card) => card.id === paymentMethod) ?? null;
  const canUseCredits = eligibleCredits.length > 0 && (!isOpenGroupLesson || Boolean(materializedCreditLessonId));
  const isUsingCredits = paymentMethod === "credits";
  const isUsingApplePay = paymentMethod === "apple-pay";
  const isUsingNewCard = paymentMethod === "new-card";
  const fallbackCardId =
    paymentMethods.find((method) => method.isDefault)?.id ?? paymentMethods[0]?.id ?? "apple-pay";
  const heldCredits = isFiniteNumber(creditsBalance?.held) ? creditsBalance.held : 0;
  const heldCreditsLabel = heldCredits > 0 ? ` · ${heldCredits} held` : "";

  const remainingCredits = Math.max(creditSummary.remaining - 1, 0);
  const remainingCreditsLabel = remainingCredits === 0 ? "no credits" : `${remainingCredits} credit${remainingCredits === 1 ? "" : "s"}`;

  const priceLabel = isUsingCredits
    ? "Credit to apply"
    : isGroupLesson
      ? "Total due today"
      : "Total due now";

  const priceValue = isUsingCredits ? "1 lesson credit" : groupLesson?.pricePerPlayer ?? selectedSlot?.price ?? "--";

  const priceCaption = (() => {
    if (isUsingCredits) {
      const expiresMessage = creditSummary.nextExpiry ? ` Next expiry ${creditSummary.nextExpiry}.` : "";
      return `We'll deduct 1 credit from your balance. You'll have ${remainingCreditsLabel} remaining.${expiresMessage}`;
    }
    if (isUsingApplePay) {
      return isGroupLesson
        ? "Charged instantly via Apple Pay."
        : "Apple Pay will only be charged after the coach approves.";
    }
    if (isUsingNewCard) {
      return isGroupLesson
        ? "Charged immediately once the card is saved."
        : "We'll only charge this card after the coach approves.";
    }
    if (selectedSavedCard) {
      const cardLabel = `${selectedSavedCard.brand} •••• ${selectedSavedCard.last4}`;
      return isGroupLesson
        ? `Charged immediately to ${cardLabel}.`
        : `We'll place a hold and charge ${cardLabel} after approval.`;
    }
    return isGroupLesson ? "Charged immediately to hold your spot." : "Charged only after the coach approves.";
  })();

  const confirmButtonLabel = (() => {
    if (isUsingCredits) {
      return "Pay with credits";
    }
    if (isUsingApplePay) {
      return isGroupLesson ? "Confirm with Apple Pay" : "Request with Apple Pay";
    }
    if (isUsingNewCard) {
      return isGroupLesson ? "Confirm with new card" : "Request with new card";
    }
    return isGroupLesson ? "Confirm with saved card" : "Request with saved card";
  })();

  const disclaimerCopy = (() => {
    if (isUsingCredits) {
      return isGroupLesson
        ? "Credit is deducted immediately to secure your spot."
        : "We reserve the credit but only deduct it after coach approval.";
    }
    return isGroupLesson
      ? "Your lesson is confirmed instantly when spots are available."
      : "You won’t be charged until the coach confirms.";
  })();

  const groupLessonCancelled = Boolean(groupLesson?.cancelled);
  const groupLessonCancelledMessage = groupLessonCancelled
    ? "This lesson has been cancelled and can no longer be booked."
    : null;
  const isConfirmDisabled = isGroupLessonCheckoutDisabled({
    isConfirmed,
    isConsumingCredits,
    isPurchasingPackage,
    isProcessingPayment,
    hasPendingCreditConfirm: Boolean(pendingCreditConfirm),
    isUsingNewCard,
    groupLessonLoading: groupLessonId ? groupLessonLoading : false,
    isUsingCredits,
    canUseCredits,
    creditsLoading,
    hasAuthToken: Boolean(authToken),
    groupLessonCancelled,
  });

  const refreshCreditState = useCallback(async () => {
    if (!authToken || !resolvedCoachId) {
      return;
    }

    const [refreshedCredits, refreshedBalance] = await Promise.allSettled([
      fetchPackageCredits({
        token: authToken,
        coachId: resolvedCoachId,
        includeExpired: false,
      }),
      fetchPackageCreditsBalance({
        token: authToken,
        coachId: resolvedCoachId,
        lessonType: creditLessonType,
      }),
    ]);

    if (refreshedCredits.status === "fulfilled") {
      setCredits(refreshedCredits.value?.purchases ?? []);
      setCreditsError(null);
    } else {
      const message = refreshedCredits.reason instanceof Error ? refreshedCredits.reason.message : "Unable to refresh credits.";
      setCreditsError(message);
    }

    if (refreshedBalance.status === "fulfilled") {
      setCreditsBalance(refreshedBalance.value ?? null);
    } else {
      setCreditsBalance(null);
    }
  }, [authToken, creditLessonType, resolvedCoachId]);

  const getCreditLessonId = useCallback(() => {
    return materializedCreditLessonId;
  }, [materializedCreditLessonId]);

  const bookOpenGroupLessonWithPayment = useCallback(
    async (paymentMethodId: string) => {
      if (!authToken) {
        throw new Error("Sign in to complete your booking.");
      }

      const bookableLessonId =
        getBookableGroupLessonId(groupLesson, groupLessonId) ??
        numericSourceLessonId ??
        extractNumericLessonId(selectedSlot?.id) ??
        extractNumericLessonId(slotId);

      if (!bookableLessonId) {
        throw new Error("Missing lesson details for booking.");
      }

      const shouldBookOccurrence = Boolean(
        groupLesson &&
          groupLesson.startDateTime &&
          groupLesson.endDateTime,
      );

      if (shouldBookOccurrence && groupLesson) {
        const start = groupLesson.startDateTime ? moment.utc(groupLesson.startDateTime) : null;
        const end = groupLesson.endDateTime ? moment.utc(groupLesson.endDateTime) : null;
        if (!start?.isValid() || !end?.isValid()) {
          throw new Error("Missing lesson time details for booking.");
        }

        return joinLesson({
          token: authToken,
          lessonId: bookableLessonId,
          coachId: groupLesson.coachId,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          startDateTimeTz: moment(groupLesson.startDateTime).toISOString(),
          endDateTimeTz: moment(groupLesson.endDateTime).toISOString(),
          locationId: groupLesson.locationId ?? 0,
          court: groupLesson.court ?? 0,
          status: "CONFIRMED",
          paymentMethodId,
        });
      }

      return bookGroupLessonWithCard({
        token: authToken,
        lessonId: bookableLessonId,
        paymentMethodId,
      });
    },
    [authToken, groupLesson, groupLessonId, numericSourceLessonId, selectedSlot?.id, slotId],
  );

  const completeCreditBookingSuccess = useCallback(async () => {
    setPendingCreditConfirm(null);
    setIsConfirmed(true);
    setIsConfirmationModalOpen(true);
    await Promise.allSettled([refreshGroupLesson(), refreshCreditState()]);
  }, [refreshCreditState, refreshGroupLesson]);

  const confirmReservedCreditLesson = useCallback(
    async (lessonId: number | string) => {
      if (!authToken) {
        throw new Error("Sign in to confirm this lesson.");
      }
      await updatePlayerLesson({
        token: authToken,
        lessonId,
        status: "CONFIRMED",
      });
      await completeCreditBookingSuccess();
    },
    [authToken, completeCreditBookingSuccess],
  );

  const handleRetryCreditConfirm = useCallback(async () => {
    if (!pendingCreditConfirm) {
      return;
    }

    setConsumeError(null);
    setIsConsumingCredits(true);
    try {
      await confirmReservedCreditLesson(pendingCreditConfirm.lessonId);
    } catch (err) {
      setConsumeError(err instanceof Error ? err.message : "Credit reserved, but lesson confirmation failed. Please retry.");
    } finally {
      setIsConsumingCredits(false);
    }
  }, [confirmReservedCreditLesson, pendingCreditConfirm]);

  const consumeCreditsForLesson = useCallback(
    async (purchaseId?: number | string) => {
      if (!authToken) {
        throw new Error("Sign in to use credits.");
      }
      if (!resolvedCoachId || !lessonType) {
        throw new Error("Missing lesson details for credits.");
      }

      const numericLessonId = getCreditLessonId();
      if (!numericLessonId) {
        throw new Error("We need a numeric lesson ID to reserve credits.");
      }

      await consumePackageCredits({
        token: authToken,
        coachId: resolvedCoachId,
        lessonType: creditLessonType,
        lessonId: numericLessonId,
        purchaseId,
        participantId: isOpenGroupLesson ? currentPlayerParticipantId : undefined,
      });

      if (!requiresPlayerSideCreditConfirm) {
        await completeCreditBookingSuccess();
        return;
      }

      try {
        await confirmReservedCreditLesson(numericLessonId);
      } catch {
        setPendingCreditConfirm({ lessonId: numericLessonId });
        throw new Error("Credit reserved, but lesson confirmation failed. Please retry.");
      }
    },
    [
      authToken,
      completeCreditBookingSuccess,
      confirmReservedCreditLesson,
      creditLessonType,
      currentPlayerParticipantId,
      getCreditLessonId,
      isOpenGroupLesson,
      lessonType,
      requiresPlayerSideCreditConfirm,
      resolvedCoachId,
    ],
  );

  const handleConfirm = async () => {
    setConsumeError(null);

    if (groupLessonCancelled) {
      setConsumeError(groupLessonCancelledMessage);
      return;
    }

    if (isUsingApplePay) {
      if (!authToken) {
        setConsumeError("Sign in to use Apple Pay.");
        return;
      }
      if (!stripePromise) {
        setConsumeError("Stripe isn't configured for Apple Pay.");
        return;
      }
      if (!applePayAmount) {
        setConsumeError("Missing payment amount for Apple Pay.");
        return;
      }
      if (!isApplePayReady || !applePayRequest) {
        setConsumeError("Apple Pay isn't available on this device.");
        return;
      }

      setIsProcessingPayment(true);
      try {
        const stripe = stripeRef.current;
        if (!stripe) {
          throw new Error("Stripe is not available for Apple Pay.");
        }

        await new Promise<void>((resolve, reject) => {
          const request = applePayRequest;
          request.update({
            total: {
              label: "The Tennis Plan",
              amount: applePayAmount,
            },
          });

          const handlePayment = async (event: PaymentRequestPaymentMethodEvent) => {
            try {
              const paymentMethodId = event.paymentMethod.id;
              if (isGroupLesson) {
                const response = await bookOpenGroupLessonWithPayment(paymentMethodId);
                if (!isGroupBookingResponseSuccessful(response)) {
                  throw new Error("Booking could not be confirmed.");
                }
                await refreshGroupLesson();
              } else {
                const lessonIdForIntent = selectedSlot?.id ?? slotId;
                if (!lessonIdForIntent) {
                  throw new Error("Missing lesson details for Apple Pay.");
                }
                const intentResponse = await createPlayerStripePaymentIntent({
                  token: authToken,
                  lessonId: lessonIdForIntent,
                  paymentMethodId,
                });
                const intentRecord = intentResponse as Record<string, unknown>;
                const nestedIntent = intentRecord?.payment_intent as Record<string, unknown> | undefined;
                const clientSecret =
                  (intentRecord?.client_secret as string | undefined) ??
                  (nestedIntent?.client_secret as string | undefined);
                if (!clientSecret) {
                  throw new Error("Unable to start payment. Please try again.");
                }
                const { error, paymentIntent } = await stripe.confirmCardPayment(
                  clientSecret,
                  {
                    payment_method: paymentMethodId,
                  },
                  { handleActions: false }
                );
                if (error) {
                  throw new Error(error.message || "Apple Pay failed.");
                }
                const status = paymentIntent?.status?.toLowerCase();
                if (status && status !== "succeeded") {
                  if (status === "requires_action") {
                    const { error: actionError, paymentIntent: actionIntent } = await stripe.confirmCardPayment(clientSecret);
                    if (actionError) {
                      throw new Error(actionError.message || "Apple Pay failed.");
                    }
                    const actionStatus = actionIntent?.status?.toLowerCase();
                    if (actionStatus && actionStatus !== "succeeded") {
                      throw new Error("Payment was not successful.");
                    }
                  } else {
                    throw new Error("Payment was not successful.");
                  }
                }
              }

              event.complete("success");
              resolve();
            } catch (error) {
              event.complete("fail");
              reject(error);
            }
          };

          const handleCancel = () => {
            reject(new Error("Apple Pay was canceled."));
          };

          request.once("paymentmethod", handlePayment);
          request.once("cancel", handleCancel);

          try {
            request.show();
          } catch (error) {
            request.off("paymentmethod", handlePayment);
            request.off("cancel", handleCancel);
            reject(error);
          }
        });

        setIsConfirmed(true);
        if (groupLesson || !isGroupLesson) {
          setIsConfirmationModalOpen(true);
        }
      } catch (error) {
        setConsumeError(error instanceof Error ? error.message : "Apple Pay failed.");
      } finally {
        setIsProcessingPayment(false);
      }
      return;
    }

    if (isUsingCredits) {
      if (!authToken) {
        setConsumeError("Sign in to use credits.");
        return;
      }
      if (!resolvedCoachId || !lessonType) {
        setConsumeError("Missing lesson details for credits.");
        return;
      }
      if (!canUseCredits) {
        setConsumeError("No eligible credits available. Please pay by card.");
        setPaymentMethod(fallbackCardId);
        return;
      }

      setIsConsumingCredits(true);
      try {
        const bestPurchase = eligibleCredits[0];
        await consumeCreditsForLesson(bestPurchase?.id);
      } catch (err) {
        if (pendingCreditConfirm || (err instanceof Error && err.message.includes("Credit reserved"))) {
          setConsumeError("Credit reserved, but lesson confirmation failed. Please retry.");
          return;
        }
        const code = (err as Error & { data?: { code?: string; error?: string } })?.data?.code;
        const errorMessage = (() => {
          switch (code) {
            case "no_eligible_package":
            case "no_credits_remaining":
            case "package_expired":
            case "lesson_type_not_allowed":
              return "No eligible credits for this lesson type. Please pay by card.";
            default:
              return "Couldn't use credits, please try card.";
          }
        })();
        setConsumeError(errorMessage);
        setPaymentMethod(fallbackCardId);
      } finally {
        setIsConsumingCredits(false);
      }
      return;
    }

    if (isGroupLesson) {
      if (!authToken) {
        setConsumeError("Sign in to complete your booking.");
        return;
      }

      if (!paymentMethod || paymentMethod === "new-card" || paymentMethod === "apple-pay") {
        setConsumeError("Select a saved card to complete booking.");
        return;
      }

      setIsProcessingPayment(true);
      try {
        const response = await bookOpenGroupLessonWithPayment(paymentMethod);
        if (!isGroupBookingResponseSuccessful(response)) {
          throw new Error("Booking could not be confirmed.");
        }
        await refreshGroupLesson();
        setIsConfirmed(true);
        setIsConfirmationModalOpen(true);
      } catch (error) {
        setConsumeError(error instanceof Error ? error.message : "Unable to complete booking.");
      } finally {
        setIsProcessingPayment(false);
      }
      return;
    }

    setIsConfirmed(true);
    if (groupLesson || !isGroupLesson) {
      setIsConfirmationModalOpen(true);
    }
  };

  const savedCardsSection = (
    <div className="payment-methods__group">
      <span className="payment-methods__group-label">Saved cards</span>
      {paymentMethodsLoading ? (
        <p className="payment-methods__notice">Loading your saved cards...</p>
      ) : paymentMethodsError ? (
        <p className="payment-methods__notice payment-methods__notice--error">{paymentMethodsError}</p>
      ) : paymentMethods.length === 0 ? (
        <p className="payment-methods__notice">No saved cards yet.</p>
      ) : null}
      <div className="payment-methods__stack">
        {paymentMethods.map((card) => {
          const isSelected = paymentMethod === card.id;
          return (
            <label key={card.id} className={`payment-method-card${isSelected ? " payment-method-card--selected" : ""}`}>
              <input
                type="radio"
                name="payment-method"
                value={card.id}
                checked={isSelected}
                onChange={() => setPaymentMethod(card.id)}
              />
              <span className="payment-method-card__selector" aria-hidden />
              <span className="payment-method-card__icon">
                <CreditCard aria-hidden size={18} />
              </span>
              <span className="payment-method-card__body">
                <span className="payment-method-card__title">
                  {card.brand} ending in {card.last4}
                </span>
                <span className="payment-method-card__subtitle">Expires {formatExpiry(card.expMonth, card.expYear)}</span>
              </span>
              {card.isDefault ? <span className="payment-method-card__tag">Default</span> : null}
            </label>
          );
        })}

        <label className={`payment-method-card payment-method-card--new${isUsingNewCard ? " payment-method-card--selected" : ""}`}>
          <input
            type="radio"
            name="payment-method"
            value="new-card"
            checked={isUsingNewCard}
            onChange={() => setPaymentMethod("new-card")}
          />
          <span className="payment-method-card__selector" aria-hidden />
          <span className="payment-method-card__icon">
            <CreditCard aria-hidden size={18} />
          </span>
          <span className="payment-method-card__body">
            <span className="payment-method-card__title">Add a new credit card</span>
            <span className="payment-method-card__subtitle">Securely save it for future lessons.</span>
          </span>
        </label>

        {isUsingNewCard ? (
          <div className="payment-method-card__form" role="group" aria-label="New card details">
            {stripeEnabled ? (
              setupIntentError ? (
                <div className="payment-form__status payment-form__status--error payment-form__status--stacked" role="alert">
                  <span>{setupIntentError}</span>
                  <button
                    type="button"
                    className="payment-methods__cta"
                    onClick={() => void refreshSetupIntent()}
                    disabled={setupIntentLoading}
                  >
                    {setupIntentLoading ? (
                      <>
                        <Loader2 className="payment-form__spinner" aria-hidden />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <Plus size={16} aria-hidden />
                        Try again
                      </>
                    )}
                  </button>
                </div>
              ) : setupIntentLoading && !setupIntentClientSecret ? (
                <div className="payment-form__status payment-form__status--inline" role="status">
                  <Loader2 className="payment-form__spinner" aria-hidden />
                  Preparing secure payment form...
                </div>
              ) : setupIntentClientSecret ? (
                <Elements
                  stripe={stripePromise}
                  options={{ appearance: { theme: "stripe" } }}
                  key={setupIntentClientSecret}
                >
                  <AddCardForm clientSecret={setupIntentClientSecret} onCardAdded={handleCardAdded} />
                </Elements>
              ) : null
            ) : (
              <div className="payment-form__status payment-form__status--error" role="alert">
                <AlertCircle aria-hidden />
                <span>
                  Stripe isn&apos;t configured. Set <code>VITE_STRIPE_PUBLISHABLE_KEY</code> in your environment to enable card
                  payments.
                </span>
              </div>
            )}
            <p className="payment-form__note">
              We use encrypted vault storage and never share your payment details with coaches.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );

  const digitalWalletSection = (
    <div className="payment-methods__group">
      <span className="payment-methods__group-label">Digital wallet</span>
      <label className={`payment-method-card payment-method-card--wallet${isUsingApplePay ? " payment-method-card--selected" : ""}`}>
        <input
          type="radio"
          name="payment-method"
          value="apple-pay"
          checked={isUsingApplePay}
          onChange={() => setPaymentMethod("apple-pay")}
        />
        <span className="payment-method-card__selector" aria-hidden />
        <span className="payment-method-card__icon">
          <Apple aria-hidden size={18} />
        </span>
        <span className="payment-method-card__body">
          <span className="payment-method-card__title">Apple Pay</span>
          <span className="payment-method-card__subtitle">Pay instantly with your saved wallet.</span>
        </span>
      </label>
    </div>
  );

  const nextStepsItems = isInstantlyConfirmed
    ? [
        "Your spot is reserved immediately as long as space remains.",
        "We'll email your receipt and lesson details right away.",
        "Manage your booking or make changes from your dashboard.",
      ]
    : [
        `Your request is sent directly to ${coachFirstName} for review.`,
        "You'll receive an email as soon as the coach confirms.",
        `Once approved, your booking is confirmed and payment is processed.`,
      ];

  const confirmationStatus = isInstantlyConfirmed
    ? {
        title: "You are confirmed",
        copy: `Your spot is reserved for ${lessonDateLabel ?? "your upcoming lesson"} at ${timeRange ?? selectedSlot?.time}. We'll send a receipt to your email and keep you posted on any updates.`,
      }
    : {
        title: "Lesson Request sent",
        copy: `Your request has been sent to ${coachFirstName} for confirmation. You'll receive an email as soon as the coach confirms.`,
      };

  const modalStatus: BookingStatus = isInstantlyConfirmed ? "CONFIRMED" : "PENDING";
  const paymentMethodLabel = isUsingCredits
    ? `1 ${creditLessonType} credit`
    : isUsingApplePay
      ? "Apple Pay"
      : selectedSavedCard
        ? `${selectedSavedCard.brand} ending in ${selectedSavedCard.last4}`
        : isUsingNewCard
          ? "New card"
          : "Card";
  const modalData = {
    coachName,
    coachInitials: buildInitials(coachName),
    lessonTitle: isInstantlyConfirmed ? groupLesson?.title ?? lessonLabel : undefined,
    lessonSubtitle: isInstantlyConfirmed ? groupLesson?.focus ?? undefined : undefined,
    skillRange: isInstantlyConfirmed && groupLesson?.level ? formatLevelRange(groupLesson.level) : undefined,
    lessonTypeLabel: lessonLabel,
    isGroup: isInstantlyConfirmed ? Boolean(groupLesson) : Boolean(groupLesson),
    durationMin: parseDurationToMinutes(durationLabel ?? "") ?? groupLesson?.durationMinutes ?? 60,
    dateLabel: lessonDateLabel ?? "Date TBD",
    timeLabel: timeRange ?? selectedSlot?.time ?? "Time TBD",
    locationName: locationLabel ?? "Location TBD",
    locationAddress: groupLesson?.locationCity ?? locationLabel ?? "Location TBD",
    amountLabel: isInstantlyConfirmed ? "Amount charged" : "Lesson total",
    amount: priceValue,
    etaText: "~24 hrs",
    lessonId: groupLesson?.id,
    paymentMethodLabel,
    spotsRemainingAfterBooking: isGroupLesson ? Math.max(openSpots - 1, 0) : undefined,
    showPackagePrompt: isGroupLesson ? !isUsingCredits : false,
    cancellationPolicyText:
      "Cancellation policy: Free cancellation up to 24 hours before your lesson. Cancellations within 24 hours may be subject to a fee.",
  };

  const handleAddToCalendar = () => {
    window.alert("Calendar integration is coming soon.");
  };

  const handleShare = () => {
    if (navigator.share) {
      void navigator.share({
        title: lessonLabel,
        text: `Join me for ${lessonLabel} with ${coachName}.`,
      });
      return;
    }
    window.alert("Sharing isn't available on this device.");
  };

  const packageOptions = useMemo(() => {
    const isAllowedForLesson = (pkg: CoachPackage) => {
      return packageAllowsLessonCreditType(pkg.lesson_types_allowed, creditLessonType);
    };

    return packages
      .filter((pkg) => pkg.lesson_count > 0 && isAllowedForLesson(pkg))
      .sort((a, b) => a.lesson_count - b.lesson_count);
  }, [creditLessonType, packages]);
  const bestValuePackage = packageOptions.reduce<CoachPackage | null>((best, pkg) => {
    const total = parseCurrencyValue(pkg.total_price);
    const bestTotal = best ? parseCurrencyValue(best.total_price) : null;
    if (total == null) return best;
    if (!best || bestTotal == null) return pkg;
    return total / pkg.lesson_count < bestTotal / best.lesson_count ? pkg : best;
  }, null);
  const selectedPackage =
    packageOptions.find((pkg) => String(pkg.id) === selectedPackageId) ??
    bestValuePackage ??
    packageOptions[0] ??
    null;
  const selectedPackagePrice = selectedPackage ? parseCurrencyValue(selectedPackage.total_price) : null;
  const selectedPackageBuyLabel = isPurchasingPackage
    ? "Buying package..."
    : isUsingApplePay
      ? "Buy with Apple Pay"
      : "Buy with credit card";

  useEffect(() => {
    if (selectedPackageId || packageOptions.length === 0) {
      return;
    }
    const defaultPackage = bestValuePackage ?? packageOptions[0];
    setSelectedPackageId(String(defaultPackage.id));
  }, [bestValuePackage, packageOptions, selectedPackageId]);

  useEffect(() => {
    if (creditsLoading || !canUseCredits || hasAutoSelectedCredits) {
      return;
    }
    setPaymentMethod("credits");
    setHasAutoSelectedCredits(true);
  }, [canUseCredits, creditsLoading, hasAutoSelectedCredits]);

  const shouldShowEmptyState = groupLessonId
    ? !groupLessonLoading && !groupLesson
    : !profile || !selectedDate || !selectedSlot;

  if (groupLessonId && groupLessonLoading) {
    return (
      <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
        <div className="booking-confirmation booking-confirmation--empty">
          <div className="booking-confirmation__empty-card">
            <h1 className="booking-confirmation__empty-title">Loading group lesson…</h1>
            <p className="booking-confirmation__empty-copy">
              Please wait while we pull the latest session details.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (shouldShowEmptyState) {
    const emptyTitle = groupLessonId
      ? "We couldn't load that group lesson"
      : "We couldn't load that booking";
    const emptyCopy = groupLessonId
      ? groupLessonError ||
        "The session may have filled or is no longer available. Explore other group lessons to keep the momentum going."
      : "The booking details expired or were missing. Please return to the coach listings to choose an available lesson.";
    const emptyActionLabel = groupLessonId ? "View group lessons" : "Browse coaches";
    const emptyActionDestination = groupLessonId ? "/group-lessons" : "/find-coaches";

    return (
      <MainLayout
        mobileChrome={groupLessonId ? "home" : "default"}
        desktopChrome={groupLessonId ? "home" : "default"}
        showDesktopNav={groupLessonId ? true : !groupLessonId}
      >
        <div className="booking-confirmation booking-confirmation--empty">
          <div className="booking-confirmation__empty-card">
            <h1 className="booking-confirmation__empty-title">{emptyTitle}</h1>
            <p className="booking-confirmation__empty-copy">{emptyCopy}</p>
            <button
              type="button"
              className="fc-button fc-button--primary booking-confirmation__empty-action"
              onClick={() => navigate(emptyActionDestination)}
            >
              {emptyActionLabel}
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const summaryDateBand = (lessonDateLabel ?? "Date TBD").toUpperCase();
  const summaryLevelLabel = groupLesson?.level ? formatLevelRange(groupLesson.level) : lessonLabel;
  const sessionLabel = groupLesson?.title ?? lessonLabel;
  const sessionPriceLabel = groupLesson?.pricePerPlayer ?? selectedSlot?.price ?? "--";
  const sessionPriceAmount = parsePriceValue(sessionPriceLabel);
  const cardProcessingFee =
    !isUsingCredits && !isUsingApplePay && sessionPriceAmount != null
      ? Math.round(sessionPriceAmount * 0.03 * 100) / 100
      : 0;
  const totalPriceAmount =
    sessionPriceAmount != null
      ? isUsingCredits
        ? 0
        : sessionPriceAmount + cardProcessingFee
      : null;
  const subtotalLabel =
    sessionPriceAmount != null ? `$${sessionPriceAmount.toFixed(2)}` : sessionPriceLabel.replace(" per player", "");
  const totalPriceLabel =
    totalPriceAmount != null ? `$${totalPriceAmount.toFixed(2)}` : sessionPriceLabel.replace(" per player", "");
  const sessionBandDateLabel = groupLesson?.startDateTime
    ? `${moment.utc(groupLesson.startDateTime).format("dddd").toUpperCase()} · ${moment
        .utc(groupLesson.startDateTime)
        .format("MMM D")
        .toUpperCase()}`
    : summaryDateBand;
  const groupConfirmButtonLabel = getGroupLessonCheckoutButtonLabel({
    isUsingCredits,
    isConsumingCredits,
    isProcessingPayment,
    groupLessonCancelled,
    totalPriceLabel,
  });
  const cardFeeText = isUsingApplePay || isUsingCredits ? null : "Card processing fee may apply";

  const handleBuySelectedPackage = async () => {
    setConsumeError(null);
    setPackagePurchaseError(null);
    setIsPurchasingPackage(true);

    if (!authToken) {
      setPackagePurchaseError("Sign in to buy credits.");
      setIsPurchasingPackage(false);
      return;
    }
    if (!resolvedCoachId || !selectedPackage) {
      setPackagePurchaseError("Choose a lesson package to continue.");
      setIsPurchasingPackage(false);
      return;
    }

    if (!getCreditLessonId()) {
      setPackagePurchaseError("We need a numeric lesson ID to apply credits to this lesson.");
      setIsPurchasingPackage(false);
      return;
    }

    let paymentMethodId: string | null = null;
    let applePayEvent: PaymentRequestPaymentMethodEvent | null = null;
    let applePayCompleted = false;

    try {
      if (paymentMethod === "apple-pay") {
        if (!stripePromise || selectedPackagePrice == null) {
          throw new Error("Apple Pay is not ready for package checkout.");
        }
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error("Stripe is not available for Apple Pay.");
        }
        const packagePaymentRequest = stripe.paymentRequest({
          country: "US",
          currency: "usd",
          total: {
            label: selectedPackage.name || `${selectedPackage.lesson_count} lesson credits`,
            amount: Math.round(selectedPackagePrice * 100),
          },
          requestPayerName: true,
          requestPayerEmail: true,
        });
        const canPay = await packagePaymentRequest.canMakePayment();
        if (!canPay?.applePay) {
          throw new Error("Apple Pay is not available on this device.");
        }
        applePayEvent = await new Promise<PaymentRequestPaymentMethodEvent>((resolve, reject) => {
          const handlePayment = (event: PaymentRequestPaymentMethodEvent) => {
            packagePaymentRequest.off("cancel", handleCancel);
            resolve(event);
          };
          const handleCancel = () => {
            packagePaymentRequest.off("paymentmethod", handlePayment);
            reject(new Error("Apple Pay was canceled."));
          };
          packagePaymentRequest.once("paymentmethod", handlePayment);
          packagePaymentRequest.once("cancel", handleCancel);
          try {
            packagePaymentRequest.show();
          } catch (error) {
            packagePaymentRequest.off("paymentmethod", handlePayment);
            packagePaymentRequest.off("cancel", handleCancel);
            reject(error);
          }
        });
        paymentMethodId = applePayEvent.paymentMethod.id;
      } else if (paymentMethod && paymentMethod !== "credits" && paymentMethod !== "new-card") {
        paymentMethodId = paymentMethod;
      }

      if (!paymentMethodId) {
        throw new Error("Choose Apple Pay or a saved card to buy credits.");
      }

      const purchaseResponse = await purchaseCoachPackage({
        token: authToken,
        packageId: selectedPackage.id,
        paymentMethodId,
      });
      applePayEvent?.complete("success");
      applePayCompleted = true;

      setPaymentMethod("credits");
      setIsCreditsPackageOpen(false);
      setHasAutoSelectedCredits(true);
      await consumeCreditsForLesson(purchaseResponse.purchase?.id);
      const [refreshedCredits, refreshedBalance] = await Promise.allSettled([
        fetchPackageCredits({
          token: authToken,
          coachId: resolvedCoachId,
          includeExpired: false,
        }),
        fetchPackageCreditsBalance({
          token: authToken,
          coachId: resolvedCoachId,
          lessonType: creditLessonType,
        }),
      ]);
      if (refreshedCredits.status === "fulfilled") {
        const nextCredits = refreshedCredits.value?.purchases ?? [];
        setCredits(nextCredits);
        setCreditsError(null);
        const boughtCredit = nextCredits.find(
          (purchase) =>
            purchase.id != null &&
            String(purchase.id) === String(purchaseResponse.purchase?.id) &&
            (purchase.credits_remaining ?? 0) > 0,
        );
        if (boughtCredit) {
          setPaymentMethod("credits");
          setHasAutoSelectedCredits(true);
        }
      }
      if (refreshedBalance.status === "fulfilled") {
        setCreditsBalance(refreshedBalance.value ?? null);
      }
    } catch (err) {
      if (!applePayCompleted) {
        applePayEvent?.complete("fail");
      }
      const isReservedConfirmFailure = err instanceof Error && err.message.includes("Credit reserved");
      if (isReservedConfirmFailure) {
        setConsumeError("Credit reserved, but lesson confirmation failed. Please retry.");
        setIsCreditsPackageOpen(true);
      }
      setPackagePurchaseError(
        isReservedConfirmFailure
          ? "Credit reserved, but lesson confirmation failed. Please retry."
          : err instanceof Error
            ? err.message
            : "Unable to buy credits.",
      );
    } finally {
      setIsPurchasingPackage(false);
    }
  };

  const creditsPaymentCard = canUseCredits ? (
    <label className={`payment-method-card payment-method-card--credits${isUsingCredits ? " payment-method-card--selected" : ""}`}>
      <input
        type="radio"
        name="payment-method"
        value="credits"
        checked={isUsingCredits}
        onChange={() => setPaymentMethod("credits")}
        disabled={creditsLoading || !authToken}
      />
      <span className="payment-method-card__selector" aria-hidden />
      <span className="payment-method-card__icon payment-method-card__icon--ticket">🎟️</span>
      <span className="payment-method-card__body">
        <span className="payment-method-card__title">
          {creditSummary.remaining} {creditLessonType} credit{creditSummary.remaining === 1 ? "" : "s"} available
        </span>
        <span className="payment-method-card__subtitle">Auto-applied to this lesson{heldCreditsLabel}</span>
      </span>
      {creditSummary.nextExpiry ? (
        <span className="payment-method-card__tag payment-method-card__tag--success">Next expiry {creditSummary.nextExpiry}</span>
      ) : null}
    </label>
  ) : (
    <div className={`payment-method-card--credits-package${isCreditsPackageOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="payment-method-card__package-toggle"
        onClick={() => setIsCreditsPackageOpen((open) => !open)}
        aria-expanded={isCreditsPackageOpen}
      >
        <span className="payment-method-card__icon payment-method-card__icon--ticket">🎟️</span>
        <span className="payment-method-card__body">
          <span className="payment-method-card__title">Buy a lesson package</span>
          <span className="payment-method-card__subtitle">Save up to 20% · pay with credits</span>
        </span>
        <ChevronDown className="payment-method-card__chevron" aria-hidden size={18} />
      </button>
      {isCreditsPackageOpen ? (
        <div className="payment-method-card__package-panel">
          <p className="payment-method-card__package-intro">
            Buy sessions now — one credit covers this lesson, the rest are yours to use any time.
          </p>
          {packagesLoading ? <p className="payment-methods__notice">Loading packages...</p> : null}
          {packagesError ? <p className="payment-methods__notice payment-methods__notice--error">{packagesError}</p> : null}
          {!packagesLoading && !packagesError && packageOptions.length === 0 ? (
            <p className="payment-methods__notice">No lesson packages are available right now.</p>
          ) : null}
          {packageOptions.map((lessonPackage) => {
            const isSelectedPackage = selectedPackage?.id === lessonPackage.id;
            const total = parseCurrencyValue(lessonPackage.total_price);
            const perSession = total != null ? total / lessonPackage.lesson_count : null;
            const savings =
              sessionPriceAmount != null && total != null
                ? Math.max(sessionPriceAmount * lessonPackage.lesson_count - total, 0)
                : 0;
            const isBestValue = bestValuePackage?.id === lessonPackage.id;
            const title = lessonPackage.name || `${lessonPackage.lesson_count} lesson package`;
            const description = lessonPackage.description?.trim();
            return (
              <button
                type="button"
                key={lessonPackage.id}
                className={`payment-method-card__package-option${
                  isSelectedPackage ? " payment-method-card__package-option--selected" : ""
                }`}
                onClick={() => setSelectedPackageId(String(lessonPackage.id))}
              >
                <span>
                  <span className="payment-method-card__package-title">
                    {title}
                    {isBestValue ? <span className="payment-method-card__package-badge">Best value</span> : null}
                  </span>
                  {description ? <span className="payment-method-card__package-description">{description}</span> : null}
                  <span className="payment-method-card__package-subtitle">
                    {lessonPackage.lesson_count} credits ·{" "}
                    {perSession != null ? `${formatMoney(perSession)}/credit` : formatPackageLessonTypes(lessonPackage.lesson_types_allowed)}
                  </span>
                  <span className="payment-method-card__package-meta">
                    {formatPackageValidity(lessonPackage.validity_months)} · {formatPackageLessonTypes(lessonPackage.lesson_types_allowed)}
                  </span>
                </span>
                <span className="payment-method-card__package-price">
                  <strong>{formatMoney(lessonPackage.total_price)}</strong>
                  {savings > 0 ? <small>Save {formatMoney(savings)}</small> : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className="payment-method-card__package-buy"
            onClick={() => void handleBuySelectedPackage()}
            disabled={!selectedPackage || isPurchasingPackage}
            aria-busy={isPurchasingPackage}
          >
            {selectedPackageBuyLabel}
          </button>
          {packagePurchaseError ? (
            <p className="payment-methods__notice payment-methods__notice--error">{packagePurchaseError}</p>
          ) : null}
          {pendingCreditConfirm ? (
            <button
              type="button"
              className="payment-methods__cta"
              onClick={() => void handleRetryCreditConfirm()}
              disabled={isConsumingCredits}
            >
              {isConsumingCredits ? "Retrying..." : "Retry confirmation"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const lessonCreditsSection = (
    <div className="payment-methods__group">
      <span className="payment-methods__group-label">Lesson credits</span>
      {creditsPaymentCard}
      {isUsingCredits ? (
        <div className="payment-methods__credits-note">
          Applying one credit will cover this lesson. You&apos;ll have {remainingCreditsLabel} after booking.
        </div>
      ) : null}
    </div>
  );

  const groupPaymentMethods = (
    <>
      <div className="payment-methods__stack payment-methods__stack--group">
        {creditsPaymentCard}

        <label className={`payment-method-card payment-method-card--wallet${isUsingApplePay ? " payment-method-card--selected" : ""}`}>
          <input
            type="radio"
            name="payment-method"
            value="apple-pay"
            checked={isUsingApplePay}
            onChange={() => setPaymentMethod("apple-pay")}
          />
          <span className="payment-method-card__selector" aria-hidden />
          <span className="payment-method-card__icon payment-method-card__icon--apple">Pay</span>
          <span className="payment-method-card__body">
            <span className="payment-method-card__title">Apple Pay</span>
            <span className="payment-method-card__subtitle">Fast & secure · Face ID</span>
          </span>
        </label>

        {paymentMethods.map((card) => {
          const isSelected = paymentMethod === card.id;
          return (
            <label key={card.id} className={`payment-method-card${isSelected ? " payment-method-card--selected" : ""}`}>
              <input
                type="radio"
                name="payment-method"
                value={card.id}
                checked={isSelected}
                onChange={() => setPaymentMethod(card.id)}
              />
              <span className="payment-method-card__selector" aria-hidden />
              <span
                className={`payment-method-card__icon payment-method-card__icon--brand ${getCardBrandClass(card.brand)}`}
              >
                {getCardBrandMark(card.brand)}
              </span>
              <span className="payment-method-card__body">
                <span className="payment-method-card__title">
                  {card.brand} ending in {card.last4}
                </span>
                <span className="payment-method-card__subtitle">
                  Exp {formatExpiry(card.expMonth, card.expYear)}
                  {card.isDefault ? " · Default" : ""}
                </span>
              </span>
            </label>
          );
        })}

        <label className={`payment-method-card payment-method-card--new${isUsingNewCard ? " payment-method-card--selected" : ""}`}>
          <input
            type="radio"
            name="payment-method"
            value="new-card"
            checked={isUsingNewCard}
            onChange={() => setPaymentMethod("new-card")}
          />
          <span className="payment-method-card__selector" aria-hidden />
          <span className="payment-method-card__icon payment-method-card__icon--new">+</span>
          <span className="payment-method-card__body">
            <span className="payment-method-card__title">Add a new card</span>
          </span>
        </label>
      </div>

      {paymentMethodsLoading ? <p className="payment-methods__notice">Loading your saved cards...</p> : null}
      {paymentMethodsError ? <p className="payment-methods__notice payment-methods__notice--error">{paymentMethodsError}</p> : null}
      {!paymentMethodsLoading && !paymentMethodsError && paymentMethods.length === 0 ? (
        <p className="payment-methods__notice">No saved cards yet.</p>
      ) : null}
      {isUsingCredits ? (
        <div className="payment-methods__credits-note">
          Applying one credit will cover this lesson. You&apos;ll have {remainingCreditsLabel} after booking.
        </div>
      ) : null}
      {isUsingNewCard ? (
        <div className="payment-method-card__form" role="group" aria-label="New card details">
          {stripeEnabled ? (
            setupIntentError ? (
              <div className="payment-form__status payment-form__status--error payment-form__status--stacked" role="alert">
                <span>{setupIntentError}</span>
                <button
                  type="button"
                  className="payment-methods__cta"
                  onClick={() => void refreshSetupIntent()}
                  disabled={setupIntentLoading}
                >
                  {setupIntentLoading ? (
                    <>
                      <Loader2 className="payment-form__spinner" aria-hidden />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <Plus size={16} aria-hidden />
                      Try again
                    </>
                  )}
                </button>
              </div>
            ) : setupIntentLoading && !setupIntentClientSecret ? (
              <div className="payment-form__status payment-form__status--inline" role="status">
                <Loader2 className="payment-form__spinner" aria-hidden />
                Preparing secure payment form...
              </div>
            ) : setupIntentClientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{ appearance: { theme: "stripe" } }}
                key={setupIntentClientSecret}
              >
                <AddCardForm clientSecret={setupIntentClientSecret} onCardAdded={handleCardAdded} />
              </Elements>
            ) : null
          ) : (
            <div className="payment-form__status payment-form__status--error" role="alert">
              <AlertCircle aria-hidden />
              <span>
                Stripe isn&apos;t configured. Set <code>VITE_STRIPE_PUBLISHABLE_KEY</code> in your environment to enable card payments.
              </span>
            </div>
          )}
          <p className="payment-form__note">
            We use encrypted vault storage and never share your payment details with coaches.
          </p>
        </div>
      ) : null}
    </>
  );

  return (
    <MainLayout
      mobileChrome={isGroupLesson ? "home" : "default"}
      desktopChrome={isGroupLesson ? "home" : "default"}
      showDesktopNav={isGroupLesson ? true : !isGroupLesson}
    >
      <div className={`booking-confirmation${isGroupLesson ? " booking-confirmation--group-modal" : ""}`}>
        <div className={`booking-confirmation__inner${isGroupLesson ? " booking-confirmation__inner--group" : ""}`}>
          {isGroupLesson ? (
            <div className="booking-confirmation__group-panel">
              <div className="booking-confirmation__group-header">
                <button
                  type="button"
                  className="booking-confirmation__group-back"
                  onClick={() => {
                    if (backButtonDestination) {
                      navigate(backButtonDestination);
                    } else {
                      navigate(-1);
                    }
                  }}
                  aria-label="Back to lesson details"
                >
                  <ArrowLeft aria-hidden />
                </button>
                <div className="booking-confirmation__group-title">Checkout</div>
                <button
                  type="button"
                  className="booking-confirmation__group-close"
                  onClick={() => {
                    if (backButtonDestination) {
                      navigate(backButtonDestination);
                    } else {
                      navigate(-1);
                    }
                  }}
                  aria-label="Close checkout"
                >
                  ×
                </button>
              </div>

              <div className="booking-confirmation__group-content">
                <p className="booking-confirmation__section-label">Your session</p>
                <div className="booking-confirmation__summary-card">
                  <div className="booking-confirmation__summary-band">
                    <div className="booking-confirmation__summary-date">{sessionBandDateLabel}</div>
                    <span className="booking-confirmation__summary-level">{summaryLevelLabel}</span>
                  </div>
                  <div className="booking-confirmation__summary-body">
                    <h2 className="booking-confirmation__summary-title">{sessionLabel}</h2>
                    <div className="booking-confirmation__detail-list">
                      <div className="booking-confirmation__detail">
                        <span className="booking-confirmation__detail-emoji" aria-hidden>🕐</span>
                        <span>
                          {timeRange ?? "Time TBD"}
                          {durationLabel ? ` · ${durationLabel}` : ""}
                        </span>
                      </div>
                      {locationLabel ? (
                        <div className="booking-confirmation__detail">
                          <span className="booking-confirmation__detail-emoji" aria-hidden>📍</span>
                          <span>{locationLabel}</span>
                        </div>
                      ) : null}
                      <div className="booking-confirmation__detail">
                        <span className="booking-confirmation__detail-emoji" aria-hidden>👤</span>
                        <span>with {coachName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="booking-confirmation__payment-block">
                  <p className="booking-confirmation__section-label">Payment method</p>
                  <div className="booking-confirmation__payment booking-confirmation__payment--group">
                    {groupPaymentMethods}
                  </div>
                </div>

                <div className="booking-confirmation__price-block">
                  <p className="booking-confirmation__section-label">Price</p>
                  <div className="booking-confirmation__price-card">
                    <div className="booking-confirmation__price-row">
                      <span className="booking-confirmation__price-row-label">Session</span>
                      <span className="booking-confirmation__price-row-value">{subtotalLabel}</span>
                    </div>
                    {!isUsingCredits && !isUsingApplePay && sessionPriceAmount != null ? (
                      <div className="booking-confirmation__price-row is-muted">
                        <span className="booking-confirmation__price-row-label">Card processing fee (3%)</span>
                        <span className="booking-confirmation__price-row-value">${cardProcessingFee.toFixed(2)}</span>
                      </div>
                    ) : null}
                    {isUsingCredits ? (
                      <div className="booking-confirmation__price-row is-muted is-credit">
                        <span className="booking-confirmation__price-row-label">1 group credit applied</span>
                        <span className="booking-confirmation__price-row-value">−{subtotalLabel}</span>
                      </div>
                    ) : null}
                    <div className="booking-confirmation__price-divider" />
                    <div className="booking-confirmation__price-total">
                      <span className="booking-confirmation__price-total-label">Total</span>
                      <span className="booking-confirmation__price-total-value">{totalPriceLabel}</span>
                    </div>
                    {isUsingCredits ? (
                      <div className="booking-confirmation__price-caption">Paid with 1 group credit</div>
                    ) : null}
                  </div>
                </div>

                <div className="booking-confirmation__policy">
                  <span className="booking-confirmation__policy-emoji" aria-hidden>ℹ️</span>
                  <div className="booking-confirmation__policy-copy">
                    Cancel at least 24 hours before your class for a full refund or credit. Cancellations within
                    24 hours are non-refundable.
                  </div>
                </div>

                {consumeError || groupLessonCancelledMessage ? (
                  <span className="booking-confirmation__error">{consumeError ?? groupLessonCancelledMessage}</span>
                ) : null}
                {pendingCreditConfirm ? (
                  <button
                    type="button"
                    className="payment-methods__cta"
                    onClick={() => void handleRetryCreditConfirm()}
                    disabled={isConsumingCredits}
                  >
                    {isConsumingCredits ? "Retrying..." : "Retry confirmation"}
                  </button>
                ) : null}
              </div>

              <div className="booking-confirmation__group-footer">
                <button
                  type="button"
                  className={`fc-button fc-button--primary booking-confirmation__confirm${
                    isUsingApplePay ? " booking-confirmation__confirm--dark" : ""
                  }`}
                  onClick={handleConfirm}
                  disabled={isConfirmDisabled}
                >
                  {groupConfirmButtonLabel}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="booking-confirmation__back"
                onClick={() => {
                  if (backButtonDestination) {
                    navigate(backButtonDestination);
                  } else {
                    navigate(-1);
                  }
                }}
              >
                <ArrowLeft aria-hidden className="booking-confirmation__back-icon" /> {backButtonLabel}
              </button>

              <header className="booking-confirmation__header">
                <div className="booking-confirmation__headline">
                  <span className="booking-confirmation__eyebrow">Review & confirm</span>
                  <h1 className="booking-confirmation__title">{confirmTitle}</h1>
                  <p className="booking-confirmation__subtitle">{headlineSubtitle}</p>
                </div>
              </header>

              <div className="booking-confirmation__layout">
                <section className="booking-confirmation__main">
              <div className="booking-confirmation__summary-card">
                <div className="booking-confirmation__summary-band">
                  <div className="booking-confirmation__summary-date">{summaryDateBand}</div>
                  <span className="booking-confirmation__summary-level">{summaryLevelLabel}</span>
                </div>
                <div className="booking-confirmation__summary-body">
                  <h2 className="booking-confirmation__summary-title">{sessionLabel}</h2>
                  <div className="booking-confirmation__detail-list">
                    <div className="booking-confirmation__detail">
                      <Clock aria-hidden size={16} />
                      <span>
                        {timeRange ?? "Time TBD"}
                        {durationLabel ? ` · ${durationLabel}` : ""}
                      </span>
                    </div>
                    {locationLabel ? (
                      <div className="booking-confirmation__detail">
                        <MapPin aria-hidden size={16} />
                        <span>{locationLabel}</span>
                      </div>
                    ) : null}
                    <div className="booking-confirmation__detail">
                      <CalendarDays aria-hidden size={16} />
                      <span>with {coachName}</span>
                    </div>
                    {spotsLabel ? (
                      <div className="booking-confirmation__detail">
                        <Users aria-hidden size={16} />
                        <span>{spotsLabel}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="booking-confirmation__payment">
                <p className="booking-confirmation__section-label">Payment method</p>
                <div className="payment-methods">
                  {lessonCreditsSection}
                  {digitalWalletSection}
                  {savedCardsSection}
                </div>
              </div>

              <div className="booking-confirmation__price-card">
                <p className="booking-confirmation__section-label">Price</p>
                <div className="booking-confirmation__price-row">
                  <span className="booking-confirmation__price-row-label">{priceLabel}</span>
                  <span className="booking-confirmation__price-row-value">{priceValue}</span>
                </div>
                {cardFeeText ? (
                  <div className="booking-confirmation__price-row is-muted">
                    <span className="booking-confirmation__price-row-label">Processing</span>
                    <span className="booking-confirmation__price-row-value">{cardFeeText}</span>
                  </div>
                ) : null}
                {isUsingCredits ? (
                  <div className="booking-confirmation__price-row is-muted is-credit">
                    <span className="booking-confirmation__price-row-label">1 lesson credit applied</span>
                    <span className="booking-confirmation__price-row-value">{priceValue}</span>
                  </div>
                ) : null}
                <div className="booking-confirmation__price-divider" />
                <div className="booking-confirmation__price-total">
                  <span className="booking-confirmation__price-total-label">Total</span>
                  <span className="booking-confirmation__price-total-value">
                    {isUsingCredits ? "$0.00" : sessionPriceLabel.replace(" per player", "")}
                  </span>
                </div>
                <div className={`booking-confirmation__price-caption${isUsingCredits ? " is-success" : ""}`}>
                  {priceCaption}
                </div>
              </div>

              <div className="booking-confirmation__policy">
                <AlertCircle aria-hidden size={16} />
                <div className="booking-confirmation__policy-copy">
                  Cancel at least 24 hours before your class for a full refund or credit. Cancellations within
                  24 hours are non-refundable.
                </div>
              </div>

              <div className="booking-confirmation__actions">
                <button
                  type="button"
                  className="fc-button fc-button--primary booking-confirmation__confirm"
                  onClick={handleConfirm}
                  disabled={isConfirmDisabled}
                >
                  {isProcessingPayment
                    ? "Processing Apple Pay..."
                    : isConsumingCredits
                      ? "Applying credits..."
                      : confirmButtonLabel}
                  <CheckCircle2 aria-hidden className="booking-confirmation__confirm-icon" />
                </button>
                {consumeError || groupLessonCancelledMessage ? (
                  <span className="booking-confirmation__error">{consumeError ?? groupLessonCancelledMessage}</span>
                ) : null}
                {pendingCreditConfirm ? (
                  <button
                    type="button"
                    className="payment-methods__cta"
                    onClick={() => void handleRetryCreditConfirm()}
                    disabled={isConsumingCredits}
                  >
                    {isConsumingCredits ? "Retrying..." : "Retry confirmation"}
                  </button>
                ) : null}
                <span className="booking-confirmation__disclaimer">{disclaimerCopy}</span>
                {isConfirmed && isGroupLesson ? (
                  <div
                    className={`booking-confirmation__status ${
                      isGroupLesson ? "booking-confirmation__status--success" : "booking-confirmation__status--pending"
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    <h3>{confirmationStatus.title}</h3>
                    <p>{confirmationStatus.copy}</p>
                    <button
                      type="button"
                      className="booking-confirmation__status-action"
                      onClick={() => navigate("/")}
                    >
                      Go to dashboard
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

                <aside className="booking-confirmation__aside">
                <div className="booking-confirmation__aside-card">
                  <h3>What happens next</h3>
                  <ul>
                    {nextStepsItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="booking-confirmation__aside-card booking-confirmation__aside-card--muted">
                  <h3>Need to adjust?</h3>
                  <p>{adjustCopy}</p>
                  <button
                    type="button"
                    className="booking-confirmation__aside-back"
                    onClick={handleAdjustNavigation}
                  >
                    {adjustButtonLabel}
                  </button>
                </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
      {isConfirmationModalOpen ? (
        <BookingStatusModal
          open={isConfirmationModalOpen}
          status={modalStatus}
          data={modalData}
          onClose={() => setIsConfirmationModalOpen(false)}
          onPrimary={() => navigate("/")}
          onSecondary={() => navigate("/")}
          onBrowsePackages={() => navigate("/credits")}
          onAddToCalendar={handleAddToCalendar}
          onShareWithFriends={modalStatus === "CONFIRMED" ? handleShare : undefined}
        />
      ) : null}
    </MainLayout>
  );
};

export default BookingConfirmationPage;
