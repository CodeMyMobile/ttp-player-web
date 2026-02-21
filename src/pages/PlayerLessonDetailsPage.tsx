import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import MainLayout from "../components/MainLayout";
import LessonDetailCard from "../components/LessonDetailCard";
import { fetchPlayerLessonById, type Lesson } from "../api/playerLessons";
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

const resolveLessonTypeForCredits = (lesson: Lesson | null) => {
  if (!lesson) return "private";
  const record = lesson as Record<string, unknown>;
  const typeId = parseNumber(record.lessontype_id ?? record.lesson_type_id ?? record.lessonTypeId);
  const typeLabel = String(record.lesson_type_name ?? "").toLowerCase();
  if (typeId === 2 || typeId === 3 || typeId === 4 || typeLabel.includes("group") || typeLabel.includes("semi")) {
    return "group";
  }
  return "private";
};

const extractPaymentMethods = (payload: PlayerStripePaymentMethod[] | Record<string, unknown> | null | undefined) => {
  if (!payload) return [] as PlayerStripePaymentMethod[];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.payment_methods)) return payload.payment_methods as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.data)) return payload.data as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.results)) return payload.results as PlayerStripePaymentMethod[];
  return [] as PlayerStripePaymentMethod[];
};

const PlayerLessonDetailsPage = () => {
  const { id } = useParams<{ id?: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<"card" | "credits">("card");
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

  const token = useMemo(() => getStoredAuthToken({ preferScheme: "token" }) ?? null, []);

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

  useEffect(() => {
    if (!token || !lesson || !isPaymentPending) return;
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
  }, [isPaymentPending, lesson, token]);

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
      if (paymentChoice === "credits") {
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
        if (!stripePromise) {
          throw new Error("Stripe is not configured in this environment.");
        }
        const intentResponse = await createPlayerStripePaymentIntent({
          token,
          lessonId: lesson.id,
          paymentMethodId: selectedPaymentMethodId,
        });
        const intentRecord = intentResponse as Record<string, unknown>;
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
      await loadLesson();
      setActionSuccess("Lesson accepted successfully.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to accept lesson.");
    } finally {
      setSubmitting(false);
    }
  }, [lesson, loadLesson, paymentChoice, selectedCreditId, selectedPaymentMethodId, token]);

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
        <LessonDetailCard lesson={lesson} />
        <section className="player-lesson-details__status-panel">
          {isConfirmed ? (
            <p className="player-lesson-details__status-success">Lesson confirmed and payment completed.</p>
          ) : null}
          {isPaymentPending ? (
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
                  (paymentChoice === "credits" && !selectedCreditId)
                }
              >
                {submitting ? "Processing…" : "Accept Lesson"}
              </button>
            </>
          ) : null}
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
    isConfirmed,
    isPaymentPending,
    lesson,
    loading,
    paymentChoice,
    paymentMethods,
    paymentMethodsError,
    paymentMethodsLoading,
    selectedCreditId,
    selectedPaymentMethodId,
    setupIntentError,
    setupIntentLoading,
    setupIntentSecret,
    submitting,
  ]);

  return (
    <MainLayout>
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
