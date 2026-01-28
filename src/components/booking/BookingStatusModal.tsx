import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Info,
  MapPin,
  Share2,
  X,
} from "lucide-react";

import "./BookingStatusModal.css";

export type BookingStatus = "PENDING" | "CONFIRMED";

export type BookingStatusLesson = {
  coachName: string;
  coachInitials?: string;
  lessonType: string;
  duration: string;
  dateLabel: string;
  timeLabel: string;
  locationName: string;
  locationAddress?: string;
};

type BookingStatusModalProps = {
  status: BookingStatus;
  lesson: BookingStatusLesson;
  amount: string;
  etaText?: string;
  onClose: () => void;
  onPrimary: () => void;
  onSecondary: () => void;
  onAddToCalendar: () => void;
  onShare?: () => void;
};

const buildInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const [first, second] = parts;
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
};

const BookingStatusModal = ({
  status,
  lesson,
  amount,
  etaText = "~24 hrs",
  onClose,
  onPrimary,
  onSecondary,
  onAddToCalendar,
  onShare,
}: BookingStatusModalProps) => {
  const isConfirmed = status === "CONFIRMED";
  const title = isConfirmed ? "You’re booked!" : "Lesson request sent!";
  const subtitle = isConfirmed
    ? "Your spot in this group lesson has been confirmed."
    : "Your request has been sent to your coach for confirmation.";
  const bannerText = isConfirmed ? "Booking confirmed" : "Awaiting coach response";
  const amountLabel = isConfirmed ? "Amount charged" : "Lesson total";
  const primaryLabel = isConfirmed ? "Done" : "Got it";
  const sectionTitle = isConfirmed ? "WHAT’S CONFIRMED" : "WHAT HAPPENS NEXT";
  const infoText = isConfirmed
    ? "A confirmation email with lesson details has been sent to your email address."
    : "Your payment method won’t be charged until the coach confirms. If they can’t accommodate this time, they may suggest alternatives.";
  const cancellationText =
    "Cancellation policy: Free cancellation up to 24 hours before your lesson. Cancellations within 24 hours may be subject to a fee.";
  const coachInitials = lesson.coachInitials || buildInitials(lesson.coachName);

  return (
    <div className="booking-status-modal__overlay" role="dialog" aria-modal="true" aria-labelledby="booking-status-title">
      <div className="booking-status-modal" role="document">
        <button type="button" className="booking-status-modal__close" onClick={onClose} aria-label="Close confirmation">
          <X size={18} strokeWidth={2.5} />
        </button>

        <header className="booking-status-modal__header">
          <span className="booking-status-modal__icon">
            <CheckCircle2 size={28} strokeWidth={2.4} />
          </span>
          <div>
            <h2 id="booking-status-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
        </header>

        <div className={`booking-status-modal__banner booking-status-modal__banner--${isConfirmed ? "confirmed" : "pending"}`}>
          <span className="booking-status-modal__banner-dot" />
          {bannerText}
        </div>

        <section className="booking-status-modal__lesson-card">
          <div className="booking-status-modal__lesson-header">
            <span className="booking-status-modal__avatar">{coachInitials || "CO"}</span>
            <div>
              <div className="booking-status-modal__coach-name">{lesson.coachName}</div>
              <div className="booking-status-modal__lesson-meta">
                {lesson.lessonType} • {lesson.duration}
              </div>
            </div>
          </div>

          <div className="booking-status-modal__lesson-row">
            <CalendarDays size={18} />
            <div>
              <div className="booking-status-modal__lesson-primary">{lesson.dateLabel}</div>
              <div className="booking-status-modal__lesson-secondary">{lesson.timeLabel}</div>
            </div>
          </div>
          <div className="booking-status-modal__lesson-row">
            <MapPin size={18} />
            <div>
              <div className="booking-status-modal__lesson-primary">{lesson.locationName}</div>
              {lesson.locationAddress ? (
                <div className="booking-status-modal__lesson-secondary">{lesson.locationAddress}</div>
              ) : null}
            </div>
          </div>

          <div className="booking-status-modal__amount">
            <span>{amountLabel}</span>
            <strong>{amount}</strong>
          </div>

          <div className="booking-status-modal__lesson-actions">
            <button type="button" className="booking-status-modal__ghost" onClick={onAddToCalendar}>
              <CalendarCheck2 size={16} /> Add to calendar
            </button>
            {isConfirmed ? (
              <button type="button" className="booking-status-modal__ghost" onClick={onShare}>
                <Share2 size={16} /> Share with friends
              </button>
            ) : null}
          </div>
        </section>

        <section className="booking-status-modal__steps">
          <h3>{sectionTitle}</h3>
          {isConfirmed ? (
            <ul className="booking-status-modal__checklist">
              {["Your spot is reserved", "Payment processed", "Confirmation email sent"].map((item) => (
                <li key={item}>
                  <CheckCircle2 size={18} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ol className="booking-status-modal__stepper">
              <li className="booking-status-modal__step booking-status-modal__step--active">
                <span className="booking-status-modal__step-index">1</span>
                <span>Request sent to coach</span>
              </li>
              <li className="booking-status-modal__step">
                <span className="booking-status-modal__step-index">2</span>
                <span>Coach confirms availability</span>
                <span className="booking-status-modal__step-eta">{etaText}</span>
              </li>
              <li className="booking-status-modal__step">
                <span className="booking-status-modal__step-index">3</span>
                <span>You&apos;ll receive email confirmation</span>
              </li>
              <li className="booking-status-modal__step">
                <span className="booking-status-modal__step-index">4</span>
                <span>Payment processed</span>
              </li>
            </ol>
          )}
        </section>

        <div className="booking-status-modal__alert booking-status-modal__alert--info">
          <Info size={18} />
          <span>{infoText}</span>
        </div>

        <div className="booking-status-modal__alert booking-status-modal__alert--warning">
          <Info size={18} />
          <span>{cancellationText}</span>
        </div>

        <footer className="booking-status-modal__footer">
          <button type="button" className="booking-status-modal__secondary" onClick={onSecondary}>
            My Bookings
          </button>
          <button type="button" className="booking-status-modal__primary" onClick={onPrimary}>
            {primaryLabel}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default BookingStatusModal;
