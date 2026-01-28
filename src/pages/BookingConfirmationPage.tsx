import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Apple,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Star,
  Users,
  Wallet,
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
import GroupLessonConfirmationModal from "../components/group-lessons/GroupLessonConfirmationModal";
import PrivateLessonConfirmationModal from "../components/private-lessons/PrivateLessonConfirmationModal";
import AddCardForm from "../components/payments/AddCardForm";
import { findCoachProfile, type GroupParticipant } from "../data/mockCoachProfiles";
import {
  fetchUpcomingGroupLessonById,
  mapUpcomingGroupLesson,
  type GroupLesson,
} from "../api/groupLessons";
import {
  fetchPackageCredits,
  fetchPackageCreditsBalance,
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
import { joinLesson } from "../api/playerLessons";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

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
  const [isConsumingCredits, setIsConsumingCredits] = useState(false);
  const [consumeError, setConsumeError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [groupLesson, setGroupLesson] = useState<GroupLesson | null>(null);
  const [groupLessonLoading, setGroupLessonLoading] = useState(false);
  const [groupLessonError, setGroupLessonError] = useState<string | null>(null);
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

  const lessonDetails = selectedSlot ? profile?.booking.lessonTypes.find((type) => type.id === selectedSlot.lessonType) : undefined;

  const isProfileGroupLesson = selectedSlot?.lessonType === "group";
  const isGroupLesson = Boolean(groupLesson) || isProfileGroupLesson;

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
  const locationLabel = groupLesson?.locationName ?? profile?.location ?? profile?.coachingLocations[0];
  const resolvedCoachName = groupLesson?.coachName ?? profile?.name ?? "your coach";
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

  useEffect(() => {
    const controller = new AbortController();

    if (!resolvedCoachId || !authToken) {
      setCreditsBalance(null);
      return () => controller.abort();
    }

    fetchPackageCreditsBalance({
      token: authToken,
      coachId: resolvedCoachId,
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

  const lessonType = groupLesson ? "group" : selectedSlot?.lessonType ?? "private";
  const eligibleCredits = useMemo(() => {
    const allowedForLesson = (purchase: PackagePurchase) => {
      const allowed = purchase.lesson_types_allowed;
      if (Array.isArray(allowed) && allowed.length > 0) {
        return allowed.includes(lessonType);
      }
      return true;
    };
    return credits.filter(
      (purchase) => (purchase.credits_remaining ?? 0) > 0 && allowedForLesson(purchase),
    );
  }, [credits, lessonType]);

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
  const coachAvatar = groupLesson?.coachAvatarUrl ?? profile?.imageUrl;
  const coachTitle = profile?.title ?? (groupLesson ? `${groupLesson.skillLabel} • Group session` : undefined);
  const coachRating = profile?.rating;
  const coachReviewCount = profile?.reviewCount;
  const durationLabel = groupLesson ? `${groupLesson.durationMinutes} min` : selectedSlot?.duration;
  const confirmTitle = groupLesson ? `Confirm your spot in ${groupLesson.title}` : `Confirm your lesson with ${coachName}`;
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
    ? `Secure your spot instantly in ${coachFirstName}'s group lesson — no coach approval needed.`
    : `Lock in your preferred time. We’ll notify ${coachFirstName} once you submit the request.`;

  const selectedSavedCard = paymentMethods.find((card) => card.id === paymentMethod) ?? null;
  const canUseCredits = eligibleCredits.length > 0;
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
      return isGroupLesson ? "Confirm with credits" : "Request with credits";
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

  const isConfirmDisabled =
    isConfirmed ||
    isConsumingCredits ||
    isProcessingPayment ||
    isUsingNewCard ||
    (groupLessonId ? groupLessonLoading : false) ||
    (isUsingCredits && (!canUseCredits || creditsLoading || !authToken));

  const handleConfirm = async () => {
    setConsumeError(null);

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
              if (groupLesson) {
                const coachId = groupLesson.coachId;
                const locationId = groupLesson.locationId;
                const startDateTime = groupLesson.startDateTime;
                const endDateTime = groupLesson.endDateTime;
                if (!coachId || !locationId || !startDateTime || !endDateTime) {
                  throw new Error("Missing lesson details for Apple Pay.");
                }
                await joinLesson({
                  token: authToken,
                  lessonId: groupLesson.id,
                  coachId,
                  startDateTime,
                  endDateTime,
                  startDateTimeTz: startDateTime,
                  endDateTimeTz: endDateTime,
                  locationId,
                  court: groupLesson.court ?? 0,
                  status: "CONFIRMED",
                  paymentMethodId,
                });
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
        const lessonIdForConsume = groupLesson?.id ?? selectedSlot?.id ?? slotId ?? groupLessonId;
        const bestPurchase = eligibleCredits[0];
        const numericLessonId = extractNumericLessonId(lessonIdForConsume);
        if (!numericLessonId) {
          setConsumeError("We need a numeric lesson ID to reserve credits.");
          setPaymentMethod(fallbackCardId);
          return;
        }
        await consumePackageCredits({
          token: authToken,
          coachId: resolvedCoachId,
          lessonType,
          lessonId: numericLessonId,
          purchaseId: bestPurchase?.id,
        });
        setIsConfirmed(true);
        setIsConfirmationModalOpen(true);
        try {
          const refreshed = await fetchPackageCredits({
            token: authToken,
            coachId: resolvedCoachId,
            includeExpired: false,
          });
          setCredits(refreshed?.purchases ?? []);
          setCreditsError(null);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to refresh credits.";
          setCreditsError(message);
        }
        try {
          const refreshedBalance = await fetchPackageCreditsBalance({
            token: authToken,
            coachId: resolvedCoachId,
          });
          setCreditsBalance(refreshedBalance ?? null);
        } catch {
          setCreditsBalance(null);
        }
      } catch (err) {
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

    setIsConfirmed(true);
    if (groupLesson || !isGroupLesson) {
      setIsConfirmationModalOpen(true);
    }
  };

  const privateLessonStart = useMemo(() => {
    if (isGroupLesson || !selectedDate || !selectedSlot) {
      return undefined;
    }

    const startMinutes = parseTimeToMinutes(selectedSlot.time);
    if (startMinutes == null) {
      return undefined;
    }

    const [yearPart, monthPart, dayPart] = (selectedDate.id ?? "").split("-");
    const year = Number.parseInt(yearPart ?? "", 10);
    const month = Number.parseInt(monthPart ?? "", 10);
    const day = Number.parseInt(dayPart ?? "", 10);

    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return undefined;
    }

    const hours = Math.floor(startMinutes / 60);
    const minutes = startMinutes % 60;
    const startDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return startDate;
  }, [isGroupLesson, selectedDate, selectedSlot]);

  const privateLessonEnd = useMemo(() => {
    if (!privateLessonStart || !selectedSlot?.duration) {
      return undefined;
    }

    const durationMinutes = parseDurationToMinutes(selectedSlot.duration);
    if (durationMinutes == null) {
      return undefined;
    }

    return new Date(privateLessonStart.getTime() + durationMinutes * 60 * 1000);
  }, [privateLessonStart, selectedSlot?.duration]);

  const lessonStatusLabel = isGroupLesson ? "Confirmed" : "Pending coach approval";

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

  const lessonCreditsSection = (
    <div className="payment-methods__group">
      <span className="payment-methods__group-label">Lesson credits</span>
      <label
        className={`payment-method-card payment-method-card--credits${
          isUsingCredits ? " payment-method-card--selected" : ""
        }${canUseCredits ? "" : " payment-method-card--disabled"}`}
      >
        <input
          type="radio"
          name="payment-method"
          value="credits"
          checked={isUsingCredits}
          onChange={() => setPaymentMethod("credits")}
          disabled={!canUseCredits || creditsLoading || !authToken}
        />
        <span className="payment-method-card__selector" aria-hidden />
        <span className="payment-method-card__icon">
          <Wallet aria-hidden size={18} />
        </span>
        <span className="payment-method-card__body">
          <span className="payment-method-card__title">Use lesson credits</span>
          <span className="payment-method-card__subtitle">
            {creditsLoading
              ? "Checking credits…"
              : creditsError
                ? creditsError
                : !authToken
                    ? "Sign in to use credits."
                    : canUseCredits
                    ? `${creditSummary.remaining} credit${creditSummary.remaining === 1 ? "" : "s"} available for this lesson type${heldCreditsLabel}`
                    : "No credits available for this lesson type."}
          </span>
        </span>
        {creditSummary.nextExpiry && canUseCredits ? (
          <span className="payment-method-card__tag payment-method-card__tag--success">Next expiry {creditSummary.nextExpiry}</span>
        ) : null}
      </label>
      {isUsingCredits ? (
        <div className="payment-methods__credits-note">
          Applying one credit will cover this lesson. You'll have {remainingCreditsLabel} after booking.
        </div>
      ) : null}
    </div>
  );

  const nextStepsItems = isGroupLesson
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

  const confirmationStatus = isGroupLesson
    ? {
        title: "Lesson confirmed!",
        copy: `You're all set for ${lessonDateLabel ?? "your upcoming lesson"} at ${timeRange ?? selectedSlot?.time}. We'll send a receipt to your email and keep you posted on any updates.`,
      }
    : {
        title: "Booking request sent!",
        copy: `We've notified ${coachFirstName}. You'll hear from us as soon as they confirm—your payment will only process after approval.`,
      };

  const shouldShowEmptyState = groupLessonId
    ? !groupLessonLoading && !groupLesson
    : !profile || !selectedDate || !selectedSlot;

  if (groupLessonId && groupLessonLoading) {
    return (
      <MainLayout>
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
      <MainLayout>
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

  return (
    <MainLayout>
      <div className="booking-confirmation">
        <div className="booking-confirmation__inner">
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
            <section className="booking-confirmation__card">
              <div className="booking-confirmation__coach">
                {coachAvatar ? (
                  <img className="booking-confirmation__coach-avatar" src={coachAvatar} alt="" />
                ) : (
                  <span className="booking-confirmation__coach-avatar booking-confirmation__coach-avatar--placeholder" aria-hidden>
                    {coachFirstName.charAt(0)}
                  </span>
                )}
                <div className="booking-confirmation__coach-meta">
                  <h2 className="booking-confirmation__coach-name">{coachName}</h2>
                  {coachTitle ? <p className="booking-confirmation__coach-title">{coachTitle}</p> : null}
                  {coachRating != null ? (
                    <div className="booking-confirmation__coach-rating">
                      <Star size={18} fill="#FDB022" stroke="none" aria-hidden />
                      {coachRating.toFixed(1)}
                      {coachReviewCount != null ? (
                        <span className="booking-confirmation__coach-reviews">({coachReviewCount} reviews)</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="booking-confirmation__details">
                <div className="booking-confirmation__detail">
                  <CalendarDays aria-hidden size={20} />
                  <div className="booking-confirmation__detail-copy">
                    <span className="booking-confirmation__detail-label">When</span>
                    <span className="booking-confirmation__detail-primary">{lessonDateLabel ?? "To be scheduled"}</span>
                    {timeRange ? (
                      <span className="booking-confirmation__detail-secondary">{timeRange}</span>
                    ) : null}
                  </div>
                </div>

                <div className="booking-confirmation__detail">
                  <Clock aria-hidden size={20} />
                  <div className="booking-confirmation__detail-copy">
                    <span className="booking-confirmation__detail-label">Lesson</span>
                    <span className="booking-confirmation__detail-primary">{lessonLabel}</span>
                    {durationLabel ? (
                      <span className="booking-confirmation__detail-secondary">{durationLabel}</span>
                    ) : null}
                  </div>
                </div>

                {locationLabel ? (
              <div className="booking-confirmation__detail">
                <MapPin aria-hidden size={20} />
                <div className="booking-confirmation__detail-copy">
                  <span className="booking-confirmation__detail-label">Location</span>
                  <span className="booking-confirmation__detail-primary">{locationLabel}</span>
                  {spotsLabel ? (
                    <span className="booking-confirmation__detail-secondary">{spotsLabel}</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isGroupLesson ? (
              <div className="booking-confirmation__group-roster">
                <div className="booking-confirmation__group-roster-header">
                  <span className="booking-confirmation__group-roster-icon" aria-hidden>
                    <Users size={18} />
                  </span>
                  <div className="booking-confirmation__group-roster-heading">
                    <span className="booking-confirmation__group-roster-label">Who's already in</span>
                    {rosterCaption ? (
                      <span className="booking-confirmation__group-roster-caption">{rosterCaption}</span>
                    ) : null}
                  </div>
                </div>

                {participantCount > 0 ? (
                  <ul className="booking-confirmation__group-roster-list">
                    {participants.map((participant) => (
                      <li key={participant.id} className="booking-confirmation__group-roster-item">
                        <span className="booking-confirmation__group-roster-avatar" aria-hidden>
                          {participant.avatarUrl ? (
                            <img src={participant.avatarUrl} alt="" />
                          ) : (
                            getInitials(participant.name)
                          )}
                        </span>
                        <div className="booking-confirmation__group-roster-body">
                          <span className="booking-confirmation__group-roster-name">{participant.name}</span>
                          <span className="booking-confirmation__group-roster-meta">
                            {participant.skillLevel ?? "Skill level pending"}
                            {participant.focusArea ? ` • ${participant.focusArea}` : ""}
                          </span>
                          {participant.joinedLabel ? (
                            <span className="booking-confirmation__group-roster-joined">{participant.joinedLabel}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="booking-confirmation__group-roster-empty">
                    <p>
                      You're first in line for this session. Invite a friend or grab a spot before they're gone!
                    </p>
                  </div>
                )}

                {openSpots > 0 ? (
                  <div className="booking-confirmation__group-roster-footer">
                    +{openSpots} spot{openSpots === 1 ? "" : "s"} open
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="booking-confirmation__price">
            <div>
              <span className="booking-confirmation__price-label">{priceLabel}</span>
              <span className="booking-confirmation__price-value">{priceValue}</span>
            </div>
            <span className="booking-confirmation__price-caption">{priceCaption}</span>
          </div>

          <div className="booking-confirmation__payment">
            <div className="booking-confirmation__payment-header">
              <div>
                <h3>Payment method</h3>
                <p>Choose how you’d like to take care of this lesson.</p>
              </div>
              <span className="booking-confirmation__payment-secure">
                <ShieldCheck aria-hidden size={16} /> Secure checkout
              </span>
            </div>

            <div className="payment-methods">
              {canUseCredits ? lessonCreditsSection : null}
              {savedCardsSection}
              {digitalWalletSection}
              {!canUseCredits ? lessonCreditsSection : null}
              <div className="payment-packages-banner">
                <span className="payment-packages-banner__icon">
                  <Package aria-hidden size={20} />
                </span>
                <div className="payment-packages-banner__body">
                  <h4>Need more credits?</h4>
                  <p>Lock in savings with lesson packages and top up your credit balance anytime.</p>
                </div>
                <button
                  type="button"
                  className="payment-packages-banner__action"
                  onClick={() => navigate("/find-coaches")}
                >
                  Browse packages
                </button>
              </div>
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
            {consumeError ? <span className="booking-confirmation__error">{consumeError}</span> : null}
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
        </div>
      </div>
      {isConfirmationModalOpen && !isGroupLesson ? (
        <PrivateLessonConfirmationModal
          coachName={coachName}
          coachTitle={coachTitle}
          lessonLabel={lessonLabel}
          dateLabel={lessonDateLabel}
          timeRange={timeRange}
          locationLabel={locationLabel}
          statusLabel={lessonStatusLabel}
          statusCopy={confirmationStatus.copy}
          onClose={() => setIsConfirmationModalOpen(false)}
          startDate={privateLessonStart}
          endDate={privateLessonEnd}
        />
      ) : null}
      {isConfirmationModalOpen && groupLesson ? (
        <GroupLessonConfirmationModal
          lesson={groupLesson}
          onClose={() => setIsConfirmationModalOpen(false)}
        />
      ) : null}
    </MainLayout>
  );
};

export default BookingConfirmationPage;
