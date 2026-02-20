import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, Loader2, MapPin, User } from "lucide-react";

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
  quickSignupLessonInvite,
  rejectLessonInvite,
  type LessonInviteActionResponse,
  type LessonInviteBeginResponse,
  type LessonInviteClaimResponse,
  type LessonInviteQuickSignupResponse,
} from "../api/lessonInvites";
import type { PlayerStripePaymentMethod, PlayerStripePaymentMethodListResponse } from "../api/playerStripe";
import { decideInviteNextAction, extractInviteTokenFromRoute } from "../utils/lessonInviteFlow";
import { useLessonInviteStepMachine } from "../hooks/useLessonInviteStepMachine";

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
  | "email_in_use"
  | "full_name_required"
  | "email_required"
  | "password_required"
  | "password_too_short"
  | "password_mismatch"
  | "invalid_status"
  | null;

type NormalizedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
};

type InvitePreviewData = {
  coachName: string;
  coachInitials: string;
  coachProfilePicture: string | null;
  coachMeta: string;
  lessonType: string;
  dateLabel: string;
  durationLabel: string;
  locationLabel: string;
  totalLabel: string;
};

type InviteStatusPill = {
  label: string;
  tone: "success" | "pending" | "neutral" | "danger";
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
  if (code.includes("lesson_archived") || code.includes("archived")) return "lesson_archived";
  if (code.includes("coach_stripe_missing")) return "coach_stripe_missing";
  if (code.includes("pricing")) return "pricing_error";
  if (code.includes("email_in_use")) return "email_in_use";
  if (code.includes("full_name_required")) return "full_name_required";
  if (code.includes("email_required")) return "email_required";
  if (code.includes("password_required")) return "password_required";
  if (code.includes("password_too_short")) return "password_too_short";
  if (code.includes("password_mismatch")) return "password_mismatch";
  if (code.includes("invalid_status")) return "invalid_status";
  if (code.includes("lesson_full")) return "lesson_full";
  if (code.includes("payment_required")) return "payment_required";
  if (code.includes("full")) return "full";
  return null;
};

const errorMessageForCode = (code: InviteStatusCode) => {
  if (code === "expired") return "This invite has expired.";
  if (code === "full" || code === "lesson_full") return "This lesson is already full.";
  if (code === "not_found") return "We couldn’t find this invite.";
  if (code === "invite_mismatch") return "This invite is for another account.";
  if (code === "lesson_archived") return "This lesson is no longer available.";
  if (code === "invalid_status") return "This invite can no longer be used.";
  if (code === "payment_required") return "Payment is required to claim this invite.";
  if (code === "email_in_use") return "That email is already in use. Please sign in with it.";
  if (code === "full_name_required") return "First and last name are required.";
  if (code === "email_required") return "Email is required.";
  if (code === "password_required") return "Password is required.";
  if (code === "password_too_short") return "Password must be at least 8 characters.";
  if (code === "password_mismatch") return "Password confirmation does not match.";
  if (code === "coach_stripe_missing" || code === "pricing_error") {
    return "This lesson cannot be paid online right now. Please contact support.";
  }
  return null;
};

const resolveInviteStatusCode = (payload: LessonInviteBeginResponse | null): InviteStatusCode => {
  if (!payload) return null;
  const lesson = payload.lesson as Record<string, unknown> | undefined;
  const lessonTypeName = lowercase(lesson?.lesson_type_name ?? lesson?.lessonTypeName);
  const lessonTypeId = Number(lesson?.lessontype_id ?? lesson?.lesson_type_id ?? lesson?.lessonTypeId);
  const isGroupLikeType =
    lessonTypeName.includes("group") ||
    lessonTypeName.includes("semi") ||
    lessonTypeId === 2 ||
    lessonTypeId === 3 ||
    lessonTypeId === 4;
  const remainingSpots = payload.remainingSpots ?? lesson?.remaining_spots ?? lesson?.remainingSpots;
  if (isGroupLikeType) {
    if (lesson?.is_full === true) return "full";
    if (typeof remainingSpots === "number" && remainingSpots <= 0) return "full";
    if (typeof remainingSpots === "string" && remainingSpots.trim() && Number(remainingSpots) <= 0) return "full";
  }
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
      return `/player/lesson/${lessonId}`;
    }
    if (typeof lessonId === "string" && lessonId.trim()) {
      return `/player/lesson/${lessonId.trim()}`;
    }
  }
  return "/player/calendar";
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
  const lesson = payload.lesson as Record<string, unknown> | undefined;
  const invite = payload.invite as Record<string, unknown> | undefined;
  const lessonMeta = lesson?.metadata as Record<string, unknown> | undefined;
  return (
    (typeof lessonMeta?.title === "string" && lessonMeta.title.trim() ? lessonMeta.title : null) ||
    (typeof lesson?.metadata_title === "string" && lesson.metadata_title.trim() ? lesson.metadata_title : null) ||
    (typeof lesson?.lesson_title === "string" && lesson.lesson_title.trim() ? lesson.lesson_title : null) ||
    (typeof lesson?.title === "string" && lesson.title.trim() ? lesson.title : null) ||
    (typeof payload.lesson_title === "string" ? payload.lesson_title : null) ||
    (typeof payload.title === "string" ? payload.title : null) ||
    (typeof invite?.lesson_title === "string" ? invite.lesson_title : null) ||
    (typeof invite?.title === "string" ? invite.title : null) ||
    "Lesson invite"
  );
};

const resolveMetaLines = (payload: LessonInviteBeginResponse | null) => {
  if (!payload) return [];
  const lesson = payload.lesson as Record<string, unknown> | undefined;
  const coach = payload.coach as Record<string, unknown> | undefined;
  const invite = payload.invite as Record<string, unknown> | undefined;
  const coachName =
    (typeof coach?.full_name === "string" && coach.full_name.trim() ? coach.full_name : null) ||
    (typeof lesson?.full_name === "string" && lesson.full_name.trim() ? lesson.full_name : null) ||
    (typeof payload.coach_name === "string" ? payload.coach_name : null) ||
    (typeof invite?.coach_name === "string" ? invite.coach_name : null) ||
    (typeof (invite?.coach as Record<string, unknown> | undefined)?.name === "string"
      ? ((invite?.coach as Record<string, unknown>).name as string)
      : null);
  const startAt =
    (typeof lesson?.start_date_time_tz === "string" && lesson.start_date_time_tz ? lesson.start_date_time_tz : null) ||
    (typeof lesson?.start_date_time === "string" && lesson.start_date_time ? lesson.start_date_time : null) ||
    (typeof payload.start_at === "string" ? payload.start_at : null) ||
    (typeof payload.starts_at === "string" ? payload.starts_at : null) ||
    (typeof invite?.start_at === "string" ? invite.start_at : null) ||
    (typeof invite?.starts_at === "string" ? invite.starts_at : null);
  const location =
    (typeof lesson?.location === "string" && lesson.location.trim() ? lesson.location : null) ||
    (typeof lesson?.location_name === "string" && lesson.location_name.trim() ? lesson.location_name : null) ||
    (typeof payload.location === "string" ? payload.location : null) ||
    (typeof invite?.location === "string" ? invite.location : null);

  const lines = [];
  if (coachName) lines.push(`Coach: ${coachName}`);
  if (startAt) lines.push(`Start: ${new Date(startAt).toLocaleString()}`);
  if (location) lines.push(`Location: ${location}`);
  return lines;
};

const toCoachInitials = (name?: string) => {
  const safe = String(name || "Coach").trim();
  const parts = safe.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "CO";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const computeDurationLabel = (startRaw?: string | null, endRaw?: string | null) => {
  if (!startRaw || !endRaw) return "1 hour";
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "1 hour";
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (minutes <= 0) return "1 hour";
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} min`;
};

const resolvePreviewData = (payload: LessonInviteBeginResponse | null): InvitePreviewData => {
  const lesson = payload?.lesson as Record<string, unknown> | undefined;
  const coach = payload?.coach as Record<string, unknown> | undefined;
  const invite = (payload?.invite as Record<string, unknown> | undefined) || {};
  const lessonMeta = lesson?.metadata as Record<string, unknown> | undefined;

  const coachName =
    (typeof coach?.full_name === "string" && coach.full_name.trim() ? coach.full_name : null) ||
    (typeof lesson?.full_name === "string" && lesson.full_name.trim() ? lesson.full_name : null) ||
    (typeof payload?.coach_name === "string" ? payload.coach_name : null) ||
    (typeof invite.coach_name === "string" ? invite.coach_name : null) ||
    (typeof (invite.coach as Record<string, unknown> | undefined)?.name === "string"
      ? ((invite.coach as Record<string, unknown>).name as string)
      : null) ||
    "Your coach";

  const lessonType =
    (typeof lesson?.lesson_type_name === "string" && lesson.lesson_type_name.trim() ? lesson.lesson_type_name : null) ||
    (typeof lesson?.lessontype_name === "string" && lesson.lessontype_name.trim() ? lesson.lessontype_name : null) ||
    (typeof lessonMeta?.title === "string" && lessonMeta.title.trim() ? lessonMeta.title : null) ||
    (typeof payload?.lesson_type_name === "string" ? payload.lesson_type_name : null) ||
    (typeof payload?.lesson_type === "string" ? payload.lesson_type : null) ||
    (typeof invite.lesson_type_name === "string" ? invite.lesson_type_name : null) ||
    (typeof invite.lesson_type === "string" ? invite.lesson_type : null) ||
    "Lesson";

  const startAt =
    (typeof lesson?.start_date_time_tz === "string" && lesson.start_date_time_tz ? lesson.start_date_time_tz : null) ||
    (typeof lesson?.start_date_time === "string" && lesson.start_date_time ? lesson.start_date_time : null) ||
    (typeof payload?.start_at === "string" ? payload.start_at : null) ||
    (typeof payload?.starts_at === "string" ? payload.starts_at : null) ||
    (typeof payload?.start_date_time === "string" ? payload.start_date_time : null) ||
    (typeof invite.start_at === "string" ? invite.start_at : null) ||
    (typeof invite.starts_at === "string" ? invite.starts_at : null) ||
    (typeof invite.start_date_time === "string" ? invite.start_date_time : null) ||
    null;

  const endAt =
    (typeof lesson?.end_date_time_tz === "string" && lesson.end_date_time_tz ? lesson.end_date_time_tz : null) ||
    (typeof lesson?.end_date_time === "string" && lesson.end_date_time ? lesson.end_date_time : null) ||
    (typeof payload?.end_at === "string" ? payload.end_at : null) ||
    (typeof payload?.end_date_time === "string" ? payload.end_date_time : null) ||
    (typeof invite.end_at === "string" ? invite.end_at : null) ||
    (typeof invite.end_date_time === "string" ? invite.end_date_time : null) ||
    null;

  const location =
    (typeof lesson?.location === "string" && lesson.location.trim() ? lesson.location : null) ||
    (typeof lesson?.location_name === "string" && lesson.location_name.trim() ? lesson.location_name : null) ||
    (typeof payload?.location === "string" ? payload.location : null) ||
    (typeof payload?.location_name === "string" ? payload.location_name : null) ||
    (typeof invite.location === "string" ? invite.location : null) ||
    (typeof invite.location_name === "string" ? invite.location_name : null) ||
    "Tennis court";

  const totalRaw =
    lesson?.group_price_per_person ??
    lesson?.price_per_person ??
    lesson?.hourly_rate ??
    coach?.hourly_rate ??
    payload?.price_per_person ??
    payload?.price ??
    invite.price_per_person ??
    invite.price ??
    null;

  const totalLabel =
    typeof totalRaw === "number"
      ? `$${totalRaw.toFixed(2)}`
      : typeof totalRaw === "string" && totalRaw.trim()
        ? totalRaw.trim().startsWith("$")
          ? totalRaw.trim()
          : `$${totalRaw.trim()}`
        : "TBD";

  const dateLabel = startAt
    ? new Date(startAt).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Date TBD";

  return {
    coachName,
    coachInitials: toCoachInitials(coachName),
    coachProfilePicture:
      (typeof coach?.profile_picture === "string" && coach.profile_picture.trim() ? coach.profile_picture : null) ||
      (typeof lesson?.profile_picture === "string" && lesson.profile_picture.trim() ? lesson.profile_picture : null),
    coachMeta:
      (typeof lessonMeta?.level === "string" && lessonMeta.level.trim() ? `Level ${lessonMeta.level}` : null) ||
      (typeof payload?.coach_meta === "string" ? payload.coach_meta : null) ||
      (typeof invite.coach_meta === "string" ? invite.coach_meta : null) ||
      "Certified coach",
    lessonType,
    dateLabel,
    durationLabel:
      (typeof lessonMeta?.duration === "string" && lessonMeta.duration.trim()
        ? `${lessonMeta.duration} min`
        : computeDurationLabel(startAt, endAt)),
    locationLabel: location,
    totalLabel,
  };
};

const resolveLessonStatusPills = (payload: LessonInviteBeginResponse | null): InviteStatusPill[] => {
  if (!payload) return [];
  const lesson = payload.lesson as Record<string, unknown> | undefined;
  if (!lesson) return [];

  const pills: InviteStatusPill[] = [];
  const lessonStatus = typeof lesson.status === "number" ? lesson.status : Number(lesson.status);
  const paymentRequired = payload.paymentRequired === true || payload.requires_payment === true;

  if (Number.isFinite(lessonStatus)) {
    if (lessonStatus === 1) {
      pills.push({ label: "Lesson Confirmed", tone: "success" });
    } else if (lessonStatus === 0 && paymentRequired) {
      pills.push({ label: "Payment Pending", tone: "pending" });
    } else if (lessonStatus === 0) {
      pills.push({ label: "Pending", tone: "pending" });
    } else if (lessonStatus === 2) {
      pills.push({ label: "Cancelled", tone: "danger" });
    }
  }

  if (lesson.is_upcoming === true) {
    pills.push({ label: "Upcoming", tone: "neutral" });
  }

  return pills;
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
  const [quickSignupForm, setQuickSignupForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [quickSignupLoading, setQuickSignupLoading] = useState(false);
  const [quickSignupError, setQuickSignupError] = useState<string | null>(null);

  const [flowScreen, setFlowScreen] = useState<"preview" | "decline" | "declined">("preview");
  const [declineReason, setDeclineReason] = useState("Schedule conflict");
  const [declineMessage, setDeclineMessage] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectSuccessMessage, setRejectSuccessMessage] = useState<string | null>(null);
  const [confirmStarted, setConfirmStarted] = useState(false);

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
  const [retryingFlow, setRetryingFlow] = useState(false);
  const { step, goPreview, goQuickSignup, goPayment, goDone } = useLessonInviteStepMachine("preview");

  const pageStatusCode = beginStatusCode || resolveInviteStatusCode(invitePayload);
  const blockedInvite = isActionBlocked(pageStatusCode);
  const requiresPaymentFromError = actionStatusCode === "payment_required";
  const actionType = useMemo(
    () => decideInviteNextAction({ beginPayload: invitePayload, claimPayload }),
    [claimPayload, invitePayload],
  );
  const shouldShowPayment = actionType === "pay" || requiresPaymentFromError;
  const authTokenForCalls = (claimPayload?.access_token as string | undefined) || sessionToken;
  // Always require Step 3A for invitee claim flows before payment/accept.
  const shouldUseQuickSignup = true;
  const showPaymentPanel = step === "payment" && Boolean(authTokenForCalls) && shouldShowPayment;
  const mismatchState = pageStatusCode === "invite_mismatch" || actionStatusCode === "invite_mismatch";
  const title = resolveTitle(invitePayload);
  const metaLines = resolveMetaLines(invitePayload);
  const preview = useMemo(() => resolvePreviewData(invitePayload), [invitePayload]);
  const lessonStatusPills = useMemo(() => resolveLessonStatusPills(invitePayload), [invitePayload]);
  const stripeEnabled = Boolean(stripePromise);
  const quickSignupValid = useMemo(() => {
    if (!quickSignupForm.firstName.trim()) return false;
    if (!quickSignupForm.lastName.trim()) return false;
    if (!quickSignupForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quickSignupForm.email.trim())) return false;
    if (quickSignupForm.password.length < 8) return false;
    if (quickSignupForm.confirmPassword !== quickSignupForm.password) return false;
    return true;
  }, [quickSignupForm]);

  const persistClaimSession = useCallback((claimResponse: LessonInviteClaimResponse) => {
    const accessToken = claimResponse.access_token;
    if (accessToken) {
      localStorage.setItem("authToken", accessToken);
    }
    if (claimResponse.refresh_token) {
      localStorage.setItem("refreshToken", claimResponse.refresh_token);
    }
    localStorage.setItem("authLoginResponse", JSON.stringify(claimResponse));
    const normalized = getStoredAuthToken({ preferScheme: "token" });
    setSessionToken(normalized);
    return accessToken ?? null;
  }, []);

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
        setActionError(errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to accept invite."));
      } finally {
        setAccepting(false);
      }
    },
    [accepting, completeFlow, token],
  );

  const runPay = useCallback(
    async (paymentMethodId: string) => {
      if (!token || !authTokenForCalls || paying) return;
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
          authToken: authTokenForCalls,
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
        setActionError(errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to complete payment."));
      } finally {
        setPaying(false);
      }
    },
    [authTokenForCalls, claimPayload, completeFlow, invitePayload, paying, token],
  );

  const loadPaymentContext = useCallback(async () => {
    if (!authTokenForCalls || !stripeEnabled || (!requiresPaymentFromError && actionType !== "pay")) {
      return;
    }

    setSetupIntentLoading(true);
    setPaymentMethodsLoading(true);
    setSetupIntentError(null);
    setPaymentMethodsError(null);
    setActionStatusCode(null);

    try {
      const [setupResult, methodsResult] = await Promise.all([
        getLessonInviteStripeSetupIntent(authTokenForCalls),
        getLessonInviteStripePaymentMethods(authTokenForCalls),
      ]);

      if (!setupResult?.client_secret) {
        throw new Error("Missing Stripe setup session.");
      }
      setSetupIntentClientSecret(setupResult.client_secret);

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
  }, [actionType, authTokenForCalls, requiresPaymentFromError, stripeEnabled]);

  const handleInviteCardAdded = useCallback(
    async (paymentMethodId?: string) => {
      setActionError(null);
      setSuccessMessage("Card saved. Refreshing saved payment methods…");
      await new Promise((resolve) => setTimeout(resolve, 900));
      await loadPaymentContext();
      if (paymentMethodId) {
        setSelectedPaymentMethodId(paymentMethodId);
      }
      setSuccessMessage("Card added. Select it and confirm lesson.");
    },
    [loadPaymentContext],
  );

  const runAutoClaim = useCallback(async () => {
    if (!token || claimLoading || autoClaiming) return;
    if (shouldUseQuickSignup) return;
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
      if (confirmStarted) {
        if (response.requires_payment === true || response.paymentRequired === true || shouldShowPayment) {
          goPayment();
        } else {
          completeFlow(response as LessonInviteActionResponse);
          goDone();
        }
      }
    } catch (error) {
      const code = resolveErrorCode(error);
      setActionStatusCode(code);
      setClaimError(errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to claim invite."));
    } finally {
      setClaimLoading(false);
      setAutoClaiming(false);
    }
  }, [autoClaiming, claimLoading, completeFlow, confirmStarted, goDone, goPayment, persistClaimSession, shouldShowPayment, shouldUseQuickSignup, token]);

  const retryInviteFlow = useCallback(async () => {
    if (!token || retryingFlow) return;
    setRetryingFlow(true);
    setBeginError(null);
    setClaimError(null);
    setPaymentMethodsError(null);
    setSetupIntentError(null);
    setActionError(null);
    setActionStatusCode(null);

    let beginCompleted = false;
    let claimCompleted = false;

    try {
      const beginResponse = await beginLessonInvite(token);
      beginCompleted = true;
      setInvitePayload(beginResponse);

      const claimResponse = await claimLessonInvite(token);
      claimCompleted = true;
      setClaimPayload(claimResponse);

      const authToken = persistClaimSession(claimResponse);
      if (!authToken) {
        throw new Error("Claim succeeded but no access token was returned.");
      }

      const nextAction = decideInviteNextAction({ beginPayload: beginResponse, claimPayload: claimResponse });
      if (nextAction === "pay") {
        const setupResult = await getLessonInviteStripeSetupIntent(authToken);
        if (!setupResult?.client_secret) {
          throw new Error("Missing Stripe setup session.");
        }
        setSetupIntentClientSecret(setupResult.client_secret);

        const methodsResult = await getLessonInviteStripePaymentMethods(authToken);
        const defaultId = resolveDefaultId(methodsResult);
        const normalizedMethods = extractPaymentMethods(methodsResult).map((method) => normalizePaymentMethod(method, defaultId));
        setPaymentMethods(normalizedMethods);
        const defaultMethod = normalizedMethods.find((method) => method.isDefault);
        setSelectedPaymentMethodId(defaultMethod?.id || normalizedMethods[0]?.id || "");
      }
    } catch (error) {
      const code = resolveErrorCode(error);
      const message = errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to retry invite flow.");
      setActionStatusCode(code);
      setActionError(message);
      if (!beginCompleted) {
        setBeginError(message);
      } else if (!claimCompleted) {
        setClaimError(message);
      } else {
        setPaymentMethodsError(message);
      }
    } finally {
      setRetryingFlow(false);
    }
  }, [persistClaimSession, retryingFlow, token]);

  const handleQuickSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || quickSignupLoading || !quickSignupValid) return;

    setQuickSignupLoading(true);
    setQuickSignupError(null);
    setActionStatusCode(null);

    try {
      const response = await quickSignupLessonInvite(
        token,
        {
          firstName: quickSignupForm.firstName.trim(),
          lastName: quickSignupForm.lastName.trim(),
          email: quickSignupForm.email.trim(),
          phone: quickSignupForm.phone.trim() || undefined,
          password: quickSignupForm.password,
          confirmPassword: quickSignupForm.confirmPassword,
        },
        invitePayload?.quickSignup?.endpoint,
      );

      setClaimPayload(response as LessonInviteQuickSignupResponse);
      persistClaimSession(response);

      const requiresPayment = response.requires_payment === true || response.paymentRequired === true;
      if (requiresPayment) {
        goPayment();
        return;
      }

      completeFlow(response as LessonInviteActionResponse);
      goDone();
    } catch (error) {
      const code = resolveErrorCode(error);
      setActionStatusCode(code);
      setQuickSignupError(errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to complete quick signup."));
    } finally {
      setQuickSignupLoading(false);
    }
  };

  const handleConfirmClick = () => {
    setConfirmStarted(true);
    setQuickSignupError(null);
    setClaimError(null);
    if (shouldUseQuickSignup) {
      goQuickSignup();
      return;
    }
    if (!authTokenForCalls) {
      void runAutoClaim();
      return;
    }
    if (shouldShowPayment) {
      goPayment();
      return;
    }
    if (!shouldShowPayment) {
      void runAccept(authTokenForCalls);
    }
  };

  const handleRejectInvite = useCallback(async () => {
    if (!token || rejecting) return;

    setRejecting(true);
    setRejectError(null);
    setRejectSuccessMessage(null);

    try {
      const beginResponse = await beginLessonInvite(token);
      setInvitePayload(beginResponse);

      let authToken = authTokenForCalls;
      if (!authToken) {
        if (shouldUseQuickSignup) {
          throw new Error("Complete quick signup first to decline this invite.");
        }
        const claimResponse = await claimLessonInvite(token);
        setClaimPayload(claimResponse);
        persistClaimSession(claimResponse);
        authToken = claimResponse.access_token || getStoredAuthToken({ preferScheme: "token" });
      }

      if (!authToken) {
        throw new Error("Unable to authenticate this invite. Please try again.");
      }

      const response = await rejectLessonInvite(token, authToken);
      setRejectSuccessMessage(response?.message || "Lesson invite rejected");
      setFlowScreen("declined");
    } catch (error) {
      const code = resolveErrorCode(error);
      setActionStatusCode(code);
      setRejectError(errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to decline lesson."));
    } finally {
      setRejecting(false);
    }
  }, [
    authTokenForCalls,
    persistClaimSession,
    rejecting,
    shouldUseQuickSignup,
    token,
  ]);

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
        const prefill = payload.quickSignup?.prefill;
        if (prefill) {
          setQuickSignupForm((prev) => ({
            ...prev,
            firstName: typeof prefill.first_name === "string" ? prefill.first_name : prev.firstName,
            lastName: typeof prefill.last_name === "string" ? prefill.last_name : prev.lastName,
            email: typeof prefill.email === "string" ? prefill.email : prev.email,
            phone: typeof prefill.phone === "string" ? prefill.phone : prev.phone,
          }));
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const code = resolveErrorCode(error);
        setBeginError(errorMessageForCode(code) || (error instanceof Error ? error.message : "Unable to load invite."));
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
    if (authLoading || beginLoading || blockedInvite || sessionToken || !token || shouldUseQuickSignup) {
      return;
    }
    if (autoClaimAttempted) return;
    void runAutoClaim();
  }, [authLoading, autoClaimAttempted, beginLoading, blockedInvite, runAutoClaim, sessionToken, shouldUseQuickSignup, token]);

  useEffect(() => {
    if (!authTokenForCalls || beginLoading || blockedInvite || mismatchState || !token || !confirmStarted) {
      return;
    }
    if (!shouldShowPayment) {
      void runAccept(authTokenForCalls);
    }
  }, [authTokenForCalls, beginLoading, blockedInvite, confirmStarted, mismatchState, runAccept, shouldShowPayment, token]);

  useEffect(() => {
    if (!authTokenForCalls || !showPaymentPanel || blockedInvite) {
      return;
    }
    void loadPaymentContext();
  }, [authTokenForCalls, blockedInvite, loadPaymentContext, showPaymentPanel]);

  return (
    <div className="auth-page lesson-invite-page">
      <div className="lesson-invite-phone">
        <div className="lesson-invite-simple-header">
          <div className="lesson-invite-brand-logo">🎾</div>
          <div className="lesson-invite-brand-name">The Tennis Plan</div>
        </div>

        <div className="lesson-invite-content">
          <section className="lesson-invite-coach-card">
            <div className={`lesson-invite-coach-avatar${preview.coachProfilePicture ? " lesson-invite-coach-avatar--image" : ""}`}>
              {preview.coachProfilePicture ? <img src={preview.coachProfilePicture} alt={`${preview.coachName} profile`} /> : preview.coachInitials}
            </div>
            <div className="lesson-invite-coach-info">
              <div className="lesson-invite-coach-label">Your Coach</div>
              <div className="lesson-invite-coach-name">{preview.coachName}</div>
              <div className="lesson-invite-coach-meta">{preview.coachMeta}</div>
            </div>
          </section>

          <section className="lesson-invite-lesson-card">
            <div className="lesson-invite-lesson-title">{title}</div>
            <div className="lesson-invite-lesson-row">
              <span className="lesson-invite-lesson-icon lesson-invite-lesson-icon--purple">
                <User size={14} />
              </span>
              <div className="lesson-invite-lesson-detail">
                <div className="lesson-invite-lesson-label">Lesson Type</div>
                <div className="lesson-invite-lesson-value">{preview.lessonType}</div>
              </div>
            </div>
            <div className="lesson-invite-lesson-row">
              <span className="lesson-invite-lesson-icon lesson-invite-lesson-icon--blue">
                <CalendarDays size={14} />
              </span>
              <div className="lesson-invite-lesson-detail">
                <div className="lesson-invite-lesson-label">Date & Time</div>
                <div className="lesson-invite-lesson-value">{preview.dateLabel}</div>
              </div>
            </div>
            <div className="lesson-invite-lesson-row">
              <span className="lesson-invite-lesson-icon">
                <Clock3 size={14} />
              </span>
              <div className="lesson-invite-lesson-detail">
                <div className="lesson-invite-lesson-label">Duration</div>
                <div className="lesson-invite-lesson-value">{preview.durationLabel}</div>
              </div>
            </div>
            <div className="lesson-invite-lesson-row">
              <span className="lesson-invite-lesson-icon lesson-invite-lesson-icon--green">
                <MapPin size={14} />
              </span>
              <div className="lesson-invite-lesson-detail">
                <div className="lesson-invite-lesson-label">Location</div>
                <div className="lesson-invite-lesson-value">{preview.locationLabel}</div>
              </div>
            </div>
          </section>

          <section className="lesson-invite-total-card">
            <span className="lesson-invite-total-label">Lesson Total</span>
            <span className="lesson-invite-total-value">{preview.totalLabel}</span>
          </section>

          {lessonStatusPills.length > 0 ? (
            <section className="lesson-invite-status-pills">
              {lessonStatusPills.map((pill) => (
                <span key={pill.label} className={`lesson-invite-status-pill lesson-invite-status-pill--${pill.tone}`}>
                  {pill.label}
                </span>
              ))}
            </section>
          ) : null}

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
          {!beginLoading && beginError ? (
            <button type="button" className="primary-button" onClick={() => void retryInviteFlow()} disabled={retryingFlow}>
              {retryingFlow ? "Retrying…" : "Retry"}
            </button>
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

          {!beginLoading && !blockedInvite && flowScreen === "decline" ? (
            <section className="lesson-invite-decline">
              <h2>Can&apos;t Make It</h2>
              {rejectError ? <div className="error-message">{rejectError}</div> : null}
              <div className="lesson-invite-reasons">
                {["Schedule conflict", "Need a different time", "Changed my mind", "Other"].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setDeclineReason(reason)}
                    className={`lesson-invite-reason${declineReason === reason ? " lesson-invite-reason--selected" : ""}`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <textarea
                className="lesson-invite-message"
                placeholder="Message to coach (optional)"
                value={declineMessage}
                onChange={(event) => setDeclineMessage(event.target.value)}
              />
              <button type="button" className="lesson-invite-danger-button" onClick={() => void handleRejectInvite()} disabled={rejecting}>
                {rejecting ? "Declining…" : "Decline Lesson"}
              </button>
              <button type="button" className="lesson-invite-ghost-button" onClick={() => setFlowScreen("preview")}>
                Go Back
              </button>
            </section>
          ) : null}

          {!beginLoading && !blockedInvite && flowScreen === "declined" ? (
            <section className="lesson-invite-done">
              <div className="lesson-invite-done-icon lesson-invite-done-icon--red">✗</div>
              <h2>Lesson Declined</h2>
              <p>We&apos;ve let your coach know you can&apos;t make this lesson.</p>
              {rejectSuccessMessage ? <div className="success-message">{rejectSuccessMessage}</div> : null}
              <div className="lesson-invite-info-card">
                <p>Reason: {declineReason}</p>
                {declineMessage.trim() ? <p>Message sent to coach.</p> : null}
              </div>
              <button type="button" className="primary-button" onClick={() => setFlowScreen("preview")}>
                Back to Invite
              </button>
            </section>
          ) : null}

          {!beginLoading && !blockedInvite && flowScreen === "preview" ? (
            <>
              {!sessionToken && (claimLoading || autoClaiming) ? (
                <p className="lesson-invite-card__status" role="status">
                  <Loader2 size={16} className="lesson-invite-card__spinner" aria-hidden />
                  Claiming your invite…
                </p>
              ) : null}

              {claimError ? <div className="error-message">{claimError}</div> : null}
              {claimError ? (
                <button type="button" className="primary-button" onClick={() => void retryInviteFlow()} disabled={retryingFlow}>
                  {retryingFlow ? "Retrying…" : "Retry"}
                </button>
              ) : null}

              {step === "quickSignup" && shouldUseQuickSignup ? (
                <form className="lesson-invite-claim-form" onSubmit={handleQuickSignupSubmit}>
                  <h2>Create account</h2>
                  <p className="lesson-invite-card__status">Set your password to claim your account and continue.</p>
                  {quickSignupError ? <div className="error-message">{quickSignupError}</div> : null}
                  <input
                    className="form-input"
                    placeholder="First name"
                    value={quickSignupForm.firstName}
                    onChange={(event) => setQuickSignupForm((prev) => ({ ...prev, firstName: event.target.value }))}
                    required
                  />
                  <input
                    className="form-input"
                    placeholder="Last name"
                    value={quickSignupForm.lastName}
                    onChange={(event) => setQuickSignupForm((prev) => ({ ...prev, lastName: event.target.value }))}
                    required
                  />
                  <input
                    className="form-input"
                    type="email"
                    placeholder="Email"
                    value={quickSignupForm.email}
                    onChange={(event) => setQuickSignupForm((prev) => ({ ...prev, email: event.target.value }))}
                    required
                  />
                  <input
                    className="form-input"
                    placeholder="Phone"
                    value={quickSignupForm.phone}
                    onChange={(event) => setQuickSignupForm((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Password (min 8)"
                    value={quickSignupForm.password}
                    onChange={(event) => setQuickSignupForm((prev) => ({ ...prev, password: event.target.value }))}
                    required
                    minLength={8}
                  />
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Confirm password"
                    value={quickSignupForm.confirmPassword}
                    onChange={(event) => setQuickSignupForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    required
                  />
                  <button type="submit" className="primary-button" disabled={quickSignupLoading || !quickSignupValid}>
                    {quickSignupLoading ? "Creating account…" : "Continue to payment"}
                  </button>
                  <button type="button" className="lesson-invite-ghost-button" onClick={goPreview} disabled={quickSignupLoading}>
                    Back
                  </button>
                </form>
              ) : null}

              {!showPaymentPanel && !accepting && !acceptCompleted && step !== "quickSignup" ? (
                <div className="lesson-invite-actions">
                  <button type="button" className="lesson-invite-confirm-button" onClick={handleConfirmClick} disabled={claimLoading}>
                    Confirm & Pay
                  </button>
                  <button type="button" className="lesson-invite-decline-link" onClick={() => setFlowScreen("decline")}>
                    Can&apos;t make it? Let coach know
                  </button>
                </div>
              ) : null}

              {sessionToken && !showPaymentPanel ? (
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
                  ) : null}
                </p>
              ) : null}
            </>
          ) : null}

          {!beginLoading && !blockedInvite && showPaymentPanel ? (
            <section className="lesson-invite-card__payment">
              <h2>Payment</h2>
              <p>Complete payment to confirm your lesson invite.</p>
              <div className="lesson-invite-payment-links">
                <Link className="lesson-invite-payment-link" to="/settings/payment-methods">
                  Manage payment methods
                </Link>
                <span className="lesson-invite-payment-link-hint">
                  Add a card there or use the secure form below.
                </span>
              </div>

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
              {setupIntentError ? <div className="error-message">{setupIntentError}</div> : null}
              {(paymentMethodsError || setupIntentError) ? (
                <button type="button" className="primary-button" onClick={() => void retryInviteFlow()} disabled={retryingFlow}>
                  {retryingFlow ? "Retrying…" : "Retry payment setup"}
                </button>
              ) : null}

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
                    {paying ? "Processing…" : `Confirm lesson and pay ${preview.totalLabel}`}
                  </button>
                </div>
              ) : null}

              {paymentMethods.length === 0 && !setupIntentLoading ? (
                <p className="lesson-invite-card__status" role="status">
                  Add a payment method below to confirm this lesson.
                </p>
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
                    onCardAdded={handleInviteCardAdded}
                  />
                </Elements>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default LessonInvitePage;
