import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronDown, MapPin, Star, X } from "lucide-react";

import type { Coach } from "../../data/mockCoaches";
import { findCoachProfile, type CoachProfile } from "../../data/mockCoachProfiles";

import "../../pages/CoachProfilePage.css";
import "./BookLessonModal.css";

type LessonFilter = "all" | "private" | "group";

type SelectionState = {
  day: string;
  lessonType: LessonFilter;
  range?: {
    start: string;
    end: string;
  };
};

const ALL_DAYS_ID = "all-days";
const CUSTOM_RANGE_ID = "custom-range";

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

const MAX_FUTURE_SELECTION_DAYS = 180;

const formatDateForInput = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getDateDisplayMeta = (isoDate: string) => {
  if (!isoDate) {
    return undefined;
  }

  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parsed);
  const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(parsed);
  const monthDayShort = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed);
  const monthDayLong = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);

  return {
    iso: isoDate,
    weekdayShort,
    weekdayLong,
    monthDayShort,
    monthDayLong,
  };
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
    range: undefined,
  });
  const [rangeStartValue, setRangeStartValue] = useState<string>("");
  const [rangeEndValue, setRangeEndValue] = useState<string>("");
  const [rangeError, setRangeError] = useState<string | undefined>();
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const navigate = useNavigate();
  const dateMenuRef = useRef<HTMLDivElement | null>(null);

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
        range: undefined,
      });
      setRangeStartValue("");
      setRangeEndValue("");
      setRangeError(undefined);
      setIsDateMenuOpen(false);
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

    const datesToConsider = (() => {
      if (selection.range) {
        const { start, end } = selection.range;
        return profile.booking.availableDates.filter((date) => {
          if (start && date.id < start) {
            return false;
          }
          if (end && date.id > end) {
            return false;
          }
          return true;
        });
      }

      if (selection.day === ALL_DAYS_ID) {
        return profile.booking.availableDates;
      }

      return profile.booking.availableDates.filter((date) => date.id === selection.day);
    })();

    return datesToConsider.map((date) => ({
      ...date,
      slots: date.slots.filter(predicate),
    }));
  }, [profile, selection.day, selection.lessonType]);

  const hasAnySlots = filteredDates.some((date) => date.slots.length > 0);

  const customSelectionMeta = useMemo(() => {
    if (!profile || selection.day === ALL_DAYS_ID || selection.range) {
      return undefined;
    }

    const knownDate = profile.booking.availableDates.some((date) => date.id === selection.day);
    if (knownDate) {
      return undefined;
    }

    return getDateDisplayMeta(selection.day);
  }, [profile, selection.day, selection.range]);

  const selectedRangeMeta = useMemo(() => {
    if (!selection.range) {
      return undefined;
    }

    const startMeta = getDateDisplayMeta(selection.range.start);
    const endMeta = getDateDisplayMeta(selection.range.end);

    if (!startMeta || !endMeta) {
      return undefined;
    }

    return { start: startMeta, end: endMeta };
  }, [selection.range]);

  const selectedDateSummary = useMemo(() => {
    if (selection.range && selectedRangeMeta) {
      const { start, end } = selectedRangeMeta;
      if (selection.range.start === selection.range.end) {
        return `${start.weekdayLong}, ${start.monthDayLong}`;
      }
      return `${start.weekdayLong}, ${start.monthDayLong} – ${end.weekdayLong}, ${end.monthDayLong}`;
    }

    if (!profile || selection.day === ALL_DAYS_ID) {
      return undefined;
    }

    const matchedDate = profile.booking.availableDates.find((date) => date.id === selection.day);
    if (matchedDate) {
      const meta = getDateDisplayMeta(matchedDate.id);
      if (meta) {
        return `${meta.weekdayLong}, ${meta.monthDayLong}`;
      }
      return matchedDate.label;
    }

    if (customSelectionMeta) {
      return `${customSelectionMeta.weekdayLong}, ${customSelectionMeta.monthDayLong}`;
    }

    return undefined;
  }, [selection.range, selectedRangeMeta, profile, selection.day, customSelectionMeta]);

  const minSelectableDate = useMemo(() => formatDateForInput(new Date()), []);
  const maxSelectableDate = useMemo(
    () => formatDateForInput(addDays(new Date(), MAX_FUTURE_SELECTION_DAYS)),
    [],
  );

  const datePickerStartId = useMemo(() => `book-lesson-date-start-${coach.id}`, [coach.id]);
  const datePickerEndId = useMemo(() => `book-lesson-date-end-${coach.id}`, [coach.id]);
  const dateMenuId = useMemo(() => `book-lesson-date-menu-${coach.id}`, [coach.id]);
  const dateRangeHintId = useMemo(() => `book-lesson-date-hint-${coach.id}`, [coach.id]);
  const rangeErrorId = useMemo(() => `book-lesson-date-error-${coach.id}`, [coach.id]);

  useEffect(() => {
    if (!isDateMenuOpen) {
      setRangeError(undefined);
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!dateMenuRef.current) {
        return;
      }

      if (!dateMenuRef.current.contains(event.target as Node)) {
        setIsDateMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDateMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDateMenuOpen]);

  useEffect(() => {
    if (selection.range) {
      setRangeStartValue(selection.range.start);
      setRangeEndValue(selection.range.end);
    }
  }, [selection.range]);

  const handleApplyRange = () => {
    setRangeError(undefined);

    if (!rangeStartValue || !rangeEndValue) {
      setRangeError("Select both a start and end date.");
      return;
    }

    if (rangeStartValue > rangeEndValue) {
      setRangeError("Start date must be before the end date.");
      return;
    }

    setSelection((prev) => ({
      ...prev,
      day: CUSTOM_RANGE_ID,
      range: { start: rangeStartValue, end: rangeEndValue },
    }));
    setIsDateMenuOpen(false);
  };

  const handleClearRange = () => {
    setRangeStartValue("");
    setRangeEndValue("");
    setRangeError(undefined);
    setSelection((prev) => ({
      ...prev,
      range: undefined,
      day: prev.range ? ALL_DAYS_ID : prev.day,
    }));
    setIsDateMenuOpen(false);
  };

  const dateFilterLabel = useMemo(() => {
    if (selection.range && selectedRangeMeta) {
      const { start, end } = selectedRangeMeta;
      if (selection.range.start === selection.range.end) {
        return `Custom date · ${start.monthDayShort}`;
      }
      return `Custom range · ${start.monthDayShort} – ${end.monthDayShort}`;
    }

    if (!profile) {
      return "Select a date";
    }

    if (selection.day === ALL_DAYS_ID) {
      return "All upcoming dates";
    }

    const matchedDate = profile.booking.availableDates.find((date) => date.id === selection.day);
    if (matchedDate) {
      return `${dayNameMap[matchedDate.day] ?? matchedDate.day} · ${matchedDate.label}`;
    }

    if (customSelectionMeta) {
      return `${customSelectionMeta.weekdayShort} · ${customSelectionMeta.monthDayShort}`;
    }

    if (selection.range) {
      return "Custom range";
    }

    return "Selected date";
  }, [selection.range, selectedRangeMeta, profile, selection.day, customSelectionMeta]);

  const dateFilterDescription = useMemo(() => {
    if (selection.range && selectedRangeMeta) {
      const { start, end } = selectedRangeMeta;
      if (selection.range.start === selection.range.end) {
        return `Showing availability for ${start.weekdayLong}`;
      }
      return `Showing lessons from ${start.monthDayLong} to ${end.monthDayLong}`;
    }

    if (selection.day === ALL_DAYS_ID) {
      return "Showing every available lesson";
    }

    return selectedDateSummary ?? "Checking availability";
  }, [selection.range, selectedRangeMeta, selection.day, selectedDateSummary]);

  const lessonLocationLabel = useMemo(() => {
    if (!profile) {
      return undefined;
    }

    return profile.location ?? profile.coachingLocations[0];
  }, [profile]);

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

    return (
      <button
        key={`${dateId}-${slot.id}`}
        type="button"
        className={`coach-booking-slot coach-booking-slot--${slot.lessonType}`}
        onClick={() => {
          navigate(`/booking/confirm?coach=${coach.id}&date=${dateId}&slot=${slot.id}`, {
            state: { coachId: coach.id, dateId, slotId: slot.id },
          });
          onClose();
        }}
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
                  <span className="coach-booking__label">Date</span>
                  <div className="coach-booking__day-grid">
                    <button
                      type="button"
                      className={`coach-booking__day${
                        selection.day === ALL_DAYS_ID && !selection.range ? " coach-booking__day--active" : ""
                      }`}
                      onClick={() => {
                        setSelection((prev) => ({ ...prev, day: ALL_DAYS_ID, range: undefined }));
                        setRangeStartValue("");
                        setRangeEndValue("");
                      }}
                    >
                      <span className="coach-booking__day-name">All Days</span>
                      <span className="coach-booking__day-date">View every option</span>
                    </button>
                    {profile.booking.availableDates.map((date) => {
                      const active = selection.day === date.id && !selection.range;
                      return (
                        <button
                          key={date.id}
                          type="button"
                          className={`coach-booking__day${active ? " coach-booking__day--active" : ""}`}
                          onClick={() => {
                            setSelection((prev) => ({ ...prev, day: date.id, range: undefined }));
                            setRangeStartValue(date.id);
                            setRangeEndValue(date.id);
                          }}
                        >
                          <span className="coach-booking__day-name">{dayNameMap[date.day] ?? date.day}</span>
                          <span className="coach-booking__day-date">{date.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="coach-booking__filters">
                    <div
                      ref={dateMenuRef}
                      className={`coach-booking__filter coach-booking__filter--date${isDateMenuOpen ? " coach-booking__filter--open" : ""}`}
                    >
                      <button
                        type="button"
                        className="coach-booking__filter-trigger"
                        aria-haspopup="true"
                        aria-expanded={isDateMenuOpen}
                        aria-controls={dateMenuId}
                        onClick={() => {
                          setIsDateMenuOpen((prev) => !prev);
                        }}
                      >
                        <span className="coach-booking__filter-trigger-text">
                          <span className="coach-booking__filter-trigger-label">{dateFilterLabel}</span>
                          <span className="coach-booking__filter-trigger-description">{dateFilterDescription}</span>
                        </span>
                        <span className="coach-booking__filter-trigger-icons">
                          <CalendarDays aria-hidden="true" className="coach-booking__filter-icon" size={18} />
                          <ChevronDown
                            aria-hidden="true"
                            className="coach-booking__filter-chevron"
                            size={18}
                          />
                        </span>
                      </button>
                      {isDateMenuOpen ? (
                        <div id={dateMenuId} className="coach-booking__filter-dropdown" role="menu">
                          <button
                            type="button"
                            className={`coach-booking__filter-option${
                              !selection.range && selection.day === ALL_DAYS_ID
                                ? " coach-booking__filter-option--active"
                                : ""
                            }`}
                            role="menuitemradio"
                            aria-checked={!selection.range && selection.day === ALL_DAYS_ID}
                            onClick={() => {
                              setSelection((prev) => ({ ...prev, day: ALL_DAYS_ID, range: undefined }));
                              setRangeStartValue("");
                              setRangeEndValue("");
                              setIsDateMenuOpen(false);
                            }}
                          >
                            <span className="coach-booking__filter-option-primary">All upcoming dates</span>
                            <span className="coach-booking__filter-option-secondary">View every lesson</span>
                          </button>
                          <div className="coach-booking__filter-divider" />
                          <div className="coach-booking__filter-group">
                            <span className="coach-booking__filter-group-label">Upcoming options</span>
                            <div className="coach-booking__filter-options-list">
                              {profile.booking.availableDates.map((date) => {
                                const active = !selection.range && selection.day === date.id;
                                return (
                                  <button
                                    key={date.id}
                                    type="button"
                                    className={`coach-booking__filter-option${
                                      active ? " coach-booking__filter-option--active" : ""
                                    }`}
                                    role="menuitemradio"
                                    aria-checked={active}
                                    onClick={() => {
                                      setSelection((prev) => ({ ...prev, day: date.id, range: undefined }));
                                      setRangeStartValue(date.id);
                                      setRangeEndValue(date.id);
                                      setIsDateMenuOpen(false);
                                    }}
                                  >
                                    <span className="coach-booking__filter-option-primary">
                                      {dayNameMap[date.day] ?? date.day}
                                    </span>
                                    <span className="coach-booking__filter-option-secondary">{date.label}</span>
                                  </button>
                                );
                              })}
                              {customSelectionMeta ? (
                                <button
                                  type="button"
                                  className="coach-booking__filter-option coach-booking__filter-option--active coach-booking__filter-option--custom"
                                  role="menuitemradio"
                                  aria-checked={!selection.range && selection.day === customSelectionMeta.iso}
                                  onClick={() => {
                                    setSelection((prev) => ({
                                      ...prev,
                                      day: customSelectionMeta.iso,
                                      range: undefined,
                                    }));
                                    setRangeStartValue(customSelectionMeta.iso);
                                    setRangeEndValue(customSelectionMeta.iso);
                                    setIsDateMenuOpen(false);
                                  }}
                                >
                                  <span className="coach-booking__filter-option-primary">
                                    {customSelectionMeta.weekdayLong}
                                  </span>
                                  <span className="coach-booking__filter-option-secondary">
                                    {customSelectionMeta.monthDayLong}
                                  </span>
                                </button>
                              ) : null}
                              {selection.range && selectedRangeMeta ? (
                                <button
                                  type="button"
                                  className="coach-booking__filter-option coach-booking__filter-option--active coach-booking__filter-option--custom"
                                  role="menuitemradio"
                                  aria-checked={true}
                                  onClick={() => {
                                    setIsDateMenuOpen(false);
                                  }}
                                >
                                  <span className="coach-booking__filter-option-primary">Custom range</span>
                                  <span className="coach-booking__filter-option-secondary">
                                    {selectedRangeMeta.start.monthDayLong} – {selectedRangeMeta.end.monthDayLong}
                                  </span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <div className="coach-booking__filter-divider" />
                          <div className="coach-booking__filter-field">
                            <span className="coach-booking__filter-field-label">Jump to a date range</span>
                            <div className="coach-booking__filter-range-inputs">
                              <div className="coach-booking__filter-field-group">
                                <label className="coach-booking__filter-field-caption" htmlFor={datePickerStartId}>
                                  Start
                                </label>
                                <input
                                  id={datePickerStartId}
                                  className="coach-booking__date-input"
                                  type="date"
                                  min={minSelectableDate}
                                  max={rangeEndValue || maxSelectableDate}
                                  value={rangeStartValue}
                                  aria-describedby={dateRangeHintId}
                                  aria-errormessage={rangeError ? rangeErrorId : undefined}
                                  onChange={(event) => {
                                    setRangeStartValue(event.target.value);
                                    setRangeError(undefined);
                                  }}
                                />
                              </div>
                              <div className="coach-booking__filter-field-group">
                                <label className="coach-booking__filter-field-caption" htmlFor={datePickerEndId}>
                                  End
                                </label>
                                <input
                                  id={datePickerEndId}
                                  className="coach-booking__date-input"
                                  type="date"
                                  min={rangeStartValue || minSelectableDate}
                                  max={maxSelectableDate}
                                  value={rangeEndValue}
                                  aria-describedby={dateRangeHintId}
                                  aria-errormessage={rangeError ? rangeErrorId : undefined}
                                  onChange={(event) => {
                                    setRangeEndValue(event.target.value);
                                    setRangeError(undefined);
                                  }}
                                />
                              </div>
                            </div>
                            <p id={dateRangeHintId} className="coach-booking__filter-hint">
                              {selection.range && selectedRangeMeta
                                ? `Showing availability from ${selectedRangeMeta.start.monthDayLong} to ${selectedRangeMeta.end.monthDayLong}.`
                                : selectedDateSummary
                                ? `Showing availability for ${selectedDateSummary}.`
                                : "Select any future dates to check availability."}
                            </p>
                            {rangeError ? (
                              <p id={rangeErrorId} className="coach-booking__filter-error" role="alert">
                                {rangeError}
                              </p>
                            ) : null}
                            <div className="coach-booking__filter-actions">
                              <button type="button" className="coach-booking__filter-clear" onClick={handleClearRange}>
                                Clear
                              </button>
                              <button type="button" className="coach-booking__filter-apply" onClick={handleApplyRange}>
                                Apply range
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
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

      </div>
      <button type="button" className="book-lesson-modal-overlay__backdrop" aria-hidden="true" onClick={onClose} />
    </div>
  );
};

export default BookLessonModal;
