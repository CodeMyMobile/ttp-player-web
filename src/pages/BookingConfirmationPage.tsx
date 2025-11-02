import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, MapPin, Star } from "lucide-react";

import MainLayout from "../components/MainLayout";
import { findCoachProfile } from "../data/mockCoachProfiles";

import "./BookingConfirmationPage.css";

type LocationState = {
  coachId?: number;
  dateId?: string;
  slotId?: string;
};

const MINUTES_PER_DAY = 24 * 60;

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

const BookingConfirmationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as LocationState | undefined;
  const searchParams = new URLSearchParams(location.search);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const coachIdFromState = state?.coachId;
  const dateIdFromState = state?.dateId;
  const slotIdFromState = state?.slotId;

  const coachIdParam = searchParams.get("coach");
  const dateIdParam = searchParams.get("date");
  const slotIdParam = searchParams.get("slot");

  const coachId = coachIdFromState ?? (coachIdParam ? Number.parseInt(coachIdParam, 10) : undefined);
  const dateId = dateIdFromState ?? dateIdParam ?? undefined;
  const slotId = slotIdFromState ?? slotIdParam ?? undefined;

  const profile = coachId != null ? findCoachProfile(coachId) : undefined;

  const selectedDate = profile?.booking.availableDates.find((date) => date.id === dateId);
  const selectedSlot = selectedDate?.slots.find((slot) => slot.id === slotId);

  const lessonDetails = selectedSlot ? profile?.booking.lessonTypes.find((type) => type.id === selectedSlot.lessonType) : undefined;

  const timeRange = selectedSlot ? buildTimeRangeLabel(selectedSlot.time, selectedSlot.duration) : undefined;
  const locationLabel = profile?.location ?? profile?.coachingLocations[0];
  const isGroupLesson = selectedSlot?.lessonType === "group";
  const coachFirstName = profile?.name?.split(" ")[0] ?? profile?.name ?? "";
  const lessonDateLabel = selectedDate
    ? `${dayNameMap[selectedDate.day] ?? selectedDate.day}, ${selectedDate.label}`
    : undefined;

  const capacity = isGroupLesson ? extractPlayerCapacity(lessonDetails?.duration) : undefined;
  const spotsLabel = useMemo(() => {
    if (!selectedSlot || !isGroupLesson) {
      return undefined;
    }

    const remaining = Math.max(selectedSlot.spotsRemaining, 0);
    if (capacity) {
      return `${Math.min(remaining, capacity)}/${capacity} spots available`;
    }

    return `${remaining} spot${remaining === 1 ? "" : "s"} available`;
  }, [capacity, isGroupLesson, selectedSlot]);

  const lessonLabel = lessonDetails?.label ?? (selectedSlot?.lessonType === "private" ? "Private lesson" : "Group lesson");

  const headlineSubtitle = isGroupLesson
    ? `Secure your spot instantly in ${coachFirstName}'s group lesson — no coach approval needed.`
    : `Lock in your preferred time. We’ll notify ${coachFirstName} once you submit the request.`;

  const priceLabel = isGroupLesson ? "Total due today" : "Total due now";
  const priceCaption = isGroupLesson ? "Charged immediately to hold your spot." : "Charged only after the coach approves.";
  const confirmButtonLabel = isGroupLesson ? "Confirm lesson" : "Submit booking request";
  const disclaimerCopy = isGroupLesson
    ? "Your lesson is confirmed instantly when spots are available."
    : "You won’t be charged until the coach confirms.";

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

  const shouldShowEmptyState = !profile || !selectedDate || !selectedSlot;

  if (shouldShowEmptyState) {
    return (
      <MainLayout>
        <div className="booking-confirmation booking-confirmation--empty">
          <div className="booking-confirmation__empty-card">
            <h1 className="booking-confirmation__empty-title">We couldn't load that booking</h1>
            <p className="booking-confirmation__empty-copy">
              The booking details expired or were missing. Please return to the coach listings to choose an available lesson.
            </p>
            <button
              type="button"
              className="fc-button fc-button--primary booking-confirmation__empty-action"
              onClick={() => navigate("/find-coaches")}
            >
              Browse coaches
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
            onClick={() => navigate(-1)}
          >
            <ArrowLeft aria-hidden className="booking-confirmation__back-icon" /> Back to availability
          </button>

          <header className="booking-confirmation__header">
            <div className="booking-confirmation__headline">
              <span className="booking-confirmation__eyebrow">Review & confirm</span>
              <h1 className="booking-confirmation__title">Confirm your lesson with {profile.name}</h1>
              <p className="booking-confirmation__subtitle">{headlineSubtitle}</p>
            </div>
          </header>

          <div className="booking-confirmation__layout">
            <section className="booking-confirmation__card">
              <div className="booking-confirmation__coach">
                <img className="booking-confirmation__coach-avatar" src={profile.imageUrl} alt="" />
                <div className="booking-confirmation__coach-meta">
                  <h2 className="booking-confirmation__coach-name">{profile.name}</h2>
                  <p className="booking-confirmation__coach-title">{profile.title}</p>
                  <div className="booking-confirmation__coach-rating">
                    <Star size={18} fill="#FDB022" stroke="none" aria-hidden />
                    {profile.rating.toFixed(1)}
                    <span className="booking-confirmation__coach-reviews">({profile.reviewCount} reviews)</span>
                  </div>
                </div>
              </div>

              <div className="booking-confirmation__details">
                <div className="booking-confirmation__detail">
                  <CalendarDays aria-hidden size={20} />
                  <div className="booking-confirmation__detail-copy">
                    <span className="booking-confirmation__detail-label">When</span>
                    <span className="booking-confirmation__detail-primary">
                      {dayNameMap[selectedDate.day] ?? selectedDate.day}, {selectedDate.label}
                    </span>
                    <span className="booking-confirmation__detail-secondary">{timeRange}</span>
                  </div>
                </div>

                <div className="booking-confirmation__detail">
                  <Clock aria-hidden size={20} />
                  <div className="booking-confirmation__detail-copy">
                    <span className="booking-confirmation__detail-label">Lesson</span>
                    <span className="booking-confirmation__detail-primary">{lessonLabel}</span>
                    <span className="booking-confirmation__detail-secondary">{selectedSlot.duration}</span>
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
              </div>

              <div className="booking-confirmation__price">
                <div>
                  <span className="booking-confirmation__price-label">{priceLabel}</span>
                  <span className="booking-confirmation__price-value">{selectedSlot.price}</span>
                </div>
                <span className="booking-confirmation__price-caption">{priceCaption}</span>
              </div>

              <div className="booking-confirmation__actions">
                <button
                  type="button"
                  className="fc-button fc-button--primary booking-confirmation__confirm"
                  onClick={() => setIsConfirmed(true)}
                  disabled={isConfirmed}
                >
                  {confirmButtonLabel}
                  <CheckCircle2 aria-hidden className="booking-confirmation__confirm-icon" />
                </button>
                <span className="booking-confirmation__disclaimer">{disclaimerCopy}</span>
                {isConfirmed ? (
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
                <p>
                  You can return to availability and pick a different time or lesson type at any point before submitting your
                  request.
                </p>
                <button
                  type="button"
                  className="booking-confirmation__aside-back"
                  onClick={() => navigate(-1)}
                >
                  Choose a different slot
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default BookingConfirmationPage;
