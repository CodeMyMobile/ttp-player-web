import moment from "moment";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Apple,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Globe,
  MapPin,
  MessageCircle,
  Users,
  Wallet,
  X,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import JoinMyRosterBanner from "../components/coaches/JoinMyRosterBanner";
import { fetchCoachProfile, type CoachProfileRecord } from "../api/coachProfile";
import {
  consumePackageCredits,
  fetchCoachPackages,
  fetchPackageCredits,
  fetchPackageCreditsBalance,
  type CoachPackage,
  type PackageCreditsBalanceResponse,
  type PackagePurchase,
} from "../api/playerPackages";
import {
  bookGroupLessonWithCard,
  fetchCoachLessonsByDate,
  fetchCoachSchedule,
  type CoachScheduleEntry,
  type Lesson,
  requestPrivateLesson,
} from "../api/playerLessons";
import {
  getPlayerStripePaymentMethods,
  type PlayerStripePaymentMethod,
} from "../api/playerStripe";
import { updatePlayerLesson } from "../api/player";
import { useAuth } from "../context/AuthContext";
import { useCoachRoster } from "../hooks/useCoachRoster";
import { getStoredAuthToken } from "../services/authToken";
import BookingStatusModal, { type BookingStatus } from "../components/booking/BookingStatusModal";

import "./CoachProfilePage.css";
import "../components/coaches/coaches.css";

type LessonTypeFilter = "all" | "private" | "group";
type AnchorTab = "about" | "specialties" | "courts";
type BookingStep = "about" | "confirm" | "card" | "success";
type IntroWho = "Myself" | "My child" | "";

type LoadedSlot = {
  id: string;
  type: Exclude<LessonTypeFilter, "all">;
  isoDate: string;
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  durationMin: number;
  court: string;
  priceLabel: string;
  start: string;
  end: string;
  className?: string;
  level?: string;
  description?: string;
  spotsLeft?: number;
  totalSpots?: number;
  locationId?: number | null;
  courtValue?: number | string | null;
  sourceLessonId?: number;
  bookingState?: "pending" | "confirmed";
};

type DayGroup = {
  isoDate: string;
  dayLabel: string;
  dateLabel: string;
  shortDateLabel: string;
  slots: LoadedSlot[];
};

type IntroFormState = {
  who: IntroWho;
  level: string;
  goals: string[];
  note: string;
};

type BookingConfirmationData = {
  status: BookingStatus;
  data: {
    coachName: string;
    coachInitials: string;
    lessonTitle?: string;
    lessonSubtitle?: string;
    skillRange?: string;
    lessonTypeLabel: string;
    isGroup?: boolean;
    durationMin: number;
    dateLabel: string;
    timeLabel: string;
    locationName: string;
    locationAddress: string;
    amountLabel: string;
    amount: string;
    etaText?: string;
    cancellationPolicyText: string;
  };
};

const SCHEDULE_WINDOW_DAYS = 7;
const INTRO_GOALS = [
  "Serve",
  "Groundstrokes",
  "Match strategy",
  "Doubles",
  "Fitness",
  "Tournament prep",
  "Just have fun",
];

const LEVEL_OPTIONS = [
  "Beginner",
  "Beginner+",
  "Intermediate",
  "Intermediate+",
  "Advanced",
  "Competitive",
];

const MOCK_PAYMENT_METHODS: PlayerStripePaymentMethod[] = [
  {
    id: "mock-visa",
    card: { brand: "Visa", last4: "4242", exp_month: 12, exp_year: 2028 },
    billing_details: { name: "Player Default" },
    is_default: true,
  },
  {
    id: "mock-mastercard",
    card: { brand: "Mastercard", last4: "4444", exp_month: 8, exp_year: 2027 },
    billing_details: { name: "Player Backup" },
  },
];

const useCoachProfile = (id?: string) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CoachProfileRecord | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    if (!id) {
      setProfile(undefined);
      setError(undefined);
      setLoading(false);
      return () => controller.abort();
    }

    const coachId = Number.parseInt(id, 10);
    if (Number.isNaN(coachId)) {
      setProfile(undefined);
      setError("Invalid coach identifier.");
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setError(undefined);

    fetchCoachProfile(coachId, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setProfile(data);
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        const status = (err as Error & { status?: number }).status;
        if (status === 404) {
          setProfile(undefined);
          setError(undefined);
          return;
        }
        setProfile(undefined);
        setError(err instanceof Error ? err.message : "Unable to load coach profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);

  return { loading, profile, error };
};

const buildInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const formatCurrency = (value?: string | number | null) => {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value.replace(/[^0-9.]/g, ""))
        : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return typeof value === "string" ? value : undefined;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numeric);
};

const parseCurrency = (value?: string | number | null) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseDurationMinutes = (label?: string) => {
  if (!label) return 60;
  const hr = label.match(/(\d+(?:\.\d+)?)\s*hr/i);
  if (hr) {
    return Math.round(Number.parseFloat(hr[1]) * 60);
  }
  const min = label.match(/(\d+)\s*min/i);
  if (min) {
    return Number.parseInt(min[1], 10);
  }
  return 60;
};

const parseClock = (isoDate: string, value?: string) => {
  if (!value) return null;
  const parsed = moment(`${isoDate} ${value}`, ["YYYY-MM-DD h:mm A", "YYYY-MM-DD HH:mm", moment.ISO_8601], true);
  return parsed.isValid() ? parsed : null;
};

const resolveLessonType = (lesson: Lesson) => {
  const label = String(lesson.lesson_type_name ?? "").toLowerCase();
  return label.includes("group") ? "group" : "private";
};

const normalizeLessonTypeLabel = (lessonTypes?: string[]) => {
  if (!lessonTypes?.length) return "All lessons";
  return lessonTypes
    .map((type) =>
      type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(" · ");
};

const extractMetricNumber = (values: string[], pattern: RegExp) => {
  for (const value of values) {
    const match = value.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return undefined;
};

const buildGoogleCalendarUrl = (slot: LoadedSlot, coachName: string) => {
  const start = moment(slot.start).utc().format("YYYYMMDD[T]HHmmss[Z]");
  const end = moment(slot.end).utc().format("YYYYMMDD[T]HHmmss[Z]");
  const details = encodeURIComponent(`Lesson with ${coachName}`);
  const location = encodeURIComponent(slot.court);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Lesson with ${coachName}`)}&dates=${start}/${end}&details=${details}&location=${location}`;
};

const downloadIcs = (slot: LoadedSlot, coachName: string) => {
  const stamp = moment.utc().format("YYYYMMDD[T]HHmmss[Z]");
  const start = moment(slot.start).utc().format("YYYYMMDD[T]HHmmss[Z]");
  const end = moment(slot.end).utc().format("YYYYMMDD[T]HHmmss[Z]");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Tennis Plan//Coach Booking//EN",
    "BEGIN:VEVENT",
    `UID:${slot.id}@thetennisplan`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Lesson with ${coachName}`,
    `LOCATION:${slot.court}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${coachName.toLowerCase().replace(/\s+/g, "-")}-lesson.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const CoachProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading, profile, error: profileError } = useCoachProfile(id);
  const authToken =
    user?.session?.access_token ??
    user?.access_token ??
    user?.token ??
    getStoredAuthToken({ preferScheme: "token" }) ??
    undefined;

  const {
    rosterStatus,
    rosterLoading,
    rosterError,
    requestJoin,
    requestingJoin,
    requestJoinError,
    requestJoinSuccess,
  } = useCoachRoster(profile?.id, authToken);

  const [bookingType, setBookingType] = useState<LessonTypeFilter>("all");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<AnchorTab>("about");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [packages, setPackages] = useState<CoachPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [packageCredits, setPackageCredits] = useState<PackagePurchase[]>([]);
  const [creditsBalance, setCreditsBalance] = useState<PackageCreditsBalanceResponse | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PlayerStripePaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [slotsByDay, setSlotsByDay] = useState<DayGroup[]>([]);
  const [bookingStep, setBookingStep] = useState<BookingStep>("confirm");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<LoadedSlot | null>(null);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<"credits" | "card" | "apple-pay">("card");
  const [bookingInFlight, setBookingInFlight] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmationData | null>(null);
  const [consumeError, setConsumeError] = useState<string | null>(null);
  const [consumingCredits, setConsumingCredits] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const [introForm, setIntroForm] = useState<IntroFormState>({ who: "", level: "", goals: [], note: "" });

  const aboutRef = useRef<HTMLElement | null>(null);
  const specialtiesRef = useRef<HTMLElement | null>(null);
  const courtsRef = useRef<HTMLElement | null>(null);
  const packagesRef = useRef<HTMLElement | null>(null);

  const coachName = profile?.name ?? profile?.fullName ?? "Coach";
  const coachFirstName = coachName.split(" ")[0] ?? "Coach";
  const coachAvatar = profile?.imageUrl ?? profile?.profilePicture ?? "";
  const coachTitle = profile?.title ?? profile?.headlineBadge ?? "Tennis Coach";
  const coachContact = (profile as CoachProfileRecord & { contact?: { phone?: string; email?: string } } | undefined)?.contact;
  const coachPhone = coachContact?.phone?.trim() ?? "";
  const aboutCopy = profile?.about ?? profile?.bio ?? profile?.summary ?? "";
  const certifications = profile?.certifications ?? [];
  const specialties = profile?.specialties ?? [];
  const languages = profile?.languages ?? [];
  const levels = profile?.levels ?? [];
  const coachingLocations = profile?.coachingLocations?.length ? profile.coachingLocations : profile?.courts ?? [];
  const bookingLessonTypes = profile?.booking?.lessonTypes ?? [];
  const privateType = bookingLessonTypes.find((item) => item.id === "private");
  const groupType = bookingLessonTypes.find((item) => item.id === "group");
  const privatePriceLabel = privateType?.price ?? profile?.lessonRates?.private ?? profile?.pricePerHour ?? "$0";
  const groupPriceLabel = groupType?.price ?? profile?.lessonRates?.group ?? undefined;
  const metrics = [
    ...(profile?.highlightChips?.map((chip) => chip.label) ?? []),
    ...(profile?.metrics?.map((metric) => `${metric.value} ${metric.label}`) ?? []),
  ];
  const experienceLabel = profile?.yearsExperience
    ? `${profile.yearsExperience} years`
    : extractMetricNumber(metrics, /(\d+\+?)\s*years?/i) ?? "Experienced";
  const studentsLabel = extractMetricNumber(metrics, /(\d+\+?)\s*students?/i) ?? "Players coached";
  const playerId =
    user?.session?.user_id ??
    user?.id ??
    (() => {
      if (typeof window === "undefined") return "guest";
      try {
        const loginRaw = localStorage.getItem("authLoginResponse");
        const parsed = loginRaw ? (JSON.parse(loginRaw) as Record<string, unknown>) : null;
        return String(parsed?.user_id ?? parsed?.id ?? "guest");
      } catch {
        return "guest";
      }
    })();
  const firstBookingKey = `coach-first-booking:${profile?.id ?? "coach"}:${playerId}`;

  useEffect(() => {
    if (!profile?.id || !authToken) {
      setPackages([]);
      setPackageCredits([]);
      setCreditsBalance(null);
      setPaymentMethods([]);
      return;
    }

    const controller = new AbortController();
    setPackagesLoading(true);
    setCreditsLoading(true);
    setPaymentMethodsLoading(true);
    setPackagesError(null);
    setPaymentMethodsError(null);

    fetchCoachPackages({ token: authToken, coachId: profile.id, signal: controller.signal })
      .then((data) => setPackages((data?.packages ?? []).filter((item) => item.is_active !== false)))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setPackagesError(err instanceof Error ? err.message : "Unable to load packages.");
          setPackages([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPackagesLoading(false);
      });

    fetchPackageCredits({ token: authToken, coachId: profile.id, includeExpired: false, signal: controller.signal })
      .then((data) => setPackageCredits(data?.purchases ?? []))
      .catch(() => {
        if (!controller.signal.aborted) setPackageCredits([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCreditsLoading(false);
      });

    fetchPackageCreditsBalance({ token: authToken, coachId: profile.id, signal: controller.signal })
      .then((data) => setCreditsBalance(data ?? null))
      .catch(() => {
        if (!controller.signal.aborted) setCreditsBalance(null);
      });

    getPlayerStripePaymentMethods(authToken)
      .then((response) => {
        const methods = Array.isArray(response)
          ? response
          : response?.payment_methods ?? response?.data ?? response?.results ?? [];
        const nextMethods = methods.length ? methods : MOCK_PAYMENT_METHODS;
        setPaymentMethods(nextMethods);
        setSelectedPaymentMethodId(nextMethods.find((item) => item.is_default)?.id ?? nextMethods[0]?.id ?? "");
      })
      .catch(() => {
        setPaymentMethods(MOCK_PAYMENT_METHODS);
        setSelectedPaymentMethodId(MOCK_PAYMENT_METHODS[0].id);
        setPaymentMethodsError(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentMethodsLoading(false);
      });

    return () => controller.abort();
  }, [authToken, profile?.id]);

  useEffect(() => {
    if (!profile?.id || !authToken) {
      setSlotsByDay([]);
      return;
    }

    let active = true;
    setScheduleLoading(true);

    const loadAvailability = async () => {
      const nextDays: DayGroup[] = [];

      for (let offset = 0; offset < SCHEDULE_WINDOW_DAYS; offset += 1) {
        const currentDay = moment().add(offset, "days");
        const isoDate = currentDay.format("YYYY-MM-DD");
        const weekday = currentDay.format("dddd").toUpperCase();

        const [scheduleEntries, lessons] = await Promise.all([
          fetchCoachSchedule({ token: authToken, coachId: profile.id, day: weekday }).catch(() => [] as CoachScheduleEntry[]),
          fetchCoachLessonsByDate({ token: authToken, coachId: profile.id, date: isoDate }).catch(() => [] as Lesson[]),
        ]);

        const occupiedRanges = lessons
          .map((lesson) => ({
            start: moment.utc(lesson.start_date_time),
            end: moment.utc(lesson.end_date_time),
          }))
          .filter((item) => item.start.isValid() && item.end.isValid());

        const privateSlots = scheduleEntries.flatMap((entry, entryIndex) => {
          const start = parseClock(isoDate, String(entry.from ?? ""));
          const end = parseClock(isoDate, String(entry.to ?? ""));
          if (!start || !end || !end.isAfter(start)) return [];

          const slots: LoadedSlot[] = [];
          let cursor = start.clone();
          let slotIndex = 0;

          while (cursor.clone().add(60, "minutes").isSameOrBefore(end)) {
            const slotEnd = cursor.clone().add(60, "minutes");
            const overlaps = occupiedRanges.some(
              (range) => cursor.isBefore(range.end) && slotEnd.isAfter(range.start),
            );

            if (!overlaps) {
              slots.push({
                id: `${isoDate}-private-${entryIndex}-${slotIndex}`,
                type: "private",
                isoDate,
                dayLabel: currentDay.format("ddd"),
                dateLabel: currentDay.format("MMM D"),
                timeLabel: cursor.format("h:mm A"),
                durationLabel: "1 hr",
                durationMin: 60,
                court: String(entry.location_name ?? entry.location ?? coachingLocations[0] ?? "Court TBD"),
                priceLabel: privatePriceLabel,
                start: cursor.toISOString(),
                end: slotEnd.toISOString(),
                locationId:
                  typeof entry.location_id === "number"
                    ? entry.location_id
                    : entry.location_id != null
                      ? Number(entry.location_id)
                      : null,
                courtValue: entry.court ?? null,
              });
            }

            cursor = slotEnd;
            slotIndex += 1;
          }

          return slots;
        });

        const groupSlots = lessons
          .filter((lesson) => resolveLessonType(lesson) === "group")
          .map((lesson, index) => {
            const start = moment.utc(lesson.start_date_time);
            const end = moment.utc(lesson.end_date_time);
            const totalSpots = Number(lesson.player_limit ?? 0) || undefined;
            const currentPlayers = Number(lesson.current_player_count ?? 0) || 0;
            const spotsLeft = totalSpots ? Math.max(totalSpots - currentPlayers, 0) : undefined;

            return {
              id: `${isoDate}-group-${lesson.id}-${index}`,
              type: "group" as const,
              isoDate,
              dayLabel: currentDay.format("ddd"),
              dateLabel: currentDay.format("MMM D"),
              timeLabel: start.local().format("h:mm A"),
              durationLabel: end.isValid() ? `${end.diff(start, "minutes")} min` : groupType?.duration ?? "1 hr",
              durationMin: end.isValid() ? end.diff(start, "minutes") : 60,
              court: lesson.location_name ?? coachingLocations[0] ?? "Court TBD",
              priceLabel: formatCurrency(lesson.price_per_person) ?? groupPriceLabel ?? "$0",
              start: lesson.start_date_time,
              end: lesson.end_date_time,
              className: lesson.metadata?.title ?? lesson.metadata_title ?? "Group lesson",
              level: lesson.metadata?.level ?? "All levels",
              description: lesson.metadata?.description ?? "Live coached group session.",
              spotsLeft,
              totalSpots,
              locationId: lesson.location_id ?? null,
              courtValue: null,
              sourceLessonId: lesson.id,
            };
          });

        const slots = [...privateSlots, ...groupSlots].sort((a, b) => moment(a.start).valueOf() - moment(b.start).valueOf());
        nextDays.push({
          isoDate,
          dayLabel: currentDay.format("ddd"),
          dateLabel: currentDay.format("MMM D"),
          shortDateLabel: currentDay.format("D"),
          slots,
        });
      }

      if (active) {
        setSlotsByDay(nextDays);
        setScheduleLoading(false);
      }
    };

    void loadAvailability();

    return () => {
      active = false;
    };
  }, [authToken, coachingLocations, groupPriceLabel, groupType?.duration, privatePriceLabel, profile?.id]);

  const availableCredits = useMemo(() => {
    const balance = creditsBalance?.available;
    if (typeof balance === "number" && Number.isFinite(balance)) return balance;
    return packageCredits.reduce((sum, purchase) => sum + Math.max(Number(purchase.credits_remaining ?? 0), 0), 0);
  }, [creditsBalance?.available, packageCredits]);

  const privateCredits = useMemo(
    () =>
      packageCredits
        .filter((purchase) => {
          const types = purchase.lesson_types_allowed ?? [];
          return !types.length || types.some((type) => type.toLowerCase().includes("private"));
        })
        .reduce((sum, purchase) => sum + Math.max(Number(purchase.credits_remaining ?? 0), 0), 0),
    [packageCredits],
  );

  const visibleDays = useMemo(() => {
    return slotsByDay.map((day) => ({
      ...day,
      slots: day.slots.filter((slot) => bookingType === "all" || slot.type === bookingType),
    }));
  }, [bookingType, slotsByDay]);

  const activeDays = useMemo(() => visibleDays.filter((day) => day.slots.length > 0), [visibleDays]);

  useEffect(() => {
    if (selectedDate === "all") return;
    if (activeDays.some((day) => day.isoDate === selectedDate)) return;
    setSelectedDate(activeDays[0]?.isoDate ?? "all");
  }, [activeDays, selectedDate]);

  const visibleSlots = useMemo(() => {
    if (selectedDate === "all") {
      return activeDays.flatMap((day) => day.slots);
    }
    return activeDays.find((day) => day.isoDate === selectedDate)?.slots ?? [];
  }, [activeDays, selectedDate]);

  const nextAvailableSlot = visibleSlots[0] ?? activeDays.flatMap((day) => day.slots)[0] ?? null;
  const slotsThisWeek = activeDays.reduce((sum, day) => sum + day.slots.length, 0);

  const filteredPackages = useMemo(() => {
    if (bookingType === "all") return packages;
    return packages.filter((pkg) => {
      const types = pkg.lesson_types_allowed ?? [];
      if (!types.length) return true;
      return types.some((type) => type.toLowerCase().includes(bookingType));
    });
  }, [bookingType, packages]);

  const onboardingPrefill = useMemo(() => {
    if (typeof window === "undefined") {
      return { who: "" as IntroWho, level: "", goals: [] as string[] };
    }
    try {
      const profileRaw = localStorage.getItem("playerPersonalDetails");
      const loginRaw = localStorage.getItem("authLoginResponse");
      const profileData = profileRaw ? (JSON.parse(profileRaw) as Record<string, unknown>) : {};
      const loginData = loginRaw ? (JSON.parse(loginRaw) as Record<string, unknown>) : {};
      const combined = { ...loginData, ...profileData };

      const who =
        combined.introWho === "My child" || combined.lesson_for === "child"
          ? "My child"
          : combined.introWho === "Myself" || combined.lesson_for === "self"
            ? "Myself"
            : "";
      const level =
        typeof combined.introLevel === "string"
          ? combined.introLevel
          : typeof combined.level === "string"
            ? combined.level
            : "";
      const goalsRaw = combined.introGoals ?? combined.goals ?? combined.focus_areas;
      const goals = Array.isArray(goalsRaw)
        ? goalsRaw.filter((item): item is string => typeof item === "string")
        : [];

      return { who: who as IntroWho, level, goals };
    } catch {
      return { who: "" as IntroWho, level: "", goals: [] as string[] };
    }
  }, []);

  useEffect(() => {
    setIntroForm((current) => ({
      who: current.who || onboardingPrefill.who,
      level: current.level || onboardingPrefill.level,
      goals: current.goals.length ? current.goals : onboardingPrefill.goals,
      note: current.note,
    }));
  }, [onboardingPrefill]);

  const isFirstBooking = useMemo(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(firstBookingKey) !== "completed";
  }, [firstBookingKey]);

  const hasPrefill = Boolean(onboardingPrefill.who || onboardingPrefill.level || onboardingPrefill.goals.length);

  const sectionRefs: Record<AnchorTab, RefObject<HTMLElement>> = {
    about: aboutRef as RefObject<HTMLElement>,
    specialties: specialtiesRef as RefObject<HTMLElement>,
    courts: courtsRef as RefObject<HTMLElement>,
  };

  const scrollToSection = (tab: AnchorTab) => {
    setActiveTab(tab);
    const node = sectionRefs[tab].current;
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY - 190;
    window.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      const offsets: Array<{ id: AnchorTab; top: number }> = [
        { id: "about", top: aboutRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY },
        { id: "specialties", top: specialtiesRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY },
        { id: "courts", top: courtsRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY },
      ];

      const current =
        offsets
          .filter((item) => item.top <= 220)
          .sort((a, b) => b.top - a.top)[0]?.id ?? "about";
      setActiveTab(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openBookingFlow = (slot: LoadedSlot) => {
    setSelectedSlot(slot);
    setBookingStep(isFirstBooking ? "about" : "confirm");
    setBookingOpen(true);
    setPaymentMethodsError(null);
    setBookingError(null);
    setBookingSuccess(null);
    setConsumeError(null);
  };

  const closeBookingFlow = () => {
    setBookingOpen(false);
    setBookingStep("confirm");
  };

  const closePaymentSheet = () => {
    setPaymentSheetOpen(false);
    setPaymentMethodsError(null);
    setConsumeError(null);
    setBookingInFlight(null);
    setConsumingCredits(false);
  };

  const openPaymentSheet = (choice: "credits" | "card" | "apple-pay" = "card") => {
    setPaymentChoice(choice);
    setPaymentSheetOpen(true);
    setBookingOpen(false);
    setPaymentMethodsError(null);
    setBookingError(null);
    setBookingSuccess(null);
    setConsumeError(null);
  };

  const buildBookingConfirmation = (slot: LoadedSlot): BookingConfirmationData => {
    const isGroup = slot.type === "group";
    return {
      status: isGroup ? "CONFIRMED" : "PENDING",
      data: {
        coachName,
        coachInitials: buildInitials(coachName),
        lessonTitle: isGroup ? slot.className : undefined,
        lessonSubtitle: isGroup ? slot.description : undefined,
        lessonTypeLabel: isGroup ? slot.className ?? "Group lesson" : "Private lesson",
        isGroup,
        durationMin: slot.durationMin,
        dateLabel: `${slot.dayLabel}, ${slot.dateLabel}`,
        timeLabel: slot.timeLabel,
        locationName: slot.court,
        locationAddress: slot.court,
        amountLabel: isGroup ? "Amount charged" : "Lesson total",
        amount: slot.priceLabel,
        etaText: isGroup ? undefined : "~24 hrs",
        cancellationPolicyText:
          "Cancellation policy: Free cancellation up to 24 hours before your lesson. Cancellations within 24 hours may be subject to a fee.",
      },
    };
  };

  const applyLessonConfirmedStatus = (slot: LoadedSlot) => {
    setSlotsByDay((prev) =>
      prev.map((day) => ({
        ...day,
        slots: day.slots.map((entry) => {
          if (entry.id !== slot.id) return entry;
          if (entry.type === "group") {
            const nextSpots = entry.spotsLeft != null ? Math.max(entry.spotsLeft - 1, 0) : entry.spotsLeft;
            return { ...entry, spotsLeft: nextSpots, bookingState: "confirmed" };
          }
          return { ...entry, bookingState: "pending" };
        }),
      })),
    );
  };

  const handleBookingComplete = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(firstBookingKey, "completed");
    }
  };

  const buildSessionPrepMetadata = () => ({
    session_prep: {
      who_for: introForm.who === "My child" ? "my_child" : "myself",
      level: introForm.level || undefined,
      goals: introForm.goals.length ? introForm.goals : undefined,
      note: introForm.note.trim() || undefined,
    },
  });

  const confirmBookLesson = async () => {
    if (!selectedSlot || !authToken || !profile?.id) {
      setBookingError("Please select a lesson and sign in to continue.");
      return;
    }

    if (paymentChoice === "card" && !selectedPaymentMethodId) {
      setPaymentMethodsError("Choose a payment method to book this lesson.");
      return;
    }

    if (paymentChoice === "apple-pay") {
      setPaymentMethodsError("Apple Pay uses the same confirmation flow here and still requires Stripe wiring.");
      return;
    }

    setBookingInFlight(selectedSlot.id);
    setBookingError(null);
    setBookingSuccess(null);
    setConsumeError(null);

    try {
      if (paymentChoice === "credits") {
        setConsumingCredits(true);
        if (!availableCredits) {
          throw new Error("No eligible credits available.");
        }
      }

      if (selectedSlot.type === "group" && selectedSlot.sourceLessonId) {
        if (paymentChoice === "credits") {
          await updatePlayerLesson({
            token: authToken,
            lessonId: selectedSlot.sourceLessonId,
            status: "CONFIRMED",
          });
          if (packageCredits[0]?.id) {
            await consumePackageCredits({
              token: authToken,
              coachId: profile.id,
              lessonType: "group",
              lessonId: selectedSlot.sourceLessonId,
              purchaseId: packageCredits[0].id,
            }).catch(() => undefined);
          }
        } else {
          await bookGroupLessonWithCard({
            token: authToken,
            lessonId: selectedSlot.sourceLessonId,
            paymentMethodId: selectedPaymentMethodId,
          });
        }
      } else {
        if (!selectedSlot.locationId) {
          throw new Error("Missing location details for this lesson.");
        }
        await requestPrivateLesson({
          token: authToken,
          coachId: Number(profile.id),
          startDateTime: moment(selectedSlot.start).utc().toISOString(),
          endDateTime: moment(selectedSlot.end).utc().toISOString(),
          startDateTimeTz: moment(selectedSlot.start).toISOString(),
          endDateTimeTz: moment(selectedSlot.end).toISOString(),
          locationId: selectedSlot.locationId,
          court: selectedSlot.courtValue ?? 0,
          status: "PENDING",
          metadata: buildSessionPrepMetadata(),
          ...(paymentChoice === "card" ? { paymentMethodId: selectedPaymentMethodId } : {}),
        });
        if (paymentChoice === "credits" && packageCredits[0]?.id) {
          await consumePackageCredits({
            token: authToken,
            coachId: profile.id,
            lessonType: "private",
            purchaseId: packageCredits[0].id,
          }).catch(() => undefined);
        }
      }

      applyLessonConfirmedStatus(selectedSlot);
      handleBookingComplete();
      setBookingConfirmation(buildBookingConfirmation(selectedSlot));
      setBookingSuccess(null);
      closePaymentSheet();
      setSelectedSlot(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to complete this booking.";
      setBookingError(message);
      setPaymentMethodsError(message);
    } finally {
      setBookingInFlight(null);
      setConsumingCredits(false);
    }
  };

  const canContinueIntro = Boolean(introForm.level && introForm.goals.length);
  const smsHref = coachPhone ? `smsto:${coachPhone}` : "";
  const handleMessageCoach = () => {
    if (!smsHref || typeof window === "undefined") {
      return;
    }
    window.location.href = smsHref;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="coach-profile-page coach-profile-page--loading">
          <div className="coach-profile-loading-card" />
        </div>
      </MainLayout>
    );
  }

  if (profileError || !profile) {
    return (
      <MainLayout>
        <div className="coach-profile-page">
          <div className="coach-profile-empty">
            <div className="coach-profile-empty__icon">
              <MessageCircle strokeWidth={2.2} />
            </div>
            <h1 className="coach-profile-empty__title">{profileError ? "We couldn’t load this coach" : "Coach not found"}</h1>
            <p className="coach-profile-empty__copy">
              {profileError ?? "That profile isn’t available right now. Return to the coach list and try another profile."}
            </p>
            <Link to="/find-coaches" className="coach-profile-empty__action">
              <ArrowLeft size={16} /> Back to Coaches
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="coach-profile-page">
        <div className="coach-profile-shell">
          <JoinMyRosterBanner
            coachName={coachName}
            rosterStatus={rosterStatus}
            canRequest={Boolean(authToken)}
            onRequestJoin={requestJoin}
            requestingJoin={requestingJoin}
            joinError={requestJoinError ?? undefined}
            joinSuccess={requestJoinSuccess}
            rosterError={rosterError ?? undefined}
            rosterLoading={rosterLoading}
          />

          <div className="coach-profile-sticky-chrome">
            <div className="coach-profile-sticky-chrome__header">
              <button type="button" className="coach-profile-top-action" onClick={() => navigate("/find-coaches")}>
                <ArrowLeft size={16} /> Coaches
              </button>
              <button
                type="button"
                className="coach-profile-top-action coach-profile-top-action--ghost"
                onClick={handleMessageCoach}
                disabled={!smsHref}
              >
                <MessageCircle size={16} /> Message
              </button>
            </div>

            <div className="coach-profile-sticky-chrome__tabs">
              {(["about", "specialties", "courts"] as AnchorTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`coach-profile-tab${activeTab === tab ? " coach-profile-tab--active" : ""}`}
                  onClick={() => scrollToSection(tab)}
                >
                  {tab === "about" ? "About" : tab === "specialties" ? "Specialties" : "Courts"}
                </button>
              ))}
            </div>

            <div className="coach-profile-mini-bar">
              <div className="coach-profile-mini-bar__coach">
                {coachAvatar ? (
                  <img src={coachAvatar} alt="" className="coach-profile-mini-bar__avatar" />
                ) : (
                  <span className="coach-profile-mini-bar__avatar coach-profile-mini-bar__avatar--fallback">{buildInitials(coachName)}</span>
                )}
                <div>
                  <p className="coach-profile-mini-bar__name">{coachName}</p>
                  <p className="coach-profile-mini-bar__meta">{certifications[0] ?? coachTitle}</p>
                </div>
              </div>
              <span className="coach-profile-mini-bar__price">{privatePriceLabel}</span>
            </div>
          </div>

          <div className="coach-profile-layout-v2">
            <div className="coach-profile-main-v2">
              <section className="coach-profile-hero-v2">
                <div className="coach-profile-hero-v2__identity">
                  {coachAvatar ? (
                    <img src={coachAvatar} alt={coachName} className="coach-profile-hero-v2__avatar" />
                  ) : (
                    <div className="coach-profile-hero-v2__avatar coach-profile-hero-v2__avatar--fallback">{buildInitials(coachName)}</div>
                  )}
                  <div className="coach-profile-hero-v2__copy">
                    <div className="coach-profile-hero-v2__eyebrow">Coach profile</div>
                    <h1>{coachName}</h1>
                    <p className="coach-profile-hero-v2__title">{coachTitle}</p>
                    <div className="coach-profile-hero-v2__chips">
                      {certifications.map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--purple">
                          {item}
                        </span>
                      ))}
                    </div>
                    <div className="coach-profile-hero-v2__stats">
                      <span>
                        <MapPin size={14} /> {profile.location}
                      </span>
                      <span>
                        <Users size={14} /> {studentsLabel}
                      </span>
                      <span>
                        <Clock3 size={14} /> {experienceLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="coach-profile-section coach-profile-section--bio">
                <div className="coach-profile-section__header">
                  <h2>Bio</h2>
                </div>
                <p className={`coach-profile-bio${bioExpanded ? " coach-profile-bio--expanded" : ""}`}>{aboutCopy}</p>
                {aboutCopy.length > 180 ? (
                  <button type="button" className="coach-profile-inline-link" onClick={() => setBioExpanded((value) => !value)}>
                    {bioExpanded ? "See less" : "See more"}
                  </button>
                ) : null}
              </section>

              {availableCredits > 0 ? (
                <section className="coach-credit-strip-mobile">
                  <div>
                    <strong>{availableCredits} credits</strong>
                    <span>can be applied at booking</span>
                  </div>
                  <button type="button" onClick={() => packagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    Top up
                  </button>
                </section>
              ) : null}

              <aside className="coach-profile-aside-v2 coach-profile-aside-v2--mobile">
                <div className="coach-profile-price-card">
                  <div className="coach-profile-price-card__row">
                    <div>
                      <p className="coach-profile-price-card__eyebrow">from</p>
                      <h3>{privatePriceLabel}</h3>
                    </div>
                    <div className={`coach-profile-availability${slotsThisWeek > 0 ? " coach-profile-availability--open" : ""}`}>
                      {slotsThisWeek > 0 ? `${slotsThisWeek} slots this week` : "No slots this week"}
                    </div>
                  </div>
                  {groupPriceLabel ? <p className="coach-profile-price-card__sub">{groupPriceLabel} group</p> : null}
                </div>

                {availableCredits > 0 ? (
                  <div className="coach-credit-strip">
                    <div className="coach-credit-strip__copy">
                      <Wallet size={16} />
                      <span>{availableCredits} credits</span>
                      <small>can be applied at booking</small>
                    </div>
                    <button type="button" onClick={() => packagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                      Top up
                    </button>
                  </div>
                ) : null}

                <section className="coach-booking-card">
                  <div className="coach-profile-section__header">
                    <h2>Book a lesson</h2>
                  </div>

                  <div className="coach-booking-toggle">
                    {(["all", "private", "group"] as LessonTypeFilter[])
                      .filter((type) => type !== "group" || Boolean(groupPriceLabel))
                      .map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={bookingType === type ? "is-active" : ""}
                          onClick={() => setBookingType(type)}
                        >
                          {type === "all" ? "All" : type === "private" ? "Private" : "Group"}
                        </button>
                      ))}
                  </div>

                  <div className="coach-day-strip">
                    <button
                      type="button"
                      className={selectedDate === "all" ? "coach-day-chip is-active" : "coach-day-chip"}
                      onClick={() => setSelectedDate("all")}
                    >
                      <span>All</span>
                    </button>
                    {activeDays.map((day) => (
                      <button
                        key={day.isoDate}
                        type="button"
                        className={selectedDate === day.isoDate ? "coach-day-chip is-active" : "coach-day-chip"}
                        onClick={() => setSelectedDate(day.isoDate)}
                      >
                        <span>{day.dayLabel}</span>
                        <small>{day.shortDateLabel}</small>
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`coach-day-chip coach-day-chip--icon${showDatePicker ? " is-active" : ""}`}
                      onClick={() => setShowDatePicker((value) => !value)}
                    >
                      <CalendarDays size={16} />
                    </button>
                  </div>

                  {showDatePicker ? (
                    <div className="coach-date-picker">
                      <input
                        type="date"
                        onChange={(event) => {
                          const value = event.target.value;
                          setSelectedDate(value);
                          setShowDatePicker(false);
                        }}
                      />
                    </div>
                  ) : null}

                  {scheduleLoading ? <div className="coach-empty-card">Loading availability…</div> : null}

                  {!scheduleLoading && visibleSlots.length > 0 ? (
                    <div className="coach-slot-list">
                      {visibleSlots.map((slot) =>
                        slot.type === "private" ? (
                          <article key={slot.id} className="coach-slot coach-slot--private">
                            <div className="coach-slot__main">
                              <p className="coach-slot__time">
                                {slot.dayLabel} {slot.dateLabel} · {slot.timeLabel}
                              </p>
                              <div className="coach-slot__meta">
                                <span className="coach-profile-pill coach-profile-pill--purple">Private</span>
                                <span>{slot.court}</span>
                                <span>{slot.durationLabel}</span>
                              </div>
                            </div>
                            <div className="coach-slot__actions">
                              <strong>{slot.priceLabel}</strong>
                              <button type="button" disabled={slot.bookingState != null} onClick={() => openBookingFlow(slot)}>
                                {slot.bookingState === "pending" ? "Requested" : slot.bookingState === "confirmed" ? "Booked" : "Book"}
                              </button>
                            </div>
                          </article>
                        ) : (
                          <article key={slot.id} className="coach-slot coach-slot--group">
                            <div className="coach-slot__card-head">
                              <div>
                                <h3>{slot.className}</h3>
                                <div className="coach-slot__meta">
                                  <span className="coach-profile-pill coach-profile-pill--green">Group</span>
                                  <span className="coach-profile-pill coach-profile-pill--amber">{slot.durationLabel}</span>
                                  <span className="coach-profile-pill coach-profile-pill--gold">{slot.level}</span>
                                </div>
                              </div>
                              <strong>{slot.priceLabel}</strong>
                            </div>
                            <p className="coach-slot__description">{slot.description}</p>
                            <div className="coach-slot__footer">
                              <div>
                                <p>
                                  {slot.dayLabel} {slot.dateLabel} · {slot.timeLabel}
                                </p>
                                <small>
                                  {slot.court}
                                  {slot.spotsLeft != null && slot.totalSpots != null ? ` · ${slot.spotsLeft}/${slot.totalSpots} spots left` : ""}
                                </small>
                              </div>
                              <button type="button" disabled={slot.bookingState != null} onClick={() => openBookingFlow(slot)}>
                                {slot.bookingState === "confirmed" ? "Booked" : "Reserve spot"}
                              </button>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  ) : null}

                  {!scheduleLoading && visibleSlots.length === 0 ? (
                    <div className="coach-empty-card coach-empty-card--purple">
                      <strong>No lessons for this filter</strong>
                      <p>
                        {nextAvailableSlot
                          ? `Next available: ${nextAvailableSlot.dayLabel} ${nextAvailableSlot.dateLabel} · ${nextAvailableSlot.timeLabel}`
                          : "No availability posted yet."}
                      </p>
                      <div className="coach-empty-card__actions">
                        <button type="button" onClick={() => setSelectedDate("all")}>
                          See all availability
                        </button>
                        <button type="button" className="is-secondary" onClick={handleMessageCoach} disabled={!smsHref}>
                          Message coach
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section ref={packagesRef} className="coach-profile-section coach-profile-section--packages">
                  <div className="coach-profile-section__header">
                    <h2>Packages</h2>
                    <span className="coach-profile-section__caption">
                      {availableCredits > 0 ? `${availableCredits} credits available` : "Top up lesson credits"}
                    </span>
                  </div>

                  {packagesLoading ? <div className="coach-empty-card">Loading packages…</div> : null}
                  {packagesError ? <div className="coach-empty-card">{packagesError}</div> : null}
                  {!packagesLoading && !packagesError ? (
                    <div className="coach-package-list">
                      {filteredPackages.length > 0 ? (
                        filteredPackages.map((pkg, index) => {
                          const total = formatCurrency(pkg.total_price) ?? `${pkg.total_price}`;
                          const perSession = parseCurrency(pkg.total_price)
                            ? formatCurrency(Number(pkg.total_price) / Math.max(pkg.lesson_count, 1))
                            : undefined;
                          return (
                            <article key={String(pkg.id)} className={`coach-package-card${index === 1 ? " coach-package-card--featured" : ""}`}>
                              <div className="coach-package-card__top">
                                <div>
                                  <p className="coach-package-card__eyebrow">{normalizeLessonTypeLabel(pkg.lesson_types_allowed)}</p>
                                  <h3>{pkg.name || `${pkg.lesson_count} session package`}</h3>
                                </div>
                                {index === 1 ? <span className="coach-package-card__badge">Popular</span> : null}
                              </div>
                              <p>{pkg.description || "Flexible credits that can be applied when you book."}</p>
                              <div className="coach-package-card__price">
                                <strong>{total}</strong>
                                <span>{perSession ? `${perSession}/session` : `${pkg.lesson_count} credits`}</span>
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <div className="coach-empty-card">No packages are available for this filter yet.</div>
                      )}
                    </div>
                  ) : null}
                </section>
              </aside>

              <section ref={aboutRef} className="coach-profile-section" id="about">
                <div className="coach-profile-section__header">
                  <h2>About</h2>
                </div>
                <div className="coach-detail-grid">
                  <article className="coach-detail-card">
                    <Clock3 size={18} />
                    <span>Experience</span>
                    <strong>{experienceLabel}</strong>
                  </article>
                  <article className="coach-detail-card">
                    <Users size={18} />
                    <span>Students</span>
                    <strong>{studentsLabel}</strong>
                  </article>
                  <article className="coach-detail-card">
                    <Globe size={18} />
                    <span>Languages</span>
                    <strong>{languages.join(", ") || "English"}</strong>
                  </article>
                </div>

                <div className="coach-detail-stack">
                  <div>
                    <h3>Certifications</h3>
                    <div className="coach-chip-row">
                      {certifications.map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--purple">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Pricing</h3>
                    <div className="coach-chip-row">
                      <span className="coach-profile-pill coach-profile-pill--white">{privatePriceLabel} private</span>
                      {groupPriceLabel ? <span className="coach-profile-pill coach-profile-pill--white">{groupPriceLabel} group</span> : null}
                    </div>
                  </div>
                </div>
              </section>

              <section ref={specialtiesRef} className="coach-profile-section" id="specialties">
                <div className="coach-profile-section__header">
                  <h2>Specialties</h2>
                </div>
                <div className="coach-detail-stack">
                  <div>
                    <h3>Focus areas</h3>
                    <div className="coach-chip-row">
                      {specialties.map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--soft">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Levels</h3>
                    <div className="coach-chip-row">
                      {levels.map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--purple">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Formats</h3>
                    <div className="coach-chip-row">
                      {(bookingLessonTypes.length ? bookingLessonTypes.map((item) => item.label) : ["Private lesson", "Group lesson"]).map((item) => (
                        <span key={item} className="coach-profile-pill coach-profile-pill--blue">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Availability</h3>
                    <div className="coach-chip-row">
                      <span className="coach-profile-pill coach-profile-pill--green">{profile.availability}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section ref={courtsRef} className="coach-profile-section" id="courts">
                <div className="coach-profile-section__header">
                  <h2>Courts</h2>
                </div>
                <div className="coach-court-grid">
                  {coachingLocations.map((location, index) => (
                    <article key={location} className="coach-court-card">
                      <div className={`coach-court-card__icon${index === 0 ? " coach-court-card__icon--primary" : ""}`}>
                        <MapPin size={18} />
                      </div>
                      <div>
                        <strong>{location}</strong>
                        <span>{index === 0 ? "Primary location" : "Secondary location"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="coach-profile-aside-v2 coach-profile-aside-v2--desktop">
              <div className="coach-profile-price-card">
                <div className="coach-profile-price-card__row">
                  <div>
                    <p className="coach-profile-price-card__eyebrow">from</p>
                    <h3>{privatePriceLabel}</h3>
                  </div>
                  <div className={`coach-profile-availability${slotsThisWeek > 0 ? " coach-profile-availability--open" : ""}`}>
                    {slotsThisWeek > 0 ? `${slotsThisWeek} slots this week` : "No slots this week"}
                  </div>
                </div>
                {groupPriceLabel ? <p className="coach-profile-price-card__sub">{groupPriceLabel} group</p> : null}
              </div>

              {availableCredits > 0 ? (
                <div className="coach-credit-strip">
                  <div className="coach-credit-strip__copy">
                    <Wallet size={16} />
                    <span>{availableCredits} credits</span>
                    <small>can be applied at booking</small>
                  </div>
                  <button type="button" onClick={() => packagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    Top up
                  </button>
                </div>
              ) : null}

              <section className="coach-booking-card">
                <div className="coach-profile-section__header">
                  <h2>Book a lesson</h2>
                </div>

                <div className="coach-booking-toggle">
                  {(["all", "private", "group"] as LessonTypeFilter[])
                    .filter((type) => type !== "group" || Boolean(groupPriceLabel))
                    .map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={bookingType === type ? "is-active" : ""}
                        onClick={() => setBookingType(type)}
                      >
                        {type === "all" ? "All" : type === "private" ? "Private" : "Group"}
                      </button>
                    ))}
                </div>

                <div className="coach-day-strip">
                  <button
                    type="button"
                    className={selectedDate === "all" ? "coach-day-chip is-active" : "coach-day-chip"}
                    onClick={() => setSelectedDate("all")}
                  >
                    <span>All</span>
                  </button>
                  {activeDays.map((day) => (
                    <button
                      key={day.isoDate}
                      type="button"
                      className={selectedDate === day.isoDate ? "coach-day-chip is-active" : "coach-day-chip"}
                      onClick={() => setSelectedDate(day.isoDate)}
                    >
                      <span>{day.dayLabel}</span>
                      <small>{day.shortDateLabel}</small>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`coach-day-chip coach-day-chip--icon${showDatePicker ? " is-active" : ""}`}
                    onClick={() => setShowDatePicker((value) => !value)}
                  >
                    <CalendarDays size={16} />
                  </button>
                </div>

                {showDatePicker ? (
                  <div className="coach-date-picker">
                    <input
                      type="date"
                      onChange={(event) => {
                        setSelectedDate(event.target.value);
                        setShowDatePicker(false);
                      }}
                    />
                  </div>
                ) : null}

                {scheduleLoading ? <div className="coach-empty-card">Loading availability…</div> : null}
                {!scheduleLoading && visibleSlots.length > 0 ? (
                  <div className="coach-slot-list coach-slot-list--aside">
                    {visibleSlots.map((slot) =>
                      slot.type === "private" ? (
                        <article key={slot.id} className="coach-slot coach-slot--private">
                          <div className="coach-slot__main">
                            <p className="coach-slot__time">
                              {slot.dayLabel} {slot.dateLabel} · {slot.timeLabel}
                            </p>
                            <div className="coach-slot__meta">
                              <span className="coach-profile-pill coach-profile-pill--purple">Private</span>
                              <span>{slot.court}</span>
                              <span>{slot.durationLabel}</span>
                            </div>
                          </div>
                          <div className="coach-slot__actions">
                            <strong>{slot.priceLabel}</strong>
                            <button type="button" disabled={slot.bookingState != null} onClick={() => openBookingFlow(slot)}>
                              {slot.bookingState === "pending" ? "Requested" : slot.bookingState === "confirmed" ? "Booked" : "Book"}
                            </button>
                          </div>
                        </article>
                      ) : (
                        <article key={slot.id} className="coach-slot coach-slot--group">
                          <div className="coach-slot__card-head">
                            <div>
                              <h3>{slot.className}</h3>
                              <div className="coach-slot__meta">
                                <span className="coach-profile-pill coach-profile-pill--green">Group</span>
                                <span className="coach-profile-pill coach-profile-pill--amber">{slot.durationLabel}</span>
                                <span className="coach-profile-pill coach-profile-pill--gold">{slot.level}</span>
                              </div>
                            </div>
                            <strong>{slot.priceLabel}</strong>
                          </div>
                          <p className="coach-slot__description">{slot.description}</p>
                          <div className="coach-slot__footer">
                            <div>
                              <p>
                                {slot.dayLabel} {slot.dateLabel} · {slot.timeLabel}
                              </p>
                              <small>
                                {slot.court}
                                {slot.spotsLeft != null && slot.totalSpots != null ? ` · ${slot.spotsLeft}/${slot.totalSpots} spots left` : ""}
                              </small>
                            </div>
                            <button type="button" disabled={slot.bookingState != null} onClick={() => openBookingFlow(slot)}>
                              {slot.bookingState === "confirmed" ? "Booked" : "Reserve spot"}
                            </button>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                ) : null}

                {!scheduleLoading && visibleSlots.length === 0 ? (
                  <div className="coach-empty-card coach-empty-card--purple">
                    <strong>No lessons for this filter</strong>
                    <p>
                      {nextAvailableSlot
                        ? `Next available: ${nextAvailableSlot.dayLabel} ${nextAvailableSlot.dateLabel} · ${nextAvailableSlot.timeLabel}`
                        : "No availability posted yet."}
                    </p>
                    <div className="coach-empty-card__actions">
                      <button type="button" onClick={() => setSelectedDate("all")}>
                        See all availability
                      </button>
                      <button type="button" className="is-secondary" onClick={handleMessageCoach} disabled={!smsHref}>
                        Message coach
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="coach-profile-section coach-profile-section--packages">
                <div className="coach-profile-section__header">
                  <h2>Packages</h2>
                  <span className="coach-profile-section__caption">
                    {availableCredits > 0 ? `${availableCredits} credits available` : "Top up lesson credits"}
                  </span>
                </div>

                {packagesLoading ? <div className="coach-empty-card">Loading packages…</div> : null}
                {packagesError ? <div className="coach-empty-card">{packagesError}</div> : null}
                {!packagesLoading && !packagesError ? (
                  <div className="coach-package-list">
                    {filteredPackages.length > 0 ? (
                      filteredPackages.map((pkg, index) => {
                        const total = formatCurrency(pkg.total_price) ?? `${pkg.total_price}`;
                        const perSession = parseCurrency(pkg.total_price)
                          ? formatCurrency(Number(pkg.total_price) / Math.max(pkg.lesson_count, 1))
                          : undefined;
                        return (
                          <article key={String(pkg.id)} className={`coach-package-card${index === 1 ? " coach-package-card--featured" : ""}`}>
                            <div className="coach-package-card__top">
                              <div>
                                <p className="coach-package-card__eyebrow">{normalizeLessonTypeLabel(pkg.lesson_types_allowed)}</p>
                                <h3>{pkg.name || `${pkg.lesson_count} session package`}</h3>
                              </div>
                              {index === 1 ? <span className="coach-package-card__badge">Popular</span> : null}
                            </div>
                            <p>{pkg.description || "Flexible credits that can be applied when you book."}</p>
                            <div className="coach-package-card__price">
                              <strong>{total}</strong>
                              <span>{perSession ? `${perSession}/session` : `${pkg.lesson_count} credits`}</span>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="coach-empty-card">No packages are available for this filter yet.</div>
                    )}
                  </div>
                ) : null}
              </section>
            </aside>
          </div>
        </div>

        {bookingOpen && selectedSlot ? (
          <div className="coach-booking-flow" role="dialog" aria-modal="true">
            <div className="coach-booking-flow__backdrop" onClick={closeBookingFlow} />
            <div className="coach-booking-flow__panel">
              <div className="coach-booking-flow__topbar">
                <button
                  type="button"
                  className="coach-booking-flow__back"
                  onClick={() => {
                    if (bookingStep === "about") {
                      closeBookingFlow();
                      return;
                    }
                    if (bookingStep === "confirm") {
                      setBookingStep(isFirstBooking ? "about" : "confirm");
                      if (!isFirstBooking) closeBookingFlow();
                      return;
                    }
                    closeBookingFlow();
                  }}
                >
                  <ChevronLeft size={18} /> Back
                </button>
                <button type="button" className="coach-booking-flow__close" onClick={closeBookingFlow}>
                  <X size={18} />
                </button>
              </div>

              {bookingStep === "about" ? (
                <div className="coach-booking-step">
                  <div className="coach-booking-step__coach-card">
                    {coachAvatar ? <img src={coachAvatar} alt="" /> : <span>{buildInitials(coachName)}</span>}
                    <div>
                      <p>Your first lesson with {coachName}</p>
                      <strong>Help {coachFirstName} prepare for your session</strong>
                    </div>
                  </div>

                  {hasPrefill ? <div className="coach-prefill-banner">Pre-filled from your preferences — just check and confirm.</div> : null}

                  <div className="coach-form-group">
                    <label>Who is this lesson for?</label>
                    <div className="coach-chip-row">
                      {(["Myself", "My child"] as IntroWho[]).map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`coach-choice-chip${introForm.who === value ? " is-active" : ""}`}
                          onClick={() => setIntroForm((current) => ({ ...current, who: value }))}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="coach-form-group">
                    <label>Your current level</label>
                    <div className="coach-chip-row">
                      {LEVEL_OPTIONS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`coach-choice-chip${introForm.level === value ? " is-active" : ""}`}
                          onClick={() => setIntroForm((current) => ({ ...current, level: value }))}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="coach-form-group">
                    <label>What do you want to work on?</label>
                    <div className="coach-chip-row">
                      {INTRO_GOALS.map((goal) => {
                        const active = introForm.goals.includes(goal);
                        return (
                          <button
                            key={goal}
                            type="button"
                            className={`coach-choice-chip${active ? " is-active" : ""}`}
                            onClick={() =>
                              setIntroForm((current) => ({
                                ...current,
                                goals: active ? current.goals.filter((item) => item !== goal) : [...current.goals, goal],
                              }))
                            }
                          >
                            {goal}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="coach-form-group">
                    <label>Anything else?</label>
                    <textarea
                      value={introForm.note}
                      onChange={(event) => setIntroForm((current) => ({ ...current, note: event.target.value }))}
                      placeholder="Injuries, upcoming tournaments, doubles goals, match prep..."
                    />
                  </div>

                  <div className="coach-booking-step__footer">
                    <button
                      type="button"
                      className="coach-secondary-button"
                      onClick={() => setBookingStep("confirm")}
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      className="coach-primary-button"
                      disabled={!canContinueIntro}
                      onClick={() => setBookingStep("confirm")}
                    >
                      Continue to payment
                    </button>
                  </div>
                </div>
              ) : null}

              {bookingStep === "confirm" ? (
                <div className="coach-booking-step">
                  <div className="coach-booking-step__coach-card">
                    {coachAvatar ? <img src={coachAvatar} alt="" /> : <span>{buildInitials(coachName)}</span>}
                    <div>
                      <strong>{coachName}</strong>
                      <p>{certifications[0] ?? coachTitle}</p>
                    </div>
                  </div>

                  <div className="coach-summary-table">
                    <div><span>Type</span><strong>{selectedSlot.type === "private" ? "Private lesson" : selectedSlot.className ?? "Group lesson"}</strong></div>
                    <div><span>Date & time</span><strong>{selectedSlot.dayLabel} {selectedSlot.dateLabel} · {selectedSlot.timeLabel}</strong></div>
                    <div><span>Duration</span><strong>{selectedSlot.durationLabel}</strong></div>
                    <div><span>Location</span><strong>{selectedSlot.court}</strong></div>
                  </div>

                  <div className="coach-total-box">
                    <span>Total price</span>
                    <strong>{selectedSlot.priceLabel}</strong>
                  </div>

                  {privateCredits === 0 && selectedSlot.type === "private" ? (
                    <div className="coach-upsell-card">
                      <button type="button" className="coach-upsell-card__close">
                        <X size={14} />
                      </button>
                      <p>Save on repeat sessions</p>
                      <strong>Buy 10-pack</strong>
                      <span>Mock 15% discount until coach portal pricing is wired.</span>
                      <div className="coach-upsell-card__actions">
                        <button type="button" className="coach-primary-button coach-primary-button--small">Buy 10-pack</button>
                        <button type="button" className="coach-secondary-button coach-secondary-button--small">Just this lesson</button>
                      </div>
                    </div>
                  ) : null}

                  <button type="button" className="coach-primary-button" onClick={() => openPaymentSheet("card")}>
                    Continue to payment
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {paymentSheetOpen && selectedSlot ? (
          <div className="coach-payment-modal" role="dialog" aria-modal="true">
            <div className="coach-payment-modal__backdrop" onClick={closePaymentSheet} />
            <div className="coach-payment-modal__panel">
              <div className="coach-payment-modal__header">
                <div>
                  <p className="coach-payment-modal__eyebrow">Pay for lesson</p>
                  <h3 className="coach-payment-modal__title">Choose a payment method</h3>
                  {consumeError ? <p className="coach-payment-modal__error">{consumeError}</p> : null}
                </div>
                <button type="button" className="coach-payment-modal__close" onClick={closePaymentSheet} aria-label="Close payment selection">
                  ×
                </button>
              </div>

              {paymentMethodsLoading ? <p className="coach-payment-modal__hint">Loading your cards…</p> : null}
              {paymentMethodsError ? <p className="coach-payment-modal__error">{paymentMethodsError}</p> : null}
              {bookingError ? <p className="coach-payment-modal__error">{bookingError}</p> : null}

              <div className="coach-payment-modal__choices">
                <label className={`coach-payment-choice${paymentChoice === "credits" ? " coach-payment-choice--active" : ""}${!availableCredits ? " coach-payment-choice--disabled" : ""}`}>
                  <input
                    type="radio"
                    name="payment-choice"
                    value="credits"
                    checked={paymentChoice === "credits"}
                    onChange={() => setPaymentChoice("credits")}
                    disabled={!availableCredits}
                  />
                  <div className="coach-payment-choice__body">
                    <div className="coach-payment-choice__title-row">
                      <span className="coach-payment-choice__title">Use credits</span>
                    </div>
                    <p className="coach-payment-choice__subtitle">
                      {availableCredits ? `You have ${availableCredits} credit${availableCredits === 1 ? "" : "s"} available.` : "No eligible credits for this lesson type."}
                    </p>
                  </div>
                </label>

                <label className={`coach-payment-choice${paymentChoice === "apple-pay" ? " coach-payment-choice--active" : ""}`}>
                  <input
                    type="radio"
                    name="payment-choice"
                    value="apple-pay"
                    checked={paymentChoice === "apple-pay"}
                    onChange={() => setPaymentChoice("apple-pay")}
                  />
                  <div className="coach-payment-choice__body">
                    <div className="coach-payment-choice__title-row">
                      <Apple aria-hidden size={16} />
                      <span className="coach-payment-choice__title">Apple Pay</span>
                    </div>
                    <p className="coach-payment-choice__subtitle">Pay instantly with your Apple Pay wallet.</p>
                  </div>
                </label>

                <label className={`coach-payment-choice${paymentChoice === "card" ? " coach-payment-choice--active" : ""}`}>
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

              {paymentChoice === "card" && paymentMethods.length > 0 ? (
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
                          {expMonth && expYear ? <span className="coach-payment-card__expiry">{expMonth.toString().padStart(2, "0")}/{`${expYear}`.slice(-2)}</span> : null}
                        </div>
                        {method.is_default ? <span className="coach-payment-card__pill">Default</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="coach-payment-modal__price-breakdown">
                <span>Total: {selectedSlot.priceLabel}</span>
                <span>Type: {selectedSlot.type === "private" ? "Private lesson" : selectedSlot.className ?? "Group lesson"}</span>
                <span>Location: {selectedSlot.court}</span>
              </div>

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
                    (paymentChoice === "credits" && (!availableCredits || consumingCredits))
                  }
                  onClick={() => void confirmBookLesson()}
                >
                  {bookingInFlight || consumingCredits
                    ? "Booking…"
                    : paymentChoice === "credits"
                      ? "Confirm with credits"
                      : paymentChoice === "apple-pay"
                        ? "Confirm with Apple Pay"
                        : "Confirm & pay"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {bookingConfirmation ? (
          <BookingStatusModal
            open={Boolean(bookingConfirmation)}
            status={bookingConfirmation.status}
            data={bookingConfirmation.data}
            onClose={() => setBookingConfirmation(null)}
            onPrimary={() => setBookingConfirmation(null)}
            onSecondary={() => navigate("/")}
            onAddToCalendar={() => {
              if (selectedSlot) {
                downloadIcs(selectedSlot, coachName);
              }
            }}
            onShareWithFriends={() => {
              if (navigator.share) {
                void navigator.share({
                  title: bookingConfirmation.data.lessonTypeLabel,
                  text: `Join me for ${bookingConfirmation.data.lessonTypeLabel} with ${bookingConfirmation.data.coachName}.`,
                });
              }
            }}
          />
        ) : null}
      </div>
    </MainLayout>
  );
};

export default CoachProfilePage;
