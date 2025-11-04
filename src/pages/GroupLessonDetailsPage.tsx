import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import GroupLessonConfirmationModal from "../components/group-lessons/GroupLessonConfirmationModal";
import { findGroupLessonById } from "../data/mockGroupLessons";
import { colors, typography } from "../lib/theme";

import "./GroupLessonDetailsPage.css";

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

const formatMinutesToTimeLabel = (totalMinutes: number) => {
  const minutesNormalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours24 = Math.floor(minutesNormalized / 60);
  const minutes = minutesNormalized % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const buildTimeRangeLabel = (startLabel: string, durationMinutes: number) => {
  const startMinutes = parseTimeToMinutes(startLabel);
  if (startMinutes == null) {
    return startLabel;
  }

  const endMinutes = startMinutes + durationMinutes;
  return `${formatMinutesToTimeLabel(startMinutes)} – ${formatMinutesToTimeLabel(endMinutes)}`;
};

const formatLevel = (level: number) => `NTRP ${level.toFixed(1)}`;

const buildInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const GroupLessonDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const lesson = useMemo(() => (id ? findGroupLessonById(id) : undefined), [id]);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const themeVars = useMemo(
    () => ({
      "--fc-color-bg": colors.pageBackground,
      "--fc-color-surface": colors.surface,
      "--fc-color-border": colors.border,
      "--fc-color-text-primary": colors.primaryText,
      "--fc-color-text-secondary": colors.secondaryText,
      "--fc-color-text-muted": colors.mutedText,
      "--fc-color-accent": colors.accentPurple,
      "--fc-color-accent-light": colors.accentPurpleLight,
      "--fc-color-accent-border": colors.accentPurpleBorder,
      "--fc-font-family": typography.fontFamily,
    }),
    [],
  );

  if (!lesson) {
    return (
      <MainLayout>
        <div className="group-lesson-details" style={themeVars}>
          <div className="group-lesson-details__inner group-lesson-details__inner--empty">
            <Link to="/group-lessons" className="group-lesson-details__back-link">
              <ArrowLeft aria-hidden /> Back to group lessons
            </Link>
            <div className="group-lesson-details__empty">
              <h1>We couldn’t find that session</h1>
              <p>The lesson may have been filled or removed. Browse the latest sessions to pick another time.</p>
              <Link to="/group-lessons" className="group-lesson-details__empty-action">
                Explore group lessons
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const confirmedCount = lesson.participants.length;
  const spotsRemaining = Math.max(Math.min(lesson.availableSpots, lesson.totalSpots - confirmedCount), 0);
  const timeRange = buildTimeRangeLabel(lesson.startTime, lesson.durationMinutes);
  const levelLabel = formatLevel(lesson.level);

  return (
    <MainLayout>
      <div className="group-lesson-details" style={themeVars}>
        <div className="group-lesson-details__inner">
          <button
            type="button"
            className="group-lesson-details__back-link"
            onClick={() => {
              if (window.history.length > 2) {
                navigate(-1);
              } else {
                navigate("/group-lessons");
              }
            }}
          >
            <ArrowLeft aria-hidden /> Back
          </button>

          <header className="group-lesson-details__header">
            <div className="group-lesson-details__title-block">
              <span className="group-lesson-details__eyebrow">Featured group session</span>
              <h1>{lesson.title}</h1>
              <p className="group-lesson-details__subtitle">{lesson.focus}</p>
              <div className="group-lesson-details__tags">
                <span className="group-lesson-details__tag">{levelLabel}</span>
                <span className="group-lesson-details__tag">{lesson.skillLabel}</span>
                {lesson.courtSurface ? (
                  <span className="group-lesson-details__tag">{lesson.courtSurface} court</span>
                ) : null}
              </div>
            </div>

            <aside className="group-lesson-details__coach-card">
              <div className="group-lesson-details__coach">
                <img src={lesson.coachAvatarUrl} alt="" />
                <div>
                  <p className="group-lesson-details__coach-name">{lesson.coachName}</p>
                  <p className="group-lesson-details__coach-title">Matchplay Certified Coach</p>
                  <Link to={`/coaches/${lesson.coachId}`} className="group-lesson-details__coach-link">
                    View coach profile
                  </Link>
                </div>
              </div>
              <div className="group-lesson-details__coach-meta">
                <CalendarDays aria-hidden size={18} />
                <span>{lesson.date}</span>
              </div>
              <div className="group-lesson-details__coach-meta">
                <Clock aria-hidden size={18} />
                <span>
                  {timeRange}
                  <span className="group-lesson-details__dot" aria-hidden>
                    •
                  </span>
                  {lesson.durationMinutes} min
                </span>
              </div>
              <div className="group-lesson-details__coach-meta">
                <MapPin aria-hidden size={18} />
                <span>{lesson.locationName}</span>
              </div>
              <div className="group-lesson-details__coach-meta group-lesson-details__coach-meta--spots">
                <Users aria-hidden size={18} />
                <span>
                  {confirmedCount}/{lesson.totalSpots} players confirmed
                  {spotsRemaining > 0 ? ` • ${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} open` : " • Full"}
                </span>
              </div>
            </aside>
          </header>

          <div className="group-lesson-details__layout">
            <section className="group-lesson-details__content">
              <div className="group-lesson-details__card">
                <h2>What to expect</h2>
                <p>{lesson.description}</p>
                {lesson.highlights && lesson.highlights.length > 0 ? (
                  <ul className="group-lesson-details__highlight-list">
                    {lesson.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="group-lesson-details__card">
                <div className="group-lesson-details__card-header">
                  <h2>Confirmed players</h2>
                  <span>{confirmedCount} attending</span>
                </div>
                {confirmedCount > 0 ? (
                  <ul className="group-lesson-details__participants">
                    {lesson.participants.map((participant) => (
                      <li key={participant.id} className="group-lesson-details__participant">
                        <span className="group-lesson-details__participant-avatar" aria-hidden>
                          {participant.avatarUrl ? (
                            <img src={participant.avatarUrl} alt="" />
                          ) : (
                            buildInitials(participant.name)
                          )}
                        </span>
                        <div className="group-lesson-details__participant-body">
                          <span className="group-lesson-details__participant-name">{participant.name}</span>
                          <span className="group-lesson-details__participant-meta">
                            {participant.skillLevel ?? "Skill level pending"}
                            {participant.focusArea ? ` • ${participant.focusArea}` : ""}
                          </span>
                          {participant.joinedLabel ? (
                            <span className="group-lesson-details__participant-joined">{participant.joinedLabel}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="group-lesson-details__participants-empty">
                    <p>Be the first to claim a spot — invite a hitting partner to join you.</p>
                  </div>
                )}
              </div>
            </section>

            <aside className="group-lesson-details__checkout">
              <div className="group-lesson-details__checkout-card">
                <div className="group-lesson-details__checkout-header">
                  <h2>Secure your spot</h2>
                  <p>Pay now to instantly join the roster. Spots update in real time.</p>
                </div>
                <div className="group-lesson-details__price-row">
                  <span className="group-lesson-details__price-label">Total due today</span>
                  <span className="group-lesson-details__price-value">{lesson.pricePerPlayer}</span>
                </div>
                <ul className="group-lesson-details__checkout-list">
                  <li>
                    <ShieldCheck aria-hidden size={18} /> Secure checkout powered by Matchplay
                  </li>
                  <li>
                    <Users aria-hidden size={18} /> {spotsRemaining > 0 ? `${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} left` : "Session full"}
                  </li>
                  <li>
                    <CalendarDays aria-hidden size={18} /> {lesson.date}
                  </li>
                </ul>
                <button
                  type="button"
                  className="group-lesson-details__checkout-action"
                  disabled={spotsRemaining === 0}
                  onClick={() => {
                    setIsConfirmationOpen(true);
                  }}
                >
                  {spotsRemaining === 0 ? "Join waitlist" : "Book & pay"}
                </button>
                <p className="group-lesson-details__checkout-caption">
                  {spotsRemaining === 0
                    ? "We'll notify you if a player drops and a spot re-opens."
                    : "You're charged immediately to hold your place. Cancel up to 24 hours ahead for a full credit."}
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
      {isConfirmationOpen ? (
        <GroupLessonConfirmationModal lesson={lesson} onClose={() => setIsConfirmationOpen(false)} />
      ) : null}
    </MainLayout>
  );
};

export default GroupLessonDetailsPage;
