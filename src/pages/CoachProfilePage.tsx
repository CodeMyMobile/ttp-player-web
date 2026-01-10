import moment from "moment";
import { useEffect, useMemo, useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
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
import {
  createPlayerStripePaymentIntent,
  getPlayerStripePaymentMethods,
  type PlayerStripePaymentMethod,
} from "../api/playerStripe";
import {
  fetchCoachPackages,
  fetchPackageCreditsBalance,
  fetchPackageCredits,
  consumePackageCredits,
  type CoachPackage,
  type PackageCreditsBalanceResponse,
  type PackagePurchase,
} from "../api/playerPackages";
import {
  type Lesson as ApiLesson,
  type CoachScheduleEntry,
  fetchCoachLessonsByDate,
  fetchCoachSchedule,
  joinLesson,
  requestPrivateLesson,
  type NewLessonResponse,
} from "../api/playerLessons";
import { useAuth } from "../context/AuthContext";
import { useCoachRoster } from "../hooks/useCoachRoster";
import type { CoachProfile } from "../data/mockCoachProfiles";
import { getStoredAuthToken } from "../services/authToken";
import LessonDetailCard from "../components/LessonDetailCard";

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

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_STRIPE_PUBLISHABLEKEY ??
  "";

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const extractNumericLessonId = (payload?: NewLessonResponse | null) => {
  const candidates = [payload?.lesson?.id, payload?.id, payload?.lesson_id];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
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
const SCHEDULE_WINDOW_DAYS = 7;

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

const buildScheduleMoment = (isoDate: string, time?: string) => {
  if (!isoDate || !time) {
    return null;
  }
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  // Treat schedule times as UTC so they align with the mobile app’s handling
  const combined = moment.utc(`${isoDate}T${normalizedTime}`, ["YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DDTHH:mm"], true);
  return combined.isValid() ? combined : null;
};

const formatCurrency = (value?: number | string | null) => {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  try {
    return numeric.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  } catch {
    return `$${numeric}`;
  }
};

const normalizeLessonTypeLabel = (lessonTypes?: string[]) => {
  const label = lessonTypes?.[0];
  if (!label) return "package";
  const normalized = label.replace(/[_-]+/g, " ").trim();
  return normalized || "package";
};

const formatLessonTypeList = (lessonTypes?: string[]) => {
  if (!lessonTypes || lessonTypes.length === 0) return "All lesson types";
  if (lessonTypes.length === 1) return normalizeLessonTypeLabel(lessonTypes);
  return lessonTypes
    .map((type) => normalizeLessonTypeLabel([type]))
    .map((type) => type.charAt(0).toUpperCase() + type.slice(1))
    .join(" · ");
};

const buildPerLessonLabel = (total: number | string, count?: number | null) => {
  if (!count || count <= 0) return undefined;
  const formattedTotal = formatCurrency(total);
  const numericTotal = typeof total === "string" ? Number.parseFloat(total) : total;
  if (!Number.isFinite(numericTotal)) {
    return formattedTotal ? `${formattedTotal} total` : undefined;
  }
  const per = numericTotal / count;
  const perLabel = formatCurrency(per) ?? per.toFixed(2);
  return `${perLabel} per lesson`;
};

const buildExpiryLabel = (value?: string | null) => {
  if (!value) return undefined;
  const date = moment(value);
  if (!date.isValid()) {
    return undefined;
  }
  return date.format("MMM D, YYYY");
};

const buildSlotsFromScheduleEntry = (
  entry: CoachScheduleEntry,
  isoDate: string,
  defaultLessonType: BookingSlot["lessonType"],
  defaultDuration: string,
  defaultPrice: string,
  fallbackIndex = 0,
): BookingSlot[] => {
  const startMoment = buildScheduleMoment(isoDate, entry.from);
  if (!startMoment) {
    return [];
  }

  const endMoment = buildScheduleMoment(isoDate, entry.to);
  const slotIdBase =
    entry.id !== undefined && entry.id !== null ? String(entry.id) : `${fallbackIndex}`;

  const locationId =
    typeof entry.location_id === "number"
      ? entry.location_id
      : entry.location_id
        ? Number(entry.location_id)
        : undefined;
  const locationLabel = entry.location_name ?? entry.location ?? "";
  const baseSlot = {
    lessonType: defaultLessonType,
    duration: defaultDuration,
    price: defaultPrice,
    location: locationLabel,
    location_id: locationId,
    locationId,
    date: isoDate,
    court: entry.court ?? null,
    title: entry.court ? `Court ${entry.court}` : undefined,
  };

  const slots: BookingSlot[] = [];

  if (endMoment && endMoment.isAfter(startMoment)) {
    let cursor = startMoment.clone();
    let segmentIndex = 0;

    while (cursor.isBefore(endMoment)) {
      const segmentEnd = cursor.clone().add(1, "hour");
      if (segmentEnd.isAfter(endMoment)) {
        break;
      }
      slots.push({
        ...baseSlot,
        id: `${isoDate}-${slotIdBase}-seg-${segmentIndex}`,
        time: cursor.format("h:mm A"),
        duration: `${segmentEnd.diff(cursor, "minutes")} min`,
        spotsRemaining: 4,
        startDateTime: cursor.clone().utc().toISOString(),
        endDateTime: segmentEnd.clone().utc().toISOString(),
        startDateTimeTz: cursor.toISOString(),
        endDateTimeTz: segmentEnd.toISOString(),
        [SEGMENTED_FLAG]: true,
      });
      cursor = segmentEnd;
      segmentIndex += 1;
    }
  }

  if (slots.length) {
    return slots;
  }

  const durationMinutes =
    endMoment && endMoment.isAfter(startMoment) ? endMoment.diff(startMoment, "minutes") : null;
  const computedDuration =
    durationMinutes && Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : parseDurationToMinutes(defaultDuration) ?? 60;
  const derivedEnd = endMoment ?? startMoment.clone().add(computedDuration, "minutes");

  return [
    {
      ...baseSlot,
      id: `${isoDate}-${slotIdBase}`,
      time: startMoment.format("h:mm A"),
      duration: `${computedDuration} min`,
      spotsRemaining: 4,
      startDateTime: startMoment.clone().utc().toISOString(),
      endDateTime: derivedEnd.clone().utc().toISOString(),
      startDateTimeTz: startMoment.toISOString(),
      endDateTimeTz: derivedEnd.toISOString(),
      [SEGMENTED_FLAG]: true,
    },
  ];
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

const shouldDedupeLesson = (lesson: ApiLesson) => {
  const record = lesson as Record<string, unknown>;
  const typeId = Number(record.lessontype_id ?? record.lesson_type_id ?? record.lessonTypeId);
  if (typeId === 2 || typeId === 3) return true;
  const typeLabel = String(record.lesson_type_name ?? record.lessonTypeName ?? "").toLowerCase();
  return typeLabel.includes("group") || typeLabel.includes("semi");
};

const buildLessonDedupeKey = (lesson: ApiLesson) => {
  const record = lesson as Record<string, unknown>;
  const typeId = Number(record.lessontype_id ?? record.lesson_type_id ?? record.lessonTypeId) || 0;
  const coachId = record.coach_id ?? record.coachId ?? "";
  const locationId = record.location_id ?? record.locationId ?? "";
  const court = record.court ?? "";
  return [
    lesson.start_date_time ?? "",
    lesson.end_date_time ?? "",
    typeId,
    coachId,
    locationId,
    court,
  ]
    .map((value) => String(value))
    .join("|");
};

const lessonBelongsToUser = (lesson: ApiLesson, userId?: string) => {
  if (!userId) return false;
  const record = lesson as Record<string, unknown>;
  const playerId = record.player_id ?? record.playerId ?? record.playerID;
  if (playerId != null && String(playerId) === userId) return true;
  const groupPlayers = Array.isArray(record.group_players) ? record.group_players : [];
  return groupPlayers.some((player) => {
    const playerData = player as Record<string, unknown>;
    const groupPlayerId = playerData.player_id ?? playerData.id ?? playerData.user_id;
    return groupPlayerId != null && String(groupPlayerId) === userId;
  });
};

const mergeLessonRecords = (primary: ApiLesson, secondary: ApiLesson) => {
  const primaryRecord = primary as Record<string, unknown>;
  const secondaryRecord = secondary as Record<string, unknown>;
  const primaryPlayers = Array.isArray(primaryRecord.group_players) ? primaryRecord.group_players : [];
  const secondaryPlayers = Array.isArray(secondaryRecord.group_players) ? secondaryRecord.group_players : [];
  if (primaryPlayers.length || !secondaryPlayers.length) {
    return primary;
  }
  return { ...primary, group_players: secondaryPlayers };
};

const dedupeLessonsForDate = (lessons: ApiLesson[], userId?: string) => {
  const map = new Map<string, ApiLesson>();
  lessons.forEach((lesson) => {
    if (!shouldDedupeLesson(lesson)) {
      map.set(`lesson-${lesson.id}`, lesson);
      return;
    }
    const key = buildLessonDedupeKey(lesson);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, lesson);
      return;
    }
    const existingOwned = lessonBelongsToUser(existing, userId);
    const incomingOwned = lessonBelongsToUser(lesson, userId);
    if (!existingOwned && incomingOwned) {
      map.set(key, mergeLessonRecords(lesson, existing));
      return;
    }
    map.set(key, mergeLessonRecords(existing, lesson));
  });
  return Array.from(map.values());
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

// Breaks a wide availability window into hourly slots for booking display.
const SEGMENTED_FLAG = "__ttpSegmented";

const splitIntoSlots = (slot: BookingSlot) => {
  const record = slot as Record<string, unknown> & { [SEGMENTED_FLAG]?: boolean };

  if (record[SEGMENTED_FLAG]) {
    return [slot];
  }

  const from =
    (typeof record.from === "string" && record.from) ||
    (typeof record.start_time === "string" && record.start_time) ||
    (typeof record.startTime === "string" && record.startTime) ||
    (typeof record.start_date_time === "string" && record.start_date_time) ||
    (typeof record.startDateTime === "string" && record.startDateTime);
  const to =
    (typeof record.to === "string" && record.to) ||
    (typeof record.end_time === "string" && record.end_time) ||
    (typeof record.endTime === "string" && record.endTime) ||
    (typeof record.end_date_time === "string" && record.end_date_time) ||
    (typeof record.endDateTime === "string" && record.endDateTime);

  if (!from || !to) return [slot];

  const date = (typeof record.date === "string" && record.date) || moment().format("YYYY-MM-DD");

  const fromDate = moment(`${date} ${from}`, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"], true);
  const toDate = moment(`${date} ${to}`, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"], true);

  if (!fromDate.isValid() || !toDate.isValid() || !fromDate.isBefore(toDate)) {
    return [{ ...slot, [SEGMENTED_FLAG]: true }];
  }

  const segments: BookingSlot[] = [];
  let cursor = fromDate.clone();
  let index = 0;

  while (cursor.isBefore(toDate)) {
    const end = cursor.clone().add(1, "hour");
    if (end.isAfter(toDate)) break;

    segments.push({
      ...slot,
      id: `${slot.id ?? record.id ?? "slot"}-seg-${index}`,
      time: cursor.format("h:mm A"),
      duration: `${end.diff(cursor, "minutes")} min`,
      startDateTime: cursor.toISOString(),
      endDateTime: end.toISOString(),
      start_date_time: cursor.utc().toISOString(),
      end_date_time: end.utc().toISOString(),
      startDateTimeTz: cursor.toISOString(),
      endDateTimeTz: end.toISOString(),
      [SEGMENTED_FLAG]: true,
    });

    cursor = end;
    index += 1;
  }

  return segments.length ? segments : [{ ...slot, [SEGMENTED_FLAG]: true }];
};

const getScopedSlots = (slots: BookingSlot[], lessonType: string) => {
  const scoped = lessonType === "all" ? slots : slots.filter((slot) => slot.lessonType === lessonType);
  return scoped.flatMap(splitIntoSlots);
};

const CoachProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, profile, error: profileError } = useCoachProfile(id);
  const { user } = useAuth();
  const currentUserId = useMemo(() => {
    const record = user as Record<string, unknown> | null;
    const candidate =
      record?.id ??
      record?.user_id ??
      record?.player_id ??
      (record?.session as Record<string, unknown> | undefined)?.user_id;
    return candidate != null ? String(candidate) : undefined;
  }, [user]);
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
  const [paymentChoice, setPaymentChoice] = useState<"credits" | "card">("card");
  const [consumingCredits, setConsumingCredits] = useState(false);
  const [consumeError, setConsumeError] = useState<string | null>(null);
  const [pendingLessonPayment, setPendingLessonPayment] = useState<ApiLesson | null>(null);
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
  const [coachPackages, setCoachPackages] = useState<CoachPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [packageCredits, setPackageCredits] = useState<PackagePurchase[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<PackageCreditsBalanceResponse | null>(null);
  const languages = profile?.languages ?? [];
  const levels = profile?.levels ?? [];
  const certifications = profile?.certifications ?? [];
  const specialties = profile?.specialties ?? [];
  const coachingLocations = profile?.coachingLocations ?? [];
  const lessonDetails = profile?.lessonDetails ?? [];
  const lessonPackages = coachPackages;
  const booking = profile?.booking;
  const bookingLessonTypes = booking?.lessonTypes ?? [];
  const coachDisplayName = (profile?.name ?? profile?.fullName ?? "").trim() || "Coach";
  const bookingHeadline = booking?.headline ?? `Book a lesson with ${coachDisplayName}`;
  const bookingNote = booking?.note ?? "Need a different time? Message your coach.";
  const coachFirstName = coachDisplayName.split(" ")[0] ?? coachDisplayName;
  const coachTitle = profile?.title ?? profile?.headlineBadge ?? "Tennis Coach";
  const coachAvatar = profile?.imageUrl ?? profile?.profilePicture ?? "https://placehold.co/120x120?text=Coach";
  const [apiAvailableDates, setApiAvailableDates] = useState<BookingDate[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [lessonsByDate, setLessonsByDate] = useState<Record<string, ApiLesson[]>>({});
  const availableDates = useMemo(
    () => (apiAvailableDates.length ? apiAvailableDates : booking?.availableDates ?? []),
    [apiAvailableDates, booking?.availableDates],
  );

  useEffect(() => {
    if (!profile?.id) {
      setApiAvailableDates([]);
      return;
    }

    let cancelled = false;
    const coachId = Number(profile.id);
    const defaultLesson =
      bookingLessonTypes.find((lesson) => lesson.id === "private") ?? bookingLessonTypes[0];
    const defaultLessonType = (defaultLesson?.id ?? "private") as BookingSlot["lessonType"];
    const defaultDuration = defaultLesson?.duration ?? "60 min";
    const defaultPrice = defaultLesson?.price ?? "";
    const lessonsMap: Record<string, ApiLesson[]> = {};

    const loadSchedule = async () => {
      setScheduleLoading(true);
      const days: BookingDate[] = [];

      try {
        for (let offset = 0; offset < SCHEDULE_WINDOW_DAYS; offset += 1) {
          const dateMoment = moment().add(offset, "days");
          const dayName = dateMoment.format("dddd").toUpperCase();
          const isoDate = dateMoment.format("YYYY-MM-DD");

          let scheduleEntries = [];
          try {
            scheduleEntries = await fetchCoachSchedule({
              token: authToken ?? "",
              coachId,
              day: dayName,
            });
          } catch (err) {
            // ignore schedule errors for this day
            console.error("Failed to fetch coach schedule", err);
            continue;
          }

          if (!scheduleEntries.length) {
            continue;
          }

          let lessonsForDate = [];
          try {
            lessonsForDate = await fetchCoachLessonsByDate({
              token: authToken ?? undefined,
              coachId,
              date: isoDate,
            });
          } catch (err) {
            lessonsForDate = [];
          }

          lessonsForDate = dedupeLessonsForDate(lessonsForDate, currentUserId);
          lessonsMap[isoDate] = lessonsForDate;

          const lessonTimes = new Set(
            (() => {
              const grouped = new Map<string, ApiLesson[]>();
              lessonsForDate.forEach((lesson) => {
                const timeKey = moment.utc(lesson.start_date_time).format("HH:mm");
                if (!timeKey) return;
                const existing = grouped.get(timeKey) ?? [];
                existing.push(lesson);
                grouped.set(timeKey, existing);
              });
              const blocked = new Set<string>();
              grouped.forEach((groupLessons, timeKey) => {
                const isBlocked = groupLessons.length > 0 && groupLessons.every((lesson) => shouldBlockSlot(lesson));
                if (isBlocked) {
                  blocked.add(timeKey);
                }
              });
              return blocked;
            })(),
          );

          const slots = scheduleEntries
            .flatMap((entry, entryIndex) =>
              buildSlotsFromScheduleEntry(entry, isoDate, defaultLessonType, defaultDuration, defaultPrice, entryIndex),
            )
            .filter((slot) => {
              const slotStart = slot.startDateTime
                ? moment(slot.startDateTime).format("HH:mm")
                : moment(slot.time, ["h:mm A", "HH:mm"]).format("HH:mm");
              return slotStart ? !lessonTimes.has(slotStart) : true;
            });

          if (slots.length) {
            days.push({
              id: isoDate,
              day: dateMoment.format("ddd"),
              date: dateMoment.format("DD"),
              label: dateMoment.format("MMM D"),
              totalSlots: slots.length,
              slots,
            });
          }
        }

        if (!cancelled) {
          setApiAvailableDates(days);
          setLessonsByDate(lessonsMap);
        }
      } finally {
        if (!cancelled) {
          setScheduleLoading(false);
        }
      }
    };

    void loadSchedule();

    return () => {
      cancelled = true;
    };
  }, [authToken, bookingLessonTypes, currentUserId, profile?.id]);

  useEffect(() => {
    const controller = new AbortController();

    if (!profile?.id) {
      setCoachPackages([]);
      setPackagesError(null);
      setPackagesLoading(false);
      return () => controller.abort();
    }

    if (!authToken) {
      setCoachPackages([]);
      setPackagesError("Sign in to view lesson packages.");
      setPackagesLoading(false);
      return () => controller.abort();
    }

    setPackagesLoading(true);
    setPackagesError(null);

    fetchCoachPackages({
      token: authToken,
      coachId: profile.id,
      signal: controller.signal,
    })
      .then((data) => {
        const packages = (data?.packages ?? []).filter((pkg) => pkg.is_active !== false);
        setCoachPackages(packages);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unable to load lesson packages.";
        setPackagesError(message);
        setCoachPackages([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPackagesLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, profile?.id]);

  useEffect(() => {
    const controller = new AbortController();

    if (!profile?.id) {
      setPackageCredits([]);
      setCreditsError(null);
      setCreditsLoading(false);
      setCreditsBalance(null);
      return () => controller.abort();
    }

    if (!authToken) {
      setPackageCredits([]);
      setCreditsError("Sign in to view credits.");
      setCreditsLoading(false);
      setCreditsBalance(null);
      return () => controller.abort();
    }

    setCreditsLoading(true);
    setCreditsError(null);

    fetchPackageCredits({
      token: authToken,
      coachId: profile.id,
      includeExpired: false,
      signal: controller.signal,
    })
      .then((data) => {
        setPackageCredits(data?.purchases ?? []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unable to load credits.";
        setCreditsError(message);
        setPackageCredits([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCreditsLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, profile?.id]);

  useEffect(() => {
    const controller = new AbortController();

    if (!profile?.id || !authToken) {
      setCreditsBalance(null);
      return () => controller.abort();
    }

    setCreditsBalance(null);

    fetchPackageCreditsBalance({
      token: authToken,
      coachId: profile.id,
      signal: controller.signal,
    })
      .then((data) => {
        setCreditsBalance(data ?? null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCreditsBalance(null);
      });

    return () => controller.abort();
  }, [authToken, profile?.id]);

  useEffect(() => {
    if (loading || !availableDates.length) {
      return;
    }

    if (selection.dateId && selection.timeId) {
      return;
    }

    const defaultLessonType = booking?.defaultLessonType ?? "all";
    const initialDate = availableDates[0];
    const initialSlot =
      getScopedSlots(initialDate?.slots ?? [], defaultLessonType)[0] ??
      getScopedSlots(initialDate?.slots ?? [], "all")[0];
    setSelection({
      lessonType: defaultLessonType,
      dateId: initialDate?.id,
      timeId: initialSlot?.id,
    });
  }, [availableDates, booking?.defaultLessonType, loading, selection.dateId, selection.timeId]);

  useEffect(() => {
    if (!availableDates.length || !selection.lessonType) {
      return;
    }

    if (selection.dateId === ALL_DATES_ID) {
      if (!selection.timeId) {
        return;
      }

      const timeExists = availableDates.some((date) =>
        getScopedSlots(date.slots, selection.lessonType).some((slot) => slot.id === selection.timeId),
      );

      if (!timeExists) {
        setSelection((prev) => ({
          ...prev,
          timeId: undefined,
        }));
      }

      return;
    }

    const dates = availableDates;
    if (!dates.length) {
      return;
    }

    const activeDate =
      dates.find((item) => item.id === selection.dateId) ?? dates[0];
    const slotsForLesson = getScopedSlots(activeDate.slots, selection.lessonType);

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
  }, [availableDates, selection.dateId, selection.lessonType, selection.timeId]);

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

  const resolveLessonParticipantStatus = (lesson?: ApiLesson) => {
    if (!lesson) return undefined;
    const record = lesson as Record<string, unknown>;
    const rawStatus = record.status;
    let status = typeof rawStatus === "number" ? rawStatus : Number(rawStatus);
    if (!Number.isFinite(status)) {
      status = undefined;
    }

    const groupPlayers = Array.isArray(record.group_players) ? record.group_players : [];
    if (groupPlayers.length && currentUserId) {
      const playerRecord = groupPlayers.find((player) => {
        const playerData = player as Record<string, unknown>;
        const playerId = playerData.player_id ?? playerData.id ?? playerData.user_id;
        return playerId != null && String(playerId) === currentUserId;
      }) as Record<string, unknown> | undefined;

      if (playerRecord) {
        const resolved = playerRecord.payment_status ?? playerRecord.status;
        const parsed = typeof resolved === "number" ? resolved : Number(resolved);
        if (Number.isFinite(parsed)) {
          status = parsed;
        }
      }
    }

    return status;
  };

  const isOpenGroupLesson = (lesson?: ApiLesson) => {
    if (!lesson) return false;
    const record = lesson as Record<string, unknown>;
    const typeId = Number(record.lessontype_id ?? record.lesson_type_id ?? record.lessonTypeId);
    if (typeId === 3) return true;
    const typeLabel = String(record.lesson_type_name ?? record.lessonTypeName ?? "").toLowerCase();
    return typeLabel.includes("open group");
  };

  const isOpenGroupAvailable = (lesson?: ApiLesson) => {
    if (!lesson || !isOpenGroupLesson(lesson)) return false;
    const record = lesson as Record<string, unknown>;
    const playerId = record.player_id ?? record.playerId ?? record.playerID;
    return playerId == null;
  };

  const isLessonOwnedByUser = (lesson?: ApiLesson) => {
    if (!lesson || !currentUserId) return false;
    const record = lesson as Record<string, unknown>;
    const playerId = record.player_id ?? record.playerId ?? record.playerID;
    if (playerId != null && String(playerId) === currentUserId) return true;
    const groupPlayers = Array.isArray(record.group_players) ? record.group_players : [];
    return groupPlayers.some((player) => {
      const playerData = player as Record<string, unknown>;
      const groupPlayerId = playerData.player_id ?? playerData.id ?? playerData.user_id;
      return groupPlayerId != null && String(groupPlayerId) === currentUserId;
    });
  };

  const resolveLessonTypeId = (lesson?: ApiLesson) => {
    if (!lesson) return "private";
    const record = lesson as Record<string, unknown>;
    const typeId = Number(record.lessontype_id ?? record.lesson_type_id ?? record.lessonTypeId);
    const typeLabel = String(record.lesson_type_name ?? record.lessonTypeName ?? "").toLowerCase();
    if (typeId === 3 || typeLabel.includes("group")) return "group";
    if (typeId === 2 || typeLabel.includes("semi")) return "group";
    return "private";
  };

  const shouldBlockSlot = (lesson?: ApiLesson) => {
    if (!lesson) return false;
    if (isLessonOwnedByUser(lesson)) return false;
    if (isOpenGroupAvailable(lesson)) return false;
    return true;
  };

  const lessonStatusLabel = (lesson?: ApiLesson) => {
    if (!lesson) return undefined;
    if (isOpenGroupAvailable(lesson) && !isLessonOwnedByUser(lesson)) {
      return undefined;
    }
    const status = resolveLessonParticipantStatus(lesson);
    if (status === 2) return "Cancelled";
    if (!isLessonOwnedByUser(lesson)) {
      return "Reserved";
    }
    if (status === 0) return "Pending";
    if (status === 1) return "Confirmed";
    return undefined;
  };

  const findLessonForSlot = (dateKey: string, slot: BookingSlot) => {
    const lessons = lessonsByDate[dateKey] ?? [];
    const slotStart = (() => {
      if (slot.start_date_time) return moment.utc(slot.start_date_time);
      if (slot.startDateTime) return moment.utc(slot.startDateTime);
      if ((slot as Record<string, unknown>).from) {
        const from = (slot as Record<string, string>).from;
        return moment(`${dateKey} ${from}`, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"]);
      }
      return moment(`${dateKey} ${slot.time}`, ["YYYY-MM-DD h:mm A", "YYYY-MM-DD HH:mm"]);
    })();
    if (!slotStart.isValid()) return null;
    const slotEnd = (() => {
      if (slot.end_date_time) return moment.utc(slot.end_date_time);
      if (slot.endDateTime) return moment.utc(slot.endDateTime);
      if ((slot as Record<string, unknown>).to) {
        const to = (slot as Record<string, string>).to;
        return moment(`${dateKey} ${to}`, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"]);
      }
      return slotStart.clone().add(parseDurationToMinutes(slot.duration ?? "60 min") ?? 60, "minutes");
    })();

    const matchingLessons = lessons.filter((lesson) => {
      const lessonStart = moment.utc(lesson.start_date_time);
      const lessonEnd = moment.utc(lesson.end_date_time);
      if (!lessonStart.isValid() || !lessonEnd.isValid()) return false;
      return (
        lessonStart.isSame(slotStart, "minute") ||
        lessonStart.isBetween(slotStart, slotEnd, undefined, "[)") ||
        slotStart.isBetween(lessonStart, lessonEnd, undefined, "[)")
      );
    });

    if (!matchingLessons.length) {
      return null;
    }

    const ownedLesson = matchingLessons.find((lesson) => isLessonOwnedByUser(lesson));
    return ownedLesson ?? matchingLessons[0] ?? null;
  };

  const lessonFilters = [
    { id: "all", label: "All", ariaLabel: "All lesson formats" },
    { id: "private", label: "Privates", ariaLabel: "Private lessons" },
    { id: "group", label: "Groups", ariaLabel: "Group sessions" },
  ];

  const playerLessonCredits = useMemo(() => {
    const now = moment();
    return packageCredits
      .filter((purchase) => {
        const remaining = purchase.credits_remaining ?? 0;
        const expired = purchase.expires_at ? moment(purchase.expires_at).isBefore(now, "day") : false;
        return remaining > 0 && !expired;
      })
      .map((purchase) => {
        const remaining = purchase.credits_remaining ?? 0;
        const total = purchase.credits_total ?? remaining + (purchase.credits_used ?? 0);
        const lessonTypeLabel = normalizeLessonTypeLabel(purchase.lesson_types_allowed);
        const formattedLessonType =
          lessonTypeLabel.charAt(0).toUpperCase() + lessonTypeLabel.slice(1);
        const expiryLabel = buildExpiryLabel(purchase.expires_at);
        const purchasedLabel = buildExpiryLabel(purchase.purchased_at);

        return {
          id: String(purchase.id ?? `${formattedLessonType}-${purchase.coach_package_id ?? "package"}`),
          lessonTypeId: lessonTypeLabel,
          lessonTypeLabel: formattedLessonType,
          remaining,
          totalPurchased: total,
          upcomingExpiryLabel: expiryLabel ? `${remaining} expire ${expiryLabel}` : undefined,
          lastPurchasedLabel: purchasedLabel ? `Purchased ${purchasedLabel}` : undefined,
        };
      });
  }, [packageCredits]);
  const creditsRemaining = playerLessonCredits.reduce(
    (sum, credit) => sum + Math.max(credit.remaining, 0),
    0,
  );
  const balanceAvailable = isFiniteNumber(creditsBalance?.available) ? creditsBalance.available : undefined;
  const balanceHeld = isFiniteNumber(creditsBalance?.held) ? creditsBalance.held : undefined;
  const balanceTotal = isFiniteNumber(creditsBalance?.total) ? creditsBalance.total : undefined;
  const availableCredits = balanceAvailable ?? creditsRemaining;
  const hasCreditsRemaining = availableCredits > 0;
  const hasLessonCredits =
    playerLessonCredits.length > 0 || (isFiniteNumber(balanceTotal) ? balanceTotal > 0 : false);
  const lessonCreditSummary = playerLessonCredits
    .map((credit) => `${credit.lessonTypeLabel}: ${Math.max(credit.remaining, 0)} left`)
    .join(" • ");
  const balanceDetailParts: string[] = [];
  if (isFiniteNumber(balanceHeld)) {
    balanceDetailParts.push(`${balanceHeld} held`);
  }
  if (isFiniteNumber(balanceTotal)) {
    balanceDetailParts.push(`${balanceTotal} total`);
  }
  const balanceDetail = balanceDetailParts.join(" · ");
  const exhaustedCreditsMessage =
    isFiniteNumber(balanceHeld) && balanceHeld > 0
      ? "Your credits are currently held for pending bookings."
      : "All saved lesson credits have been used.";

  const eligibleCreditsForLessonType = useCallback(
    (lessonType: string | undefined) => {
      const normalizedType = (lessonType ?? "").toLowerCase();
      const isAllowed = (purchase: PackagePurchase) => {
        const allowed = purchase.lesson_types_allowed;
        if (Array.isArray(allowed) && allowed.length > 0) {
          return allowed.some((type) => type?.toLowerCase() === normalizedType);
        }
        return true;
      };
      return packageCredits.filter(
        (purchase) => (purchase.credits_remaining ?? 0) > 0 && isAllowed(purchase),
      );
    },
    [packageCredits],
  );

  const pendingLessonType = pendingBooking?.slot.lessonType ?? selection.lessonType ?? "private";
  const resolvedPendingLessonType = (() => {
    if (pendingLessonPayment) {
      return resolveLessonTypeId(pendingLessonPayment);
    }
    if (pendingBooking?.slot?.lessonType && pendingBooking.slot.lessonType !== "all") {
      return pendingBooking.slot.lessonType;
    }
    if (selection.lessonType === "all") {
      return "private";
    }
    return pendingLessonType;
  })();
  const pendingEligibleCredits = useMemo(
    () => (pendingLessonPayment ? [] : eligibleCreditsForLessonType(resolvedPendingLessonType)),
    [eligibleCreditsForLessonType, pendingLessonPayment, resolvedPendingLessonType],
  );

  const pendingCreditSummary = useMemo(() => {
    const remaining = pendingEligibleCredits.reduce(
      (sum, purchase) => sum + Math.max(Number(purchase.credits_remaining ?? 0), 0),
      0,
    );

    const nextExpiry = pendingEligibleCredits
      .map((purchase) => purchase.expires_at)
      .filter(Boolean)
      .map((value) => moment(value as string))
      .filter((value) => value.isValid())
      .sort((a, b) => a.valueOf() - b.valueOf())[0];

    return {
      remaining,
      nextExpiryLabel: nextExpiry ? `Next expiry ${nextExpiry.format("MMM D, YYYY")}` : undefined,
    };
  }, [pendingEligibleCredits]);

  const isAllDatesSelected = selection.dateId === ALL_DATES_ID;

  const dateEntries = useMemo(() => {
    if (!profile) {
      return [] as DateEntry[];
    }

    return availableDates.map((date) => {
      const slots = getScopedSlots(date.slots, selection.lessonType);

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
    (record.location as Record<string, unknown> | undefined)?.locationId,
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
    setPendingLessonPayment(null);
    setBookingError(null);
    setBookingSuccess(null);
    setConsumeError(null);
    setPaymentChoice(eligibleCreditsForLessonType(slot.lessonType).length > 0 ? "credits" : "card");
    setPaymentSheetOpen(true);
    await loadPaymentMethods();
  };

  const handleConfirmPendingLesson = async (lesson: ApiLesson) => {
    if (!authToken) {
      setBookingError("Please sign in again to confirm this lesson.");
      return;
    }
    setPendingLessonPayment(lesson);
    setPendingBooking(null);
    setBookingError(null);
    setBookingSuccess(null);
    setConsumeError(null);
    setPaymentChoice("card");
    setPaymentSheetOpen(true);
    await loadPaymentMethods();
  };

  const closePaymentSheet = () => {
    setPaymentSheetOpen(false);
    setPendingBooking(null);
    setPendingLessonPayment(null);
    setPaymentMethodsError(null);
    setPaymentChoice("card");
    setConsumeError(null);
    setConsumingCredits(false);
  };

  const applyLessonConfirmedStatus = (lesson: ApiLesson) => {
    const lessonDateKey = moment.utc(lesson.start_date_time).format("YYYY-MM-DD");
    setLessonsByDate((prev) => {
      const list = prev[lessonDateKey] ?? [];
      const updated = list.map((entry) => {
        if (entry.id !== lesson.id) return entry;
        const record = entry as Record<string, unknown>;
        const groupPlayers = Array.isArray(record.group_players) ? record.group_players : [];
        if (!groupPlayers.length || !currentUserId) {
          return { ...entry, status: 1 };
        }
        const updatedPlayers = groupPlayers.map((player) => {
          const playerData = player as Record<string, unknown>;
          const playerId = playerData.player_id ?? playerData.id ?? playerData.user_id;
          if (playerId == null || String(playerId) !== currentUserId) {
            return player;
          }
          if (playerData.payment_status != null) {
            return { ...playerData, payment_status: 1 };
          }
          return { ...playerData, status: 1 };
        });
        return { ...entry, status: 1, group_players: updatedPlayers };
      });
      return {
        ...prev,
        [lessonDateKey]: updated,
      };
    });
  };

  const confirmBookLesson = async () => {
    if (!pendingBooking && !pendingLessonPayment) {
      setBookingError("Please select a lesson to continue.");
      return;
    }
    if (!authToken) {
      setBookingError("Please select a lesson and sign in to continue.");
      return;
    }

    if (pendingLessonPayment) {
      if (!selectedPaymentMethodId) {
        setPaymentMethodsError("Choose a payment method to confirm this lesson.");
        return;
      }
      setBookingError(null);
      setBookingSuccess(null);
      setBookingInFlight(`lesson-${pendingLessonPayment.id}`);

      try {
        if (isOpenGroupLesson(pendingLessonPayment)) {
          const record = pendingLessonPayment as Record<string, unknown>;
          const coachId = Number(record.coach_id ?? profile?.id);
          const locationId = Number(record.location_id ?? record.locationId);
          if (!Number.isFinite(coachId) || !Number.isFinite(locationId)) {
            throw new Error("Missing coach or location details for this lesson.");
          }
          await joinLesson({
            token: authToken,
            lessonId: pendingLessonPayment.id,
            coachId,
            startDateTime: pendingLessonPayment.start_date_time,
            endDateTime: pendingLessonPayment.end_date_time,
            startDateTimeTz: pendingLessonPayment.start_date_time,
            endDateTimeTz: pendingLessonPayment.end_date_time,
            locationId,
            court: record.court ?? 0,
            status: "CONFIRMED",
            paymentMethodId: selectedPaymentMethodId,
          });
        } else {
          if (!stripePromise) {
            throw new Error("Stripe is not configured for this environment.");
          }
          const intentResponse = await createPlayerStripePaymentIntent({
            token: authToken,
            lessonId: pendingLessonPayment.id,
          });
          const intentRecord = intentResponse as Record<string, unknown>;
          const nestedIntent = intentRecord?.payment_intent as Record<string, unknown> | undefined;
          const clientSecret =
            (intentRecord?.client_secret as string | undefined) ??
            (nestedIntent?.client_secret as string | undefined);
          if (!clientSecret) {
            throw new Error("Unable to start payment. Please try again.");
          }
          const stripe = await stripePromise;
          if (!stripe) {
            throw new Error("Stripe is not available to confirm this payment.");
          }
          const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: selectedPaymentMethodId,
          });
          if (error) {
            throw new Error(error.message || "Card payment failed.");
          }
          const status = paymentIntent?.status?.toLowerCase();
          if (status && status !== "succeeded") {
            throw new Error("Payment was not successful.");
          }
        }

        setBookingSuccess("Payment confirmed. See you on court!");
        applyLessonConfirmedStatus(pendingLessonPayment);
        closePaymentSheet();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to confirm payment for this lesson.";
        setBookingError(message);
      } finally {
        setBookingInFlight(null);
      }
      return;
    }

    if (!pendingBooking || !profile) {
      setBookingError("Please select a lesson and sign in to continue.");
      return;
    }
    if (paymentChoice === "card" && !selectedPaymentMethodId) {
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
    setConsumeError(null);

    try {
      if (paymentChoice === "credits") {
        setConsumingCredits(true);
        try {
          const bestPurchase = pendingEligibleCredits[0];
          try {
            const lessonResponse = await requestPrivateLesson({
              token: authToken,
              coachId,
              startDateTime: schedule.startDateTime,
              endDateTime: schedule.endDateTime,
              startDateTimeTz: schedule.startDateTimeTz,
              endDateTimeTz: schedule.endDateTimeTz,
              locationId,
              court,
              status: "PENDING",
            });
            const lessonId = extractNumericLessonId(lessonResponse);
            if (!lessonId) {
              throw new Error("Unable to reserve credits without a numeric lesson ID.");
            }
            await consumePackageCredits({
              token: authToken,
              coachId,
              lessonType: slot.lessonType ?? "private",
              lessonId,
              purchaseId: bestPurchase?.id,
            });
            setBookingSuccess("Lesson request sent. We’re holding your credit until the coach confirms.");
            closePaymentSheet();
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : "We created the lesson but could not reserve your credit.";
            setBookingError(message);
          }
          try {
            const refreshed = await fetchPackageCredits({
              token: authToken,
              coachId,
              includeExpired: false,
            });
            setPackageCredits(refreshed?.purchases ?? []);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unable to refresh credits.";
            setCreditsError(message);
          }
          try {
            const refreshedBalance = await fetchPackageCreditsBalance({
              token: authToken,
              coachId,
            });
            setCreditsBalance(refreshedBalance ?? null);
          } catch {
            setCreditsBalance(null);
          }
        } catch (err) {
          const code = (err as Error & { data?: { code?: string } })?.data?.code;
          const fallbackMessage =
            code === "no_eligible_package" ||
            code === "no_credits_remaining" ||
            code === "package_expired" ||
            code === "lesson_type_not_allowed"
              ? "No eligible credits left for this lesson. Please pay by card."
              : "Couldn't use credits, please try a card.";
          setConsumeError(fallbackMessage);
          setPaymentChoice("card");
          setPaymentSheetOpen(true);
        } finally {
          setConsumingCredits(false);
          setBookingInFlight(null);
        }
        return;
      }

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
                          <p className="coach-profile-panel__copy">
                            Serve technique, match strategy, and tournament prep dialed for your game.
                          </p>
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
                                  {creditsLoading
                                    ? "Checking credits…"
                                    : hasLessonCredits
                                      ? "Your lesson credits"
                                      : "No credits yet"}
                                </span>
                                {creditsLoading ? (
                                  <p className="coach-profile-packages__status-empty">Loading your credits…</p>
                                ) : creditsError ? (
                                  <p className="coach-profile-packages__status-empty">{creditsError}</p>
                                ) : hasLessonCredits ? (
                                  <ul className="coach-profile-packages__status-list">
                                    {playerLessonCredits.map((credit) => (
                                      <li
                                        key={credit.id}
                                        className={`coach-profile-packages__status-item${
                                          credit.remaining > 0 ? " coach-profile-packages__status-item--active" : ""
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
                                    Buy credits in advance to skip checkout and save on lessons with {coachFirstName}.
                                  </p>
                                )}
                              </div>
                            </div>
                            {packagesError ? (
                              <p className="coach-profile-packages__status-empty">{packagesError}</p>
                            ) : null}
                            {packagesLoading ? (
                              <div className="coach-profile-packages__empty">Loading packages…</div>
                            ) : lessonPackages.length > 0 ? (
                              <ul className="coach-profile-packages__list">
                                {lessonPackages.map((lessonPackage) => {
                                  const perLessonLabel = buildPerLessonLabel(
                                    lessonPackage.total_price,
                                    lessonPackage.lesson_count,
                                  );
                                  const totalPriceLabel =
                                    formatCurrency(lessonPackage.total_price) ??
                                    (typeof lessonPackage.total_price === "string"
                                      ? lessonPackage.total_price
                                      : `${lessonPackage.total_price}`);
                                  const validityLabel = lessonPackage.validity_months
                                    ? `${lessonPackage.validity_months} month${lessonPackage.validity_months === 1 ? "" : "s"} validity`
                                    : "Flexible expiry";
                                  const lessonTypeLabel = normalizeLessonTypeLabel(lessonPackage.lesson_types_allowed);
                                  const lessonTypesLabel = formatLessonTypeList(lessonPackage.lesson_types_allowed);
                                  const packageTitle =
                                    lessonPackage.name || `${lessonPackage.lesson_count} ${lessonTypeLabel} package`;

                                  return (
                                    <li key={lessonPackage.id} className="coach-profile-package">
                                      <div className="coach-profile-package__top">
                                        <span className="coach-profile-package__discount">{lessonTypesLabel}</span>
                                        {validityLabel ? (
                                          <span className="coach-profile-package__per">{validityLabel}</span>
                                        ) : null}
                                      </div>
                                      <p className="coach-profile-package__title">{packageTitle}</p>
                                      <p className="coach-profile-package__description">{lessonPackage.description}</p>
                                      <div className="coach-profile-package__pricing">
                                        <span className="coach-profile-package__per">
                                          {perLessonLabel ?? `${lessonPackage.lesson_count} credits`}
                                        </span>
                                        <span className="coach-profile-package__total">{totalPriceLabel}</span>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <div className="coach-profile-packages__empty">No packages are available yet for this coach.</div>
                            )}
                            <button
                              type="button"
                              className="coach-profile-packages__action"
                              onClick={handleOpenPurchaseModal}
                              disabled={!lessonPackages.length || Boolean(packagesError) || packagesLoading}
                            >
                              <Package aria-hidden />
                              <span>Purchase credits</span>
                            </button>
                          </div>
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
                                ? `You have ${availableCredits} credit${availableCredits === 1 ? "" : "s"} ready to apply when you book.`
                                : exhaustedCreditsMessage
                              : `Purchase credits to skip checkout and save on ${coachFirstName}'s lessons.`}
                          </p>
                          {balanceDetail ? (
                            <span className="coach-booking__wallet-detail">{balanceDetail}</span>
                          ) : null}
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
                          const dateKey = resolveIsoDate(date) ?? String(date.id);
                          const bookedLessons = lessonsByDate[dateKey] ?? [];
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
                          dateEntries.map(({ date, slots }) => {
                            const dateKey = resolveIsoDate(date) ?? String(date.id);
                            const bookedLessons = lessonsByDate[dateKey] ?? [];
                            return (
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
                                      const slotLesson = findLessonForSlot(dateKey, slot);
                                      const slotLessonStatus = lessonStatusLabel(slotLesson || undefined);
                                      const slotLessonPending =
                                        slotLesson && resolveLessonParticipantStatus(slotLesson) === 0;
                                      const canConfirmPending =
                                        Boolean(slotLessonPending && isLessonOwnedByUser(slotLesson));
                                      const canJoinOpenGroup = Boolean(slotLesson && isOpenGroupAvailable(slotLesson));
                                      const isReserved = slotLessonStatus === "Reserved";
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
                                        (slotLesson?.lesson_type_name ??
                                          lessonDetails?.label ??
                                          (slot.lessonType === "private" ? "Private lesson" : "Group lesson"));
                                      const groupTitle = isGroupLesson ? slot.title : undefined;
                                      const isBooking =
                                        bookingInFlight === slot.id ||
                                        (slotLesson ? bookingInFlight === `lesson-${slotLesson.id}` : false);
                                      const canTakeAction = canConfirmPending || canJoinOpenGroup;
                                      const isDisabled = Boolean(slotLesson) && !canTakeAction;
                                      const buttonLabel = canConfirmPending
                                        ? isBooking
                                          ? "Confirming…"
                                          : "Confirm & pay"
                                        : canJoinOpenGroup
                                          ? isBooking
                                            ? "Joining…"
                                            : "Join & pay"
                                          : slotLessonStatus ?? (isBooking ? "Booking…" : "Book lesson");

                                      return (
                                        <div
                                          key={slot.id}
                                          role="group"
                                          tabIndex={0}
                                          aria-pressed={active}
                                          onClick={() => {
                                            if (slotLesson) {
                                              if (canConfirmPending || canJoinOpenGroup) {
                                                void handleConfirmPendingLesson(slotLesson);
                                              }
                                              return;
                                            }
                                            handleDateChange(date.id);
                                            handleTimeChange(slot.id);
                                            void handleBookLesson(date, slot);
                                          }}
                                          onKeyDown={(event) => {
                                            if (isDisabled && !canTakeAction) return;
                                            if (event.key === "Enter" || event.key === " ") {
                                              event.preventDefault();
                                              if (slotLesson) {
                                                if (canConfirmPending || canJoinOpenGroup) {
                                                  void handleConfirmPendingLesson(slotLesson);
                                                  return;
                                                }
                                                return;
                                              }
                                              handleDateChange(date.id);
                                              handleTimeChange(slot.id);
                                              void handleBookLesson(date, slot);
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
                                            {isReserved ? (
                                              <span className="coach-booking-slot__badge coach-booking-slot__badge--reserved">
                                                Reserved
                                              </span>
                                            ) : null}
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
                                            {isReserved ? (
                                              <span className="coach-booking-slot__status">Reserved</span>
                                            ) : null}
                                            {!isReserved ? (
                                              <button
                                                type="button"
                                                className="coach-booking-slot__book"
                                                disabled={isBooking || isDisabled}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  if (slotLesson) {
                                                    if (canConfirmPending || canJoinOpenGroup) {
                                                      void handleConfirmPendingLesson(slotLesson);
                                                    }
                                                    return;
                                                  }
                                                  void handleBookLesson(date, slot);
                                                }}
                                              >
                                                {buttonLabel}
                                              </button>
                                            ) : null}
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
                                {bookedLessons.length > 0 && (
                                  <div className="coach-booking-day__lessons">
                                    <h4 className="coach-booking-day__lessons-title">Booked lessons</h4>
                                    <div className="coach-booking-day__lessons-list">
                                      {bookedLessons.map((lesson) => {
                                        const isPending = resolveLessonParticipantStatus(lesson) === 0;
                                        const canConfirm = isPending && isLessonOwnedByUser(lesson);
                                        return (
                                          <div key={lesson.id}>
                                            <LessonDetailCard
                                              lesson={lesson}
                                              statusLabel={lessonStatusLabel(lesson)}
                                            />
                                            {canConfirm && (
                                              <div className="coach-booking-slot__actions">
                                                <button
                                                  type="button"
                                                  className="coach-booking-slot__book"
                                                  disabled={bookingInFlight === `lesson-${lesson.id}`}
                                                  onClick={() => void handleConfirmPendingLesson(lesson)}
                                                >
                                                  {bookingInFlight === `lesson-${lesson.id}`
                                                    ? "Confirming…"
                                                    : "Confirm & pay"}
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </section>
                            );
                          })
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
                                const dateKey = resolveIsoDate(selectedDate) ?? String(selectedDate.id);
                                const slotLesson = findLessonForSlot(dateKey, slot);
                                const slotLessonStatus = lessonStatusLabel(slotLesson || undefined);
                                const slotLessonPending =
                                  slotLesson && resolveLessonParticipantStatus(slotLesson) === 0;
                                const canConfirmPending =
                                  Boolean(slotLessonPending && isLessonOwnedByUser(slotLesson));
                                const canJoinOpenGroup = Boolean(slotLesson && isOpenGroupAvailable(slotLesson));
                                const isReserved = slotLessonStatus === "Reserved";
                                const timeRange = buildTimeRangeLabel(
                                  slot.time,
                                  lessonDetails?.duration ?? slot.duration,
                                );
                                const isGroupLesson = slot.lessonType === "group";
                                const capacity = isGroupLesson ? extractPlayerCapacity(lessonDetails?.duration) : undefined;
                                const availableSpots = Math.max(slot.spotsRemaining, 0);
                                const spotsLabel = isGroupLesson
                                  ? capacity
                                    ? `${Math.min(availableSpots, capacity)}/${capacity} spots available`
                                    : `${availableSpots} spot${availableSpots === 1 ? "" : "s"} available`
                                  : undefined;
                                const lessonLabel =
                                  (slotLesson?.lesson_type_name ??
                                    lessonDetails?.label ??
                                    (slot.lessonType === "private" ? "Private lesson" : "Group lesson"));
                                const groupTitle = isGroupLesson ? slot.title : undefined;
                                const isBooking =
                                  bookingInFlight === slot.id ||
                                  (slotLesson ? bookingInFlight === `lesson-${slotLesson.id}` : false);
                                const canTakeAction = canConfirmPending || canJoinOpenGroup;
                                const isDisabled = Boolean(slotLesson) && !canTakeAction;
                                const buttonLabel = canConfirmPending
                                  ? isBooking
                                    ? "Confirming…"
                                    : "Confirm & pay"
                                  : canJoinOpenGroup
                                    ? isBooking
                                      ? "Joining…"
                                      : "Join & pay"
                                    : slotLessonStatus ?? (isBooking ? "Booking…" : "Book lesson");

                                return (
                                  <div
                                    key={slot.id}
                                    role="group"
                                    tabIndex={0}
                                    aria-pressed={active}
                                    onClick={() => {
                                      if (slotLesson) {
                                        if (canConfirmPending || canJoinOpenGroup) {
                                          void handleConfirmPendingLesson(slotLesson);
                                        }
                                        return;
                                      }
                                      handleDateChange(selectedDate.id);
                                      handleTimeChange(slot.id);
                                      void handleBookLesson(selectedDate, slot);
                                    }}
                                    onKeyDown={(event) => {
                                      if (isDisabled && !canTakeAction) return;
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        if (slotLesson) {
                                          if (canConfirmPending || canJoinOpenGroup) {
                                            void handleConfirmPendingLesson(slotLesson);
                                            return;
                                          }
                                          return;
                                        }
                                        handleDateChange(selectedDate.id);
                                        handleTimeChange(slot.id);
                                        void handleBookLesson(selectedDate, slot);
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
                                      {isReserved ? (
                                        <span className="coach-booking-slot__badge coach-booking-slot__badge--reserved">
                                          Reserved
                                        </span>
                                      ) : null}
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
                                      {isReserved ? (
                                        <span className="coach-booking-slot__status">Reserved</span>
                                      ) : null}
                                      {!isReserved ? (
                                        <button
                                          type="button"
                                          className="coach-booking-slot__book"
                                          disabled={isBooking || isDisabled}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            if (slotLesson) {
                                              if (canConfirmPending || canJoinOpenGroup) {
                                                void handleConfirmPendingLesson(slotLesson);
                                              }
                                              return;
                                            }
                                            void handleBookLesson(selectedDate, slot);
                                          }}
                                        >
                                          {buttonLabel}
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="coach-booking-day__empty">
                              {selection.lessonType === "group" && <p>No group sessions are available on this day.</p>}
                              {selection.lessonType === "private" && <p>No private lessons are available on this day.</p>}
                              {selection.lessonType === "all" && <p>No lessons are available on this day.</p>}
                            </div>
                          )}
                          {(() => {
                            const dateKey = resolveIsoDate(selectedDate) ?? String(selectedDate.id);
                            const bookedLessons = lessonsByDate[dateKey] ?? [];
                            if (!bookedLessons.length) return null;
                            return (
                              <div className="coach-booking-day__lessons">
                                <h4 className="coach-booking-day__lessons-title">Booked lessons</h4>
                                <div className="coach-booking-day__lessons-list">
                              {bookedLessons.map((lesson) => (
                                    <div key={lesson.id}>
                                      <LessonDetailCard
                                        lesson={lesson}
                                        statusLabel={lessonStatusLabel(lesson)}
                                      />
                                      {resolveLessonParticipantStatus(lesson) === 0 &&
                                        isLessonOwnedByUser(lesson) && (
                                          <div className="coach-booking-slot__actions">
                                            <button
                                              type="button"
                                              className="coach-booking-slot__book"
                                              disabled={bookingInFlight === `lesson-${lesson.id}`}
                                              onClick={() => void handleConfirmPendingLesson(lesson)}
                                            >
                                              {bookingInFlight === `lesson-${lesson.id}`
                                                ? "Confirming…"
                                                : "Confirm & pay"}
                                            </button>
                                          </div>
                                        )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
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
                {consumeError ? <p className="coach-payment-modal__error">{consumeError}</p> : null}
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
            {creditsError && paymentChoice === "credits" && (
              <p className="coach-payment-modal__error">{creditsError}</p>
            )}

            {!paymentMethodsLoading && !paymentMethodsError && paymentMethods.length === 0 && (
              <div className="coach-payment-modal__empty">
                <p>No saved cards yet.</p>
                <Link to="/settings/payment-methods" className="coach-payment-modal__link">
                  Add a payment method
                </Link>
              </div>
            )}

            <div className="coach-payment-modal__choices">
              <label
                className={`coach-payment-choice${
                  paymentChoice === "credits" ? " coach-payment-choice--active" : ""
                }${creditsLoading || !pendingEligibleCredits.length || creditsError ? " coach-payment-choice--disabled" : ""}`}
              >
                <input
                  type="radio"
                  name="payment-choice"
                  value="credits"
                  checked={paymentChoice === "credits"}
                  onChange={() => setPaymentChoice("credits")}
                  disabled={creditsLoading || !pendingEligibleCredits.length || Boolean(creditsError)}
                />
                <div className="coach-payment-choice__body">
                  <div className="coach-payment-choice__title-row">
                    <span className="coach-payment-choice__title">Use credits</span>
                    {pendingCreditSummary.nextExpiryLabel && (
                      <span className="coach-payment-choice__pill">{pendingCreditSummary.nextExpiryLabel}</span>
                    )}
                  </div>
                  <p className="coach-payment-choice__subtitle">
                    {creditsLoading
                      ? "Checking credits…"
                      : !pendingEligibleCredits.length
                        ? "No eligible credits for this lesson type."
                        : `You have ${pendingCreditSummary.remaining} credit${pendingCreditSummary.remaining === 1 ? "" : "s"} available.`}
                  </p>
                </div>
              </label>

              <label
                className={`coach-payment-choice${
                  paymentChoice === "card" ? " coach-payment-choice--active" : ""
                }${paymentMethodsLoading ? " coach-payment-choice--disabled" : ""}`}
              >
                <input
                  type="radio"
                  name="payment-choice"
                  value="card"
                  checked={paymentChoice === "card"}
                  onChange={() => setPaymentChoice("card")}
                />
                <div className="coach-payment-choice__body">
                  <div className="coach-payment-choice__title-row">
                    <span className="coach-payment-choice__title">Pay by card</span>
                  </div>
                  <p className="coach-payment-choice__subtitle">Use your saved cards for this booking.</p>
                </div>
              </label>
            </div>

            {paymentChoice === "card" && paymentMethods.length > 0 && (
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
                disabled={
                  bookingInFlight !== null ||
                  (paymentChoice === "card" && (!selectedPaymentMethodId || paymentMethodsLoading)) ||
                  (paymentChoice === "credits" && (creditsLoading || !pendingEligibleCredits.length || consumingCredits))
                }
                onClick={() => void confirmBookLesson()}
              >
                {bookingInFlight || consumingCredits
                  ? "Booking…"
                  : paymentChoice === "credits"
                    ? "Confirm with credits"
                    : "Confirm & pay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default CoachProfilePage;
