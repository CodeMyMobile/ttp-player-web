import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, Star, X } from "lucide-react";

import type { Coach } from "../../data/mockCoaches";
import { findCoachProfile, type CoachProfile } from "../../data/mockCoachProfiles";

import "../../pages/CoachProfilePage.css";
import "./BookLessonModal.css";

type LessonFilter = "all" | "private" | "group";

type SelectionState = {
  day: string;
  lessonType: LessonFilter;
};

type SelectedSlot = {
  dateId: string;
  slotId: string;
};

const ALL_DAYS_ID = "all-days";

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

type BookLessonModalProps = {
  coach: Coach;
  onClose: () => void;
};

const BookLessonModal = ({ coach, onClose }: BookLessonModalProps) => {
  const [profile, setProfile] = useState<CoachProfile | undefined>();
  const [selection, setSelection] = useState<SelectionState>({
    day: ALL_DAYS_ID,
    lessonType: "all",
  });
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | undefined>();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let timer: number | undefined;
    timer = window.setTimeout(() => {
      const nextProfile = findCoachProfile(coach.id);
      setProfile(nextProfile);
      setSelection({
        day: ALL_DAYS_ID,
        lessonType: "all",
      });
      setSelectedSlot(undefined);
    }, 220);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      if (timer) {
        window.clearTimeout(timer);
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [coach.id, onClose]);

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

  const filteredDates = useMemo(() => {
    if (!profile) {
      return [] as CoachProfile["booking"]["availableDates"];
    }

    const matchesLessonType = (lessonType: LessonFilter) =>
      lessonType === "all"
        ? () => true
        : (slot: CoachProfile["booking"]["availableDates"][number]["slots"][number]) =>
            slot.lessonType === lessonType;

    const predicate = matchesLessonType(selection.lessonType);

    const datesToConsider =
      selection.day === ALL_DAYS_ID
        ? profile.booking.availableDates
        : profile.booking.availableDates.filter((date) => date.id === selection.day);

    return datesToConsider.map((date) => ({
      ...date,
      slots: date.slots.filter(predicate),
    }));
  }, [profile, selection.day, selection.lessonType]);

  const hasAnySlots = filteredDates.some((date) => date.slots.length > 0);

  const lessonLocationLabel = useMemo(() => {
    if (!profile) {
      return undefined;
    }

    return profile.location ?? profile.coachingLocations[0];
  }, [profile]);

  useEffect(() => {
    if (!selectedSlot || !profile) {
      return;
    }

    const exists = profile.booking.availableDates.some(
      (date) => date.id === selectedSlot.dateId && date.slots.some((slot) => slot.id === selectedSlot.slotId),
    );

    if (!exists) {
      setSelectedSlot(undefined);
    }
  }, [profile, selectedSlot]);

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    const stillVisible = filteredDates.some(
      (date) => date.id === selectedSlot.dateId && date.slots.some((slot) => slot.id === selectedSlot.slotId),
    );

    if (!stillVisible) {
      setSelectedSlot(undefined);
    }
  }, [filteredDates, selectedSlot]);

  const selectedSlotInfo = useMemo(() => {
    if (!profile || !selectedSlot) {
      return undefined;
    }

    const date = profile.booking.availableDates.find((item) => item.id === selectedSlot.dateId);
    if (!date) {
      return undefined;
    }

    const slot = date.slots.find((item) => item.id === selectedSlot.slotId);
    if (!slot) {
      return undefined;
    }

    const timeRange = buildTimeRangeLabel(slot.time, slot.duration);
    const lessonDetails = lessonTypeDetailMap[slot.lessonType];
    const lessonLabel =
      lessonDetails?.label ?? (slot.lessonType === "private" ? "Private lesson" : "Group lesson");

    return {
      dayName: dayNameMap[date.day] ?? date.day,
      dateLabel: date.label,
      timeRange,
      lessonLabel,
      locationLabel: lessonLocationLabel,
      price: slot.price,
    };
  }, [lessonLocationLabel, lessonTypeDetailMap, profile, selectedSlot]);

  const renderSlot = (
    dateId: string,
    slot: CoachProfile["booking"]["availableDates"][number]["slots"][number],
  ) => {
    const timeRange = buildTimeRangeLabel(slot.time, slot.duration);
    const lessonDetails = lessonTypeDetailMap[slot.lessonType];
    const lessonLabel = lessonDetails?.label ?? (slot.lessonType === "private" ? "Private lesson" : "Group lesson");
    const isGroupLesson = slot.lessonType === "group";
    const capacity = isGroupLesson ? extractPlayerCapacity(lessonDetails?.duration) : undefined;
    const availableSpots = Math.max(slot.spotsRemaining, 0);
    const spotsLabel = isGroupLesson
      ? capacity
        ? `${Math.min(availableSpots, capacity)}/${capacity} spots available`
        : `${availableSpots} spot${availableSpots === 1 ? "" : "s"} available`
      : undefined;
    const groupTitle = isGroupLesson ? slot.title : undefined;
    const active = selectedSlot?.dateId === dateId && selectedSlot.slotId === slot.id;

    return (
      <button
        key={`${dateId}-${slot.id}`}
        type="button"
        className={`coach-booking-slot coach-booking-slot--${slot.lessonType}${active ? " coach-booking-slot--active" : ""}`}
        onClick={() => {
          setSelectedSlot({ dateId, slotId: slot.id });
        }}
        aria-pressed={active}
      >
        <div className="coach-booking-slot__header">
          <span className="coach-booking-slot__range">{timeRange}</span>
          <span className="coach-booking-slot__price">{slot.price}</span>
        </div>
        <div className="coach-booking-slot__details">
          <span className="coach-booking-slot__badge">{lessonLabel}</span>
          {groupTitle ? (
            <>
              <span className="coach-booking-slot__group-title">{groupTitle}</span>
              <span className="coach-booking-slot__separator" aria-hidden />
            </>
          ) : (
            <span className="coach-booking-slot__separator" aria-hidden />
          )}
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
  };

  const modalDescriptionId = `book-lesson-modal-desc-${coach.id}`;

  return (
    <div className="book-lesson-modal-overlay" role="dialog" aria-modal="true" aria-labelledby={modalDescriptionId}>
      <div className="book-lesson-modal" role="document">
        <header className="book-lesson-modal__header">
          <div className="book-lesson-modal__identity">
            <img className="book-lesson-modal__avatar" src={coach.imageUrl} alt="" />
            <div className="book-lesson-modal__meta">
              <p className="book-lesson-modal__eyebrow">Book with</p>
              <h2 className="book-lesson-modal__title" id={modalDescriptionId}>
                {coach.name}
              </h2>
              <div className="book-lesson-modal__stats">
                <span className="book-lesson-modal__rating">
                  <Star size={16} fill="#FDB022" stroke="none" aria-hidden />
                  {coach.rating.toFixed(1)}
                  <span className="book-lesson-modal__rating-count">({coach.reviewCount} reviews)</span>
                </span>
                <span className="book-lesson-modal__separator" aria-hidden />
                <span className="book-lesson-modal__price">{coach.pricePerHour}</span>
                <span className="book-lesson-modal__price-unit">per hour</span>
              </div>
            </div>
          </div>
          <button type="button" className="book-lesson-modal__close" onClick={onClose} aria-label="Close booking dialog">
            <X size={18} strokeWidth={2.5} />
          </button>
        </header>

        <div className="book-lesson-modal__body">
          {profile ? (
            <div className="book-lesson-modal__booking-surface">
              <div className="coach-booking__controls book-lesson-modal__controls">
                <div className="coach-booking__section">
                  <span className="coach-booking__label">Select day</span>
                  <div className="coach-booking__day-grid">
                    <button
                      type="button"
                      className={`coach-booking__day${selection.day === ALL_DAYS_ID ? " coach-booking__day--active" : ""}`}
                      onClick={() => {
                        setSelection((prev) => ({ ...prev, day: ALL_DAYS_ID }));
                      }}
                    >
                      <span className="coach-booking__day-name">All Days</span>
                      <span className="coach-booking__day-date">View every option</span>
                    </button>
                    {profile.booking.availableDates.map((date) => {
                      const active = selection.day === date.id;
                      return (
                        <button
                          key={date.id}
                          type="button"
                          className={`coach-booking__day${active ? " coach-booking__day--active" : ""}`}
                          onClick={() => {
                            setSelection((prev) => ({ ...prev, day: date.id }));
                          }}
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
                    {[
                      { id: "all" as LessonFilter, label: "All lessons" },
                      { id: "private" as LessonFilter, label: "Private" },
                      { id: "group" as LessonFilter, label: "Group" },
                    ].map((item) => {
                      const active = selection.lessonType === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`coach-booking__lesson-pill${active ? " coach-booking__lesson-pill--active" : ""}`}
                          onClick={() => {
                            setSelection((prev) => ({ ...prev, lessonType: item.id }));
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="coach-booking__schedule book-lesson-modal__schedule">
                {hasAnySlots ? (
                  <div className="coach-booking__days">
                    {filteredDates.map((date) => {
                      if (date.slots.length === 0) {
                        return null;
                      }
                      return (
                        <section key={date.id} className="coach-booking-day">
                          <div className="coach-booking-day__header">
                            <div className="coach-booking-day__titles">
                              <h3 className="coach-booking-day__title">{dayNameMap[date.day] ?? date.day}</h3>
                              <span className="coach-booking-day__subtitle">{date.label}</span>
                            </div>
                            <span className="coach-booking-day__count">
                              {date.slots.length} option{date.slots.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="coach-booking-day__slots">
                            {date.slots.map((slot) => renderSlot(date.id, slot))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="coach-booking-day__empty">
                    {selection.lessonType === "group" ? (
                      <p>No group sessions are available for the selected day.</p>
                    ) : selection.lessonType === "private" ? (
                      <p>No private lessons are available for the selected day.</p>
                    ) : (
                      <p>No lessons are available for the selected day.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="book-lesson-modal__loading" aria-busy="true">
              <div className="book-lesson-modal__spinner" />
              <span>Loading availability…</span>
            </div>
          )}
        </div>

        <footer className="book-lesson-modal__footer">
          <div className="book-lesson-modal__selection" aria-live="polite">
            {selectedSlotInfo ? (
              <div className="book-lesson-modal__selection-card">
                <div className="book-lesson-modal__selection-header">
                  <span className="book-lesson-modal__selection-label">Your selection</span>
                  <span className="book-lesson-modal__selection-price">{selectedSlotInfo.price}</span>
                </div>
                <div className="book-lesson-modal__selection-details">
                  <div className="book-lesson-modal__selection-row">
                    <CalendarDays size={18} aria-hidden />
                    <div className="book-lesson-modal__selection-copy">
                      <span className="book-lesson-modal__selection-primary">
                        {selectedSlotInfo.dayName}, {selectedSlotInfo.dateLabel}
                      </span>
                      <span className="book-lesson-modal__selection-secondary">
                        {selectedSlotInfo.timeRange} · {selectedSlotInfo.lessonLabel}
                      </span>
                    </div>
                  </div>
                  {selectedSlotInfo.locationLabel ? (
                    <div className="book-lesson-modal__selection-row">
                      <MapPin size={18} aria-hidden />
                      <div className="book-lesson-modal__selection-copy">
                        <span className="book-lesson-modal__selection-primary">
                          {selectedSlotInfo.locationLabel}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="book-lesson-modal__selection-placeholder">
                <span>Select a day and lesson time to review the details before confirming.</span>
              </div>
            )}
          </div>
          <div className="book-lesson-modal__actions">
            <button
              type="button"
              className="fc-button fc-button--primary book-lesson-modal__confirm"
              disabled={!selectedSlotInfo}
            >
              {selectedSlotInfo ? `Confirm booking - ${selectedSlotInfo.price}` : "Confirm booking"}
            </button>
            <span className="book-lesson-modal__disclaimer">
              You won't be charged until the coach confirms
            </span>
          </div>
        </footer>
      </div>
      <button type="button" className="book-lesson-modal-overlay__backdrop" aria-hidden="true" onClick={onClose} />
    </div>
  );
};

export default BookLessonModal;
