import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Package,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import JoinMyRosterBanner from "../components/coaches/JoinMyRosterBanner";
import { useAuth } from "../context/AuthContext";
import { useCoachRoster } from "../hooks/useCoachRoster";
import { findCoachProfile, type CoachProfile } from "../data/mockCoachProfiles";
import { getStoredAuthToken } from "../services/authToken";

import "./CoachProfilePage.css";
import "../components/coaches/coaches.css";

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

type BookingDate = CoachProfile["booking"]["availableDates"][number];
type BookingSlot = BookingDate["slots"][number];
type DateEntry = {
  date: BookingDate;
  slots: BookingSlot[];
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

const MINUTES_PER_DAY = 24 * 60;
const ALL_DATES_ID = "all-dates";

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
  const navigate = useNavigate();
  const { loading, profile } = useCoachProfile(id);
  const { user } = useAuth();
  const authToken = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );
  const {
    rosterStatus,
    rosterLoading: rosterStatusLoading,
    rosterError: rosterStatusError,
    requestJoin,
    requestingJoin,
    requestJoinError,
    requestJoinSuccess,
  } = useCoachRoster(profile?.id, authToken);
  const canRequestCoach = Boolean(authToken);
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

    if (selection.dateId === ALL_DATES_ID) {
      if (!selection.timeId) {
        return;
      }

      const timeExists = profile.booking.availableDates.some((date) =>
        (selection.lessonType === "all"
          ? date.slots
          : date.slots.filter((slot) => slot.lessonType === selection.lessonType)
        ).some((slot) => slot.id === selection.timeId),
      );

      if (!timeExists) {
        setSelection((prev) => ({
          ...prev,
          timeId: undefined,
        }));
      }

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

  const handleOpenPurchaseModal = () => {
    if (!profile) {
      return;
    }

    navigate(`/coaches/${profile.id}/purchase`);
  };

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
      timeId: id === ALL_DATES_ID ? undefined : prev.timeId,
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

  const playerLessonCredits = profile?.playerLessonCredits ?? [];
  const hasLessonCredits = playerLessonCredits.length > 0;
  const creditsRemaining = playerLessonCredits.reduce(
    (sum, credit) => sum + Math.max(credit.remaining, 0),
    0,
  );
  const hasCreditsRemaining = playerLessonCredits.some((credit) => credit.remaining > 0);
  const coachFirstName = profile?.name?.split(" ")[0] ?? profile?.name ?? "the coach";
  const lessonCreditSummary = playerLessonCredits
    .map((credit) => `${credit.lessonTypeLabel}: ${Math.max(credit.remaining, 0)} left`)
    .join(" • ");
  const bestValueLessonPackage = useMemo(() => {
    if (!profile || profile.lessonPackages.length === 0) {
      return undefined;
    }

    return profile.lessonPackages.reduce((best, current) => {
      if (!best) {
        return current;
      }

      return current.lessons > best.lessons ? current : best;
    }, profile.lessonPackages[0]);
  }, [profile]);

  const isAllDatesSelected = selection.dateId === ALL_DATES_ID;

  const dateEntries = useMemo(() => {
    if (!profile) {
      return [] as DateEntry[];
    }

    return profile.booking.availableDates.map((date) => {
      const slots =
        selection.lessonType === "all"
          ? date.slots
          : date.slots.filter((slot) => slot.lessonType === selection.lessonType);

      return {
        date,
        slots,
      } satisfies DateEntry;
    });
  }, [profile, selection.lessonType]);

  const selectedDateEntry = useMemo(() => {
    if (isAllDatesSelected) {
      return undefined;
    }

    return dateEntries.find((entry) => entry.date.id === selection.dateId);
  }, [dateEntries, isAllDatesSelected, selection.dateId]);

  const selectedDate = selectedDateEntry?.date;

  const filteredSlots = selectedDateEntry?.slots ?? [];

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

  const highlightChips = useMemo(() => {
    if (!profile) {
      return [] as CoachProfile["highlightChips"];
    }

    return profile.highlightChips.filter((chip) => !/utr/i.test(chip.label));
  }, [profile]);

  const navigateToCheckout = (dateId: string, slotId: string) => {
    if (!profile) {
      return;
    }

    navigate(`/booking/confirm?coach=${profile.id}&date=${dateId}&slot=${slotId}`, {
      state: { coachId: profile.id, dateId, slotId },
    });
  };

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
              <JoinMyRosterBanner
                coachName={profile.name}
                rosterStatus={rosterStatus}
                canRequest={canRequestCoach}
                onRequestJoin={requestJoin}
                requestingJoin={requestingJoin}
                joinError={requestJoinError ?? undefined}
                joinSuccess={requestJoinSuccess}
                rosterError={rosterStatusError ?? undefined}
                rosterLoading={rosterStatusLoading}
              />
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
                        </div>
                        <div className="coach-profile-identity__meta">
                          <span className="coach-profile-identity__title">{profile.title}</span>
                          {profile.languages.length > 0 && (
                            <>
                              <span className="coach-profile-identity__separator" aria-hidden="true">
                                •
                              </span>
                              <span className="coach-profile-identity__meta-item">
                                Languages: {profile.languages.join(", ")}
                              </span>
                            </>
                          )}
                          {profile.levels.length > 0 && (
                            <>
                              <span className="coach-profile-identity__separator" aria-hidden="true">
                                •
                              </span>
                              <span className="coach-profile-identity__meta-item">
                                Levels: {profile.levels.join(", ")}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="coach-profile-identity__chips">
                          {highlightChips.map((chip) => {
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
                        {profile.lessonPackages.length > 0 && (
                          <div className="coach-profile-packages">
                            <div className="coach-profile-packages__header">
                              <div className="coach-profile-packages__intro">
                                <h3 className="coach-profile-packages__title">Package deals</h3>
                                <p className="coach-profile-packages__copy">
                                  Lock in savings when you reserve multiple lessons in advance.
                                </p>
                              </div>
                              <span className="coach-profile-packages__badge">Best value</span>
                            </div>
                            <div className="coach-profile-packages__status" role="status">
                              <div className="coach-profile-packages__status-icon" aria-hidden>
                                <Wallet />
                              </div>
                              <div className="coach-profile-packages__status-body">
                                <span className="coach-profile-packages__status-eyebrow">
                                  {hasLessonCredits ? "Your lesson credits" : "No credits yet"}
                                </span>
                                {hasLessonCredits ? (
                                  <ul className="coach-profile-packages__status-list">
                                    {playerLessonCredits.map((credit) => (
                                      <li
                                        key={credit.lessonTypeId}
                                        className={`coach-profile-packages__status-item${
                                          credit.remaining > 0
                                            ? " coach-profile-packages__status-item--active"
                                            : ""
                                        }`}
                                      >
                                        <div className="coach-profile-packages__status-item-main">
                                          <span className="coach-profile-packages__status-type">
                                            {credit.lessonTypeLabel}
                                          </span>
                                          <span className="coach-profile-packages__status-remaining">
                                            {credit.remaining} of {credit.totalPurchased ?? credit.remaining} left
                                          </span>
                                        </div>
                                        {credit.upcomingExpiryLabel ? (
                                          <span className="coach-profile-packages__status-meta">
                                            {credit.upcomingExpiryLabel}
                                          </span>
                                        ) : null}
                                        {credit.lastPurchasedLabel ? (
                                          <span className="coach-profile-packages__status-meta">
                                            {credit.lastPurchasedLabel}
                                          </span>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="coach-profile-packages__status-empty">
                                    Save up to {bestValueLessonPackage?.discount.toLowerCase() ?? "15%"} on lessons with {coachFirstName}
                                    when you buy credits in advance.
                                  </p>
                                )}
                              </div>
                            </div>
                            <ul className="coach-profile-packages__list">
                              {profile.lessonPackages.map((lessonPackage) => (
                                <li key={lessonPackage.id} className="coach-profile-package">
                                  <div className="coach-profile-package__top">
                                    <span className="coach-profile-package__discount">{lessonPackage.discount}</span>
                                  </div>
                                  <p className="coach-profile-package__title">
                                    {lessonPackage.lessons}-lesson package
                                  </p>
                                  <p className="coach-profile-package__description">{lessonPackage.description}</p>
                                  <div className="coach-profile-package__pricing">
                                    <span className="coach-profile-package__per">{lessonPackage.pricePerLesson}</span>
                                    <span className="coach-profile-package__total">{lessonPackage.totalPrice}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              className="coach-profile-packages__action"
                              onClick={handleOpenPurchaseModal}
                            >
                              <Package aria-hidden />
                              <span>Purchase credits</span>
                            </button>
                          </div>
                        )}
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

                    <div className="coach-booking__wallet">
                      <div
                        className={`coach-booking__wallet-card${
                          hasCreditsRemaining ? " coach-booking__wallet-card--active" : ""
                        }`}
                      >
                        <div className="coach-booking__wallet-icon" aria-hidden>
                          <Wallet />
                        </div>
                        <div className="coach-booking__wallet-body">
                          <span className="coach-booking__wallet-eyebrow">Lesson credits</span>
                          <p className="coach-booking__wallet-copy">
                            {hasLessonCredits
                              ? hasCreditsRemaining
                                ? `You have ${creditsRemaining} credit${creditsRemaining === 1 ? "" : "s"} ready to apply when you book.`
                                : "All saved lesson credits have been used."
                              : `Purchase credits to skip checkout and save on ${coachFirstName}'s lessons.`}
                          </p>
                          {lessonCreditSummary ? (
                            <span className="coach-booking__wallet-detail">{lessonCreditSummary}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="coach-booking__wallet-action"
                          onClick={handleOpenPurchaseModal}
                        >
                          {hasCreditsRemaining ? "Add credits" : "Purchase credits"}
                        </button>
                      </div>
                    </div>

                    <div className="coach-booking__controls">
                      <div className="coach-booking__section">
                        <span className="coach-booking__label">Select day</span>
                        <div className="coach-booking__day-grid">
                          <button
                            type="button"
                            aria-pressed={isAllDatesSelected}
                            onClick={() => handleDateChange(ALL_DATES_ID)}
                            className={`coach-booking__day${
                              isAllDatesSelected ? " coach-booking__day--active" : ""
                            }`}
                          >
                            <span className="coach-booking__day-name">All Dates</span>
                            <span className="coach-booking__day-date">View every option</span>
                          </button>
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
                        {isAllDatesSelected ? (
                          dateEntries.length > 0 ? (
                            dateEntries.map(({ date, slots }) => (
                              <section key={date.id} className="coach-booking-day">
                                <div className="coach-booking-day__header">
                                  <div className="coach-booking-day__titles">
                                    <h3>{dayNameMap[date.day] ?? date.day}</h3>
                                    <span>{date.label}</span>
                                  </div>
                                  <span className="coach-booking-day__count">
                                    {slots.length} {slots.length === 1 ? "option" : "options"}
                                  </span>
                                </div>
                                {slots.length > 0 ? (
                                  <div className="coach-booking-day__slots">
                                    {slots.map((slot) => {
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
                                            handleDateChange(date.id);
                                            handleTimeChange(slot.id);
                                            navigateToCheckout(date.id, slot.id);
                                          }}
                                          className={`coach-booking-slot coach-booking-slot--${slot.lessonType}${
                                            active ? " coach-booking-slot--active" : ""
                                          }`}
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
                                    {selection.lessonType === "all" && (
                                      <p>No lessons are available on this day.</p>
                                    )}
                                  </div>
                                )}
                              </section>
                            ))
                          ) : (
                            <div className="coach-booking-day__empty">
                              <p>No lessons are available at this time.</p>
                            </div>
                          )
                        ) : selectedDate ? (
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
                                        navigateToCheckout(selectedDate.id, slot.id);
                                      }}
                                      className={`coach-booking-slot coach-booking-slot--${slot.lessonType}${
                                        active ? " coach-booking-slot--active" : ""
                                      }`}
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
