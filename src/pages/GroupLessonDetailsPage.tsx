import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Clock,
  MapPin,
  Share2,
  Users,
  MessageCircle,
} from "lucide-react";
import moment from "moment";

import {
  fetchUpcomingGroupLessons,
  fetchUpcomingGroupLessonById,
  isActiveGroupLessonBookingStatus,
  mapUpcomingGroupLesson,
  mapUpcomingGroupLessonsResponse,
  type GroupLesson,
} from "../api/groupLessons";
import { fetchCoachProfile, type CoachProfileRecord } from "../api/coachProfile";
import { updatePlayerLesson } from "../api/player";
import {
  consumePackageCredits,
  fetchCoachPackages,
  fetchPackageCredits,
  getPackageCreditsRemaining,
  purchaseCoachPackage,
  type CoachPackage,
  type PackagePurchase,
} from "../api/playerPackages";
import { getPlayerStripePaymentMethods, type PlayerStripePaymentMethod } from "../api/playerStripe";
import MainLayout from "../components/MainLayout";
import { colors, typography } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { DEFAULT_POSITION, getStoredLocation } from "../utils/userLocation";
import { packageAllowsLessonCreditType } from "../utils/lessonPricing";
import { fetchPublicLessonById } from "../api/playerLessons";

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

const formatLevel = (level: number | null) =>
  level == null ? "All levels" : `NTRP ${level.toFixed(1)}`;

const parseMoney = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatMoney = (value: unknown) => {
  const amount = parseMoney(value);
  if (amount == null) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
};

const formatPackageLessonTypes = (types?: string[]) => {
  if (!Array.isArray(types) || types.length === 0) return "All lesson types";
  return types
    .map((type) => type.replace(/_/g, " "))
    .map((type) => type.charAt(0).toUpperCase() + type.slice(1))
    .join(", ");
};

const formatPackageValidity = (months?: number | null) => {
  if (!months || months <= 0) return "No expiry listed";
  return `Valid ${months} month${months === 1 ? "" : "s"}`;
};

const extractPaymentMethods = (payload: PlayerStripePaymentMethod[] | Record<string, unknown> | null | undefined) => {
  if (!payload) return [] as PlayerStripePaymentMethod[];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.payment_methods)) return payload.payment_methods as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.data)) return payload.data as PlayerStripePaymentMethod[];
  if (Array.isArray(payload.results)) return payload.results as PlayerStripePaymentMethod[];
  return [];
};

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

const isGenericCoachName = (value?: string | null) => {
  if (!value) {
    return true;
  }
  return value.trim().toLowerCase() === "coach";
};

const getCoachProfileName = (profile: CoachProfileRecord | null) => {
  if (!profile) return null;
  const record = profile as CoachProfileRecord & {
    full_name?: string;
    name?: string;
  };
  const value = record.fullName ?? record.full_name ?? record.name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const getCoachProfileAvatarUrl = (profile: CoachProfileRecord | null) => {
  if (!profile) return null;
  const record = profile as CoachProfileRecord & {
    profile_picture?: string;
    avatarUrl?: string;
  };
  const value = record.profilePicture ?? record.profile_picture ?? record.avatarUrl;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const data = (error as { data?: Record<string, unknown> }).data;
    const detail = data?.detail;
    const message = data?.message;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const formatParticipantStatus = (status?: number | string | null, paymentStatus?: number | string | null) => {
  if (isActiveGroupLessonBookingStatus(status, paymentStatus)) {
    return "Booked";
  }
  const numericStatus = typeof status === "number" ? status : Number(status);
  const numericPaymentStatus = typeof paymentStatus === "number" ? paymentStatus : Number(paymentStatus);
  if (numericStatus === 2 || numericPaymentStatus === 2) {
    return "Cancelled";
  }
  if (numericStatus === 0 || numericPaymentStatus === 0) {
    return "Pending";
  }
  return "Pending";
};

type CancelFlowState = "closed" | "confirm" | "success";

type GroupLessonsStateSnapshot = {
  coachFilter: string;
  levelFilter: string;
  formatFilter: string;
  selectedRadius: string;
  searchTerm: string;
  dateFilter:
    | { type: "all" }
    | { type: "day"; iso: string }
    | { type: "range"; start: string; end: string };
  rangeStartValue: string;
  rangeEndValue: string;
  useLocationFilter: boolean;
  sortBy: "soonest" | "price-low" | "price-high";
  locationFilter: {
    label: string;
    latitude: number;
    longitude: number;
    isCurrentLocation?: boolean;
  } | null;
  locationSearchTerm: string;
};

type GroupLessonDetailsRouteState = {
  groupLessonsState?: GroupLessonsStateSnapshot;
};

const GroupLessonDetailsPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<GroupLesson | null>(null);
  const [coachProfile, setCoachProfile] = useState<CoachProfileRecord | null>(null);
  const [relatedLessons, setRelatedLessons] = useState<GroupLesson[]>([]);
  const [cancelFlowState, setCancelFlowState] = useState<CancelFlowState>("closed");
  const [cancelInFlight, setCancelInFlight] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState<string | null>(null);
  const [credits, setCredits] = useState<PackagePurchase[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [packages, setPackages] = useState<CoachPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PlayerStripePaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<"credits" | "apple-pay" | "card">("card");
  const [creditsPackageOpen, setCreditsPackageOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null);
  const [packagePurchaseError, setPackagePurchaseError] = useState<string | null>(null);
  const [bookingWithCredits, setBookingWithCredits] = useState(false);
  const [purchasingPackage, setPurchasingPackage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const routeState = (location.state as GroupLessonDetailsRouteState | null | undefined) ?? null;
  const groupLessonsReturnState = routeState?.groupLessonsState ?? null;
  const authToken =
    user?.session?.access_token ??
    user?.access_token ??
    user?.token ??
    getStoredAuthToken({ preferScheme: "Token" }) ??
    getStoredAuthToken({ preferScheme: "token" });
  const isSignedIn = Boolean(authToken);
  const promptSignIn = useCallback(() => {
    navigate("/login", { state: { from: `${location.pathname}${location.search}` } });
  }, [location.pathname, location.search, navigate]);
  const goBackToGroupLessons = useCallback(() => {
    if (!isSignedIn) {
      navigate("/");
      return;
    }
    navigate("/group-lessons", {
      state: groupLessonsReturnState ? { groupLessonsState: groupLessonsReturnState } : undefined,
    });
  }, [groupLessonsReturnState, isSignedIn, navigate]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadLesson = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      const token = authToken;

      setIsLoading(true);
      setLoadError(null);

      try {
        try {
          const response = token
            ? await fetchUpcomingGroupLessonById({
                token,
                lessonId: id,
                signal: controller.signal,
              })
            : await fetchPublicLessonById({
                lessonId: id,
                signal: controller.signal,
              });

          if (cancelled) return;

          setLesson(response.lesson ? mapUpcomingGroupLesson(response.lesson) : null);
        } catch (error) {
          if (cancelled) return;
          if (!token) {
            throw error;
          }
          const position = getStoredLocation() ?? DEFAULT_POSITION;
          const fallbackResponse = await fetchUpcomingGroupLessons({
            token,
            perPage: 50,
            page: 1,
            position,
            signal: controller.signal,
          });

          if (cancelled) return;

          const mapped = mapUpcomingGroupLessonsResponse(fallbackResponse);
          const found = mapped.lessons.find((item) => item.id === String(id));
          setLesson(found ?? null);
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load lesson.");
        setLesson(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadLesson();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authToken, id]);

  useEffect(() => {
    if (!lesson) {
      setRelatedLessons([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadRelatedLessons = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setRelatedLessons([]);
        return;
      }

      try {
        const response = await fetchUpcomingGroupLessons({
          token,
          perPage: 50,
          page: 1,
          position: getStoredLocation() ?? DEFAULT_POSITION,
          signal: controller.signal,
        });

        if (cancelled) return;

        const mapped = mapUpcomingGroupLessonsResponse(response).lessons
          .filter(
            (candidate) =>
              candidate.id !== lesson.id &&
              candidate.title === lesson.title &&
              candidate.coachId === lesson.coachId,
          )
          .sort((left, right) => {
            const leftTime = left.startDateTime ? new Date(left.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
            const rightTime = right.startDateTime ? new Date(right.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
            return leftTime - rightTime;
          })
          .slice(0, 3);

        setRelatedLessons(mapped);
      } catch {
        if (!cancelled) {
          setRelatedLessons([]);
        }
      }
    };

    void loadRelatedLessons();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lesson]);

  useEffect(() => {
    const controller = new AbortController();

    if (!lesson?.coachId) {
      setCoachProfile(null);
      return () => controller.abort();
    }

    const token =
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "Token" }) ??
      getStoredAuthToken({ preferScheme: "token" });

    if (!token) {
      setCoachProfile(null);
      return () => controller.abort();
    }

    fetchCoachProfile(lesson.coachId, {
      token,
      signal: controller.signal,
    })
      .then((profile) => {
        if (controller.signal.aborted) return;
        setCoachProfile(profile ?? null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCoachProfile(null);
      });

    return () => controller.abort();
  }, [lesson?.coachId, user]);

  useEffect(() => {
    setCancelFlowState("closed");
    setCancelInFlight(false);
    setCancelError(null);
    setCancelSuccessMessage(null);
  }, [lesson?.id]);

  const refreshLesson = useCallback(async () => {
    if (!lesson?.id || !authToken) return;
    const response = await fetchUpcomingGroupLessonById({
      token: authToken,
      lessonId: lesson.id,
    });
    setLesson(mapUpcomingGroupLesson(response.lesson));
  }, [authToken, lesson?.id]);

  useEffect(() => {
    const controller = new AbortController();
    if (!lesson?.coachId || !authToken) {
      setCredits([]);
      setPackages([]);
      setPaymentMethods([]);
      return () => controller.abort();
    }

    setCreditsLoading(true);
    setCreditsError(null);
    fetchPackageCredits({
      token: authToken,
      coachId: lesson.coachId,
      includeExpired: false,
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        const groupCredits = (response.purchases ?? []).filter((purchase) => {
          const remaining = getPackageCreditsRemaining(purchase);
          if (remaining <= 0) return false;
          return packageAllowsLessonCreditType(purchase.lesson_types_allowed, "group");
        });
        setCredits(groupCredits);
        setSelectedCreditId(groupCredits[0]?.id != null ? String(groupCredits[0].id) : null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCredits([]);
        setCreditsError(error instanceof Error ? error.message : "Unable to load credits.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setCreditsLoading(false);
      });

    setPackagesLoading(true);
    setPackagesError(null);
    fetchCoachPackages({
      token: authToken,
      coachId: lesson.coachId,
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        setPackages((response.packages ?? []).filter((pkg) => pkg.is_active !== false));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPackages([]);
        setPackagesError(error instanceof Error ? error.message : "Unable to load packages.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPackagesLoading(false);
      });

    setPaymentMethodsLoading(true);
    getPlayerStripePaymentMethods(authToken)
      .then((payload) => {
        if (controller.signal.aborted) return;
        const methods = extractPaymentMethods(payload as Record<string, unknown>);
        setPaymentMethods(methods);
        setSelectedPaymentMethodId((current) => {
          if (current && methods.some((method) => method.id === current)) return current;
          const defaultMethod =
            methods.find((method) => method.is_default || method.default || method.default_for_currency) ??
            methods[0];
          return defaultMethod?.id ?? null;
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPaymentMethods([]);
        setSelectedPaymentMethodId(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentMethodsLoading(false);
      });

    return () => controller.abort();
  }, [authToken, lesson?.coachId]);

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

  const currentUserIdentity = useMemo(() => {
    const record = user as Record<string, unknown> | null;
    const sessionRecord = record?.session as Record<string, unknown> | undefined;
    let storedUserId: string | undefined;
    let storedEmail: string | undefined;
    let storedPhone: string | undefined;
    if (typeof window !== "undefined") {
      try {
        const loginRaw = localStorage.getItem("authLoginResponse");
        const profileRaw = localStorage.getItem("playerPersonalDetails");
        const login = loginRaw ? JSON.parse(loginRaw) : null;
        const profile = profileRaw ? JSON.parse(profileRaw) : null;
        const storedId =
          login?.user_id ??
          login?.profile?.user_id ??
          profile?.user_id ??
          profile?.id ??
          undefined;
        storedUserId = storedId != null ? String(storedId) : undefined;
        storedEmail =
          (login?.email as string | undefined) ??
          (profile?.email as string | undefined);
        storedPhone =
          (login?.phone as string | undefined) ??
          (profile?.phone as string | undefined);
      } catch {
        storedUserId = undefined;
        storedEmail = undefined;
        storedPhone = undefined;
      }
    }
    const candidate =
      record?.id ??
      record?.user_id ??
      record?.player_id ??
      record?.profile_id ??
      sessionRecord?.user_id ??
      sessionRecord?.id;
    const email =
      (record?.email as string | undefined) ??
      (record?.user_email as string | undefined) ??
      (sessionRecord?.email as string | undefined);
    const phone =
      (record?.phone as string | undefined) ??
      (record?.phone_number as string | undefined) ??
      (sessionRecord?.phone as string | undefined);
    return {
      id: candidate != null ? String(candidate) : storedUserId,
      email: email ? String(email).toLowerCase() : storedEmail?.toLowerCase(),
      phone: phone ? String(phone) : storedPhone ? String(storedPhone) : undefined,
    };
  }, [user]);

  const currentUserBookingStatus = useMemo(() => {
    const groupPlayers = lesson?.groupPlayers ?? [];
    if (!groupPlayers.length) return undefined;
    const playerRecord = groupPlayers.find((player) => {
      if (currentUserIdentity.id && player.playerId != null) {
        if (String(player.playerId) === currentUserIdentity.id) return true;
      }
      if (currentUserIdentity.email && player.email) {
        if (player.email.toLowerCase() === currentUserIdentity.email) return true;
      }
      if (currentUserIdentity.phone && player.phone) {
        if (String(player.phone) === currentUserIdentity.phone) return true;
      }
      return false;
    });
    if (!playerRecord) return undefined;
    return {
      status: playerRecord.status,
      paymentStatus: playerRecord.paymentStatus,
      participantId: playerRecord.participantId ?? playerRecord.id,
    };
  }, [currentUserIdentity, lesson?.groupPlayers]);

  const availableCredits = useMemo(
    () => credits.reduce((sum, credit) => sum + getPackageCreditsRemaining(credit), 0),
    [credits],
  );

  useEffect(() => {
    if (availableCredits > 0 && selectedCreditId) {
      setPaymentChoice("credits");
      return;
    }
    setPaymentChoice((current) => (current === "credits" ? "card" : current));
  }, [availableCredits, selectedCreditId]);

  const packageOptions = useMemo(() => {
    return packages
      .filter((pkg) => {
        if (!pkg.lesson_count || pkg.lesson_count <= 0) return false;
        return packageAllowsLessonCreditType(pkg.lesson_types_allowed, "group");
      })
      .sort((a, b) => a.lesson_count - b.lesson_count);
  }, [packages]);
  const bestValuePackage = packageOptions.reduce<CoachPackage | null>((best, pkg) => {
    const total = parseMoney(pkg.total_price);
    const bestTotal = best ? parseMoney(best.total_price) : null;
    if (total == null) return best;
    if (!best || bestTotal == null) return pkg;
    return total / pkg.lesson_count < bestTotal / best.lesson_count ? pkg : best;
  }, null);
  const selectedPackage =
    packageOptions.find((pkg) => String(pkg.id) === selectedPackageId) ??
    bestValuePackage ??
    packageOptions[0] ??
    null;

  useEffect(() => {
    if (selectedPackageId || packageOptions.length === 0) return;
    const defaultPackage = bestValuePackage ?? packageOptions[0];
    setSelectedPackageId(String(defaultPackage.id));
  }, [bestValuePackage, packageOptions, selectedPackageId]);

  const handleBookWithCredits = useCallback(async () => {
    if (!lesson?.id || !lesson.coachId || !authToken || !selectedCreditId) return;
    if (!currentUserBookingStatus?.participantId) {
      setPackagePurchaseError("We couldn't identify your group booking. Please refresh and try again.");
      return;
    }
    setBookingWithCredits(true);
    setPackagePurchaseError(null);
    try {
      await consumePackageCredits({
        token: authToken,
        coachId: lesson.coachId,
        lessonType: "group",
        lessonId: lesson.id,
        purchaseId: selectedCreditId,
        participantId: currentUserBookingStatus.participantId,
      });
      await updatePlayerLesson({
        token: authToken,
        lessonId: lesson.id,
        status: "CONFIRMED",
      });
      await refreshLesson();
    } catch (error) {
      setPackagePurchaseError(error instanceof Error ? error.message : "Unable to apply credits.");
    } finally {
      setBookingWithCredits(false);
    }
  }, [authToken, currentUserBookingStatus?.participantId, lesson?.coachId, lesson?.id, refreshLesson, selectedCreditId]);

  const handleBuyPackageAndApply = useCallback(async () => {
    if (!lesson?.id || !lesson.coachId || !authToken || !selectedPackage) return;
    if (!currentUserBookingStatus?.participantId) {
      setPackagePurchaseError("We couldn't identify your group booking. Please refresh and try again.");
      return;
    }
    setPurchasingPackage(true);
    setPackagePurchaseError(null);
    try {
      const defaultMethod =
        paymentMethods.find((method) => method.id === selectedPaymentMethodId) ??
        paymentMethods.find((method) => method.is_default || method.default || method.default_for_currency) ??
        paymentMethods[0];
      if (!defaultMethod?.id) {
        throw new Error("Add a saved card at checkout before buying credits.");
      }
      const purchaseResponse = await purchaseCoachPackage({
        token: authToken,
        packageId: selectedPackage.id,
        paymentMethodId: defaultMethod.id,
      });
      await consumePackageCredits({
        token: authToken,
        coachId: lesson.coachId,
        lessonType: "group",
        lessonId: lesson.id,
        purchaseId: purchaseResponse.purchase?.id,
        participantId: currentUserBookingStatus.participantId,
      });
      await updatePlayerLesson({
        token: authToken,
        lessonId: lesson.id,
        status: "CONFIRMED",
      });
      if (purchaseResponse.purchase?.id != null) {
        setSelectedCreditId(String(purchaseResponse.purchase.id));
      }
      setCreditsPackageOpen(false);
      const refreshed = await fetchPackageCredits({
        token: authToken,
        coachId: lesson.coachId,
        includeExpired: false,
      });
      const groupCredits = (refreshed.purchases ?? []).filter((purchase) => {
          const remaining = getPackageCreditsRemaining(purchase);
          if (remaining <= 0) return false;
          return packageAllowsLessonCreditType(purchase.lesson_types_allowed, "group");
        });
      setCredits(groupCredits);
      const boughtCredit = groupCredits.find((credit) => String(credit.id) === String(purchaseResponse.purchase?.id));
      setSelectedCreditId(boughtCredit?.id != null ? String(boughtCredit.id) : groupCredits[0]?.id != null ? String(groupCredits[0].id) : null);
      await refreshLesson();
    } catch (error) {
      setPackagePurchaseError(error instanceof Error ? error.message : "Unable to reserve and apply credits.");
    } finally {
      setPurchasingPackage(false);
    }
  }, [authToken, currentUserBookingStatus?.participantId, lesson?.coachId, lesson?.id, paymentMethods, refreshLesson, selectedPackage, selectedPaymentMethodId]);

  if (isLoading) {
    return (
      <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true} pageClassName="group-lesson-details-page">
        <div className="group-lesson-details" style={themeVars}>
          <div className="group-lesson-details__inner group-lesson-details__inner--empty">
            <div className="group-lesson-details__empty">
              <h1>Loading session…</h1>
              <p>Hang tight while we load the details.</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loadError || !lesson) {
    return (
      <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true} pageClassName="group-lesson-details-page">
        <div className="group-lesson-details" style={themeVars}>
          <div className="group-lesson-details__inner group-lesson-details__inner--empty">
            <Link
              to="/group-lessons"
              state={groupLessonsReturnState ? { groupLessonsState: groupLessonsReturnState } : undefined}
              className="group-lesson-details__back-link"
            >
              <ArrowLeft aria-hidden /> Back to group lessons
            </Link>
            <div className="group-lesson-details__empty">
              <h1>{loadError ? "We couldn’t load that session" : "We couldn’t find that session"}</h1>
              <p>
                {loadError
                  ? loadError
                  : "The lesson may have been filled or removed. Browse the latest sessions to pick another time."}
              </p>
              {isSignedIn ? (
                <Link
                  to="/group-lessons"
                  state={groupLessonsReturnState ? { groupLessonsState: groupLessonsReturnState } : undefined}
                  className="group-lesson-details__empty-action"
                >
                  Explore group lessons
                </Link>
              ) : (
                <button type="button" className="group-lesson-details__empty-action" onClick={promptSignIn}>
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const isBooked = isActiveGroupLessonBookingStatus(
    currentUserBookingStatus?.status,
    currentUserBookingStatus?.paymentStatus,
  );
  const sourceLesson = lesson.sourceLesson as Record<string, unknown> | undefined;
  const bookedCountRaw = Number(sourceLesson?.booked_count ?? lesson.participants.length);
  const confirmedCount = Number.isFinite(bookedCountRaw) ? bookedCountRaw : lesson.participants.length;
  const participantRows = (lesson.groupPlayers?.length ? lesson.groupPlayers : lesson.participants).map((participant, index) => ({
    id: String(participant.playerId ?? participant.id ?? `${lesson.id}-${index}`),
    name: "name" in participant && typeof participant.name === "string" ? participant.name : "Player",
    avatarUrl: "avatarUrl" in participant && typeof participant.avatarUrl === "string" ? participant.avatarUrl : undefined,
    paymentStatus: "paymentStatus" in participant ? participant.paymentStatus : undefined,
    status: "status" in participant ? participant.status : undefined,
  }));
  const spotsRemaining = Math.max(Math.min(lesson.availableSpots, lesson.totalSpots - confirmedCount), 0);
  const timeRange = lesson.startDateTime && lesson.endDateTime
    ? (() => {
        const start = moment.utc(lesson.startDateTime);
        const end = moment.utc(lesson.endDateTime);
        if (start.isValid() && end.isValid()) {
          return `${start.format("h:mm A")} – ${end.format("h:mm A")}`;
        }
        return buildTimeRangeLabel(lesson.startTime, lesson.durationMinutes);
      })()
    : buildTimeRangeLabel(lesson.startTime, lesson.durationMinutes);
  const levelLabel = formatLevel(lesson.level);
  const coachName =
    getCoachProfileName(coachProfile) ??
    (isGenericCoachName(lesson.coachName) ? undefined : lesson.coachName) ??
    "Coach";
  const coachAvatar = getCoachProfileAvatarUrl(coachProfile) ?? lesson.coachAvatarUrl ?? "";
  const dateLabel = lesson.startDateTime
    ? moment.utc(lesson.startDateTime).format("dddd, MMMM D")
    : lesson.date;
  const participantsPreview = participantRows.slice(0, 5);
  const hiddenParticipantsCount = Math.max(participantRows.length - participantsPreview.length, 0);
  const availabilityLabel =
    spotsRemaining === 0
      ? "Full — join waitlist"
      : spotsRemaining <= 2
        ? `Only ${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} left`
        : `${spotsRemaining} spots available`;
  const availabilityToneClass =
    spotsRemaining === 0
      ? "is-full"
      : spotsRemaining <= 2
        ? "is-limited"
        : "is-open";
  const lessonStartMoment = lesson.startDateTime ? moment.utc(lesson.startDateTime) : null;
  const isCancellationWindowClosed = Boolean(lessonStartMoment?.isValid() && lessonStartMoment.diff(moment.utc(), "hours", true) < 24);
  const whatToBring = lesson.highlights?.length ? lesson.highlights : ["Racket", "Water", "Tennis shoes"];
  const heroBandLabel = lesson.startDateTime
    ? `${moment.utc(lesson.startDateTime).format("dddd").toUpperCase()} · ${moment
        .utc(lesson.startDateTime)
        .format("MMM D")
        .toUpperCase()}`
    : dateLabel.toUpperCase();
  const availabilityMetaLabel =
    spotsRemaining === 0
      ? "Full — join waitlist"
      : spotsRemaining <= 2
        ? `Only ${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} left`
        : `${spotsRemaining} spots available`;
  const groupCoachFee = parseMoney(lesson.pricePerPlayer) ?? 0;
  const groupCreditFee = Math.round(groupCoachFee * 0.03 * 100) / 100;
  const groupServiceFee = 1;
  const groupUsesCredits = paymentChoice === "credits" && availableCredits > 0 && selectedCreditId != null;
  const groupTotalDue = groupUsesCredits
    ? groupCoachFee + groupServiceFee
    : groupCoachFee + groupCreditFee + groupServiceFee;
  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    if (!shareUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: lesson.title,
          text: `Join ${lesson.title} with ${coachName}`,
          url: shareUrl,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // no-op fallback
    }
  };

  const closeCancelFlow = () => {
    if (cancelInFlight) return;
    setCancelFlowState("closed");
    setCancelError(null);
  };

  const handleCancelBooking = async () => {
    if (!lesson?.id) return;
    const token =
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "Token" }) ??
      getStoredAuthToken({ preferScheme: "token" });

    if (!token) {
      setCancelError("Sign in to cancel this booking.");
      return;
    }

    if (isCancellationWindowClosed) {
      setCancelError("Cancellation is only available more than 24 hours before the lesson starts.");
      return;
    }

    setCancelInFlight(true);
    setCancelError(null);

    try {
      const response = await updatePlayerLesson({
        token,
        lessonId: lesson.id,
        status: "CANCELLED",
      });
      setCancelSuccessMessage(
        getErrorMessage(
          { data: response as Record<string, unknown> },
          "Your group lesson booking has been cancelled and any refund has been initiated.",
        ),
      );
      setCancelFlowState("success");
      setLesson((current) =>
        current
          ? {
              ...current,
              availableSpots: Math.min(current.availableSpots + 1, current.totalSpots),
              participants: current.participants.slice(0, Math.max(current.participants.length - 1, 0)),
            }
          : current,
      );
    } catch (error) {
      setCancelError(getErrorMessage(error, "Unable to cancel this booking right now."));
    } finally {
      setCancelInFlight(false);
    }
  };

  const handleCancelSuccessClose = () => {
    navigate("/group-lessons", {
      state: groupLessonsReturnState ? { groupLessonsState: groupLessonsReturnState } : undefined,
    });
  };

  const cancelFlowOverlay =
    cancelFlowState === "closed" ? null : (
      <div className={`group-lesson-details__cancel-flow group-lesson-details__cancel-flow--${cancelFlowState}`}>
        <div
          className="group-lesson-details__cancel-backdrop"
          onClick={cancelFlowState === "confirm" ? closeCancelFlow : undefined}
        />
        <div className="group-lesson-details__cancel-dialog" role="dialog" aria-modal="true">
          {cancelFlowState === "confirm" ? (
            <>
              <div className="group-lesson-details__cancel-header">
                <button
                  type="button"
                  className="group-lesson-details__cancel-back"
                  onClick={closeCancelFlow}
                  aria-label="Back"
                >
                  <ArrowLeft aria-hidden />
                </button>
                <div className="group-lesson-details__cancel-title">Cancel booking</div>
              </div>
              <div className="group-lesson-details__cancel-body">
                <h2 className="group-lesson-details__cancel-headline">Cancel and get a full refund</h2>
                <p className="group-lesson-details__cancel-copy">
                  You&apos;re more than 24 hours out, so your booking can be cancelled and any eligible refund will be initiated.
                </p>

                <div className="group-lesson-details__cancel-session-card">
                  <h3>{lesson.title}</h3>
                  <div className="group-lesson-details__cancel-session-list">
                    <div>
                      <span aria-hidden>📅</span>
                      <span>{dateLabel}</span>
                    </div>
                    <div>
                      <span aria-hidden>🕐</span>
                      <span>
                        {timeRange} · {lesson.durationMinutes} min
                      </span>
                    </div>
                    <div>
                      <span aria-hidden>📍</span>
                      <span>{lesson.locationName}</span>
                    </div>
                  </div>
                </div>

                <div className="group-lesson-details__cancel-refund-card">
                  <span aria-hidden>✓</span>
                  <div>
                    <strong>Refund initiated</strong>
                    <p>
                      Your participation will be cancelled and any refund will be sent back to the original payment method.
                    </p>
                  </div>
                </div>

                <div className="group-lesson-details__cancel-note">
                  <span aria-hidden>👋</span>
                  <p>Any waitlisted player can be notified that a spot has opened.</p>
                </div>

                {cancelError ? <p className="group-lesson-details__cancel-error">{cancelError}</p> : null}
              </div>
              <div className="group-lesson-details__cancel-footer">
                <button
                  type="button"
                  className="group-lesson-details__cancel-secondary"
                  onClick={closeCancelFlow}
                  disabled={cancelInFlight}
                >
                  Keep booking
                </button>
                <button
                  type="button"
                  className="group-lesson-details__cancel-primary"
                  onClick={() => void handleCancelBooking()}
                  disabled={cancelInFlight || isCancellationWindowClosed}
                >
                  {cancelInFlight ? "Cancelling..." : "Yes, cancel"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="group-lesson-details__cancel-header group-lesson-details__cancel-header--centered">
                <div className="group-lesson-details__cancel-title">Booking cancelled</div>
              </div>
              <div className="group-lesson-details__cancel-body group-lesson-details__cancel-body--success">
                <div className="group-lesson-details__cancel-success-mark" aria-hidden>
                  ✓
                </div>
                <h2 className="group-lesson-details__cancel-headline">Booking cancelled</h2>
                <p className="group-lesson-details__cancel-copy">
                  Your {lesson.title} on {lessonStartMoment?.isValid() ? lessonStartMoment.format("dddd") : dateLabel} has been cancelled.
                </p>
                <div className="group-lesson-details__cancel-refund-card">
                  <span aria-hidden>💰</span>
                  <div>
                    <strong>Refund processing</strong>
                    <p>
                      {cancelSuccessMessage ??
                        "If a payment was taken, the refund has been initiated to the original payment method."}
                    </p>
                  </div>
                </div>
                <div className="group-lesson-details__cancel-success-card">
                  <strong>Looking for another class?</strong>
                  <p>Browse upcoming sessions or check out other dates for this class.</p>
                </div>
              </div>
              <div className="group-lesson-details__cancel-footer group-lesson-details__cancel-footer--single">
                <button
                  type="button"
                  className="group-lesson-details__cancel-primary"
                  onClick={handleCancelSuccessClose}
                >
                  Find another class
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );

  return (
    <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true} pageClassName="group-lesson-details-page">
      <div className="group-lesson-details" style={themeVars}>
        <div className="group-lesson-details__inner">
          <div className="group-lesson-details__shell">
            {cancelFlowOverlay}
            <div className="group-lesson-details__topbar">
              <button
                type="button"
                className="group-lesson-details__back-link"
                onClick={goBackToGroupLessons}
              >
                <ArrowLeft aria-hidden />
                <span className="group-lesson-details__back-label">Back to group lessons</span>
              </button>
              <div className="group-lesson-details__topbar-title">Class details</div>
              <div className="group-lesson-details__topbar-actions">
                <button type="button" className="group-lesson-details__topbar-action" onClick={() => void handleShare()}>
                  <Share2 aria-hidden />
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  className="group-lesson-details__topbar-close"
                  onClick={goBackToGroupLessons}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="group-lesson-details__layout">
              <section className="group-lesson-details__content">
                <header className="group-lesson-details__hero">
                  <div className="group-lesson-details__badge-row">
                    <span className="group-lesson-details__hero-badge group-lesson-details__hero-badge--primary">
                      {heroBandLabel}
                    </span>
                    <span className="group-lesson-details__hero-badge group-lesson-details__hero-badge--level">
                      {levelLabel}
                    </span>
                    <span className="group-lesson-details__hero-badge">{lesson.focus}</span>
                    {lesson.courtSurface ? (
                      <span className="group-lesson-details__hero-badge">{lesson.courtSurface} court</span>
                    ) : null}
                  </div>
                  <div className="group-lesson-details__hero-body">
                    <h1 className="group-lesson-details__hero-title">{lesson.title}</h1>
                    <p className="group-lesson-details__hero-copy">{lesson.description}</p>
                    <div className="group-lesson-details__hero-meta">
                      <div className="group-lesson-details__hero-meta-item">
                        <Clock aria-hidden />
                        <span>
                          {timeRange} · {lesson.durationMinutes} min
                        </span>
                      </div>
                      <div className="group-lesson-details__hero-meta-item">
                        <MapPin aria-hidden />
                        <span>
                          {lesson.locationName}
                          {lesson.distanceMiles > 0 ? ` · ${lesson.distanceMiles.toFixed(1)} mi` : " · nearby"}
                        </span>
                      </div>
                      <div className="group-lesson-details__hero-meta-item group-lesson-details__hero-meta-item--spots">
                        <span className="group-lesson-details__hero-emoji" aria-hidden>👥</span>
                        <span className={`group-lesson-details__hero-availability ${availabilityToneClass}`}>
                          {availabilityMetaLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </header>

                {lesson.cancelled ? (
                  <section className="group-lesson-details__section group-lesson-details__section--cancelled">
                    <div className="group-lesson-details__cancelled-banner" role="alert">
                      <div className="group-lesson-details__cancelled-icon" aria-hidden>
                        ⚠
                      </div>
                      <div className="group-lesson-details__cancelled-copy">
                        <strong>This lesson has been cancelled</strong>
                        <span>The coach cancelled this class, so it can no longer be booked.</span>
                      </div>
                    </div>
                  </section>
                ) : null}

                {isBooked && !lesson.cancelled ? (
                  <section className="group-lesson-details__section group-lesson-details__section--booked">
                    <div className="group-lesson-details__booked-banner">
                      <div className="group-lesson-details__booked-icon" aria-hidden>
                        ✓
                      </div>
                      <div className="group-lesson-details__booked-copy">
                        <strong>You&apos;re booked</strong>
                        <span>Your spot is confirmed for this class.</span>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="group-lesson-details__section">
                  <h2 className="group-lesson-details__section-label">Who's joining</h2>
                  <div className="group-lesson-details__card">
                    {confirmedCount > 0 ? (
                      <>
                        <div className="group-lesson-details__participants-head">
                          <div className="group-lesson-details__participants-stack" aria-hidden>
                            {participantsPreview.map((participant) => (
                              <span
                                key={participant.id}
                                className="group-lesson-details__participants-stack-item"
                              >
                                {buildInitials(participant.name).slice(0, 1)}
                              </span>
                            ))}
                            {hiddenParticipantsCount > 0 ? (
                              <span className="group-lesson-details__participants-stack-more">
                                +{hiddenParticipantsCount}
                              </span>
                            ) : null}
                          </div>
                          <div className="group-lesson-details__participants-summary">
                            <strong>
                              {confirmedCount} of {lesson.totalSpots} players booked
                            </strong>
                            <span className={spotsRemaining > 0 ? "is-open" : "is-full"}>
                              {spotsRemaining > 0
                                ? `${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} still open`
                                : "Class is full"}
                            </span>
                          </div>
                        </div>
                        <ul className="group-lesson-details__participants-list">
                          {participantRows.map((participant) => (
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
                                {participant.skillLevel || participant.focusArea ? (
                                  <span className="group-lesson-details__participant-meta">
                                    {participant.skillLevel}
                                    {participant.focusArea ? `${participant.skillLevel ? " • " : ""}${participant.focusArea}` : ""}
                                  </span>
                                ) : null}
                                {participant.joinedLabel ? (
                                  <span className="group-lesson-details__participant-joined">
                                    {participant.joinedLabel}
                                  </span>
                                ) : null}
                              </div>
                              <span className="group-lesson-details__participant-status">
                                {formatParticipantStatus(participant.status, participant.paymentStatus)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <div className="group-lesson-details__participants-empty">
                        <p>Be the first to book. {spotsRemaining} spots are available right now.</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="group-lesson-details__section">
                  <h2 className="group-lesson-details__section-label">What to bring</h2>
                  <div className="group-lesson-details__bring-list">
                    {whatToBring.map((item) => (
                      <span key={item} className="group-lesson-details__bring-chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="group-lesson-details__section">
                  <h2 className="group-lesson-details__section-label">Location</h2>
                  <div className="group-lesson-details__card">
                    <h3 className="group-lesson-details__card-title">{lesson.locationName}</h3>
                    <p className="group-lesson-details__card-copy">{lesson.locationCity}</p>
                    <ul className="group-lesson-details__location-list">
                      <li>🎾 {lesson.court ? `Court ${lesson.court}` : "Court assignment shared before class"}</li>
                      <li>📍 {lesson.distanceMiles > 0 ? `${lesson.distanceMiles.toFixed(1)} mi away` : "Nearby location"}</li>
                    </ul>
                    <a
                      className="group-lesson-details__secondary-action"
                      href={`https://maps.google.com/?q=${encodeURIComponent(lesson.locationName)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get directions
                    </a>
                  </div>
                </section>

                <section className="group-lesson-details__section">
                  <h2 className="group-lesson-details__section-label">Your coach</h2>
                  <div className="group-lesson-details__card">
                    <div className="group-lesson-details__coach-panel">
                      {coachAvatar ? (
                        <img
                          className="group-lesson-details__coach-avatar"
                          src={coachAvatar}
                          alt=""
                        />
                      ) : (
                        <span className="group-lesson-details__coach-avatar--placeholder" aria-hidden>
                          {buildInitials(coachName)}
                        </span>
                      )}
                      <div className="group-lesson-details__coach-meta">
                        <p className="group-lesson-details__coach-name">{coachName}</p>
                        <div className="group-lesson-details__coach-cert-list">
                          <span className="group-lesson-details__coach-cert">Matchplay Coach</span>
                          <span className="group-lesson-details__coach-cert">{lesson.skillLabel}</span>
                        </div>
                      </div>
                    </div>
                    <p className="group-lesson-details__card-copy">
                      {lesson.focus}. Expect a clear structure, live coaching, and a strong emphasis on quality reps.
                    </p>
                    <Link to={`/coaches/${lesson.coachId}`} className="group-lesson-details__coach-link">
                      View full profile →
                    </Link>
                  </div>
                </section>

                {relatedLessons.length > 0 ? (
                  <section className="group-lesson-details__section">
                    <h2 className="group-lesson-details__section-label">Other dates for this class</h2>
                    <div className="group-lesson-details__related-list">
                      {relatedLessons.map((relatedLesson) => {
                        const relatedDateLabel = relatedLesson.startDateTime
                          ? moment.utc(relatedLesson.startDateTime).format("dddd, MMMM D")
                          : relatedLesson.date;
                        const relatedSpots = Math.max(relatedLesson.availableSpots, 0);
                        const relatedPrice = relatedLesson.pricePerPlayer.replace(" per player", "");

                        return (
                          <button
                            key={relatedLesson.id}
                            type="button"
                            className="group-lesson-details__related-card"
                            onClick={() => {
                              if (!isSignedIn) {
                                promptSignIn();
                                return;
                              }
                              navigate(`/booking/confirm?groupLesson=${relatedLesson.id}`, {
                                state: {
                                  groupLessonId: relatedLesson.id,
                                  groupLessonsState: groupLessonsReturnState,
                                },
                              });
                            }}
                          >
                            <div className="group-lesson-details__related-copy">
                              <strong>{relatedDateLabel.toUpperCase()}</strong>
                              <span>
                                {relatedLesson.startTime} · {relatedSpots} spot{relatedSpots === 1 ? "" : "s"} left
                              </span>
                            </div>
                            <span className="group-lesson-details__related-price">{relatedPrice}</span>
                            <span className="group-lesson-details__related-arrow" aria-hidden>
                              →
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </section>

              <aside className="group-lesson-details__booking-rail">
                <div className="group-lesson-details__booking-card">
                  {isBooked ? (
                    <>
                      <div className="group-lesson-details__rail-booked-banner">
                        <div className="group-lesson-details__booked-icon" aria-hidden>
                          ✓
                        </div>
                        <div className="group-lesson-details__booked-copy">
                          <strong>You&apos;re booked</strong>
                          <span>Your place is confirmed.</span>
                        </div>
                      </div>

                      <div className="group-lesson-details__booking-meta">
                        <div className="group-lesson-details__booking-meta-item">
                          <CalendarDays aria-hidden />
                          <span>{dateLabel}</span>
                        </div>
                        <div className="group-lesson-details__booking-meta-item">
                          <Clock aria-hidden />
                          <span>
                            {timeRange} · {lesson.durationMinutes} min
                          </span>
                        </div>
                        <div className="group-lesson-details__booking-meta-item">
                          <MapPin aria-hidden />
                          <span>{lesson.locationName}</span>
                        </div>
                        <div className="group-lesson-details__booking-meta-item">
                          <Users aria-hidden />
                          <span>with {coachName}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="group-lesson-details__message-action"
                        onClick={() => navigate(`/coaches/${lesson.coachId}`)}
                      >
                        <MessageCircle aria-hidden />
                        <span>Message coach</span>
                      </button>

                  <button
                    type="button"
                    className="group-lesson-details__cancel-action"
                    onClick={() => {
                      setCancelError(null);
                      setCancelFlowState("confirm");
                    }}
                  >
                    Cancel booking
                  </button>

                      <p className="group-lesson-details__checkout-caption group-lesson-details__checkout-caption--centered">
                        {isCancellationWindowClosed
                          ? "Cancellation is no longer available within 24 hours of class."
                          : "Free cancellation up to 24 hours before class"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="group-lesson-details__booking-label">
                        {isSignedIn ? "Confirm this session" : "Sign in to book"}
                      </p>
                      <p className="group-lesson-details__booking-price">{formatMoney(groupTotalDue)}</p>
                      <p className="group-lesson-details__booking-price-caption">{lesson.title}</p>

                      <div className="group-lesson-details__booking-meta">
                        <div className="group-lesson-details__booking-meta-item">
                          <CalendarDays aria-hidden />
                          <span>{dateLabel}</span>
                        </div>
                        <div className="group-lesson-details__booking-meta-item">
                          <Clock aria-hidden />
                          <span>
                            {timeRange} · {lesson.durationMinutes} min
                          </span>
                        </div>
                        <div className="group-lesson-details__booking-meta-item">
                          <MapPin aria-hidden />
                          <span>{lesson.locationName}</span>
                        </div>
                        <div className="group-lesson-details__booking-meta-item">
                          <Users aria-hidden />
                          <span>with {coachName}</span>
                        </div>
                      </div>

                      <div className="group-lesson-details__booking-pill group-lesson-details__booking-pill--payment">
                        {isSignedIn ? "Needs payment" : "Sign in required"}
                      </div>

                      <div className="group-lesson-details__price-breakdown">
                        <div><span>Coach fee</span><strong>${groupCoachFee.toFixed(2)}</strong></div>
                        {!groupUsesCredits ? (
                          <div><span>Credit fee</span><strong>${groupCreditFee.toFixed(2)}</strong></div>
                        ) : null}
                        <div><span>Service fee</span><strong>${groupServiceFee.toFixed(2)}</strong></div>
                      </div>

                      {isSignedIn ? (
                      <div className="group-lesson-details__payment-panel">
                        <p className="group-lesson-details__status-pending">Choose how you want to pay.</p>

                        <div className="group-lesson-details__payment-choice">
                          {availableCredits > 0 ? (
                            <label className={`group-lesson-details__payment-option${paymentChoice === "credits" ? " is-selected" : ""}`}>
                              <input
                                type="radio"
                                name="group-payment-choice"
                                checked={paymentChoice === "credits"}
                                onChange={() => setPaymentChoice("credits")}
                                disabled={!selectedCreditId}
                              />
                              <span>🎟️</span>
                              <span>
                                {availableCredits} group credit{availableCredits === 1 ? "" : "s"} available
                              </span>
                            </label>
                          ) : null}
                          <label className={`group-lesson-details__payment-option${paymentChoice === "apple-pay" ? " is-selected" : ""}`}>
                            <input
                              type="radio"
                              name="group-payment-choice"
                              checked={paymentChoice === "apple-pay"}
                              onChange={() => setPaymentChoice("apple-pay")}
                            />
                            <span aria-hidden>🍎</span>
                            <span>Apple Pay</span>
                          </label>
                          <label className={`group-lesson-details__payment-option${paymentChoice === "card" ? " is-selected" : ""}`}>
                            <input
                              type="radio"
                              name="group-payment-choice"
                              checked={paymentChoice === "card"}
                              onChange={() => setPaymentChoice("card")}
                            />
                            <span>Credit card</span>
                          </label>
                        </div>

                        {paymentChoice === "apple-pay" ? (
                          <div className="group-lesson-details__payment-block">
                            <p>Continue to checkout to complete Apple Pay.</p>
                          </div>
                        ) : null}

                        {paymentChoice === "card" ? (
                          <div className="group-lesson-details__payment-block">
                            {paymentMethodsLoading ? <p>Loading cards...</p> : null}
                            {paymentMethods.length > 0 ? (
                              <select
                                value={selectedPaymentMethodId ?? ""}
                                onChange={(event) => setSelectedPaymentMethodId(event.target.value)}
                              >
                                {paymentMethods.map((method) => {
                                  const card = method.card;
                                  const label = `${card?.brand ?? "Card"} .... ${card?.last4 ?? ""}`;
                                  return (
                                    <option key={method.id} value={method.id}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>
                            ) : !paymentMethodsLoading ? (
                              <p>No saved card yet. Continue to checkout to add one.</p>
                            ) : null}
                          </div>
                        ) : null}

                        {availableCredits === 0 ? (
                          <div className={`group-lesson-details__credits-package${creditsPackageOpen ? " is-open" : ""}`}>
                            <button
                              type="button"
                              className="group-lesson-details__credits-package-toggle"
                              onClick={() => setCreditsPackageOpen((open) => !open)}
                              aria-expanded={creditsPackageOpen}
                            >
                              <span aria-hidden>🎟️</span>
                              <span>
                                <strong>Reserve a lesson package</strong>
                                <small>No charge until first confirmed lesson</small>
                              </span>
                              <ChevronDown aria-hidden />
                            </button>
                            {creditsPackageOpen ? (
                              <div className="group-lesson-details__credits-package-panel">
                                <p>Reserve sessions now. Your card is charged only when this lesson is confirmed.</p>
                                {packagesLoading ? <p>Loading packages...</p> : null}
                                {packagesError ? <p className="group-lesson-details__checkout-error">{packagesError}</p> : null}
                                {!packagesLoading && !packagesError && packageOptions.length === 0 ? <p>No group packages are available right now.</p> : null}
                                {packageOptions.map((lessonPackage) => {
                                  const total = parseMoney(lessonPackage.total_price);
                                  const perCredit = total != null ? total / lessonPackage.lesson_count : null;
                                  const isSelectedPackage = selectedPackage?.id === lessonPackage.id;
                                  const isBestValue = bestValuePackage?.id === lessonPackage.id;
                                  return (
                                    <button
                                      type="button"
                                      key={lessonPackage.id}
                                      className={`group-lesson-details__package-tier${isSelectedPackage ? " is-selected" : ""}`}
                                      onClick={() => setSelectedPackageId(String(lessonPackage.id))}
                                    >
                                      <span>
                                        <strong>
                                          {lessonPackage.name || `${lessonPackage.lesson_count} lesson package`}
                                          {isBestValue ? <em>Best value</em> : null}
                                        </strong>
                                        {lessonPackage.description ? <small>{lessonPackage.description}</small> : null}
                                        <small>
                                          {lessonPackage.lesson_count} credits ·{" "}
                                          {perCredit != null ? `${formatMoney(perCredit)}/credit` : formatPackageLessonTypes(lessonPackage.lesson_types_allowed)}
                                        </small>
                                        <small>
                                          {formatPackageValidity(lessonPackage.validity_months)} ·{" "}
                                          {formatPackageLessonTypes(lessonPackage.lesson_types_allowed)}
                                        </small>
                                      </span>
                                      <span>
                                        <strong>{formatMoney(lessonPackage.total_price)}</strong>
                                      </span>
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  className="group-lesson-details__buy-package"
                                  onClick={() => void handleBuyPackageAndApply()}
                                  disabled={!selectedPackage || purchasingPackage || paymentMethodsLoading}
                                  aria-busy={purchasingPackage}
                                >
                                  {purchasingPackage ? "Reserving package..." : "Reserve with saved card"}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      ) : null}

                      {creditsLoading ? <p className="group-lesson-details__checkout-caption">Checking credits...</p> : null}
                      {creditsError ? <p className="group-lesson-details__checkout-error">{creditsError}</p> : null}
                      {packagePurchaseError ? <p className="group-lesson-details__checkout-error">{packagePurchaseError}</p> : null}

                      <button
                        type="button"
                        className="group-lesson-details__checkout-action"
                        disabled={lesson.cancelled || spotsRemaining === 0 || isBooked || bookingWithCredits}
                        onClick={() => {
                          if (!isSignedIn) {
                            promptSignIn();
                            return;
                          }
                          if (paymentChoice === "credits" && availableCredits > 0 && selectedCreditId) {
                            void handleBookWithCredits();
                            return;
                          }
                          navigate(`/booking/confirm?groupLesson=${lesson.id}`, {
                            state: {
                              groupLessonId: lesson.id,
                              groupLessonsState: groupLessonsReturnState,
                            },
                          });
                        }}
                      >
                        {lesson.cancelled
                          ? "Cancelled"
                          : bookingWithCredits
                            ? "Applying credits..."
                            : isBooked
                              ? "Booked"
                              : spotsRemaining === 0
                                ? "Join waitlist"
                                : !isSignedIn
                                  ? "Sign in to book"
                                  : groupUsesCredits
                                    ? "Book with credits"
                                    : paymentChoice === "apple-pay"
                                      ? "Continue with Apple Pay"
                                      : "Book now"}
                      </button>

                      <p className="group-lesson-details__checkout-caption">
                        {spotsRemaining === 0
                          ? "We’ll notify you if a player drops and a spot re-opens."
                          : "Free cancellation up to 24 hours before the class. Your place is held as soon as checkout completes."}
                      </p>
                    </>
                  )}
                </div>
              </aside>
            </div>

            <div
              className={`group-lesson-details__mobile-footer${
                isBooked ? " group-lesson-details__mobile-footer--booked" : ""
              }`}
            >
              {isBooked ? (
                <div className="group-lesson-details__mobile-footer-stack">
                  <button
                    type="button"
                    className="group-lesson-details__mobile-footer-secondary"
                    onClick={() => navigate(`/coaches/${lesson.coachId}`)}
                  >
                    <MessageCircle aria-hidden />
                    <span>Message coach</span>
                  </button>
                  <button
                    type="button"
                    className="group-lesson-details__mobile-footer-link"
                    onClick={() => {
                      setCancelError(null);
                      setCancelFlowState("confirm");
                    }}
                  >
                    Cancel booking
                  </button>
                </div>
              ) : (
                <>
                  <div className="group-lesson-details__mobile-footer-price">
                    <strong>{lesson.pricePerPlayer.replace(" per player", "")}</strong>
                    <span>per class</span>
                  </div>
                  <button
                    type="button"
                    className="group-lesson-details__mobile-footer-action"
                    disabled={lesson.cancelled || spotsRemaining === 0 || isBooked}
                    onClick={() => {
                      if (!isSignedIn) {
                        promptSignIn();
                        return;
                      }
                      navigate(`/booking/confirm?groupLesson=${lesson.id}`, {
                        state: {
                          groupLessonId: lesson.id,
                          groupLessonsState: groupLessonsReturnState,
                        },
                      });
                    }}
                  >
                    {lesson.cancelled
                      ? "Cancelled"
                      : isBooked
                        ? "Booked"
                        : spotsRemaining === 0
                          ? "Join waitlist"
                          : isSignedIn
                            ? "Book now"
                            : "Sign in to book"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default GroupLessonDetailsPage;
