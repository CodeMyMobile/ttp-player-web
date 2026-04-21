/// <reference types="google.maps" />

import Autocomplete from "react-google-autocomplete";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, MapPin, Search } from "lucide-react";

import ResultsHeader from "../components/coaches/ResultsHeader";
import MainLayout from "../components/MainLayout";
import {
  fetchUpcomingGroupLessons,
  mapUpcomingGroupLessonsResponse,
  type GroupLesson,
} from "../api/groupLessons";
import { colors, typography } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import {
  DEFAULT_POSITION,
  getStoredLocation,
  storeLocation,
  type Coordinates,
} from "../utils/userLocation";

import "../components/coaches/coaches.css";
import "./GroupLessonsPage.css";

const DEFAULT_LOCATION = "San Francisco, CA";
const radiusOptions = ["5 mi", "10 mi", "15 mi", "20 mi", "All"];

const parseRadius = (radius: string) => {
  if (radius === "All") {
    return Number.POSITIVE_INFINITY;
  }
  const match = /^(\d+)/.exec(radius);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const formatLevelRange = (level: number) => {
  const upperBound = (level + 0.5).toFixed(1);
  return `${level.toFixed(1)} - ${upperBound}`;
};

const toIsoDate = (date: Date) => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .slice(0, 10);
};

const parseLessonDateToIso = (label: string) => {
  const currentYear = new Date().getFullYear();
  const parsed = new Date(`${label}, ${currentYear} 12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return toIsoDate(parsed);
};

const addDays = (iso: string, amount: number) => {
  const base = new Date(`${iso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + amount);
  return base;
};

const formatWeekday = (iso: string) => {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long" });
};

const formatMonthDay = (iso: string, options: "long" | "short" = "long") => {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: options === "long" ? "long" : "short",
    day: "numeric",
  });
};

const parsePriceValue = (pricePerPlayer: string) => {
  const match = String(pricePerPlayer).match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  return Number.parseFloat(match[1]);
};

const getLessonFormatLabel = (lesson: GroupLesson) => {
  const candidate = lesson.focus?.trim();
  if (!candidate) {
    return "Open Group";
  }

  if (candidate.length <= 24 && !/[.,]/.test(candidate)) {
    return candidate;
  }

  if (/cardio/i.test(candidate)) {
    return "Cardio Tennis";
  }

  if (/clinic/i.test(candidate)) {
    return "Clinic";
  }

  return "Open Group";
};

const getCoachInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const getSpotsTone = (availableSpots: number) => {
  if (availableSpots <= 0) {
    return {
      tone: "full" as const,
      label: "Full",
    };
  }

  if (availableSpots <= 2) {
    return {
      tone: "limited" as const,
      label: `${availableSpots} spot${availableSpots === 1 ? "" : "s"} left`,
    };
  }

  return {
    tone: "open" as const,
    label: `${availableSpots} spots left`,
  };
};

type DateFilterState =
  | { type: "all" }
  | { type: "day"; iso: string }
  | { type: "range"; start: string; end: string };

type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  isCurrentLocation?: boolean;
};

type GroupLessonsStateSnapshot = {
  coachFilter: string;
  levelFilter: string;
  formatFilter: string;
  selectedRadius: string;
  searchTerm: string;
  dateFilter: DateFilterState;
  rangeStartValue: string;
  rangeEndValue: string;
  useLocationFilter: boolean;
  sortBy: "soonest" | "price-low" | "price-high";
  locationFilter: SelectedLocation | null;
  locationSearchTerm: string;
};

type GroupLessonsRouteState = {
  groupLessonsState?: GroupLessonsStateSnapshot;
};

const GroupLessonsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [coachFilter, setCoachFilter] = useState<string>("All coaches");
  const [levelFilter, setLevelFilter] = useState<string>("All levels");
  const [position, setPosition] = useState<Coordinates | null>(
    () => getStoredLocation() ?? DEFAULT_POSITION,
  );
  const [locationFilter, setLocationFilter] = useState<SelectedLocation | null>(() => {
    const stored = getStoredLocation();
    if (stored) {
      return {
        label: "Current location",
        latitude: stored.latitude,
        longitude: stored.longitude,
        isCurrentLocation: true,
      };
    }
    return null;
  });
  const [locationSearchTerm, setLocationSearchTerm] = useState(locationFilter?.label ?? "");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState<string>(radiusOptions[1]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showMobileMoreFilters, setShowMobileMoreFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterState>({ type: "all" });
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [rangeStartValue, setRangeStartValue] = useState<string>("");
  const [rangeEndValue, setRangeEndValue] = useState<string>("");
  const [rangeError, setRangeError] = useState<string | undefined>();
  const [useLocationFilter, setUseLocationFilter] = useState(true);
  const [lessons, setLessons] = useState<GroupLesson[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const lessonsWithIso = useMemo(
    () =>
      lessons.map((lesson) => ({
        ...lesson,
        isoDate: parseLessonDateToIso(lesson.date),
      })),
    [lessons],
  );

  const coachOptions = useMemo(
    () => ["All coaches", ...new Set(lessonsWithIso.map((lesson) => lesson.coachName))],
    [lessonsWithIso],
  );

  const levelOptions = useMemo(() => {
    const uniqueLevels = Array.from(new Set(lessonsWithIso.map((lesson) => lesson.level)))
      .sort((a, b) => a - b)
      .map((lessonLevel) => lessonLevel.toFixed(1));
    return ["All levels", ...uniqueLevels];
  }, [lessonsWithIso]);

  const formatOptions = useMemo(
    () => ["All formats", ...new Set(lessonsWithIso.map((lesson) => getLessonFormatLabel(lesson)))],
    [lessonsWithIso],
  );
  const [formatFilter, setFormatFilter] = useState<string>("All formats");
  const [sortBy, setSortBy] = useState<"soonest" | "price-low" | "price-high">("soonest");

  const groupLessonsStateSnapshot = useMemo<GroupLessonsStateSnapshot>(
    () => ({
      coachFilter,
      levelFilter,
      formatFilter,
      selectedRadius,
      searchTerm,
      dateFilter,
      rangeStartValue,
      rangeEndValue,
      useLocationFilter,
      sortBy,
      locationFilter,
      locationSearchTerm,
    }),
    [
      coachFilter,
      dateFilter,
      formatFilter,
      levelFilter,
      locationFilter,
      locationSearchTerm,
      rangeEndValue,
      rangeStartValue,
      searchTerm,
      selectedRadius,
      sortBy,
      useLocationFilter,
    ],
  );

  const dateAnchors = useMemo(() => {
    const validIsos = lessonsWithIso
      .map((lesson) => lesson.isoDate)
      .filter((iso): iso is string => Boolean(iso))
      .sort();

    if (validIsos.length === 0) {
      const todayIso = toIsoDate(new Date());
      return { start: todayIso, end: toIsoDate(addDays(todayIso, 7)) };
    }

    const base = validIsos[0];
    const last = validIsos[validIsos.length - 1];
    const start = base;
    const endAnchor = addDays(base, 7);
    const computedEnd = toIsoDate(endAnchor);
    const max = last > computedEnd ? last : computedEnd;
    return { start, end: max };
  }, [lessonsWithIso]);

  const dayOptions = useMemo(() => {
    const startDate = dateAnchors.start;
    return Array.from({ length: 8 }, (_, index) => {
      const date = addDays(startDate, index);
      const iso = toIsoDate(date);
      return {
        iso,
        day: formatWeekday(iso),
        label: formatMonthDay(iso),
      };
    });
  }, [dateAnchors.start]);

  const themeVars = useMemo(
    () => ({
      "--fc-color-bg": colors.pageBackground,
      "--fc-color-surface": colors.surface,
      "--fc-color-text-primary": colors.primaryText,
      "--fc-color-text-secondary": colors.secondaryText,
      "--fc-color-text-muted": colors.mutedText,
      "--fc-color-border": colors.border,
      "--fc-color-icon": colors.icon,
      "--fc-color-accent": colors.accentPurple,
      "--fc-color-accent-light": colors.accentPurpleLight,
      "--fc-color-accent-border": colors.accentPurpleBorder,
      "--fc-chip-bg": colors.filterChipBg,
      "--fc-chip-hover-bg": colors.filterChipHover,
      "--fc-chip-text": colors.secondaryButtonText,
      "--fc-color-secondary-border": colors.secondaryButtonBorder,
      "--fc-color-secondary-text": colors.secondaryButtonText,
      "--fc-color-secondary-hover": colors.secondaryButtonHover,
      "--fc-color-success": colors.primarySuccess,
      "--fc-color-success-hover": colors.primarySuccessHover,
      "--fc-color-error-bg": colors.errorBg,
      "--fc-color-error-border": colors.errorBorder,
      "--fc-color-error-text": colors.errorText,
      "--fc-color-empty-icon-bg": colors.emptyIconBg,
      "--fc-color-skeleton-base": colors.skeletonBase,
      "--fc-color-skeleton-highlight": colors.skeletonHighlight,
      "--fc-font-family": typography.fontFamily,
      "--fc-heading-size": typography.heading1.size,
      "--fc-heading-line-height": typography.heading1.lineHeight,
      "--fc-body-size": typography.body.size,
      "--fc-body-line-height": typography.body.lineHeight,
    }),
    [],
  );

  const locationLabel = useLocationFilter
    ? locationFilter?.label ?? DEFAULT_LOCATION
    : "All locations";

  const hasLocationFilter = Boolean(locationFilter);

  const applyLocationFilter = useCallback((nextLocation: SelectedLocation | null) => {
    if (
      nextLocation &&
      typeof nextLocation.latitude === "number" &&
      typeof nextLocation.longitude === "number"
    ) {
      const coords: Coordinates = {
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
      };
      setPosition(coords);
      storeLocation(coords);
      setLocationFilter(nextLocation);
      setLocationSearchTerm(nextLocation.label);
      setGeoError("");
      setShowLocationPicker(false);
      return;
    }

    setLocationFilter(null);
    setLocationSearchTerm("");
    setGeoError("");
    setShowLocationPicker(false);
    setPosition({ ...DEFAULT_POSITION });
    storeLocation(null);
  }, []);

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Location detection is not supported in this browser.");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => {
        setIsDetectingLocation(false);
        const coords: Coordinates = {
          latitude: nextPosition.coords.latitude,
          longitude: nextPosition.coords.longitude,
        };
        applyLocationFilter({
          label: "Current location",
          latitude: coords.latitude,
          longitude: coords.longitude,
          isCurrentLocation: true,
        });
      },
      (geoErrorEvent) => {
        setIsDetectingLocation(false);
        console.error("Failed to detect current location", geoErrorEvent);
        setGeoError(
          geoErrorEvent.message || "We couldn't detect your location. Please allow access and try again.",
        );
      },
    );
  }, [applyLocationFilter]);

  const closeLocationPicker = useCallback(() => {
    setShowLocationPicker(false);
    setGeoError("");
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    if (!location.state || typeof location.state !== "object") {
      return;
    }

    const routeState = location.state as GroupLessonsRouteState;
    const restoredState = routeState.groupLessonsState;
    if (!restoredState) {
      return;
    }

    setCoachFilter(restoredState.coachFilter);
    setLevelFilter(restoredState.levelFilter);
    setFormatFilter(restoredState.formatFilter);
    setSelectedRadius(restoredState.selectedRadius);
    setSearchTerm(restoredState.searchTerm);
    setDateFilter(restoredState.dateFilter);
    setRangeStartValue(restoredState.rangeStartValue);
    setRangeEndValue(restoredState.rangeEndValue);
    setUseLocationFilter(restoredState.useLocationFilter);
    setSortBy(restoredState.sortBy);
    setLocationSearchTerm(restoredState.locationSearchTerm);
    applyLocationFilter(restoredState.locationFilter);

    navigate(location.pathname, { replace: true, state: null });
  }, [applyLocationFilter, location.pathname, location.state, navigate]);

  const totalLessons = lessonsWithIso.length;

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

  const isLessonBooked = useCallback(
    (lesson: GroupLesson) => {
      const groupPlayers = lesson.groupPlayers ?? [];
      if (!groupPlayers.length) return false;
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
      if (!playerRecord) return false;
      const resolved = playerRecord.paymentStatus ?? playerRecord.status;
      const parsed = typeof resolved === "number" ? resolved : Number(resolved);
      return Number.isFinite(parsed) ? parsed === 1 : false;
    },
    [currentUserIdentity],
  );

  const dateSummary = useMemo(() => {
    if (dateFilter.type === "all") {
      return "across all upcoming dates";
    }
    if (dateFilter.type === "day") {
      const matchingOption = dayOptions.find((option) => option.iso === dateFilter.iso);
      if (matchingOption) {
        return `on ${matchingOption.day}, ${matchingOption.label}`;
      }
      return `on ${formatWeekday(dateFilter.iso)}, ${formatMonthDay(dateFilter.iso)}`;
    }
    return `from ${formatMonthDay(dateFilter.start, "short")} to ${formatMonthDay(dateFilter.end, "short")}`;
  }, [dateFilter, dayOptions]);

  const displayedLessons = useMemo(() => {
    const filteredLessons = lessonsWithIso.filter((lesson) => {
      if (formatFilter !== "All formats" && getLessonFormatLabel(lesson) !== formatFilter) {
        return false;
      }
      return true;
    });

    return [...filteredLessons].sort((a, b) => {
      if (sortBy === "price-low" || sortBy === "price-high") {
        const priceA = parsePriceValue(a.pricePerPlayer) ?? 0;
        const priceB = parsePriceValue(b.pricePerPlayer) ?? 0;
        return sortBy === "price-low" ? priceA - priceB : priceB - priceA;
      }

      const dateA = a.startDateTime ? new Date(a.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
      const dateB = b.startDateTime ? new Date(b.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
    });
  }, [formatFilter, lessonsWithIso, sortBy]);

  const resultsSummary =
    displayedLessons.length === totalLessons
      ? `${displayedLessons.length} ${
          displayedLessons.length === 1 ? "group lesson" : "group lessons"
        } available ${dateSummary}`
      : `${displayedLessons.length} ${
          displayedLessons.length === 1 ? "group lesson" : "group lessons"
        } match your filters ${dateSummary} (${totalLessons} total)`;

  const maxSelectableDate = dateAnchors.end;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadLessons = async () => {
      const token = getStoredAuthToken({ preferScheme: "token" });
      if (!token) {
        setLoadError("Missing authentication token.");
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const selectedCoach =
        coachFilter === "All coaches"
          ? undefined
          : lessonsWithIso.find((lesson) => lesson.coachName === coachFilter)?.coachId;
      const parsedLevel =
        levelFilter === "All levels" ? undefined : Number.parseFloat(levelFilter);
      const radiusMiles = parseRadius(selectedRadius);
      const dateRange =
        dateFilter.type === "all"
          ? {}
          : dateFilter.type === "day"
            ? { dateStart: dateFilter.iso, dateEnd: dateFilter.iso }
            : { dateStart: dateFilter.start, dateEnd: dateFilter.end };
      const resolvedPosition = useLocationFilter ? position ?? DEFAULT_POSITION : undefined;

      try {
        const response = await fetchUpcomingGroupLessons({
          token,
          perPage: 50,
          page: 1,
          search: searchTerm.trim(),
          ...(resolvedPosition ? { position: resolvedPosition } : {}),
          filters: {
            coachId: selectedCoach,
            level: Number.isFinite(parsedLevel ?? NaN) ? parsedLevel : undefined,
            radiusMiles:
              useLocationFilter && Number.isFinite(radiusMiles) ? radiusMiles : undefined,
            ...dateRange,
          },
          signal: controller.signal,
        });

        if (cancelled) return;

        const mapped = mapUpcomingGroupLessonsResponse(response);
        setLessons(mapped.lessons);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load group lessons.");
        setLessons([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadLessons();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    coachFilter,
    levelFilter,
    selectedRadius,
    searchTerm,
    dateFilter,
    useLocationFilter,
    position,
  ]);

  const handleApplyRange = () => {
    if (!rangeStartValue || !rangeEndValue) {
      setRangeError("Select both a start and end date.");
      return;
    }
    if (rangeStartValue > rangeEndValue) {
      setRangeError("Start date must be before the end date.");
      return;
    }
    setRangeError(undefined);
    setDateFilter({ type: "range", start: rangeStartValue, end: rangeEndValue });
    setIsRangeOpen(false);
  };

  const handleClearRange = () => {
    setRangeStartValue("");
    setRangeEndValue("");
    setRangeError(undefined);
    setDateFilter({ type: "all" });
    setIsRangeOpen(false);
  };

  const resetAllFilters = useCallback(() => {
    setCoachFilter("All coaches");
    setLevelFilter("All levels");
    setFormatFilter("All formats");
    applyLocationFilter(null);
    setSelectedRadius(radiusOptions[1]);
    setSearchTerm("");
  }, [applyLocationFilter]);

  return (
    <MainLayout mobileChrome="home" showDesktopNav={false}>
      <div className="find-coaches-page group-lessons-page" style={themeVars}>
        <div className="find-coaches-page__inner group-lessons-page__inner">
          <div className="group-lessons-desktop-shell">
            <ResultsHeader
              title="Group Lessons"
              description="Dial in your game with curated sessions led by trusted Matchplay coaches."
            />

            <section className="group-lessons-desktop-filters" aria-label="Filter group lessons">
              <div className="group-lessons-desktop-filters__top">
                <label className="group-lessons-desktop-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    aria-label="Search classes"
                    placeholder="Search classes"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>

                <div className="group-lessons-desktop-filters__actions">
                  <label className="group-lessons-desktop-select">
                    <select
                      aria-label="Filter by format"
                      value={formatFilter}
                      onChange={(event) => setFormatFilter(event.target.value)}
                    >
                      {formatOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="group-lessons-desktop-select">
                    <select
                      aria-label="Filter by distance"
                      value={selectedRadius}
                      onChange={(event) => setSelectedRadius(event.target.value)}
                    >
                      {radiusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === "All" ? "Any distance" : option}
                        </option>
                      ))}
                    </select>
                  </label>

                  {(coachFilter !== "All coaches" ||
                    levelFilter !== "All levels" ||
                    formatFilter !== "All formats" ||
                    selectedRadius !== radiusOptions[1] ||
                    searchTerm.trim()) && (
                    <button
                      type="button"
                      className="group-lessons-desktop-clear"
                      onClick={() => {
                        setCoachFilter("All coaches");
                        setLevelFilter("All levels");
                        setFormatFilter("All formats");
                        setSelectedRadius(radiusOptions[1]);
                        setSearchTerm("");
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              <div className="group-lessons-desktop-meta">
                <div className="group-lessons-desktop-meta__location">
                  <MapPin size={15} aria-hidden="true" />
                  <span>{useLocationFilter ? locationLabel : "All locations"}</span>
                </div>
                <div className="group-lessons-desktop-meta__buttons">
                  <button
                    type="button"
                    onClick={() => {
                      setGeoError("");
                      setShowLocationPicker((prev) => {
                        if (!prev) {
                          setLocationSearchTerm(locationFilter?.label ?? "");
                        }
                        return !prev;
                      });
                    }}
                  >
                    Change location
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseLocationFilter((current) => !current)}
                  >
                    {useLocationFilter ? "Use all locations" : "Search nearby"}
                  </button>
                </div>
              </div>

              <div className="group-lessons-desktop-chip-row">
                <span className="group-lessons-desktop-chip-row__label">Level</span>
                <div className="group-lessons-desktop-chip-row__chips">
                  <button
                    type="button"
                    className={`group-lessons-desktop-chip${
                      levelFilter === "All levels" ? " group-lessons-desktop-chip--active" : ""
                    }`}
                    onClick={() => setLevelFilter("All levels")}
                  >
                    All
                  </button>
                  {levelOptions
                    .filter((option) => option !== "All levels")
                    .map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`group-lessons-desktop-chip${
                          levelFilter === option ? " group-lessons-desktop-chip--active" : ""
                        }`}
                        onClick={() => setLevelFilter(option)}
                      >
                        {formatLevelRange(Number.parseFloat(option))}
                      </button>
                    ))}
                </div>
              </div>

              <div className="group-lessons-desktop-chip-row">
                <span className="group-lessons-desktop-chip-row__label">Coach</span>
                <div className="group-lessons-desktop-chip-row__chips">
                  <button
                    type="button"
                    className={`group-lessons-desktop-chip${
                      coachFilter === "All coaches" ? " group-lessons-desktop-chip--active" : ""
                    }`}
                    onClick={() => setCoachFilter("All coaches")}
                  >
                    All
                  </button>
                  {coachOptions
                    .filter((option) => option !== "All coaches")
                    .map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`group-lessons-desktop-chip group-lessons-desktop-chip--coach${
                          coachFilter === option ? " group-lessons-desktop-chip--active" : ""
                        }`}
                        onClick={() => setCoachFilter(option)}
                      >
                        <span className="group-lessons-desktop-chip__avatar">
                          {getCoachInitials(option)}
                        </span>
                        {option}
                      </button>
                    ))}
                </div>
              </div>
            </section>
          </div>

          <div className="group-lessons-mobile-shell">
            <section className="group-lessons-mobile-hero">
              <h1>Group Lessons</h1>
              <p>Dial in your game with curated sessions led by trusted Matchplay coaches.</p>
            </section>

            <div className="group-lessons-mobile-search-row">
              <label className="group-lessons-mobile-search">
                <Search size={14} aria-hidden="true" />
                <input
                  aria-label="Search classes"
                  placeholder="Search classes"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={`group-lessons-mobile-more${
                  (formatFilter !== "All formats" || selectedRadius !== radiusOptions[1])
                    ? " group-lessons-mobile-more--active"
                    : ""
                }`}
                onClick={() => setShowMobileMoreFilters(true)}
              >
                <span>⚙</span>
                <span>
                  More
                  {formatFilter !== "All formats" || selectedRadius !== radiusOptions[1]
                    ? ` · ${Number(formatFilter !== "All formats") + Number(selectedRadius !== radiusOptions[1])}`
                    : ""}
                </span>
              </button>
            </div>

            <div className="group-lessons-mobile-chip-row">
              <span className="group-lessons-mobile-chip-row__label">Level</span>
              <div className="group-lessons-mobile-chip-row__scroller">
                <button
                  type="button"
                  className={`group-lessons-mobile-chip${
                    levelFilter === "All levels" ? " group-lessons-mobile-chip--active" : ""
                  }`}
                  onClick={() => setLevelFilter("All levels")}
                >
                  All
                </button>
                {levelOptions
                  .filter((option) => option !== "All levels")
                  .map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`group-lessons-mobile-chip${
                        levelFilter === option ? " group-lessons-mobile-chip--active" : ""
                      }`}
                      onClick={() => setLevelFilter(option)}
                    >
                      {formatLevelRange(Number.parseFloat(option))}
                    </button>
                  ))}
              </div>
            </div>

            <div className="group-lessons-mobile-chip-row">
              <span className="group-lessons-mobile-chip-row__label">Coach</span>
              <div className="group-lessons-mobile-chip-row__scroller">
                <button
                  type="button"
                  className={`group-lessons-mobile-chip${
                    coachFilter === "All coaches" ? " group-lessons-mobile-chip--active" : ""
                  }`}
                  onClick={() => setCoachFilter("All coaches")}
                >
                  All
                </button>
                {coachOptions
                  .filter((option) => option !== "All coaches")
                  .map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`group-lessons-mobile-chip group-lessons-mobile-chip--coach${
                        coachFilter === option ? " group-lessons-mobile-chip--active" : ""
                      }`}
                      onClick={() => setCoachFilter(option)}
                    >
                      <span className="group-lessons-mobile-chip__avatar">
                        {getCoachInitials(option)}
                      </span>
                      {option.split(" ")[0]}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {showLocationPicker ? (
            <section className="fp-location-panel" id="group-lessons-location-picker" aria-label="Location picker">
              <Autocomplete
                apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                placeholder="Search for a city, club, or court"
                className="fp-autocomplete-input"
                value={locationSearchTerm}
                onChange={(event) => setLocationSearchTerm(event.target.value)}
                onPlaceSelected={(place: google.maps.places.PlaceResult | null) => {
                  if (!place) {
                    setGeoError("Please choose a location from the suggestions.");
                    return;
                  }

                  const lat = place.geometry?.location?.lat?.();
                  const lng = place.geometry?.location?.lng?.();
                  const label =
                    place.formatted_address || place.name || locationSearchTerm || "Custom location";

                  if (
                    typeof lat === "number" &&
                    !Number.isNaN(lat) &&
                    typeof lng === "number" &&
                    !Number.isNaN(lng)
                  ) {
                    applyLocationFilter({ label, latitude: lat, longitude: lng });
                  } else {
                    setGeoError("We couldn't read that location's coordinates. Try another search.");
                  }
                }}
                options={{
                  types: ["geocode", "establishment"],
                  fields: ["formatted_address", "geometry", "name", "address_components"],
                }}
              />

              <div className="fp-location-actions">
                <button
                  type="button"
                  className="fp-location-detect"
                  onClick={detectCurrentLocation}
                  disabled={isDetectingLocation}
                >
                  {isDetectingLocation ? "Detecting location..." : "Use my current location"}
                </button>
                <div className="fp-location-secondary-actions">
                  {hasLocationFilter ? (
                    <button type="button" className="fp-location-secondary" onClick={() => applyLocationFilter(null)}>
                      Clear location
                    </button>
                  ) : null}
                  <button type="button" className="fp-location-secondary" onClick={closeLocationPicker}>
                    Close
                  </button>
                </div>
              </div>

              <div className="fp-location-summary">
                <h4>Selected location</h4>
                {locationFilter ? (
                  <p>{locationFilter.label}</p>
                ) : useLocationFilter ? (
                  <p>{DEFAULT_LOCATION}</p>
                ) : (
                  <p>No location selected yet.</p>
                )}
              </div>

              {geoError ? <p className="fp-location-error">{geoError}</p> : null}
              {!import.meta.env.VITE_GOOGLE_API_KEY ? (
                <p className="fp-location-tip">
                  Tip: Provide a Google Places API key to enable location search suggestions.
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="group-lessons-day-filter" role="region" aria-label="Filter sessions by day">
            <div className="group-lessons-day-filter__controls">
              <div className="group-lessons-day-filter__quick">
                <button
                  type="button"
                  className={`group-lessons-day-filter__pill${
                    dateFilter.type === "all" ? " group-lessons-day-filter__pill--active" : ""
                  }`}
                  aria-pressed={dateFilter.type === "all"}
                  onClick={() => {
                    setDateFilter({ type: "all" });
                    setRangeStartValue("");
                    setRangeEndValue("");
                    setRangeError(undefined);
                    setIsRangeOpen(false);
                  }}
                >
                  <span className="group-lessons-day-filter__day">All days</span>
                </button>
                {dayOptions.map((option) => {
                  const isActive = dateFilter.type === "day" && dateFilter.iso === option.iso;
                  return (
                    <button
                      key={option.iso}
                      type="button"
                      className={`group-lessons-day-filter__pill${
                        isActive ? " group-lessons-day-filter__pill--active" : ""
                      }`}
                      aria-pressed={isActive}
                      onClick={() => {
                        setDateFilter({ type: "day", iso: option.iso });
                        setRangeStartValue(option.iso);
                        setRangeEndValue(option.iso);
                        setRangeError(undefined);
                        setIsRangeOpen(false);
                      }}
                    >
                      <span className="group-lessons-day-filter__day">{option.day}</span>
                      <span className="group-lessons-day-filter__date">{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="group-lessons-day-filter__actions">
                <button
                  type="button"
                  className={`group-lessons-day-filter__range-toggle${
                    dateFilter.type === "range" ? " group-lessons-day-filter__range-toggle--active" : ""
                  }`}
                  aria-expanded={isRangeOpen}
                  onClick={() => {
                    if (!isRangeOpen) {
                      if (dateFilter.type === "range") {
                        setRangeStartValue(dateFilter.start);
                        setRangeEndValue(dateFilter.end);
                      } else {
                        setRangeStartValue((current) => current || dateAnchors.start);
                        setRangeEndValue((current) => current || dateAnchors.start);
                      }
                    }
                    setIsRangeOpen((open) => !open);
                  }}
                >
                  {dateFilter.type === "range"
                    ? `Custom range: ${formatMonthDay(dateFilter.start, "short")} – ${formatMonthDay(
                        dateFilter.end,
                        "short",
                      )}`
                    : "Choose dates"}
                </button>
              </div>
            </div>
            {isRangeOpen ? (
              <div className="group-lessons-date-range">
                <div className="group-lessons-date-range__fields">
                  <label className="group-lessons-date-range__field">
                    <span>Start</span>
                    <input
                      type="date"
                      value={rangeStartValue}
                      min={dateAnchors.start}
                      max={rangeEndValue || maxSelectableDate}
                      onChange={(event) => {
                        setRangeStartValue(event.target.value);
                        setRangeError(undefined);
                      }}
                    />
                  </label>
                  <label className="group-lessons-date-range__field">
                    <span>End</span>
                    <input
                      type="date"
                      value={rangeEndValue}
                      min={rangeStartValue || dateAnchors.start}
                      max={maxSelectableDate}
                      onChange={(event) => {
                        setRangeEndValue(event.target.value);
                        setRangeError(undefined);
                      }}
                    />
                  </label>
                </div>
                <p className="group-lessons-date-range__hint">
                  {rangeStartValue && rangeEndValue
                    ? `Showing availability from ${formatMonthDay(rangeStartValue, "short")} to ${formatMonthDay(
                        rangeEndValue,
                        "short",
                      )}.`
                    : "Select a start and end date to filter sessions."}
                </p>
                {rangeError ? <p className="group-lessons-date-range__error">{rangeError}</p> : null}
                <div className="group-lessons-date-range__actions">
                  <button type="button" onClick={handleClearRange}>
                    Clear
                  </button>
                  <button type="button" onClick={handleApplyRange}>
                    Apply range
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <section aria-labelledby="group-lessons-results-heading" className="group-lessons-results">
            <div className="group-lessons-results__header">
              <div>
                <h2 id="group-lessons-results-heading">Available sessions nearby</h2>
                <p className="group-lessons-results__meta">{resultsSummary}</p>
              </div>
              <div className="group-lessons-results__sort">
                <span>Sort by</span>
                <label className="group-lessons-results__sort-select">
                  <select
                    aria-label="Sort group lessons"
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as "soonest" | "price-low" | "price-high")
                    }
                  >
                    <option value="soonest">Soonest</option>
                    <option value="price-low">Price low</option>
                    <option value="price-high">Price high</option>
                  </select>
                </label>
              </div>
            </div>

            {isLoading ? (
              <div className="empty-state">
                <p>Loading group lessons…</p>
              </div>
            ) : loadError ? (
              <div className="empty-state">
                <p>{loadError}</p>
              </div>
            ) : displayedLessons.length === 0 ? (
              <div className="empty-state">
                <p>No lessons match your current filters.</p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="lessons-grid">
                {displayedLessons.map((lesson) => {
                  const levelRange = formatLevelRange(lesson.level);
                  const spotTone = getSpotsTone(lesson.availableSpots);
                  const isBooked = isLessonBooked(lesson);
                  const isSoldOut = lesson.availableSpots === 0;
                  const priceValue = parsePriceValue(lesson.pricePerPlayer);
                  const showPackLink = priceValue !== null && priceValue > 29;

                  return (
                    <article key={lesson.id} className="lesson-card lesson-card--desktop">
                      <header className="lesson-card__band">
                        <div className="lesson-card__band-label">
                          {lesson.day.toUpperCase()} · {lesson.date.toUpperCase()}
                        </div>
                        <span className="lesson-card__level">{levelRange} NTRP</span>
                      </header>

                      <div className="lesson-card__body">
                        <div className="lesson-card__headline">
                          <div className="lesson-card__title-wrap">
                            <h3>{lesson.title}</h3>
                            <p className="lesson-card__description">
                              {lesson.description || lesson.focus || "Details coming soon."}
                            </p>
                          </div>
                          <div className="lesson-card__price">
                            <div className="lesson-card__price-value">
                              {priceValue !== null ? `$${priceValue}` : lesson.pricePerPlayer}
                            </div>
                            {showPackLink ? (
                              <button
                                type="button"
                                className="lesson-card__pack-link"
                                onClick={() => navigate("/credits")}
                              >
                                $29 w/ pack
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="lesson-card__info-list">
                          <div className="lesson-card__info-row">
                            <Clock size={16} aria-hidden="true" />
                            <span>
                              {lesson.startTime} · {lesson.durationMinutes} min
                            </span>
                          </div>
                          <div className="lesson-card__info-row">
                            <MapPin size={16} aria-hidden="true" />
                            <span>{lesson.locationName}</span>
                          </div>
                          <div className="lesson-card__info-row lesson-card__info-row--spots">
                            <span className="lesson-card__info-icon-emoji" aria-hidden="true">
                              👥
                            </span>
                            <span
                              className={`lesson-card__spots-pill lesson-card__spots-pill--${spotTone.tone}`}
                            >
                              {spotTone.label}
                            </span>
                          </div>
                        </div>

                        <div className="lesson-card__coach-strip">
                          <div className="lesson-coach">
                            {lesson.coachAvatarUrl ? (
                              <img src={lesson.coachAvatarUrl} alt="" aria-hidden="true" />
                            ) : (
                              <span className="lesson-card__coach-fallback">
                                {getCoachInitials(lesson.coachName)}
                              </span>
                            )}
                            <div>
                              <p className="coach-name">
                                with <strong>{lesson.coachName}</strong>
                              </p>
                            </div>
                          </div>
                        </div>

                        <footer className="lesson-card__footer">
                          <Link
                            to={`/group-lessons/${lesson.id}`}
                            state={{ groupLessonsState: groupLessonsStateSnapshot }}
                            className="ghost-button"
                          >
                            View details
                          </Link>
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => {
                              navigate(`/booking/confirm?groupLesson=${lesson.id}`, {
                                state: {
                                  groupLessonId: lesson.id,
                                  groupLessonsState: groupLessonsStateSnapshot,
                                },
                              });
                            }}
                            disabled={isSoldOut || isBooked}
                          >
                            {isBooked ? "Booked" : isSoldOut ? "Join waitlist" : "Book now"}
                          </button>
                        </footer>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      {showMobileMoreFilters ? (
        <div className="group-lessons-mobile-sheet">
          <button
            type="button"
            className="group-lessons-mobile-sheet__backdrop"
            aria-label="Close filters"
            onClick={() => setShowMobileMoreFilters(false)}
          />
          <div className="group-lessons-mobile-sheet__panel">
            <div className="group-lessons-mobile-sheet__handle" />
            <div className="group-lessons-mobile-sheet__header">
              <h2>More filters</h2>
              <button type="button" onClick={resetAllFilters}>
                Clear
              </button>
            </div>
            <div className="group-lessons-mobile-sheet__content">
              <section className="group-lessons-mobile-sheet__group">
                <h3>Distance</h3>
                <p>Within radius of {useLocationFilter ? locationLabel : "selected location"}</p>
                <div className="group-lessons-mobile-sheet__chips">
                  {radiusOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`group-lessons-mobile-sheet__chip${
                        selectedRadius === option ? " group-lessons-mobile-sheet__chip--active" : ""
                      }`}
                      onClick={() => setSelectedRadius(option)}
                    >
                      {option === "All" ? "Any" : option}
                    </button>
                  ))}
                </div>
              </section>
              <section className="group-lessons-mobile-sheet__group">
                <h3>Format</h3>
                <div className="group-lessons-mobile-sheet__chips">
                  <button
                    type="button"
                    className={`group-lessons-mobile-sheet__chip${
                      formatFilter === "All formats" ? " group-lessons-mobile-sheet__chip--active" : ""
                    }`}
                    onClick={() => setFormatFilter("All formats")}
                  >
                    All
                  </button>
                  {formatOptions
                    .filter((option) => option !== "All formats")
                    .map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`group-lessons-mobile-sheet__chip${
                          formatFilter === option ? " group-lessons-mobile-sheet__chip--active" : ""
                        }`}
                        onClick={() => setFormatFilter(option)}
                      >
                        {option}
                      </button>
                    ))}
                </div>
              </section>
            </div>
            <div className="group-lessons-mobile-sheet__footer">
              <button type="button" onClick={() => setShowMobileMoreFilters(false)}>
                Show results
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
};

export default GroupLessonsPage;
