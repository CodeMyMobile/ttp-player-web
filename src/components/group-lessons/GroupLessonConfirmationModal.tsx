import { useEffect } from "react";
import { CalendarDays, MapPin, Timer, UserRound, X } from "lucide-react";

import type { GroupLesson } from "../../data/mockGroupLessons";

import "./GroupLessonConfirmationModal.css";

type GroupLessonConfirmationModalProps = {
  lesson: GroupLesson;
  onClose: () => void;
};

const formatDurationLabel = (durationMinutes: number) => {
  if (durationMinutes % 60 === 0) {
    const hours = Math.floor(durationMinutes / 60);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  if (durationMinutes > 60) {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const hoursLabel = hours === 1 ? "1 hour" : `${hours} hours`;
    return `${hoursLabel} ${minutes} min`;
  }

  return `${durationMinutes} min`;
};

const padNumber = (value: number) => value.toString().padStart(2, "0");

const formatDateForICS = (date: Date, withZulu = false) => {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hours = padNumber(date.getHours());
  const minutes = padNumber(date.getMinutes());
  const seconds = padNumber(date.getSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}${withZulu ? "Z" : ""}`;
};

const parseLessonStart = (lesson: GroupLesson) => {
  const currentYear = new Date().getFullYear();
  const composedLabel = `${lesson.date} ${currentYear} ${lesson.startTime}`;
  const parsed = new Date(composedLabel);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
};

const buildICSFile = (lesson: GroupLesson) => {
  const startDate = parseLessonStart(lesson);
  if (!startDate) {
    return undefined;
  }

  const endDate = new Date(startDate.getTime() + lesson.durationMinutes * 60 * 1000);
  const dtStamp = new Date();
  const locationParts = [lesson.locationName, lesson.locationCity].filter(Boolean);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TopTier Tennis Player//Group Lesson//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${lesson.id}@toptier-tennis`,
    `DTSTAMP:${formatDateForICS(new Date(dtStamp.getTime() - dtStamp.getTimezoneOffset() * 60000), true)}`,
    `DTSTART:${formatDateForICS(startDate)}`,
    `DTEND:${formatDateForICS(endDate)}`,
    `SUMMARY:${lesson.title}`,
    locationParts.length > 0 ? `LOCATION:${locationParts.join(", ")}` : undefined,
    lesson.description ? `DESCRIPTION:${lesson.description.replace(/\n/g, "\\n")}` : undefined,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];

  return lines.join("\r\n");
};

const GroupLessonConfirmationModal = ({ lesson, onClose }: GroupLessonConfirmationModalProps) => {
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

  const handleAddToCalendar = () => {
    const icsContent = buildICSFile(lesson);
    if (!icsContent) {
      return;
    }

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const fileName = `${lesson.title.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "lesson"}.ics`;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="group-lesson-confirmation__overlay" role="dialog" aria-modal="true" aria-labelledby="group-lesson-confirmation-title">
      <div className="group-lesson-confirmation" role="document">
        <header className="group-lesson-confirmation__header">
          <div className="group-lesson-confirmation__heading">
            <span className="group-lesson-confirmation__eyebrow">You're booked</span>
            <h2 id="group-lesson-confirmation-title">{lesson.title}</h2>
            <p>See you on court! We've reserved your spot and emailed a receipt.</p>
          </div>
          <button type="button" className="group-lesson-confirmation__close" aria-label="Close confirmation" onClick={onClose}>
            <X size={18} strokeWidth={2.5} />
          </button>
        </header>

        <div className="group-lesson-confirmation__body">
          <section className="group-lesson-confirmation__details">
            <h3>Lesson details</h3>
            <ul>
              <li>
                <CalendarDays aria-hidden className="group-lesson-confirmation__detail-icon" />
                <div>
                  <span className="group-lesson-confirmation__detail-primary">{lesson.date}</span>
                  <span className="group-lesson-confirmation__detail-secondary">Starts at {lesson.startTime}</span>
                </div>
              </li>
              <li>
                <Timer aria-hidden className="group-lesson-confirmation__detail-icon" />
                <div>
                  <span className="group-lesson-confirmation__detail-primary">{formatDurationLabel(lesson.durationMinutes)}</span>
                  <span className="group-lesson-confirmation__detail-secondary">Arrive 10 minutes early to warm up.</span>
                </div>
              </li>
              <li>
                <MapPin aria-hidden className="group-lesson-confirmation__detail-icon" />
                <div>
                  <span className="group-lesson-confirmation__detail-primary">{lesson.locationName}</span>
                  <span className="group-lesson-confirmation__detail-secondary">{lesson.locationCity}</span>
                </div>
              </li>
              <li>
                <UserRound aria-hidden className="group-lesson-confirmation__detail-icon" />
                <div>
                  <span className="group-lesson-confirmation__detail-primary">Coach {lesson.coachName}</span>
                  <span className="group-lesson-confirmation__detail-secondary">Focus: {lesson.focus}</span>
                </div>
              </li>
            </ul>
          </section>

          <aside className="group-lesson-confirmation__actions">
            <div className="group-lesson-confirmation__summary">
              <span className="group-lesson-confirmation__price-label">Total paid</span>
              <span className="group-lesson-confirmation__price-value">{lesson.pricePerPlayer}</span>
            </div>
            <button type="button" className="group-lesson-confirmation__calendar" onClick={handleAddToCalendar}>
              <CalendarDays size={18} aria-hidden /> Add to calendar
            </button>
            <p className="group-lesson-confirmation__policy">
              Need to make a change? Cancel up to 24 hours in advance for a full credit back to your account.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default GroupLessonConfirmationModal;
