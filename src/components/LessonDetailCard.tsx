import moment from "moment";
import { MapPin, Users, Clock, Layers, Share2, CheckCircle2, Hourglass, AlertTriangle, Circle } from "lucide-react";
import { Lesson } from "../api/playerLessons";
import "./LessonDetailCard.css";

type LessonDetailCardProps = {
  lesson: Lesson;
  statusLabel?: string;
  onShare?: (lesson: Lesson) => void;
};

type StatusTone = "success" | "pending" | "danger" | "neutral";

const resolveStatus = (lesson: Lesson, statusLabel?: string): { label: string; tone: StatusTone } => {
  if (statusLabel) {
    const normalized = statusLabel.toLowerCase();
    if (normalized.includes("confirm")) return { label: statusLabel, tone: "success" };
    if (normalized.includes("pending") || normalized.includes("wait")) return { label: statusLabel, tone: "pending" };
    if (normalized.includes("cancel")) return { label: statusLabel, tone: "danger" };
    if (normalized.includes("book")) return { label: statusLabel, tone: "success" };
    return { label: statusLabel, tone: "neutral" };
  }

  const numericStatus = (lesson as Record<string, unknown>).status;
  if (typeof numericStatus === "number") {
    if (numericStatus === 0) return { label: "Pending", tone: "pending" };
    if (numericStatus === 1) return { label: "Confirmed", tone: "success" };
    if (numericStatus === 2) return { label: "Cancelled", tone: "danger" };
  }

  return { label: "Lesson", tone: "neutral" };
};

const LessonDetailCard = ({ lesson, statusLabel, onShare }: LessonDetailCardProps) => {
  // Align time handling with mobile: treat API timestamps as UTC and provide a 1h fallback if end is missing
  const start = moment.utc(lesson.start_date_time);
  const end = lesson.end_date_time
    ? moment.utc(lesson.end_date_time)
    : start.clone().add(1, "hour");
  const startTimeLabel = start.format("hh:mm a");
  const endTimeLabel = end.isValid() ? end.format("hh:mm a") : "";
  const durationMinutes = end.isValid() ? Math.max(end.diff(start, "minutes"), 0) : 0;
  const durationLabel = end.isValid() ? `${durationMinutes} mins` : "";
  const level = lesson.metadata?.level || lesson.metadata_level;
  const title =
    lesson.metadata?.title ||
    lesson.metadata_title ||
    (lesson.lesson_type_name ? `${lesson.lesson_type_name} with ${lesson.coach_name}` : "Lesson");

  const status = resolveStatus(lesson, statusLabel);

  return (
    <article className="lesson-detail-card">
      <div className="lesson-detail-card__date">
        <span className="lesson-detail-card__day">{start.format("DD")}</span>
        <span className="lesson-detail-card__month">{start.format("MMM")}</span>
      </div>

      <div className="lesson-detail-card__body">
        <header className="lesson-detail-card__header">
          <div>
            <h3 className="lesson-detail-card__title">{title}</h3>
            {lesson.location_name ? (
              <p className="lesson-detail-card__meta">
                <MapPin size={16} /> {lesson.location_name}
              </p>
            ) : null}
            <p className="lesson-detail-card__meta">
              <Clock size={16} /> {startTimeLabel}
              {endTimeLabel ? ` - ${endTimeLabel}` : ""}{durationLabel ? ` • ${durationLabel}` : ""}
            </p>
            <div className="lesson-detail-card__chips">
              {lesson.lesson_type_name ? (
                <span className="lesson-detail-card__chip">
                  <Layers size={14} /> {lesson.lesson_type_name}
                </span>
              ) : null}
              {level ? (
                <span className="lesson-detail-card__chip lesson-detail-card__chip--muted">
                  Level {level}
                </span>
              ) : null}
              {typeof lesson.player_limit === "number" ? (
                <span className="lesson-detail-card__chip lesson-detail-card__chip--muted">
                  <Users size={14} /> {lesson.current_player_count ?? 0}/{lesson.player_limit} spots
                </span>
              ) : null}
            </div>
          </div>

          <div className={`lesson-detail-card__status lesson-detail-card__status--${status.tone}`}>
            {status.tone === "success" && <CheckCircle2 size={16} />}
            {status.tone === "pending" && <Hourglass size={16} />}
            {status.tone === "danger" && <AlertTriangle size={16} />}
            {status.tone === "neutral" && <Circle size={14} />}
            <span>{status.label}</span>
          </div>
        </header>

        {lesson.metadata?.description ? (
          <p className="lesson-detail-card__description">{lesson.metadata.description}</p>
        ) : null}

        <footer className="lesson-detail-card__footer">
          {typeof lesson.price_per_person === "number" ? (
            <div className="lesson-detail-card__price">
              ${lesson.price_per_person.toFixed(2)}
              <span>per player</span>
            </div>
          ) : null}
          {onShare ? (
            <button
              type="button"
              className="lesson-detail-card__share"
              onClick={() => onShare(lesson)}
            >
              <Share2 size={16} />
              Share lesson
            </button>
          ) : null}
        </footer>
      </div>
    </article>
  );
};

export default LessonDetailCard;
