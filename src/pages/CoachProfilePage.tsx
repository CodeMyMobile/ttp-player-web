import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  CheckCircle2,
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

const CoachProfilePage = () => {
  const { id } = useParams();
  const { loading, profile } = useCoachProfile(id);
  const [selection, setSelection] = useState<BookingSelections>(() => ({
    lessonType: "all",
  }));

  useEffect(() => {
    if (!loading && profile) {
      const defaultLessonType = profile.booking.defaultLessonType;
      const initialDate = profile.booking.availableDates[0];
      const initialSlot =
        initialDate?.slots.find((slot) => slot.lessonType === defaultLessonType) ??
        initialDate?.slots[0];
      setSelection({
        lessonType: "all",
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
    const slotsForLesson =
      selection.lessonType === "all"
        ? activeDate.slots
        : activeDate.slots.filter((slot) => slot.lessonType === selection.lessonType);

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

  const lessonFilters = [
    { id: "all", label: "All", ariaLabel: "All lesson formats" },
    { id: "private", label: "Privates", ariaLabel: "Private lessons" },
    { id: "group", label: "Groups", ariaLabel: "Group sessions" },
  ];

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
    return selection.lessonType === "all"
      ? selectedDate.slots
      : selectedDate.slots.filter((slot) => slot.lessonType === selection.lessonType);
  }, [selectedDate, selection.lessonType]);

  const selectedSlot = useMemo(
    () => filteredSlots.find((slot) => slot.id === selection.timeId),
    [filteredSlots, selection.timeId],
  );

  const activeLessonType = useMemo(() => {
    if (!profile) {
      return undefined;
    }

    const activeLessonId =
      selection.lessonType === "all"
        ? selectedSlot?.lessonType
        : selection.lessonType;

    if (!activeLessonId) {
      return undefined;
    }

    return profile.booking.lessonTypes.find((item) => item.id === activeLessonId);
  }, [profile, selectedSlot, selection.lessonType]);

  const lessonTypeDetailMap = useMemo(() => {
    if (!profile) {
      return {} as Record<string, CoachProfile["booking"]["lessonTypes"][number]>;
    }

    return profile.booking.lessonTypes.reduce(
      (acc, lesson) => {
        acc[lesson.id] = lesson;
        return acc;
      },
      {} as Record<string, CoachProfile["booking"]["lessonTypes"][number]>,
    );
  }, [profile]);

  const lessonLocationLabel = useMemo(() => {
    if (!profile) {
      return undefined;
    }

    return profile.location ?? profile.coachingLocations[0];
  }, [profile]);

  return (
    <MainLayout>
      <div className="coach-profile-page">
        <div className="coach-profile-page__inner">
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
                          {lessonFilters.map((lesson) => {
                            const active = selection.lessonType === lesson.id;
                            return (
                              <button
                                key={lesson.id}
                                type="button"
                                aria-pressed={active}
                                aria-label={lesson.ariaLabel}
                                onClick={() => handleLessonTypeChange(lesson.id)}
                                className={`coach-booking__lesson-pill${active ? " coach-booking__lesson-pill--active" : ""}`}
                              >
                                {lesson.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="coach-booking__schedule">
                      <div className="coach-booking__days">
                        {selectedDate ? (
                          <section className="coach-booking-day coach-booking-day--active">
                            <div className="coach-booking-day__header">
                              <div className="coach-booking-day__titles">
                                <h3>{dayNameMap[selectedDate.day] ?? selectedDate.day}</h3>
                                <span>{selectedDate.label}</span>
                              </div>
                              <span className="coach-booking-day__count">
                                {filteredSlots.length} {filteredSlots.length === 1 ? "option" : "options"}
                              </span>
                            </div>
                            {filteredSlots.length > 0 ? (
                              <div className="coach-booking-day__slots">
                                {filteredSlots.map((slot) => {
                                  const active = selection.timeId === slot.id;
                                  const lessonDetails = lessonTypeDetailMap[slot.lessonType];
                                  const timeRange = buildTimeRangeLabel(
                                    slot.time,
                                    lessonDetails?.duration ?? slot.duration,
                                  );
                                  const isGroupLesson = slot.lessonType === "group";
                                  const capacity = isGroupLesson
                                    ? extractPlayerCapacity(lessonDetails?.duration)
                                    : undefined;
                                  const availableSpots = Math.max(slot.spotsRemaining, 0);
                                  const spotsLabel = isGroupLesson
                                    ? capacity
                                      ? `${Math.min(availableSpots, capacity)}/${capacity} spots available`
                                      : `${availableSpots} spot${availableSpots === 1 ? "" : "s"} available`
                                    : undefined;
                                  const lessonLabel =
                                    lessonDetails?.label ??
                                    (slot.lessonType === "private" ? "Private lesson" : "Group lesson");
                                  const groupTitle = isGroupLesson ? slot.title : undefined;

                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      aria-pressed={active}
                                      onClick={() => {
                                        handleDateChange(selectedDate.id);
                                        handleTimeChange(slot.id);
                                      }}
                                      className={`coach-booking-slot coach-booking-slot--${slot.lessonType}${
                                        active ? " coach-booking-slot--active" : ""
                                      }`}
                                    >
                                      <div className="coach-booking-slot__header">
                                        <span className="coach-booking-slot__range">{timeRange}</span>
                                        <span className="coach-booking-slot__price">{slot.price}</span>
                                      </div>
                                      {groupTitle ? (
                                        <div className="coach-booking-slot__group-title">{groupTitle}</div>
                                      ) : null}
                                      <div className="coach-booking-slot__details">
                                        <span className="coach-booking-slot__badge">{lessonLabel}</span>
                                        <span className="coach-booking-slot__separator" aria-hidden />
                                        <span className="coach-booking-slot__duration">{slot.duration}</span>
                                        {spotsLabel ? (
                                          <>
                                            <span className="coach-booking-slot__separator" aria-hidden />
                                            <span className="coach-booking-slot__spots">{spotsLabel}</span>
                                          </>
                                        ) : null}
                                      </div>
                                      {lessonLocationLabel ? (
                                        <div className="coach-booking-slot__location">
                                          <MapPin aria-hidden className="coach-booking-slot__location-icon" />
                                          <span>{lessonLocationLabel}</span>
                                        </div>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="coach-booking-day__empty">
                                {selection.lessonType === "group" && (
                                  <p>No group sessions are available on this day.</p>
                                )}
                                {selection.lessonType === "private" && (
                                  <p>No private lessons are available on this day.</p>
                                )}
                                {selection.lessonType === "all" && <p>No lessons are available on this day.</p>}
                              </div>
                            )}
                          </section>
                        ) : (
                          <div className="coach-booking-day__empty">
                            <p>Select a day to explore available lessons.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="coach-booking__footer">
                      <BookButton
                        disabled={!selectedSlot}
                        lessonLabel={activeLessonType ? activeLessonType.label : undefined}
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
