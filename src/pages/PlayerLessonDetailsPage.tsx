import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  CreditCard,
  Hourglass,
  Info,
  MapPin,
  MessageCircle,
  UserRound,
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
import { bookGroupLessonWithCard, fetchPlayerLessonById, type Lesson } from "../api/playerLessons";
import {
  createPlayerStripePaymentIntent,
  getPlayerStripePaymentMethods,
  getPlayerStripeSetupIntent,
  type PlayerStripePaymentMethod,
} from "../api/playerStripe";
import { consumePackageCredits, fetchPackageCredits, type PackagePurchase } from "../api/playerPackages";
import AddCardForm from "../components/payments/AddCardForm";
import { getStoredAuthToken } from "../services/authToken";

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
  return parseNumber(record.status);
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

const getCoachAvatarUrl = (lesson: Lesson | null) => {
  if (!lesson) return null;
  const record = lesson as Record<string, unknown>;
  const value = record.profile_picture;
  return typeof value === "string" && value.trim() ? value : null;
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

const resolveLessonTypeForCredits = (lesson: Lesson | null) => {
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
  const [isApplePayReady, setIsApplePayReady] = useState(false);
  const [applePayRequest, setApplePayRequest] = useState<StripePaymentRequest | null>(null);
  const [coachProfile, setCoachProfile] = useState<CoachProfileRecord | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const token = useMemo(() => getStoredAuthToken({ preferScheme: "token" }) ?? null, []);
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
      if (!token) {
        setLoading(false);
        setError("Missing authentication token.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchPlayerLessonById({ token, lessonId: id, signal });
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
        const message = err instanceof Error ? err.message : "Unable to load lesson details.";
        setLesson(null);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [id, token],
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

  const lessonStatus = useMemo(() => parseLessonStatus(lesson), [lesson]);
  const isPaymentPending = lessonStatus === 0;
  const isConfirmed = lessonStatus === 1;
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
        const eligible = (creditsResponse.purchases ?? []).filter((purchase) => {
          const remaining = parseNumber(purchase.credits_remaining) ?? 0;
          return remaining > 0 && purchase.id != null;
        });
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
    if (!requiresPlayerAcceptance || !stripePromise || !lessonTotalAmountCents || lessonTotalAmountCents <= 0) {
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
  }, [lessonTotalAmountCents, requiresPlayerAcceptance]);

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

  const handleAcceptAndPay = useCallback(async () => {
    if (!token || !lesson) return;
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
    selectedCreditId,
    selectedPaymentMethodId,
    token,
  ]);

  const handleMessageCoach = useCallback(async () => {
    if (!token || !coachId || !lesson) return;
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
      const message = `Hi ${getCoachName(lesson)}, I have a question about our ${getLessonTypeLabel(lesson).toLowerCase()} on ${formatDateLabel(lesson.start_date_time)}.`;
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
  }, [coachId, coachProfile, lesson, token]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="player-lesson-details__empty" role="status">
          Loading lesson details…
        </div>
      );
    }

    if (error) {
      return (
        <div className="player-lesson-details__empty player-lesson-details__empty--error" role="alert">
          <AlertCircle size={18} aria-hidden />
          <span>{error}</span>
        </div>
      );
    }

    if (!lesson) {
      return (
        <div className="player-lesson-details__empty" role="status">
          Lesson not found.
        </div>
      );
    }

    return (
      <>
        <section
          className={`player-lesson-details__banner player-lesson-details__banner--${
            isConfirmed ? "confirmed" : isAwaitingCoachConfirmation ? "awaiting" : "payment"
          }`}
        >
          <div className="player-lesson-details__banner-icon" aria-hidden>
            {isConfirmed ? <CheckCircle2 size={20} /> : isAwaitingCoachConfirmation ? <Hourglass size={20} /> : <CreditCard size={20} />}
          </div>
          <div className="player-lesson-details__banner-copy">
            <p className="player-lesson-details__banner-title">
              {isConfirmed
                ? "Lesson confirmed"
                : isAwaitingCoachConfirmation
                  ? "Awaiting confirmation"
                  : "Payment pending"}
            </p>
            <p className="player-lesson-details__banner-text">
              {isConfirmed
                ? `${getCoachName(lesson)} has confirmed. See you on ${formatDateLabel(lesson.start_date_time)} at ${formatTimeRangeLabel(lesson.start_date_time, lesson.end_date_time).split(" · ")[0]}.`
                : isAwaitingCoachConfirmation
                  ? `${getCoachName(lesson)} hasn't confirmed this lesson yet. You'll be notified when they do.`
                  : "Accept and pay to confirm this lesson."}
            </p>
          </div>
        </section>

        <section className="player-lesson-details__card player-lesson-details__coach-card">
          <div className="player-lesson-details__coach-avatar">
            {getCoachAvatarUrl(lesson) ? (
              <img src={getCoachAvatarUrl(lesson) ?? ""} alt={getCoachName(lesson)} />
            ) : (
              <span>{getInitials(getCoachName(lesson))}</span>
            )}
          </div>
          <div className="player-lesson-details__coach-copy">
            <p className="player-lesson-details__coach-name">{getCoachName(lesson)}</p>
            <p className="player-lesson-details__coach-role">Tennis Coach</p>
          </div>
        </section>

        <section className="player-lesson-details__card player-lesson-details__detail-list">
          <div className="player-lesson-details__detail-row">
            <div className="player-lesson-details__detail-icon" aria-hidden>
              <CalendarDays size={18} />
            </div>
            <div className="player-lesson-details__detail-copy">
              <p className="player-lesson-details__detail-title">{formatDateLabel(lesson.start_date_time)}</p>
              <p className="player-lesson-details__detail-text">{formatTimeRangeLabel(lesson.start_date_time, lesson.end_date_time)}</p>
            </div>
          </div>
          <div className="player-lesson-details__detail-row">
            <div className="player-lesson-details__detail-icon" aria-hidden>
              <MapPin size={18} />
            </div>
            <div className="player-lesson-details__detail-copy">
              <p className="player-lesson-details__detail-title">{getLocationTitle(lesson)}</p>
            </div>
          </div>
          <div className="player-lesson-details__detail-row">
            <div className="player-lesson-details__detail-icon" aria-hidden>
              <UserRound size={18} />
            </div>
            <div className="player-lesson-details__detail-copy">
              <p className="player-lesson-details__detail-title">{getLessonTypeLabel(lesson)}</p>
            </div>
          </div>
          <div className="player-lesson-details__detail-row">
            <div className="player-lesson-details__detail-icon" aria-hidden>
              <CreditCard size={18} />
            </div>
            <div className="player-lesson-details__detail-copy">
              <p className="player-lesson-details__detail-title">
                {lessonTotalAmountCents != null
                  ? `$${(lessonTotalAmountCents / 100).toFixed(2)} ${isConfirmed ? "paid" : "total"}`
                  : isConfirmed
                    ? "Payment completed"
                    : "Payment pending"}
              </p>
              {lessonTotalAmountCents != null ? (
                <p className="player-lesson-details__detail-text">
                  {[
                    lessonPriceBreakdown ? `$${lessonPriceBreakdown.coachFee.toFixed(2)} coach fee` : null,
                    lessonPriceBreakdown ? `$${lessonPriceBreakdown.creditFee.toFixed(2)} credit fee` : null,
                    lessonPriceBreakdown ? `$${lessonPriceBreakdown.serviceFee.toFixed(2)} service fee` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="player-lesson-details__status-panel">
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
                  <span>{getCoachName(lesson)} will confirm this lesson soon</span>
                </div>
                <div className="player-lesson-details__step">
                  <span className="player-lesson-details__step-number">3</span>
                  <span>Your card won't be charged until {getCoachName(lesson)} confirms</span>
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
          {requiresPlayerAcceptance ? (
            <>
              <p className="player-lesson-details__status-pending">Payment pending. Accept and pay to confirm this lesson.</p>
              <div className="player-lesson-details__payment-choice">
                <label>
                  <input
                    type="radio"
                    name="payment-choice"
                    checked={paymentChoice === "credits"}
                    onChange={() => setPaymentChoice("credits")}
                    disabled={!credits.length}
                  />
                  Credits
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment-choice"
                    checked={paymentChoice === "apple-pay"}
                    onChange={() => setPaymentChoice("apple-pay")}
                    disabled={!isApplePayReady}
                  />
                  Apple Pay
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment-choice"
                    checked={paymentChoice === "card"}
                    onChange={() => setPaymentChoice("card")}
                  />
                  Card
                </label>
              </div>
              {paymentChoice === "credits" ? (
                <div className="player-lesson-details__payment-block">
                  {creditsLoading ? <p>Loading credits…</p> : null}
                  {creditsError ? <p className="player-lesson-details__status-error">{creditsError}</p> : null}
                  {!creditsLoading && !credits.length ? <p>No eligible credits available for this coach.</p> : null}
                  {credits.length > 0 ? (
                    <select
                      value={selectedCreditId ?? ""}
                      onChange={(event) => setSelectedCreditId(event.target.value)}
                      disabled={submitting}
                    >
                      {credits.map((credit) => (
                        <option key={String(credit.id)} value={String(credit.id)}>
                          {`Credits remaining: ${credit.credits_remaining ?? 0}`}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              ) : paymentChoice === "apple-pay" ? (
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
                  {stripePromise && setupIntentSecret ? (
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
                className="player-lesson-details__accept"
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
                  : paymentChoice === "apple-pay"
                    ? "Accept with Apple Pay"
                    : "Accept Lesson"}
              </button>
            </>
          ) : null}
          {messageError ? <p className="player-lesson-details__status-error">{messageError}</p> : null}
        </section>
        <section className="player-lesson-details__actions">
          {isConfirmed ? (
            <button type="button" className="player-lesson-details__action player-lesson-details__action--primary">
              <CalendarPlus size={16} aria-hidden />
              <span>Add to calendar</span>
            </button>
          ) : null}
          <button
            type="button"
            className="player-lesson-details__action player-lesson-details__action--secondary"
            onClick={() => void handleMessageCoach()}
            disabled={messageLoading || !token || !coachId}
          >
            <MessageCircle size={16} aria-hidden />
            <span>
              {messageLoading ? "Opening messages…" : `Message ${getCoachName(lesson).split(" ")[0] ?? "coach"}`}
            </span>
          </button>
          <button type="button" className="player-lesson-details__action player-lesson-details__action--danger">
            Cancel lesson
          </button>
        </section>
      </>
    );
  }, [
    actionError,
    actionSuccess,
    credits,
    creditsError,
    creditsLoading,
    error,
    handleAcceptAndPay,
    handleCardAdded,
    handleMessageCoach,
    coachId,
    isConfirmed,
    isApplePayReady,
    isAwaitingCoachConfirmation,
    lesson,
    lessonPriceBreakdown,
    lessonRecord,
    lessonTotalAmountCents,
    loading,
    messageError,
    messageLoading,
    paymentChoice,
    paymentMethods,
    paymentMethodsError,
    paymentMethodsLoading,
    requiresPlayerAcceptance,
    selectedCreditId,
    selectedPaymentMethodId,
    setupIntentError,
    setupIntentLoading,
    setupIntentSecret,
    submitting,
  ]);

  return (
    <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
      <div className="player-lesson-details">
        <Link to="/player/calendar" className="player-lesson-details__back">
          <ArrowLeft size={16} aria-hidden />
          Back to calendar
        </Link>
        {content}
      </div>
    </MainLayout>
  );
};

export default PlayerLessonDetailsPage;
