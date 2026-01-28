import { useEffect, useMemo } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";

import "./PrivateLessonConfirmationModal.css";

type PrivateLessonConfirmationModalProps = {
  coachName: string;
  coachTitle?: string;
  lessonLabel: string;
  dateLabel?: string;
  timeRange?: string;
  locationLabel?: string;
  statusLabel: string;
  statusCopy: string;
  eyebrow?: string;
  lessonDetailNote?: string;
  onClose: () => void;
  startDate?: Date;
  endDate?: Date;
};

const padNumber = (value: number) => value.toString().padStart(2, "0");

const formatDateForICS = (date: Date, withZulu = false) => {
  const year = date.getUTCFullYear();
  const month = padNumber(date.getUTCMonth() + 1);
  const day = padNumber(date.getUTCDate());
  const hours = padNumber(date.getUTCHours());
  const minutes = padNumber(date.getUTCMinutes());
  const seconds = padNumber(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}${withZulu ? "Z" : ""}`;
};

const formatDateForGoogle = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, "");

const formatDateForMicrosoft = (date: Date) => date.toISOString();

const buildICSFile = ({
  startDate,
  endDate,
  summary,
  description,
  location,
}: {
  startDate: Date;
  endDate: Date;
  summary: string;
  description?: string;
  location?: string;
}) => {
  const dtStamp = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TopTier Tennis Player//Private Lesson//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${startDate.getTime()}-${endDate.getTime()}@toptier-tennis`,
    `DTSTAMP:${formatDateForICS(dtStamp, true)}`,
    `DTSTART:${formatDateForICS(startDate)}`,
    `DTEND:${formatDateForICS(endDate)}`,
    `SUMMARY:${summary}`,
    location ? `LOCATION:${location}` : undefined,
    description ? `DESCRIPTION:${description.replace(/\n/g, "\\n")}` : undefined,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];

  return lines.join("\r\n");
};

const PrivateLessonConfirmationModal = ({
  coachName,
  coachTitle,
  lessonLabel,
  dateLabel,
  timeRange,
  locationLabel,
  statusLabel,
  statusCopy,
  eyebrow = "Request submitted",
  lessonDetailNote = "We'll lock in your spot once approved.",
  onClose,
  startDate,
  endDate,
}: PrivateLessonConfirmationModalProps) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const calendarSummary = useMemo(() => `Private lesson with ${coachName}`, [coachName]);

  const calendarDescription = useMemo(() => {
    const details = [`Lesson type: ${lessonLabel}`];
    details.push(`Status: ${statusLabel}`);
    if (timeRange && dateLabel) {
      details.push(`When: ${dateLabel} • ${timeRange}`);
    }
    if (locationLabel) {
      details.push(`Where: ${locationLabel}`);
    }
    return details.join("\n");
  }, [dateLabel, lessonLabel, locationLabel, statusLabel, timeRange]);

  const canCreateCalendarEvent = Boolean(startDate && endDate);

  const handleGoogleCalendar = () => {
    if (!canCreateCalendarEvent || !startDate || !endDate) {
      return;
    }
    const start = formatDateForGoogle(startDate);
    const end = formatDateForGoogle(endDate);
    const baseUrl = "https://calendar.google.com/calendar/render";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: calendarSummary,
      dates: `${start}/${end}`,
      details: calendarDescription,
    });
    if (locationLabel) {
      params.set("location", locationLabel);
    }
    window.open(`${baseUrl}?${params.toString()}`, "_blank", "noopener");
  };

  const handleMicrosoftCalendar = () => {
    if (!canCreateCalendarEvent || !startDate || !endDate) {
      return;
    }
    const baseUrl = "https://outlook.live.com/calendar/0/deeplink/compose";
    const params = new URLSearchParams({
      subject: calendarSummary,
      body: calendarDescription,
      startdt: formatDateForMicrosoft(startDate),
      enddt: formatDateForMicrosoft(endDate),
    });
    if (locationLabel) {
      params.set("location", locationLabel);
    }
    window.open(`${baseUrl}?${params.toString()}`, "_blank", "noopener");
  };

  const handleICalDownload = () => {
    if (!canCreateCalendarEvent || !startDate || !endDate) {
      return;
    }
    const icsContent = buildICSFile({
      startDate,
      endDate,
      summary: calendarSummary,
      description: calendarDescription,
      location: locationLabel,
    });

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeSummary = calendarSummary.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase();
    anchor.href = url;
    anchor.download = `${safeSummary || "lesson"}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="private-lesson-confirmation__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-lesson-confirmation-title"
    >
      <div className="private-lesson-confirmation" role="document">
        <button
          type="button"
          className="private-lesson-confirmation__close"
          onClick={onClose}
          aria-label="Close confirmation"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
        <header className="private-lesson-confirmation__header">
          <span className="private-lesson-confirmation__eyebrow">{eyebrow}</span>
          <h2 id="private-lesson-confirmation-title">Lesson with {coachName}</h2>
          <p>{statusCopy}</p>
        </header>

        <div className="private-lesson-confirmation__status">
          {statusLabel.toLowerCase().includes("confirm") ? (
            <CheckCircle2 aria-hidden />
          ) : (
            <Clock aria-hidden />
          )}
          <span>{statusLabel}</span>
        </div>

        <div className="private-lesson-confirmation__body">
          <section className="private-lesson-confirmation__details">
            <h3>Lesson details</h3>
            <ul>
              <li>
                <UserRound aria-hidden />
                <div>
                  <span className="private-lesson-confirmation__detail-primary">Coach {coachName}</span>
                  {coachTitle ? (
                    <span className="private-lesson-confirmation__detail-secondary">{coachTitle}</span>
                  ) : null}
                </div>
              </li>
              <li>
                <CalendarDays aria-hidden />
                <div>
                  <span className="private-lesson-confirmation__detail-primary">{dateLabel ?? "To be scheduled"}</span>
                  {timeRange ? (
                    <span className="private-lesson-confirmation__detail-secondary">{timeRange}</span>
                  ) : null}
                </div>
              </li>
              <li>
                <CalendarPlus aria-hidden />
                <div>
                  <span className="private-lesson-confirmation__detail-primary">{lessonLabel}</span>
                  <span className="private-lesson-confirmation__detail-secondary">{lessonDetailNote}</span>
                </div>
              </li>
              {locationLabel ? (
                <li>
                  <MapPin aria-hidden />
                  <div>
                    <span className="private-lesson-confirmation__detail-primary">{locationLabel}</span>
                    <span className="private-lesson-confirmation__detail-secondary">Arrive a few minutes early to warm up.</span>
                  </div>
                </li>
              ) : null}
            </ul>
          </section>

          <aside className="private-lesson-confirmation__sidebar">
            <div className="private-lesson-confirmation__policy">
              <ShieldAlert aria-hidden />
              <div>
                <h4>24-hour cancellation policy</h4>
                <p>
                  Cancel up to 24 hours before the lesson for a full credit. After that, the lesson must be paid in full.
                </p>
              </div>
            </div>

            <div className="private-lesson-confirmation__calendar">
              <h4>Add to your calendar</h4>
              <p>Keep the lesson on your radar with a single click.</p>
              <div className="private-lesson-confirmation__calendar-actions">
                <button type="button" onClick={handleGoogleCalendar} disabled={!canCreateCalendarEvent}>
                  <CalendarDays aria-hidden /> Google Calendar
                </button>
                <button type="button" onClick={handleICalDownload} disabled={!canCreateCalendarEvent}>
                  <CalendarPlus aria-hidden /> Apple Calendar (ICS)
                </button>
                <button type="button" onClick={handleMicrosoftCalendar} disabled={!canCreateCalendarEvent}>
                  <CalendarPlus aria-hidden /> Microsoft Outlook
                </button>
              </div>
              {!canCreateCalendarEvent ? (
                <p className="private-lesson-confirmation__calendar-hint">
                  Calendar links will be available once the coach confirms your time.
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PrivateLessonConfirmationModal;
