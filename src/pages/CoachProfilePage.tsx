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
      setSelection({
        lessonType: profile.booking.defaultLessonType,
        dateId: profile.booking.availableDates[0]?.id,
        timeId: profile.booking.availableTimes[0]?.id,
      });
    }
  }, [loading, profile]);

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
      timeId: prev.timeId === id ? undefined : id,
    }));
  };

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
            <div className="coach-profile-card">
              <div className="coach-profile-layout">
                <section className="coach-profile-main">
                  <header className="coach-profile-header">
                    <div className="coach-profile-identity">
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
                              <span className="coach-profile-identity__badge">{profile.headlineBadge}</span>
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

                    <div className="coach-profile-metrics">
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

                    <div className="coach-profile-about">
                      <p>{profile.about}</p>
                    </div>

                    <div className="coach-profile-certifications">
                      {profile.certifications.map((certification) => (
                        <span key={certification} className="coach-profile-certification">
                          <CheckCircle2 className="coach-profile-certification__icon" strokeWidth={2.4} />
                          {certification}
                        </span>
                      ))}
                    </div>
                  </header>

                  <section className="coach-profile-sections">
                    <div className="coach-profile-panel">
                      <div className="coach-profile-panel__header">
                        <h2 className="coach-profile-panel__title">Specialties</h2>
                        <Sparkles className="coach-profile-panel__icon" strokeWidth={2.4} />
                      </div>
                      <p className="coach-profile-panel__copy">Focus areas Maria brings into every training block.</p>
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
                      <p className="coach-profile-panel__copy">Sessions can take place at these preferred clubs.</p>
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
                      <p className="coach-profile-panel__copy">Transparent pricing for the most requested sessions.</p>
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
                  <div className="coach-profile-aside__selectors">
                    <div className="coach-profile-aside__headline">
                      <h2 className="coach-profile-aside__title">{profile.booking.headline}</h2>
                      <CalendarDays className="coach-profile-aside__title-icon" strokeWidth={2.4} />
                    </div>
                    <div>
                      <span className="coach-profile-aside__label">Select lesson type</span>
                      <div className="coach-profile-aside__grid coach-profile-aside__grid--two">
                        {profile.booking.lessonTypes.map((lesson) => {
                          const active = selection.lessonType
                            ? selection.lessonType === lesson.id
                            : lesson.id === profile.booking.defaultLessonType;
                          return (
                            <button
                              key={lesson.id}
                              type="button"
                              aria-pressed={active}
                              aria-label={`${lesson.label} – ${lesson.duration}, ${lesson.tagline}`}
                              onClick={() => handleLessonTypeChange(lesson.id)}
                              className={`coach-profile-lesson-option${active ? " coach-profile-lesson-option--active" : ""}`}
                            >
                              <span className="coach-profile-lesson-option__header">
                                <span
                                  className={`coach-profile-lesson-option__indicator${active ? " coach-profile-lesson-option__indicator--active" : ""}`}
                                  aria-hidden="true"
                                />
                                <span className="coach-profile-lesson-option__titles">
                                  <span className="coach-profile-lesson-option__label">{lesson.label}</span>
                                  <span className="coach-profile-lesson-option__duration">{lesson.duration}</span>
                                </span>
                                <span className="coach-profile-lesson-option__price">
                                  <span className="coach-profile-lesson-option__amount">{lesson.price}</span>
                                  <span className="coach-profile-lesson-option__unit">{lesson.unit}</span>
                                </span>
                              </span>
                              <span className="coach-profile-lesson-option__body">
                                <span className="coach-profile-lesson-option__tagline">{lesson.tagline}</span>
                                <ul className="coach-profile-lesson-option__list">
                                  {lesson.bullets.map((bullet) => (
                                    <li key={bullet} className="coach-profile-lesson-option__bullet">
                                      {bullet}
                                    </li>
                                  ))}
                                </ul>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="coach-profile-aside__label-row">
                        <span className="coach-profile-aside__label">Select date</span>
                        <div className="coach-profile-aside__month">{profile.booking.monthLabel}</div>
                      </div>
                      <div className="coach-profile-aside__grid coach-profile-aside__grid--three">
                        {profile.booking.availableDates.map((date) => {
                          const active = selection.dateId === date.id;
                          return (
                            <button
                              key={date.id}
                              type="button"
                              onClick={() => handleDateChange(date.id)}
                              className={`coach-profile-date${active ? " coach-profile-date--active" : ""}`}
                            >
                              <div className="coach-profile-date__header">
                                <span className="coach-profile-date__day">{date.date}</span>
                                <span className="coach-profile-date__weekday">{date.day}</span>
                              </div>
                              <div className="coach-profile-date__sessions">
                                {date.sessions.map((session) => (
                                  <span key={session} className="coach-profile-date__session">
                                    {session}
                                  </span>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="coach-profile-aside__label">Select time</span>
                      <div className="coach-profile-aside__grid coach-profile-aside__grid--two-tight">
                        {profile.booking.availableTimes.map((time) => {
                          const active = selection.timeId === time.id;
                          return (
                            <button
                              key={time.id}
                              type="button"
                              onClick={() => handleTimeChange(time.id)}
                              className={`coach-profile-time${active ? " coach-profile-time--active" : ""}`}
                            >
                              {time.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="coach-profile-aside__footer">
                    {lessonType && (
                      <div className="coach-profile-summary">
                        <div className="coach-profile-summary__row">
                          <span className="coach-profile-summary__label">{lessonType.label}</span>
                          <span className="coach-profile-summary__price">
                            <span className="coach-profile-summary__amount">{lessonType.price}</span>
                            <span className="coach-profile-summary__unit">{lessonType.unit}</span>
                          </span>
                        </div>
                        <p className="coach-profile-summary__duration">{lessonType.duration}</p>
                        <p className="coach-profile-summary__description">{lessonType.tagline}</p>
                        <ul className="coach-profile-summary__list">
                          {lessonType.bullets.map((bullet) => (
                            <li key={bullet} className="coach-profile-summary__item">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <BookButton
                      disabled={!selection.dateId || !selection.timeId}
                      lessonLabel={lessonType ? lessonType.label : undefined}
                    />
                    <p className="coach-profile-aside__note">{profile.booking.note}</p>
                    <button type="button" className="coach-profile-message">
                      <MessageCircle className="coach-profile-message__icon" strokeWidth={2.4} />
                      Message coach
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default CoachProfilePage;
