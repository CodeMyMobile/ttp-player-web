import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  MapPin,
  MessageCircle,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import { findCoachProfile, type CoachProfile } from "../data/mockCoachProfiles";

import "./CoachProfilePage.css";

const highlightIconMap = {
  users: Users,
  trophy: Award,
  spark: Sparkles,
};

const metricIconMap = {
  dollar: DollarSign,
  users: Users,
  clock: Clock3,
  map: MapPin,
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

type BookingSelections = {
  lessonType: string;
  dateId?: string;
  timeId?: string;
};

const useCoachProfile = (id?: string) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CoachProfile | undefined>();

  useEffect(() => {
    let timer: number | undefined;
    setLoading(true);
    timer = window.setTimeout(() => {
      setProfile(id ? findCoachProfile(id) : undefined);
      setLoading(false);
    }, 520);

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [id]);

  return { loading, profile };
};

const Chip = ({ label }: { label: string }) => (
  <span className="coach-chip">
    {label}
  </span>
);

const BookButton = ({ disabled, lessonLabel }: { disabled?: boolean; lessonLabel?: string }) => (
  <button type="button" disabled={disabled} className="coach-profile-book">
    Book {lessonLabel ?? "lesson"}
    <CheckCircle2 className="coach-profile-book__icon" strokeWidth={2.5} />
  </button>
);

const CoachProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, profile } = useCoachProfile(id);
  const [selection, setSelection] = useState<BookingSelections>(() => ({
    lessonType: "",
  }));

  useEffect(() => {
    if (!loading && profile) {
      const defaultLessonType = profile.booking.defaultLessonType;
      const initialDate = profile.booking.availableDates[0];
      const initialSlot = initialDate?.slots.find(
        (slot) => slot.lessonType === defaultLessonType,
      );
      setSelection({
        lessonType: defaultLessonType,
        dateId: initialDate?.id,
        timeId: initialSlot?.id,
      });
    }
  }, [loading, profile]);

  useEffect(() => {
    if (!profile || !selection.lessonType) {
      return;
    }

    const dates = profile.booking.availableDates;
    if (!dates.length) {
      return;
    }

    const activeDate =
      dates.find((item) => item.id === selection.dateId) ?? dates[0];
    const slotsForLesson = activeDate.slots.filter(
      (slot) => slot.lessonType === selection.lessonType,
    );

    const desiredTimeId =
      slotsForLesson.length === 0
        ? undefined
        : selection.timeId && slotsForLesson.some((slot) => slot.id === selection.timeId)
          ? selection.timeId
          : slotsForLesson[0]?.id;

    if (activeDate.id !== selection.dateId || desiredTimeId !== selection.timeId) {
      setSelection((prev) => ({
        ...prev,
        dateId: activeDate.id,
        timeId: desiredTimeId,
      }));
    }
  }, [profile, selection.dateId, selection.lessonType, selection.timeId]);

  const lessonType = useMemo(() => {
    if (!profile) {
      return undefined;
    }
    return profile.booking.lessonTypes.find((item) => item.id === selection.lessonType) ??
      profile.booking.lessonTypes.find((item) => item.id === profile.booking.defaultLessonType);
  }, [profile, selection.lessonType]);

  const handleLessonTypeChange = (id: string) => {
    setSelection((prev) => ({
      ...prev,
      lessonType: id,
    }));
  };

  const handleDateChange = (id: string) => {
    setSelection((prev) => ({
      ...prev,
      dateId: id,
    }));
  };

  const handleTimeChange = (id: string) => {
    setSelection((prev) => ({
      ...prev,
      timeId: id,
    }));
  };

  const selectedDate = useMemo(() => {
    if (!profile) {
      return undefined;
    }
    return profile.booking.availableDates.find((date) => date.id === selection.dateId);
  }, [profile, selection.dateId]);

  const filteredSlots = useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    return selectedDate.slots.filter((slot) => slot.lessonType === selection.lessonType);
  }, [selectedDate, selection.lessonType]);

  const selectedSlot = useMemo(
    () => filteredSlots.find((slot) => slot.id === selection.timeId),
    [filteredSlots, selection.timeId],
  );

  return (
    <MainLayout>
      <div className="coach-profile-page">
        <div className="coach-profile-page__inner">
          <button type="button" onClick={() => navigate(-1)} className="coach-profile-back">
            <ArrowLeft className="coach-profile-back__icon" strokeWidth={2.5} /> Back to Coaches
          </button>

          {loading && (
            <div className="coach-profile-skeleton" aria-hidden="true">
              <div className="coach-profile-skeleton__body">
                <div className="coach-profile-skeleton__main">
                  <div className="coach-profile-skeleton__identity-row">
                    <div className="coach-profile-skeleton__avatar" />
                    <div className="coach-profile-skeleton__identity">
                      <div className="coach-profile-skeleton__line coach-profile-skeleton__line--name" />
                      <div className="coach-profile-skeleton__line coach-profile-skeleton__line--meta" />
                      <div className="coach-profile-skeleton__chip-row">
                        <div className="coach-profile-skeleton__chip" />
                        <div className="coach-profile-skeleton__chip" />
                        <div className="coach-profile-skeleton__chip" />
                      </div>
                    </div>
                  </div>
                  <div className="coach-profile-skeleton__metrics">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="coach-profile-skeleton__metric" />
                    ))}
                  </div>
                  <div className="coach-profile-skeleton__paragraph">
                    <div className="coach-profile-skeleton__line" />
                    <div className="coach-profile-skeleton__line coach-profile-skeleton__line--short" />
                  </div>
                  <div className="coach-profile-skeleton__cards">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="coach-profile-skeleton__card" />
                    ))}
                  </div>
                </div>
                <div className="coach-profile-skeleton__aside">
                  <div className="coach-profile-skeleton__panel" />
                </div>
              </div>
            </div>
          )}

          {!loading && !profile && (
            <div className="coach-profile-empty">
              <div className="coach-profile-empty__icon">
                <MessageCircle strokeWidth={2.4} />
              </div>
              <h2 className="coach-profile-empty__title">Coach not found</h2>
              <p className="coach-profile-empty__copy">
                We couldn’t locate that profile. It may have been removed or the link is incorrect. Return to the coach directory
                to keep exploring.
              </p>
              <Link to="/find-coaches" className="coach-profile-empty__action">
                <ArrowLeft className="coach-profile-back__icon" strokeWidth={2.5} /> Back to Find Coaches
              </Link>
            </div>
          )}

          {!loading && profile && (
            <div className="coach-profile-content">
              <section className="coach-profile-hero">
                <div className="coach-profile-hero__inner">
                  <div className="coach-profile-identity coach-profile-hero__identity">
                    <div className="coach-profile-identity__avatar-block">
                      <img
                        src={profile.imageUrl}
                        alt={`Portrait of ${profile.name}`}
                        className="coach-profile-identity__avatar"
                      />
                      <div className="coach-profile-identity__details">
                        <div className="coach-profile-identity__name-row">
                          <h1 className="coach-profile-identity__name">{profile.name}</h1>
                          {profile.headlineBadge && (
                            <span className="coach-profile-identity__badge">
                              <Star className="coach-profile-identity__badge-icon" strokeWidth={2.5} />
                              {profile.headlineBadge}
                            </span>
                          )}
                        </div>
                        <div className="coach-profile-identity__meta">
                          <span className="coach-profile-identity__rating">
                            <Star className="coach-profile-identity__rating-icon" fill="#FDB022" stroke="#FDB022" strokeWidth={1.6} />
                            {profile.rating.toFixed(1)}
                          </span>
                          <span className="coach-profile-identity__reviews">({profile.reviewCount} reviews)</span>
                          <span className="coach-profile-identity__separator" aria-hidden="true">
                            •
                          </span>
                          <span className="coach-profile-identity__title">{profile.title}</span>
                        </div>
                        <div className="coach-profile-identity__chips">
                          {profile.highlightChips.map((chip) => {
                            const Icon = highlightIconMap[chip.icon];
                            return (
                              <span key={chip.label} className="coach-profile-identity__chip">
                                <Icon className="coach-profile-identity__chip-icon" strokeWidth={2.2} />
                                {chip.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="coach-profile-hero__metrics">
                    {profile.metrics.map((metric) => {
                      const Icon = metricIconMap[metric.icon];
                      return (
                        <div key={metric.label} className="coach-profile-metric">
                          <div className="coach-profile-metric__label-row">
                            <span className="coach-profile-metric__icon">
                              <Icon strokeWidth={2.4} />
                            </span>
                            <span className="coach-profile-metric__label">{metric.label}</span>
                          </div>
                          <div className="coach-profile-metric__value-row">
                            <span className="coach-profile-metric__value">{metric.value}</span>
                            {metric.caption && <span className="coach-profile-metric__caption">{metric.caption}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <div className="coach-profile-body">
                <div className="coach-profile-body__inner">
                  <div className="coach-profile-layout">
                    <section className="coach-profile-main">
                      <section className="coach-profile-sections">
                        <div className="coach-profile-panel coach-profile-panel--about">
                          <div className="coach-profile-panel__header">
                            <h2 className="coach-profile-panel__title">About {profile.name.split(" ")[0]}</h2>
                            <MessageCircle className="coach-profile-panel__icon" strokeWidth={2.4} />
                          </div>
                          <p className="coach-profile-about__copy">{profile.about}</p>
                          {profile.certifications.length > 0 && (
                            <div className="coach-profile-certifications">
                              {profile.certifications.map((certification) => (
                                <span key={certification} className="coach-profile-certification">
                                  <CheckCircle2 className="coach-profile-certification__icon" strokeWidth={2.4} />
                                  {certification}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="coach-profile-panel">
                          <div className="coach-profile-panel__header">
                            <h2 className="coach-profile-panel__title">Specialties</h2>
                            <Sparkles className="coach-profile-panel__icon" strokeWidth={2.4} />
                          </div>
                          <p className="coach-profile-panel__copy">Serve technique, match strategy, and tournament prep dialed for your game.</p>
                          <div className="coach-profile-panel__chips">
                            {profile.specialties.map((specialty) => (
                              <Chip key={specialty} label={specialty} />
                            ))}
                          </div>
                        </div>

                        <div className="coach-profile-panel">
                          <div className="coach-profile-panel__header">
                            <h2 className="coach-profile-panel__title">Coaching Locations</h2>
                            <MapPin className="coach-profile-panel__icon" strokeWidth={2.4} />
                          </div>
                          <p className="coach-profile-panel__copy">Certified to coach at these nearby courts and clubs.</p>
                          <ul className="coach-profile-locations">
                            {profile.coachingLocations.map((location) => (
                              <li key={location} className="coach-profile-location">
                                <span className="coach-profile-location__bullet" />
                                <span>{location}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="coach-profile-panel">
                          <div className="coach-profile-panel__header">
                            <h2 className="coach-profile-panel__title">Lesson Types</h2>
                            <Users className="coach-profile-panel__icon" strokeWidth={2.4} />
                          </div>
                          <p className="coach-profile-panel__copy">Clear pricing for the most popular training formats.</p>
                          <ul className="coach-profile-lessons">
                            {profile.lessonDetails.map((lesson) => (
                              <li key={lesson.title} className="coach-profile-lesson">
                                <div className="coach-profile-lesson__content">
                                  <div>
                                    <p className="coach-profile-lesson__title">{lesson.title}</p>
                                    <p className="coach-profile-lesson__description">{lesson.description}</p>
                                  </div>
                                  <div className="coach-profile-lesson__price">
                                    <p className="coach-profile-lesson__amount">{lesson.price}</p>
                                    <p className="coach-profile-lesson__cadence">{lesson.cadence}</p>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </section>
                    </section>

                    <aside className="coach-profile-aside">
                  <div className="coach-booking">
                    <div className="coach-booking__header">
                      <div className="coach-booking__header-copy">
                        <h2 className="coach-booking__title">{profile.booking.headline}</h2>
                        <p className="coach-booking__subtitle">Select your preferred date and time</p>
                      </div>
                      <CalendarDays className="coach-booking__icon" strokeWidth={2.4} />
                    </div>

                    <div className="coach-booking__controls">
                      <div className="coach-booking__section">
                        <span className="coach-booking__label">Select day</span>
                        <div className="coach-booking__day-grid">
                          {profile.booking.availableDates.map((date) => {
                            const active = selection.dateId === date.id;
                            return (
                              <button
                                key={date.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => handleDateChange(date.id)}
                                className={`coach-booking__day${active ? " coach-booking__day--active" : ""}`}
                              >
                                <span className="coach-booking__day-name">{dayNameMap[date.day] ?? date.day}</span>
                                <span className="coach-booking__day-date">{date.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="coach-booking__section">
                        <span className="coach-booking__label">Lesson type</span>
                        <div className="coach-booking__lesson-toggle">
                          {profile.booking.lessonTypes.map((lesson) => {
                            const active = selection.lessonType
                              ? selection.lessonType === lesson.id
                              : lesson.id === profile.booking.defaultLessonType;
                            return (
                              <button
                                key={lesson.id}
                                type="button"
                                aria-pressed={active}
                                aria-label={`${lesson.label} – ${lesson.duration}`}
                                onClick={() => handleLessonTypeChange(lesson.id)}
                                className={`coach-booking__lesson-pill${active ? " coach-booking__lesson-pill--active" : ""}`}
                              >
                                <span className="coach-booking__lesson-pill-name">{lesson.label}</span>
                                <span className="coach-booking__lesson-pill-meta">{lesson.duration}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {lessonType && (
                      <div className="coach-booking__lesson-details">
                        <div className="coach-booking__lesson-summary">
                          <div className="coach-booking__lesson-summary-text">
                            <span className="coach-booking__lesson-summary-name">{lessonType.label}</span>
                            <span className="coach-booking__lesson-summary-duration">{lessonType.duration}</span>
                          </div>
                          <div className="coach-booking__lesson-summary-price">
                            <span className="coach-booking__lesson-summary-amount">{lessonType.price}</span>
                            <span className="coach-booking__lesson-summary-unit">{lessonType.unit}</span>
                          </div>
                        </div>
                        <p className="coach-booking__lesson-tagline">{lessonType.tagline}</p>
                        <ul className="coach-booking__lesson-points">
                          {lessonType.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="coach-booking__schedule">
                      <div className="coach-booking__schedule-header">
                        <span className="coach-booking__label">Upcoming availability</span>
                        <span className="coach-booking__month">{profile.booking.monthLabel}</span>
                      </div>
                      <div className="coach-booking__days">
                        {profile.booking.availableDates.map((date) => {
                          const slotsForType = date.slots.filter((slot) => slot.lessonType === selection.lessonType);
                          if (!slotsForType.length) {
                            return null;
                          }
                          const isActive = selection.dateId === date.id;
                          return (
                            <section key={date.id} className={`coach-booking-day${isActive ? " coach-booking-day--active" : ""}`}>
                              <div className="coach-booking-day__header">
                                <div className="coach-booking-day__titles">
                                  <h3>{dayNameMap[date.day] ?? date.day}</h3>
                                  <span>{date.label}</span>
                                </div>
                                <span className="coach-booking-day__count">{slotsForType.length} {slotsForType.length === 1 ? "option" : "options"}</span>
                              </div>
                              <div className="coach-booking-day__slots">
                                {slotsForType.map((slot) => {
                                  const active = selection.timeId === slot.id;
                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      aria-pressed={active}
                                      onClick={() => {
                                        handleDateChange(date.id);
                                        handleTimeChange(slot.id);
                                      }}
                                      className={`coach-booking-slot${active ? " coach-booking-slot--active" : ""}`}
                                    >
                                      <div className="coach-booking-slot__time">
                                        <span className="coach-booking-slot__start">{slot.time}</span>
                                        <span className="coach-booking-slot__duration">{slot.duration}</span>
                                      </div>
                                      <div className="coach-booking-slot__meta">
                                        <span>{slot.spotsRemaining} spots left</span>
                                      </div>
                                      <div className="coach-booking-slot__price">{slot.price}</div>
                                    </button>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </div>

                    <div className="coach-booking__footer">
                      <BookButton
                        disabled={!selectedSlot}
                        lessonLabel={lessonType ? lessonType.label : undefined}
                      />
                      <p className="coach-booking__note">{profile.booking.note}</p>
                      <button type="button" className="coach-profile-message">
                        <MessageCircle className="coach-profile-message__icon" strokeWidth={2.4} />
                        Message coach
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default CoachProfilePage;
