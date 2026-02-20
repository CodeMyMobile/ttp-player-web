import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import AddCardForm from "../components/payments/AddCardForm";
import { getStoredAuthToken } from "../services/authToken";
import {
  acceptLessonInvite,
  beginLessonInvite,
  claimLessonInvite,
  getLessonInviteStripePaymentMethods,
  getLessonInviteStripeSetupIntent,
  payLessonInvite,
  type LessonInviteActionResponse,
  type LessonInviteBeginResponse,
  type LessonInviteClaimResponse,
} from "../api/lessonInvites";
import type { PlayerStripePaymentMethod, PlayerStripePaymentMethodListResponse } from "../api/playerStripe";
import { decideInviteNextAction, extractInviteTokenFromRoute } from "../utils/lessonInviteFlow";

import "./LessonInvitePage.css";

type InviteStatusCode =
  | "expired"
  | "full"
  | "not_found"
  | "invite_mismatch"
  | "lesson_full"
  | "payment_required"
  | "lesson_archived"
  | "coach_stripe_missing"
  | "pricing_error"
  | null;

type NormalizedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
};

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_STRIPE_PUBLISHABLEKEY ??
  "";

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const lowercase = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const resolveErrorCode = (error: unknown): InviteStatusCode => {
  if (!error || typeof error !== "object") return null;
  const err = error as Error & { data?: Record<string, unknown>; status?: number };
  if (err.status === 404) return "not_found";
  if (err.status === 410) return "lesson_archived";
  const codeCandidates = [
    err.data?.error_code,
    err.data?.code,
    err.data?.error,
    err.data?.message,
    err.message,
  ];
  const code = codeCandidates.map(lowercase).find(Boolean) || "";
  if (code.includes("expired")) return "expired";
  if (code.includes("not_found") || code.includes("not found")) return "not_found";
  if (code.includes("invite_mismatch")) return "invite_mismatch";
  if (code.includes("lesson_archived")) return "lesson_archived";
  if (code.includes("coach_stripe_missing")) return "coach_stripe_missing";
  if (code.includes("pricing")) return "pricing_error";
  if (code.includes("lesson_full")) return "lesson_full";
  if (code.includes("payment_required")) return "payment_required";
  if (code.includes("full")) return "full";
  return null;
};

const errorMessageForCode = (code: InviteStatusCode) => {
  if (code === "expired") return "This invite has expired.";
  if (code === "full" || code === "lesson_full") return "This lesson is already full.";
  if (code === "not_found") return "We couldn’t find this invite.";
  if (code === "invite_mismatch") return "This invite does not match your account.";
  if (code === "lesson_archived") return "This lesson is no longer available.";
  if (code === "payment_required") return "Payment is required to claim this invite.";
  if (code === "coach_stripe_missing" || code === "pricing_error") {
    return "This lesson cannot be paid online right now. Please contact support.";
  }
  return null;
};

const resolveInviteStatusCode = (payload: LessonInviteBeginResponse | null): InviteStatusCode => {
  if (!payload) return null;
  const statusRaw = lowercase(payload.status || payload.state);
  if (!statusRaw) return null;
  if (statusRaw.includes("expired")) return "expired";
  if (statusRaw.includes("lesson_archived") || statusRaw.includes("archived")) return "lesson_archived";
  if (statusRaw.includes("not_found") || statusRaw.includes("not found")) return "not_found";
  if (statusRaw.includes("lesson_full")) return "lesson_full";
  if (statusRaw.includes("full")) return "full";
  return null;
};

const resolveDefaultId = (
  payload: PlayerStripePaymentMethodListResponse | PlayerStripePaymentMethod[] | null | undefined,
) => {
  if (!payload || Array.isArray(payload)) {
    return undefined;
  }
  return (
    payload.default_payment_method_id ||
    payload.default_payment_method ||
    (typeof (payload as { defaultPaymentMethodId?: unknown }).defaultPaymentMethodId === "string"
      ? ((payload as { defaultPaymentMethodId?: string }).defaultPaymentMethodId as string)
      : undefined)
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
  return [];
};

const normalizeBrand = (brand?: string) => {
  if (!brand) return "Card";
  const normalized = brand.trim();
  if (!normalized) return "Card";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizePaymentMethod = (method: PlayerStripePaymentMethod, defaultId?: string): NormalizedPaymentMethod => {
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

const formatExpiry = (month?: number, year?: number) => {
  if (!month || !year) return "";
  const monthString = month < 10 ? `0${month}` : `${month}`;
  return `${monthString}/${String(year).slice(-2)}`;
};

const extractRedirectTarget = (...payloads: Array<Record<string, unknown> | null | undefined>) => {
  for (const payload of payloads) {
    if (!payload) continue;
    const targetCandidates = [
      payload.redirect_url,
      payload.redirect,
      payload.redirectTo,
      payload.next_url,
      payload.nextUrl,
      (payload.data as Record<string, unknown> | undefined)?.redirect_url,
      (payload.data as Record<string, unknown> | undefined)?.redirect,
    ];
    const resolved = targetCandidates.find((candidate) => typeof candidate === "string" && candidate.trim());
    if (typeof resolved === "string" && resolved.trim()) {
      return resolved.trim();
    }
  }
  return null;
};

const extractFallbackLessonPath = (...payloads: Array<Record<string, unknown> | null | undefined>) => {
  for (const payload of payloads) {
    if (!payload) continue;
    const idCandidates = [
      payload.lesson_id,
      payload.lessonId,
      (payload.lesson as Record<string, unknown> | undefined)?.id,
      (payload.invite as Record<string, unknown> | undefined)?.lesson_id,
      (payload.invite as Record<string, unknown> | undefined)?.lessonId,
    ];
    const lessonId = idCandidates.find(
      (value) => (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim()),
    );
    if (typeof lessonId === "number") {
      return `/group-lessons/${lessonId}`;
    }
    if (typeof lessonId === "string" && lessonId.trim()) {
      return `/group-lessons/${lessonId.trim()}`;
    }
  }
  return "/group-lessons";
};

const redirectTo = (target: string) => {
  if (!target) return;
  if (/^https?:\/\//i.test(target)) {
    window.location.assign(target);
    return;
  }

  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  if (target.startsWith("#")) {
    window.location.assign(`${base}${target}`);
    return;
  }

  const normalizedTarget = target.startsWith("/") ? target : `/${target}`;
  window.location.assign(`${base}#${normalizedTarget}`);
};

const resolveTitle = (payload: LessonInviteBeginResponse | null) => {
  if (!payload) return "Lesson invite";
  const invite = payload.invite as Record<string, unknown> | undefined;
  return (
    (typeof payload.lesson_title === "string" ? payload.lesson_title : null) ||
    (typeof payload.title === "string" ? payload.title : null) ||
    (typeof invite?.lesson_title === "string" ? invite.lesson_title : null) ||
    (typeof invite?.title === "string" ? invite.title : null) ||
    "Lesson invite"
  );
};

const resolveMetaLines = (payload: LessonInviteBeginResponse | null) => {
  if (!payload) return [];
  const invite = payload.invite as Record<string, unknown> | undefined;
  const coachName =
    (typeof payload.coach_name === "string" ? payload.coach_name : null) ||
    (typeof invite?.coach_name === "string" ? invite.coach_name : null) ||
    (typeof (invite?.coach as Record<string, unknown> | undefined)?.name === "string"
      ? ((invite?.coach as Record<string, unknown>).name as string)
      : null);
  const startAt =
    (typeof payload.start_at === "string" ? payload.start_at : null) ||
    (typeof payload.starts_at === "string" ? payload.starts_at : null) ||
    (typeof invite?.start_at === "string" ? invite.start_at : null) ||
    (typeof invite?.starts_at === "string" ? invite.starts_at : null);
  const location =
    (typeof payload.location === "string" ? payload.location : null) ||
    (typeof invite?.location === "string" ? invite.location : null);

  const lines = [];
  if (coachName) lines.push(`Coach: ${coachName}`);
  if (startAt) lines.push(`Start: ${new Date(startAt).toLocaleString()}`);
  if (location) lines.push(`Location: ${location}`);
  return lines;
};

const isActionBlocked = (statusCode: InviteStatusCode) =>
  statusCode === "expired" ||
  statusCode === "not_found" ||
  statusCode === "full" ||
  statusCode === "lesson_full" ||
  statusCode === "lesson_archived";

const LessonInvitePage = () => {
  const params = useParams<{ token?: string }>();
  const location = useLocation();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const token = useMemo(
    () => extractInviteTokenFromRoute({ paramsToken: params.token, pathname: location.pathname, hash: location.hash }),
    [location.hash, location.pathname, params.token],
  );
  const [invitePayload, setInvitePayload] = useState<LessonInviteBeginResponse | null>(null);
  const [claimPayload, setClaimPayload] = useState<LessonInviteClaimResponse | null>(null);
  const [beginLoading, setBeginLoading] = useState(true);
  const [beginError, setBeginError] = useState<string | null>(null);
  const [beginStatusCode, setBeginStatusCode] = useState<InviteStatusCode>(null);
  const [autoClaiming, setAutoClaiming] = useState(false);
  const [autoClaimAttempted, setAutoClaimAttempted] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(getStoredAuthToken({ preferScheme: "token" }));
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatusCode, setActionStatusCode] = useState<InviteStatusCode>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptCompleted, setAcceptCompleted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);
  const [setupIntentLoading, setSetupIntentLoading] = useState(false);
  const [setupIntentError, setSetupIntentError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<NormalizedPaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const acceptTriggeredRef = useRef(false);

  const pageStatusCode = beginStatusCode || resolveInviteStatusCode(invitePayload);
  const blockedInvite = isActionBlocked(pageStatusCode);
  const requiresPaymentFromError = actionStatusCode === "payment_required";
  const actionType = useMemo(
    () => decideInviteNextAction({ beginPayload: invitePayload, claimPayload }),
    [claimPayload, invitePayload],
  );
  const shouldShowPayment = actionType === "pay" || requiresPaymentFromError;
  const mismatchState = pageStatusCode === "invite_mismatch" || actionStatusCode === "invite_mismatch";
  const title = resolveTitle(invitePayload);
  const metaLines = resolveMetaLines(invitePayload);
  const stripeEnabled = Boolean(stripePromise);

  const persistClaimSession = useCallback(
    (claimResponse: LessonInviteClaimResponse) => {
      const accessToken = claimResponse.access_token;
      const refreshToken = claimResponse.refresh_token;

      if (accessToken) {
        localStorage.setItem("authToken", accessToken);
      }
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      }
      localStorage.setItem(
        "authLoginResponse",
        JSON.stringify({
          ...claimResponse,
        }),
      );

      const normalized = getStoredAuthToken({ preferScheme: "token" });
      setSessionToken(normalized);
    },
    [],
  );

  const completeFlow = useCallback(
    (responsePayload: LessonInviteActionResponse | null) => {
      const redirectTarget =
        extractRedirectTarget(responsePayload, claimPayload as Record<string, unknown>, invitePayload as Record<string, unknown>) ||
        extractFallbackLessonPath(responsePayload, claimPayload as Record<string, unknown>, invitePayload as Record<string, unknown>);
      redirectTo(redirectTarget);
    },
    [claimPayload, invitePayload],
  );

  const runAccept = useCallback(
    async (authToken: string) => {
      if (!token || accepting) return;
      setAccepting(true);
      setAcceptCompleted(false);
      setActionError(null);
      setActionStatusCode(null);
      setSuccessMessage(null);
      try {
        const response = await acceptLessonInvite(token, authToken);
        setAcceptCompleted(true);
        setSuccessMessage("Invite accepted. Redirecting…");
        completeFlow(response);
      } catch (error) {
        const code = resolveErrorCode(error);
        setActionStatusCode(code);
        const message = errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to accept invite.");
        setActionError(message);
      } finally {
        setAccepting(false);
      }
    },
    [accepting, completeFlow, token],
  );

  const runPay = useCallback(
    async (paymentMethodId: string) => {
      if (!token || !sessionToken || paying) return;
      if (!paymentMethodId.trim()) {
        setActionError("Please select or add a card before continuing.");
        return;
      }
      setPaying(true);
      setActionError(null);
      setActionStatusCode(null);
      setSuccessMessage(null);
      try {
        const response = await payLessonInvite({
          token,
          authToken: sessionToken,
          paymentMethodId,
          payEndpoint:
            (claimPayload?.pay_endpoint as string | undefined) ||
            (claimPayload?.payEndpoint as string | undefined) ||
            (invitePayload?.pay_endpoint as string | undefined) ||
            (invitePayload?.payEndpoint as string | undefined) ||
            null,
        });
        setSuccessMessage("Payment complete. Redirecting…");
        completeFlow(response);
      } catch (error) {
        const code = resolveErrorCode(error);
        setActionStatusCode(code);
        const message = errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to complete payment.");
        setActionError(message);
      } finally {
        setPaying(false);
      }
    },
    [claimPayload, completeFlow, invitePayload, paying, sessionToken, token],
  );

  const loadPaymentContext = useCallback(async () => {
    if (!sessionToken || !stripeEnabled || (!requiresPaymentFromError && actionType !== "pay")) {
      return;
    }

    setSetupIntentLoading(true);
    setPaymentMethodsLoading(true);
    setSetupIntentError(null);
    setPaymentMethodsError(null);
    setActionStatusCode(null);

    try {
      const [setupResult, methodsResult] = await Promise.all([
        getLessonInviteStripeSetupIntent(sessionToken),
        getLessonInviteStripePaymentMethods(sessionToken),
      ]);

      const setupSecret = setupResult?.client_secret;
      if (!setupSecret) {
        throw new Error("Missing Stripe setup session.");
      }
      setSetupIntentClientSecret(setupSecret);

      const defaultId = resolveDefaultId(methodsResult);
      const normalizedMethods = extractPaymentMethods(methodsResult).map((method) => normalizePaymentMethod(method, defaultId));
      setPaymentMethods(normalizedMethods);
      const defaultMethod = normalizedMethods.find((method) => method.isDefault);
      setSelectedPaymentMethodId(defaultMethod?.id || normalizedMethods[0]?.id || "");
    } catch (error) {
      const code = resolveErrorCode(error);
      setActionStatusCode(code);
      const message = error instanceof Error ? error.message : "Unable to load payment options.";
      setSetupIntentClientSecret(null);
      setSetupIntentError(message);
      setPaymentMethods([]);
      setPaymentMethodsError(message);
    } finally {
      setSetupIntentLoading(false);
      setPaymentMethodsLoading(false);
    }
  }, [actionType, requiresPaymentFromError, sessionToken, stripeEnabled]);

  useEffect(() => {
    const storedToken = getStoredAuthToken({ preferScheme: "token" });
    if (storedToken) {
      setSessionToken(storedToken);
      return;
    }
    if (!authLoading && !isAuthenticated) {
      setSessionToken(null);
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!token) {
      setBeginLoading(false);
      setBeginError("Missing invite token.");
      setBeginStatusCode("not_found");
      return;
    }

    let cancelled = false;
    setBeginLoading(true);
    setBeginError(null);
    setBeginStatusCode(null);

    void beginLessonInvite(token)
      .then((payload) => {
        if (cancelled) return;
        setInvitePayload(payload);
      })
      .catch((error) => {
        if (cancelled) return;
        const code = resolveErrorCode(error);
        const message = errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to load invite.");
        setBeginError(message);
        setBeginStatusCode(code);
      })
      .finally(() => {
        if (cancelled) return;
        setBeginLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!sessionToken || beginLoading || blockedInvite || mismatchState || !token) {
      acceptTriggeredRef.current = false;
      return;
    }

    if (shouldShowPayment) {
      acceptTriggeredRef.current = false;
      return;
    }

    if (acceptTriggeredRef.current) return;
    acceptTriggeredRef.current = true;
    void runAccept(sessionToken);
  }, [beginLoading, blockedInvite, mismatchState, runAccept, sessionToken, shouldShowPayment, token]);

  useEffect(() => {
    if (!sessionToken || !shouldShowPayment || blockedInvite) {
      return;
    }
    void loadPaymentContext();
  }, [blockedInvite, loadPaymentContext, sessionToken, shouldShowPayment]);

  const runAutoClaim = useCallback(async () => {
    if (!token || claimLoading || autoClaiming) return;
    setAutoClaiming(true);
    setClaimLoading(true);
    setAutoClaimAttempted(true);
    setClaimError(null);
    setActionError(null);
    setActionStatusCode(null);
    try {
      const response = await claimLessonInvite(token);
      setClaimPayload(response);
      persistClaimSession(response);
    } catch (error) {
      const code = resolveErrorCode(error);
      setActionStatusCode(code);
      const message = errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to claim invite.");
      setClaimError(message);
    } finally {
      setClaimLoading(false);
      setAutoClaiming(false);
    }
  }, [autoClaiming, claimLoading, persistClaimSession, token]);

  useEffect(() => {
    if (authLoading || beginLoading || blockedInvite || sessionToken || !token) {
      return;
    }
    if (autoClaimAttempted) return;
    void runAutoClaim();
  }, [authLoading, autoClaimAttempted, beginLoading, blockedInvite, runAutoClaim, sessionToken, token]);

  return (
    <div className="auth-page lesson-invite-page">
      <div className="auth-card lesson-invite-card">
        <div>
          <h1>{title}</h1>
          <p>Claim this invitation to join the lesson.</p>
        </div>

        {metaLines.length > 0 ? (
          <div className="lesson-invite-card__summary">
            {metaLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}

        {beginLoading || authLoading ? (
          <p className="lesson-invite-card__status" role="status">
            <Loader2 size={16} className="lesson-invite-card__spinner" aria-hidden />
            Loading invite details…
          </p>
        ) : null}

        {!beginLoading && beginError ? <div className="error-message">{beginError}</div> : null}

        {!beginLoading && !blockedInvite && !sessionToken ? (
          <>
            {claimLoading || autoClaiming ? (
              <p className="lesson-invite-card__status" role="status">
                <Loader2 size={16} className="lesson-invite-card__spinner" aria-hidden />
                Claiming your invite…
              </p>
            ) : null}
            {claimError ? (
              <>
                <div className="error-message">{claimError}</div>
                <button type="button" className="primary-button" onClick={() => void runAutoClaim()} disabled={claimLoading}>
                  {claimLoading ? "Retrying…" : "Retry claim"}
                </button>
              </>
            ) : null}
          </>
        ) : null}

        {!beginLoading && !blockedInvite && sessionToken && !shouldShowPayment ? (
          <p className="lesson-invite-card__status" role="status">
            {accepting ? (
              <>
                <Loader2 size={16} className="lesson-invite-card__spinner" aria-hidden />
                Accepting invitation…
              </>
            ) : acceptCompleted ? (
              <>
                <CheckCircle2 size={16} aria-hidden />
                Invitation accepted.
              </>
            ) : (
              <>
                <Loader2 size={16} className="lesson-invite-card__spinner" aria-hidden />
                Finalizing invitation…
              </>
            )}
          </p>
        ) : null}

        {!beginLoading && !blockedInvite && sessionToken && shouldShowPayment ? (
          <section className="lesson-invite-card__payment">
            <h2>Complete payment</h2>
            <p>Choose a saved card or add a new one to finish accepting this invite.</p>

            {actionError ? (
              <div className="error-message lesson-invite-card__alert">
                <AlertCircle size={16} aria-hidden />
                <span>{actionError}</span>
              </div>
            ) : null}

            {actionStatusCode === "coach_stripe_missing" || actionStatusCode === "pricing_error" ? (
              <div className="error-message">Payments are temporarily unavailable for this invite. Please contact support.</div>
            ) : null}

            {successMessage ? <div className="success-message">{successMessage}</div> : null}

            {paymentMethodsLoading ? (
              <p className="lesson-invite-card__status" role="status">
                <Loader2 size={16} className="lesson-invite-card__spinner" aria-hidden />
                Loading payment options…
              </p>
            ) : null}

            {paymentMethodsError && !paymentMethodsLoading ? <div className="error-message">{paymentMethodsError}</div> : null}

            {paymentMethods.length > 0 ? (
              <div className="lesson-invite-card__saved-methods">
                <label htmlFor="invite-payment-method">Saved card</label>
                <select
                  id="invite-payment-method"
                  value={selectedPaymentMethodId}
                  onChange={(event) => setSelectedPaymentMethodId(event.target.value)}
                  disabled={paying}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {`${method.brand} •••• ${method.last4}${formatExpiry(method.expMonth, method.expYear) ? ` (${formatExpiry(method.expMonth, method.expYear)})` : ""}${
                        method.isDefault ? " • Default" : ""
                      }`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void runPay(selectedPaymentMethodId)}
                  disabled={paying || !selectedPaymentMethodId}
                >
                  {paying ? "Processing…" : "Pay with selected card"}
                </button>
              </div>
            ) : null}

            {!stripeEnabled ? (
              <div className="error-message">
                Stripe is not configured. Set <code>VITE_STRIPE_PUBLISHABLE_KEY</code> to collect card details.
              </div>
            ) : setupIntentLoading && !setupIntentClientSecret ? (
              <p className="lesson-invite-card__status" role="status">
                <Loader2 size={16} className="lesson-invite-card__spinner" aria-hidden />
                Preparing secure payment fields…
              </p>
            ) : setupIntentClientSecret ? (
              <Elements stripe={stripePromise} options={{ appearance: { theme: "stripe" } }} key={setupIntentClientSecret}>
                <AddCardForm
                  clientSecret={setupIntentClientSecret}
                  onCardAdded={(paymentMethodId) => {
                    if (!paymentMethodId) {
                      setActionError("Card saved, but payment method was unavailable. Please choose a saved card.");
                      return;
                    }
                    return runPay(paymentMethodId);
                  }}
                />
              </Elements>
            ) : null}
          </section>
        ) : null}

        {!beginLoading && blockedInvite && pageStatusCode ? (
          <div className="error-message">{errorMessageForCode(pageStatusCode) || "This invite can’t be claimed."}</div>
        ) : null}

        {!beginLoading && mismatchState ? (
          <div className="lesson-invite-card__mismatch">
            <div className="error-message">This invite is for another account.</div>
            {sessionToken ? (
              <button type="button" className="secondary-link lesson-invite-card__signout" onClick={logout}>
                Sign out and continue with another account
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LessonInvitePage;
