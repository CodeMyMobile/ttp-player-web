import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock, CreditCard, Landmark, MapPin, Users } from "lucide-react";

import MainLayout from "../components/MainLayout";
import {
  bookMindbodyClass,
  fetchMindbodyClassById,
  getMindbodyClassFromResponse,
  type MindbodyClassRow,
} from "../api/mindbodyClasses";
import {
  getPlayerStripePaymentMethods,
  type PlayerStripePaymentMethod,
} from "../api/playerStripe";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

import "./MindbodyClassDetailsPage.css";

const extractPaymentMethods = (
  payload: PlayerStripePaymentMethod[] | Record<string, unknown> | null | undefined,
) => {
  if (!payload) return [] as PlayerStripePaymentMethod[];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.payment_methods)) return payload.payment_methods as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.data)) return payload.data as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.results)) return payload.results as PlayerStripePaymentMethod[];
  return [];
};

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatMoney = (cents: unknown) =>
  `$${(parseNumber(cents, 0) / 100).toFixed(2)}`;

const formatDateTime = (value?: string) => {
  if (!value) return "Time TBD";
  const parsed = moment.utc(value);
  return parsed.isValid() ? parsed.format("dddd, MMMM D [at] h:mm A") : "Time TBD";
};

const formatDuration = (start?: string, end?: string) => {
  if (!start || !end) return "60 min";
  const startMoment = moment.utc(start);
  const endMoment = moment.utc(end);
  const minutes = endMoment.diff(startMoment, "minutes");
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : "60 min";
};

const getOpenSpots = (mindbodyClass: MindbodyClassRow) => {
  if (mindbodyClass.is_full) return 0;
  if (mindbodyClass.open_spots !== undefined && mindbodyClass.open_spots !== null) {
    return parseNumber(mindbodyClass.open_spots, 0);
  }
  const maxCapacity = parseNumber(mindbodyClass.max_capacity, 0);
  const totalBooked = parseNumber(mindbodyClass.total_booked, 0);
  return Math.max(maxCapacity - totalBooked, 0);
};

const getPaymentMethodLabel = (method: PlayerStripePaymentMethod) => {
  const card = method.card;
  const brand = card?.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : "Card";
  return `${brand} .... ${card?.last4 ?? ""}`;
};

type RouteState = {
  groupLessonsState?: unknown;
};

const MindbodyClassDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const routeState = (location.state as RouteState | null | undefined) ?? null;
  const authToken = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "Token" }) ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );

  const [mindbodyClass, setMindbodyClass] = useState<MindbodyClassRow | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PlayerStripePaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!id || !authToken) {
      setError("Missing class or authentication token.");
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setError("");

    fetchMindbodyClassById({ token: authToken, classId: id, signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const nextClass = getMindbodyClassFromResponse(response);
        if (!nextClass) {
          throw new Error("Partner class was not found.");
        }
        setMindbodyClass(nextClass);
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load partner class.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [authToken, id]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    setPaymentLoading(true);

    getPlayerStripePaymentMethods(authToken)
      .then((payload) => {
        if (cancelled) return;
        const methods = extractPaymentMethods(payload as Record<string, unknown>);
        setPaymentMethods(methods);
        const defaultMethod =
          methods.find((method) => method.is_default || method.default || method.default_for_currency) ??
          methods[0];
        setSelectedPaymentMethodId(defaultMethod?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) setPaymentMethods([]);
      })
      .finally(() => {
        if (!cancelled) setPaymentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const openSpots = mindbodyClass ? getOpenSpots(mindbodyClass) : 0;
  const isFull = openSpots <= 0;
  const platformFeeCents = parseNumber(mindbodyClass?.platform_fee_amount_cents, 0);
  const partnerName = mindbodyClass?.partner_name?.trim() || "Partner coach";
  const ttpCoachMatch = mindbodyClass?.ttp_coach_match;
  const instructorName =
    ttpCoachMatch?.full_name?.trim() ||
    mindbodyClass?.instructor_name?.trim() ||
    partnerName;
  const classPriceCents = parseNumber(mindbodyClass?.class_price_cents, 0);
  const totalCents = classPriceCents + platformFeeCents;
  const partnerPayoutReady = classPriceCents <= 0 || Boolean(mindbodyClass?.stripe_connected_account_id);

  const handleBookClass = async () => {
    if (!id || !authToken || !mindbodyClass) return;
    if (!selectedPaymentMethodId) {
      setError("Add or select a payment method first.");
      return;
    }
    if (!partnerPayoutReady) {
      setError("This partner is not ready for direct payouts yet.");
      return;
    }

    setBooking(true);
    setError("");
    setSuccess(null);

    try {
      const response = await bookMindbodyClass({
        token: authToken,
        classId: id,
        paymentMethodId: selectedPaymentMethodId,
        sendEmail: false,
      });
      setSuccess(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to book partner class.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <MainLayout className="mindbody-class-page">
      <div className="mindbody-class-page__inner">
        <Link
          to="/group-lessons"
          state={{ groupLessonsState: routeState?.groupLessonsState }}
          className="mindbody-class-page__back"
        >
          Back to group lessons
        </Link>

        {loading ? (
          <div className="mindbody-class-page__state">Loading partner class...</div>
        ) : error && !mindbodyClass ? (
          <div className="mindbody-class-page__error">{error}</div>
        ) : mindbodyClass ? (
          <div className="mindbody-class-page__grid">
            <section className="mindbody-class-page__main">
              <p className="mindbody-class-page__eyebrow">{partnerName}</p>
              <h1>{mindbodyClass.name || "Partner class"}</h1>
              <p className="mindbody-class-page__description">
                {mindbodyClass.description?.trim() ||
                  "Book this partner class inside The Tennis Plan."}
              </p>

              <div className="mindbody-class-page__facts">
                <div>
                  <CalendarDays size={18} aria-hidden="true" />
                  <span>{formatDateTime(mindbodyClass.start_date_time)}</span>
                </div>
                <div>
                  <Clock size={18} aria-hidden="true" />
                  <span>{formatDuration(mindbodyClass.start_date_time, mindbodyClass.end_date_time)}</span>
                </div>
                <div>
                  <MapPin size={18} aria-hidden="true" />
                  <span>{mindbodyClass.location || "Partner location"}</span>
                </div>
                <div>
                  <Users size={18} aria-hidden="true" />
                  <span>{isFull ? "Class full" : `${openSpots} spot${openSpots === 1 ? "" : "s"} left`}</span>
                </div>
              </div>

              <div className="mindbody-class-page__partner">
                <span>Instructor</span>
                <strong>{instructorName}</strong>
                {ttpCoachMatch?.email ? (
                  <small>TTP coach match: {ttpCoachMatch.email}</small>
                ) : mindbodyClass.mindbody_instructor_email ? (
                  <small>Partner instructor: {mindbodyClass.mindbody_instructor_email}</small>
                ) : null}
              </div>
            </section>

            <aside className="mindbody-class-page__checkout">
              <h2>Checkout</h2>
              <div className="mindbody-class-page__line">
                <span>Partner class price</span>
                <strong>{formatMoney(classPriceCents)}</strong>
              </div>
              <div className="mindbody-class-page__line">
                <span>The Tennis Plan booking fee</span>
                <strong>{formatMoney(platformFeeCents)}</strong>
              </div>
              {/* <div className="mindbody-class-page__line">
                <span>Coach payout</span>
                <strong>{formatMoney(classPriceCents)}</strong>
              </div> */}
              <div className="mindbody-class-page__line mindbody-class-page__line--total">
                <span>Total due today</span>
                <strong>{formatMoney(totalCents)}</strong>
              </div>

              <div className="mindbody-class-page__flow">
                <div>
                  <CreditCard size={16} aria-hidden="true" />
                  <span>One card charge in The Tennis Plan</span>
                </div>
                <div>
                  <Landmark size={16} aria-hidden="true" />
                  <span>{formatMoney(classPriceCents)} goes to {partnerName}</span>
                </div>
                <div>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>Your spot is added to the coach's Mindbody roster</span>
                </div>
              </div>

              {!partnerPayoutReady ? (
                <div className="mindbody-class-page__error">
                  This partner needs to finish payout setup before paid bookings can be accepted.
                </div>
              ) : null}

              <label className="mindbody-class-page__payment-label" htmlFor="mindbody-payment-method">
                <CreditCard size={16} aria-hidden="true" />
                Payment method
              </label>
              {paymentLoading ? (
                <p className="mindbody-class-page__muted">Loading cards...</p>
              ) : paymentMethods.length > 0 ? (
                <select
                  id="mindbody-payment-method"
                  value={selectedPaymentMethodId}
                  onChange={(event) => setSelectedPaymentMethodId(event.target.value)}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {getPaymentMethodLabel(method)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mindbody-class-page__empty-card">
                  <p>No saved card found.</p>
                  <button type="button" onClick={() => navigate("/settings/payment-methods")}>
                    Add payment method
                  </button>
                </div>
              )}

              {error ? <div className="mindbody-class-page__error">{error}</div> : null}
              {success ? (
                <div className="mindbody-class-page__success">
                  Booking confirmed. Your payment was split automatically, your spot was added to Mindbody, and a confirmation text is being sent.
                </div>
              ) : null}

              <button
                type="button"
                className="mindbody-class-page__book"
                onClick={handleBookClass}
                disabled={booking || paymentLoading || isFull || !selectedPaymentMethodId || !partnerPayoutReady}
              >
                {booking
                  ? "Booking..."
                  : isFull
                    ? "Class full"
                    : !partnerPayoutReady
                      ? "Payout setup needed"
                      : `Pay ${formatMoney(totalCents)} and book`}
              </button>
            </aside>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default MindbodyClassDetailsPage;
