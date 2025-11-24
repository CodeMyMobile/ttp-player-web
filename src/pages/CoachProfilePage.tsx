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
import { fetchCoachProfile, type CoachProfileRecord } from "../api/coachProfile";
import { getPlayerStripePaymentMethods, type PlayerStripePaymentMethod } from "../api/playerStripe";
import { requestPrivateLesson } from "../api/playerLessons";
import { useAuth } from "../context/AuthContext";
import { useCoachRoster } from "../hooks/useCoachRoster";
import type { CoachProfile } from "../data/mockCoachProfiles";
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
  const [profile, setProfile] = useState<CoachProfileRecord | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    if (!id) {
      setProfile(undefined);
      setError(undefined);
      setLoading(false);
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    const coachId = Number.parseInt(id, 10);
    if (Number.isNaN(coachId)) {
      setProfile(undefined);
      setError("Invalid coach identifier.");
      setLoading(false);
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    setLoading(true);
    setError(undefined);
    setProfile(undefined);

    const loadProfile = async () => {
      try {
        const data = await fetchCoachProfile(coachId, { signal: controller.signal });
        if (!isActive) {
          return;
        }
        setProfile(data);
      } catch (err) {
        if (!isActive || controller.signal.aborted) {
          return;
        }

        const status = (err as Error & { status?: number }).status;
        if (status === 404) {
          setProfile(undefined);
          setError(undefined);
        } else {
          console.error("Failed to fetch coach profile", err);
          setProfile(undefined);
          setError(err instanceof Error ? err.message : "Unable to load coach profile.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [id]);

  return { loading, profile, error };
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
  const { loading, profile, error: profileError } = useCoachProfile(id);
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
  const [bookingInFlight, setBookingInFlight] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PlayerStripePaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<{
    date: BookingDate;
    slot: BookingSlot;
    schedule: {
      startDateTime: string;
      endDateTime: string;
      startDateTimeTz: string;
      endDateTimeTz: string;
    };
    locationId: number;
    court: number | string | null;
  } | null>(null);
  const languages = profile?.languages ?? [];
  const levels = profile?.levels ?? [];
  const certifications = profile?.certifications ?? [];
  const specialties = profile?.specialties ?? [];
  const coachingLocations = profile?.coachingLocations ?? [];
  const lessonDetails = profile?.lessonDetails ?? [];
  const lessonPackages = profile?.lessonPackages ?? [];
  const booking = profile?.booking;
  const availableDates = booking?.availableDates ?? [];
  const bookingLessonTypes = booking?.lessonTypes ?? [];
  const coachDisplayName = (profile?.name ?? profile?.fullName ?? "").trim() || "Coach";
  const bookingHeadline = booking?.headline ?? `Book a lesson with ${coachDisplayName}`;
  const bookingNote = booking?.note ?? "Need a different time? Message your coach.";
  const coachFirstName = coachDisplayName.split(" ")[0] ?? coachDisplayName;
  const coachTitle = profile?.title ?? profile?.headlineBadge ?? "Tennis Coach";
  const coachAvatar = profile?.imageUrl ?? profile?.profilePicture ?? "https://placehold.co/120x120?text=Coach";

  useEffect(() => {
    if (!loading && profile?.booking) {
      const defaultLessonType = profile.booking.defaultLessonType ?? "all";
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
    if (!profile?.booking || !selection.lessonType) {
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
  const lessonCreditSummary = playerLessonCredits
    .map((credit) => `${credit.lessonTypeLabel}: ${Math.max(credit.remaining, 0)} left`)
    .join(" • ");
  const bestValueLessonPackage = useMemo(() => {
    if (!profile || !profile.lessonPackages || profile.lessonPackages.length === 0) {
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

    return availableDates.map((date) => {
      const slots =
        selection.lessonType === "all"
          ? date.slots
          : date.slots.filter((slot) => slot.lessonType === selection.lessonType);

      return {
        date,
        slots,
      } satisfies DateEntry;
    });
  }, [availableDates, profile, selection.lessonType]);

  const selectedDateEntry = useMemo(() => {
    if (isAllDatesSelected) {
      return undefined;
    }

    return dateEntries.find((entry) => entry.date.id === selection.dateId);
  }, [dateEntries, isAllDatesSelected, selection.dateId]);

  const selectedDate = selectedDateEntry?.date;

  const filteredSlots = selectedDateEntry?.slots ?? [];

  const lessonTypeDetailMap = useMemo(() => {
    return bookingLessonTypes.reduce(
      (acc, lesson) => {
        acc[lesson.id] = lesson;
        return acc;
      },
      {} as Record<string, CoachProfile["booking"]["lessonTypes"][number]>,
    );
  }, [bookingLessonTypes]);

  const lessonLocationLabel = useMemo(() => {
    if (!profile) {
      return undefined;
    }

    return profile.location ?? coachingLocations[0];
  }, [coachingLocations, profile]);

  const highlightChips = useMemo(() => {
    if (!profile?.highlightChips?.length) {
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

  const resolveIsoDate = (date?: BookingDate) => {
    if (!date) return undefined;
    const candidates = [date.id, date.date];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && /^\d{4}-\d{2}-\d{2}/.test(candidate)) {
        return candidate.slice(0, 10);
      }
    }
    return undefined;
  };

  const computeSlotDateTimes = (date?: BookingDate, slot?: BookingSlot) => {
    if (!date || !slot) return null;
    const slotRecord = slot as Record<string, unknown>;
    const lessonDetails = lessonTypeDetailMap[slot.lessonType];
    const durationMinutes =
      parseDurationToMinutes(lessonDetails?.duration ?? slot.duration) ?? parseDurationToMinutes(slot.duration) ?? 60;

    const startIso =
      (slotRecord.startDateTime as string | undefined) ??
      (slotRecord.start_date_time as string | undefined) ??
      (slotRecord.start as string | undefined) ??
      (slotRecord.start_time as string | undefined);
    const endIso =
      (slotRecord.endDateTime as string | undefined) ??
      (slotRecord.end_date_time as string | undefined) ??
      (slotRecord.end as string | undefined) ??
      (slotRecord.end_time as string | undefined);

    if (startIso && endIso) {
      return {
        startDateTime: startIso,
        endDateTime: endIso,
        startDateTimeTz: startIso,
        endDateTimeTz: endIso,
      };
    }

    const baseDate = resolveIsoDate(date);
    const startMinutes = parseTimeToMinutes(slot.time ?? "");

    if (!baseDate || startMinutes == null) {
      return null;
    }

    const [year, month, day] = baseDate.split("-").map((value) => Number.parseInt(value, 10));
    if ([year, month, day].some((value) => Number.isNaN(value))) {
      return null;
    }

    const hours = Math.floor(startMinutes / 60);
    const minutes = startMinutes % 60;

    const startUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    const startLocal = new Date(year, month - 1, day, hours, minutes, 0);
    const endUtc = new Date(startUtc.getTime() + durationMinutes * 60_000);
    const endLocal = new Date(startLocal.getTime() + durationMinutes * 60_000);

    return {
      startDateTime: startUtc.toISOString(),
      endDateTime: endUtc.toISOString(),
      startDateTimeTz: startLocal.toISOString(),
      endDateTimeTz: endLocal.toISOString(),
    };
  };

  const extractLocationId = (slot?: BookingSlot) => {
    if (!slot) return null;
    const record = slot as Record<string, unknown>;
    const candidates = [
      record.location_id,
      record.locationId,
      (record.location as Record<string, unknown> | undefined)?.id,
      (record.location as Record<string, unknown> | undefined)?.location_id,
    ];

    for (const candidate of candidates) {
      const numeric = typeof candidate === "number" ? candidate : Number(candidate);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    return null;
  };

  const extractCourt = (slot?: BookingSlot) => {
    if (!slot) return 0;
    const record = slot as Record<string, unknown>;
    const value = record.court ?? record.court_id ?? record.courtId;
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    return 0;
  };

  const loadPaymentMethods = async () => {
    if (!authToken) {
      setPaymentMethodsError("Sign in to choose a payment method.");
      setPaymentMethods([]);
      return;
    }
    setPaymentMethodsLoading(true);
    setPaymentMethodsError(null);
    try {
      const payload = await getPlayerStripePaymentMethods(authToken);
      const methods =
        Array.isArray(payload) || !payload
          ? (payload ?? [])
          : (payload.payment_methods ??
            payload.data ??
            payload.results ??
            (payload as { paymentMethods?: PlayerStripePaymentMethod[] }).paymentMethods ??
            []);
      setPaymentMethods(methods);
      const defaultId =
        (!Array.isArray(payload) && payload
          ? payload.default_payment_method_id ??
            (payload as Record<string, unknown>)["default_payment_method"] ??
            (payload as Record<string, unknown>)["defaultPaymentMethodId"]
          : undefined) ??
        methods.find((method) => method.is_default || method.default || method.default_for_currency)?.id ??
        methods[0]?.id;
      setSelectedPaymentMethodId(defaultId ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load payment methods.";
      setPaymentMethods([]);
      setPaymentMethodsError(message);
    } finally {
      setPaymentMethodsLoading(false);
    }
  };

  const handleBookLesson = async (date?: BookingDate, slot?: BookingSlot) => {
    if (!profile || !slot || !date) return;
    if (!authToken) {
      setBookingError("Please sign in again to book this lesson.");
      return;
    }

    const schedule = computeSlotDateTimes(date, slot);
    const locationId = extractLocationId(slot);
    const court = extractCourt(slot);

    if (!schedule || !locationId) {
      setBookingError("We couldn’t prepare this lesson request. Missing schedule or location details.");
      return;
    }

    const coachId = Number(profile.id);
    if (!Number.isFinite(coachId)) {
      setBookingError("Invalid coach information. Please refresh and try again.");
      return;
    }

    setPendingBooking({ date, slot, schedule, locationId, court });
    setBookingError(null);
    setBookingSuccess(null);
    setPaymentSheetOpen(true);
    await loadPaymentMethods();
  };

  const closePaymentSheet = () => {
    setPaymentSheetOpen(false);
    setPendingBooking(null);
    setPaymentMethodsError(null);
  };

  const confirmBookLesson = async () => {
    if (!pendingBooking || !profile || !authToken) {
      setBookingError("Please select a lesson and sign in to continue.");
      return;
    }
    if (!selectedPaymentMethodId) {
      setPaymentMethodsError("Choose a payment method to book this lesson.");
      return;
    }

    const coachId = Number(profile.id);
    if (!Number.isFinite(coachId)) {
      setBookingError("Invalid coach information. Please refresh and try again.");
      return;
    }

    const { schedule, locationId, court, slot } = pendingBooking;
    setBookingError(null);
    setBookingSuccess(null);
    setBookingInFlight(slot.id);

    try {
      await requestPrivateLesson({
        token: authToken,
        coachId,
        startDateTime: schedule.startDateTime,
        endDateTime: schedule.endDateTime,
        startDateTimeTz: schedule.startDateTimeTz,
        endDateTimeTz: schedule.endDateTimeTz,
        locationId,
        court,
        status: "PENDING",
        paymentMethodId: selectedPaymentMethodId,
      });
      setBookingSuccess("Lesson request sent to your coach.");
      closePaymentSheet();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not book this lesson.";
      setBookingError(message);
    } finally {
      setBookingInFlight(null);
    }
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

          {!loading && profileError && (
            <div className="coach-profile-empty">
              <div className="coach-profile-empty__icon">
                <MessageCircle strokeWidth={2.4} />
              </div>
              <h2 className="coach-profile-empty__title">We couldn’t load this coach</h2>
              <p className="coach-profile-empty__copy">
                {profileError || "There was a problem loading this profile. Please try again later."}
              </p>
              <Link to="/find-coaches" className="coach-profile-empty__action">
                <ArrowLeft className="coach-profile-back__icon" strokeWidth={2.5} /> Back to Find Coaches
              </Link>
            </div>
          )}

          {!loading && !profileError && !profile && (
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
                coachName={coachDisplayName}
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
                        src={coachAvatar}
                        alt={`Portrait of ${coachDisplayName}`}
                        className="coach-profile-identity__avatar"
                      />
                      <div className="coach-profile-identity__details">
                        <div className="coach-profile-identity__name-row">
                          <h1 className="coach-profile-identity__name">{coachDisplayName}</h1>
                        </div>
                        <div className="coach-profile-identity__meta">
                          <span className="coach-profile-identity__title">{coachTitle}</span>
                          {languages.length > 0 && (
                            <>
                              <span className="coach-profile-identity__separator" aria-hidden="true">
                                •
                              </span>
                              <span className="coach-profile-identity__meta-item">
                                Languages: {languages.join(", ")}
                              </span>
                            </>
                          )}
                          {levels.length > 0 && (
                            <>
                              <span className="coach-profile-identity__separator" aria-hidden="true">
                                •
                              </span>
                              <span className="coach-profile-identity__meta-item">
                                Levels: {levels.join(", ")}
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
                            <h2 className="coach-profile-panel__title">About {coachFirstName}</h2>
                            <MessageCircle className="coach-profile-panel__icon" strokeWidth={2.4} />
                          </div>
                          <p className="coach-profile-about__copy">{profile.about}</p>
                          {certifications.length > 0 && (
                            <div className="coach-profile-certifications">
                              {certifications.map((certification) => (
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
                          {specialties.length > 0 && (
                            <div className="coach-profile-panel__chips">
                              {specialties.map((specialty) => (
                                <Chip key={specialty} label={specialty} />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="coach-profile-panel">
                          <div className="coach-profile-panel__header">
                            <h2 className="coach-profile-panel__title">Coaching Locations</h2>
                            <MapPin className="coach-profile-panel__icon" strokeWidth={2.4} />
                          </div>
                          <p className="coach-profile-panel__copy">Certified to coach at these nearby courts and clubs.</p>
                          {coachingLocations.length > 0 && (
                            <ul className="coach-profile-locations">
                              {coachingLocations.map((location) => (
                                <li key={location} className="coach-profile-location">
                                  <span className="coach-profile-location__bullet" />
                                  <span>{location}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="coach-profile-panel">
                        <div className="coach-profile-panel__header">
                          <h2 className="coach-profile-panel__title">Lesson Types</h2>
                          <Users className="coach-profile-panel__icon" strokeWidth={2.4} />
                        </div>
                        <p className="coach-profile-panel__copy">Clear pricing for the most popular training formats.</p>
                        {lessonDetails.length > 0 && (
                          <ul className="coach-profile-lessons">
                            {lessonDetails.map((lesson) => (
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
                        )}
                        {lessonPackages.length > 0 && (
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
                              {lessonPackages.map((lessonPackage) => (
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
                        <h2 className="coach-booking__title">{bookingHeadline}</h2>
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
                          {availableDates.map((date) => {
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
                      {(bookingError || bookingSuccess) && (
                        <div
                          className={`coach-booking__alert${
                            bookingError ? " coach-booking__alert--error" : " coach-booking__alert--success"
                          }`}
                        >
                          {bookingError ?? bookingSuccess}
                        </div>
                      )}
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
                                      const isBooking = bookingInFlight === slot.id;

                                      return (
                                        <div
                                          key={slot.id}
                                          role="group"
                                          tabIndex={0}
                                          aria-pressed={active}
                                          onClick={() => {
                                            handleDateChange(date.id);
                                            handleTimeChange(slot.id);
                                            navigateToCheckout(date.id, slot.id);
                                          }}
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                              event.preventDefault();
                                              handleDateChange(date.id);
                                              handleTimeChange(slot.id);
                                              navigateToCheckout(date.id, slot.id);
                                            }
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
                                          <div className="coach-booking-slot__actions">
                                            <button
                                              type="button"
                                              className="coach-booking-slot__book"
                                              disabled={isBooking}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                void handleBookLesson(date, slot);
                                              }}
                                            >
                                              {isBooking ? "Booking…" : "Book lesson"}
                                            </button>
                                          </div>
                                        </div>
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
                                  const isBooking = bookingInFlight === slot.id;

                                  return (
                                    <div
                                      key={slot.id}
                                      role="group"
                                      tabIndex={0}
                                      aria-pressed={active}
                                      onClick={() => {
                                        handleDateChange(selectedDate.id);
                                        handleTimeChange(slot.id);
                                        navigateToCheckout(selectedDate.id, slot.id);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          handleDateChange(selectedDate.id);
                                          handleTimeChange(slot.id);
                                          navigateToCheckout(selectedDate.id, slot.id);
                                        }
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
                                      <div className="coach-booking-slot__actions">
                                        <button
                                          type="button"
                                          className="coach-booking-slot__book"
                                          disabled={isBooking}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleBookLesson(selectedDate, slot);
                                          }}
                                        >
                                          {isBooking ? "Booking…" : "Book lesson"}
                                        </button>
                                      </div>
                                    </div>
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
                      <p className="coach-booking__note">{bookingNote}</p>
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
      {paymentSheetOpen && (
        <div className="coach-payment-modal" role="dialog" aria-modal="true">
          <div className="coach-payment-modal__backdrop" onClick={closePaymentSheet} />
          <div className="coach-payment-modal__panel">
            <div className="coach-payment-modal__header">
              <div>
                <p className="coach-payment-modal__eyebrow">Pay for lesson</p>
                <h3 className="coach-payment-modal__title">Choose a payment method</h3>
              </div>
              <button
                type="button"
                className="coach-payment-modal__close"
                onClick={closePaymentSheet}
                aria-label="Close payment selection"
              >
                ×
              </button>
            </div>

            {paymentMethodsLoading && <p className="coach-payment-modal__hint">Loading your cards…</p>}
            {paymentMethodsError && <p className="coach-payment-modal__error">{paymentMethodsError}</p>}

            {!paymentMethodsLoading && !paymentMethodsError && paymentMethods.length === 0 && (
              <div className="coach-payment-modal__empty">
                <p>No saved cards yet.</p>
                <Link to="/settings/payment-methods" className="coach-payment-modal__link">
                  Add a payment method
                </Link>
              </div>
            )}

            {paymentMethods.length > 0 && (
              <div className="coach-payment-modal__list" role="radiogroup" aria-label="Payment methods">
                {paymentMethods.map((method) => {
                  const brand = (method.card?.brand ?? "Card").toString();
                  const last4 = method.card?.last4 ?? "••••";
                  const expMonth = method.card?.exp_month;
                  const expYear = method.card?.exp_year;
                  const isActive = selectedPaymentMethodId === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`coach-payment-card${isActive ? " coach-payment-card--active" : ""}`}
                      onClick={() => setSelectedPaymentMethodId(method.id)}
                    >
                      <div className="coach-payment-card__brand">{brand}</div>
                      <div className="coach-payment-card__meta">
                        <span className="coach-payment-card__last4">•••• {last4}</span>
                        {expMonth && expYear ? (
                          <span className="coach-payment-card__expiry">
                            {expMonth.toString().padStart(2, "0")}/{`${expYear}`.slice(-2)}
                          </span>
                        ) : null}
                      </div>
                      {method.is_default && <span className="coach-payment-card__pill">Default</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="coach-payment-modal__actions">
              <Link to="/settings/payment-methods" className="coach-payment-modal__link">
                Manage payment methods
              </Link>
              <button
                type="button"
                className="coach-payment-modal__confirm"
                disabled={bookingInFlight !== null || !selectedPaymentMethodId || paymentMethodsLoading}
                onClick={() => void confirmBookLesson()}
              >
                {bookingInFlight ? "Booking…" : "Confirm & pay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default CoachProfilePage;
