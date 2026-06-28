import { Award, Clock3, Users } from "lucide-react";

import "./CoachCredibilityLine.css";

export interface CoachCredibilityLineProps {
  /** Primary certification; rendered only when present. */
  certLabel?: string;
  /** Years coaching; rendered only when a positive number. */
  yearsExperience?: number | null;
  /** Students coached (exact integer, no "+"); rendered only when a positive number. */
  studentCount?: number | null;
  /** Optional extra class for context-specific spacing. */
  className?: string;
}

/**
 * Compact, icon-led credibility line — cert · years coaching · students coached. Each item leads with a
 * muted glyph (no dot separators) and renders only when the data is real; nothing fabricated. The
 * Clock3/Users glyphs match the desktop hero stats row so the two read as one icon language. Shared by
 * the search card and the profile identity header.
 */
const CoachCredibilityLine = ({
  certLabel,
  yearsExperience,
  studentCount,
  className,
}: CoachCredibilityLineProps) => {
  const hasYears = typeof yearsExperience === "number" && yearsExperience > 0;
  const hasStudents = typeof studentCount === "number" && studentCount > 0;
  if (!certLabel && !hasYears && !hasStudents) return null;

  return (
    <div className={`coach-cred${className ? ` ${className}` : ""}`}>
      {certLabel ? (
        <span className="coach-cred__item">
          <Award className="coach-cred__icon" size={14} strokeWidth={2} aria-hidden />
          {certLabel}
        </span>
      ) : null}
      {hasYears ? (
        <span className="coach-cred__item">
          <Clock3 className="coach-cred__icon" size={14} strokeWidth={2} aria-hidden />
          {yearsExperience} yrs coaching
        </span>
      ) : null}
      {hasStudents ? (
        <span className="coach-cred__item">
          <Users className="coach-cred__icon" size={14} strokeWidth={2} aria-hidden />
          {studentCount} student{studentCount === 1 ? "" : "s"} coached
        </span>
      ) : null}
    </div>
  );
};

export default CoachCredibilityLine;
