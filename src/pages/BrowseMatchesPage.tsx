/// <reference types="google.maps" />

import Autocomplete from "react-google-autocomplete";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Calendar, Filter, MapPin, MessageCircle, Search, Star, Users } from "lucide-react";
import {
  identityValues,
  isOpenMatch,
  listMatches,
  normalizeMatchRecord,
  type NormalizedMatch,
  type MatchesPagination,
} from "../api/matches";
import { getPlayedWith } from "../api/playerHistory";
import { useAuth } from "../context/AuthContext";
import MainLayout from "../components/MainLayout";
import { colors, typography } from "../lib/theme";
import { getStoredAuthToken } from "../services/authToken";
import { getMatchHostId } from "../play-dates/utils/matchHost";
import {
  buildPlayedWithHostSet,
  hasPlayedWithHost,
  type PlayedWithPlayer,
} from "../utils/playedWith";
import { deriveListingVisibility, isLinkOnlyVisibility, isPrivateMatch } from "../utils/matchVisibility";
import {
  getStoredLocation,
  storeLocation,
  USER_LOCATION_CHANGED_EVENT,
} from "../utils/userLocation";

import "./BrowseMatchesPage.css";
import "../components/coaches/coaches.css";
import "../components/players/players.css";

const distanceOptions = ["5 mi", "10 mi", "20 mi", "50 mi", "All"];
const tabs = [
  { label: "My Matches", icon: "⭐" },
  { label: "Hosting", icon: "🧢" },
  { label: "Open", icon: "🔥" },
  { label: "Today", icon: "📅" },
  { label: "Tomorrow", icon: "⏰" },
  { label: "Weekend", icon: "🎉" },
  { label: "Drafts", icon: "📝" },
  { label: "Archived", icon: "🗂️" },
];

const relationshipLabel: Record<string, string> = {
  host: "Hosting",
  participant: "Joined",
};

type MatchWithMeta = NormalizedMatch & {
  distanceMiles?: number | null;
  distanceLabel?: string;
  startDate?: Date | null;
};

type Coordinates = { latitude: number; longitude: number };

type SelectedLocation = {
  label: string;
  latitude?: number;
  longitude?: number;
  isCurrentLocation?: boolean;
};

const formatCoordinatesLabel = (coords: Coordinates | null) => {
  if (!coords) {
    return "";
  }

  const latitude = Math.abs(coords.latitude).toFixed(2);
  const longitude = Math.abs(coords.longitude).toFixed(2);
  const latHemisphere = coords.latitude >= 0 ? "N" : "S";
  const lonHemisphere = coords.longitude >= 0 ? "E" : "W";

  return `${latitude}° ${latHemisphere}, ${longitude}° ${lonHemisphere}`;
};

const sanitizeLocationLabel = (label: string) => label.replace(/\s+/g, " ").trim().toLowerCase();

const buildLocationSearch = (location: SelectedLocation | null): string => {
  if (!location) {
    return "";
  }

  if (location.isCurrentLocation) {
    return "";
  }

  const label = location.label?.trim();
  if (!label) {
    return "";
  }

  const normalized = sanitizeLocationLabel(label);
  if (!normalized || normalized === "current location") {
    return "";
  }

  return label;
};

const parseDistanceMiles = (value: string): number => {
  const match = /([0-9.]+)/.exec(value);
  return match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY;
};

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseDistanceValue = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const numeric = parseNumeric(value);
  if (numeric !== null) return numeric;
  if (typeof value === "string") {
    const extracted = value.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (extracted) {
      const parsed = Number.parseFloat(extracted[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const getStartOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const isSameDay = (candidate: Date, target: Date) =>
  candidate.getFullYear() === target.getFullYear() &&
  candidate.getMonth() === target.getMonth() &&
  candidate.getDate() === target.getDate();

const getUpcomingWeekendBounds = (now: Date) => {
  const start = getStartOfDay(now);
  const day = start.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const saturday = new Date(start);
  saturday.setDate(saturday.getDate() + daysUntilSaturday);
  const monday = new Date(saturday);
  monday.setDate(monday.getDate() + 2);
  return { start: saturday, end: monday };
};

const extractCoordinates = (record: Record<string, unknown>): Coordinates | null => {
  const latitude = parseNumeric(
    record.latitude ??
      record.lat ??
      record.location_latitude ??
      (record.match as Record<string, unknown> | undefined)?.latitude ??
      (record.match as Record<string, unknown> | undefined)?.lat,
  );
  const longitude = parseNumeric(
    record.longitude ??
      record.lng ??
      record.long ??
      record.location_longitude ??
      (record.match as Record<string, unknown> | undefined)?.longitude ??
      (record.match as Record<string, unknown> | undefined)?.lng ??
      (record.match as Record<string, unknown> | undefined)?.long,
  );

  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
};

const getMatchStartDate = (match: NormalizedMatch): Date | null => {
  const raw = (match.raw ?? {}) as Record<string, unknown>;
  const candidate =
    match.startDateTimeIso ??
    raw.start_date_time ??
    raw.startDateTime ??
    raw.start_time ??
    raw.dateTime;
  if (!candidate) return null;
  const parsed =
    candidate instanceof Date
      ? candidate
      : typeof candidate === "string"
      ? new Date(candidate)
      : new Date(candidate as Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIdentitySet = (values: string[]) =>
  new Set(values.map((value) => value.toString().trim().toLowerCase()).filter(Boolean));

const extractInvitees = (record: Record<string, unknown>): unknown[] => {
  const inviteArrays = [
    record.invitees,
    record.invites,
    record.invitations,
    record.pending_invites,
    record.pendingInvites,
    (record.match as Record<string, unknown> | undefined)?.invitees,
    (record.match as Record<string, unknown> | undefined)?.invites,
  ];

  return inviteArrays.flatMap((value) => (Array.isArray(value) ? value : [])).filter(Boolean);
};

const matchHasInviteForUser = (record: Record<string, unknown>, userIdentities: Set<string>) => {
  if (record.is_invited === true || record.isInvited === true) return true;
  const invites = extractInvitees(record);
  if (invites.length === 0 || userIdentities.size === 0) return false;
  return invites.some((invite) => {
    const inviteIdentities = identityValues(invite).map((id) => id.toLowerCase());
    return inviteIdentities.some((id) => userIdentities.has(id));
  });
};

const calculateDistanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const parsedLat1 = Number(lat1);
  const parsedLon1 = Number(lon1);
  const parsedLat2 = Number(lat2);
  const parsedLon2 = Number(lon2);

  if (
    [parsedLat1, parsedLon1, parsedLat2, parsedLon2].some((value) => Number.isNaN(value))
  ) {
    return null;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRad(parsedLat2 - parsedLat1);
  const dLon = toRad(parsedLon2 - parsedLon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(parsedLat1)) * Math.cos(toRad(parsedLat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMiles * c * 10) / 10;
};

const deriveDistanceMiles = (match: NormalizedMatch, origin: Coordinates | null): number | null => {
  const raw = (match.raw ?? {}) as Record<string, unknown>;
  const serverDistance =
    parseDistanceValue(raw.distance_miles) ??
    parseDistanceValue(raw.distanceMiles) ??
    parseDistanceValue(raw.distance) ??
    parseDistanceValue(raw.proximity) ??
    parseDistanceValue(match.distance);
  if (serverDistance !== null) return serverDistance;
  if (!origin) return null;
  const matchCoords = extractCoordinates(raw);
  if (!matchCoords) return null;
  return calculateDistanceMiles(origin.latitude, origin.longitude, matchCoords.latitude, matchCoords.longitude);
};

const isHostingMatch = (match: NormalizedMatch, userIdentities: string[]) => {
  const participantHostMatch =
    match.participants?.some(
      (participant) =>
        participant.hosting &&
        ((participant.identityIds?.some((id) => userIdentities.includes(id)) ?? false) || participant.isCurrentUser),
    ) ?? false;

  const hostIdentityMatch =
    match.hostIdentityIds?.some((identityId) => userIdentities.includes(identityId)) ?? false;

  return match.relationship === "host" || participantHostMatch || hostIdentityMatch;
};

const getHostDisplayName = (match: NormalizedMatch, isHost: boolean) => {
  const hostingParticipants = match.participants?.filter((participant) => participant.hosting) ?? [];

  const currentUserHost = hostingParticipants.find((participant) => participant.isCurrentUser);
  if (currentUserHost?.name) return currentUserHost.name;

  const namedHost = hostingParticipants.find((participant) => participant.name);
  if (namedHost?.name) return namedHost.name;

  if (match.hostName) return match.hostName;
  return isHost ? "You" : undefined;
};

const readStoredUserId = (): string | number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("authLoginResponse");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const id = parsed.user_id ?? parsed.id;
    return typeof id === "string" || typeof id === "number" ? id : null;
  } catch {
    return null;
  }
};

const resolveCurrentUserId = (user: unknown): string | number | null => {
  if (user && typeof user === "object") {
    const record = user as Record<string, unknown>;
    const session = record.session as Record<string, unknown> | undefined;
    const id = record.user_id ?? record.userId ?? record.id ?? session?.user_id ?? session?.id;
    if (typeof id === "string" || typeof id === "number") return id;
  }
  return readStoredUserId();
};

const BrowseMatchesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth() as { user?: unknown };
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [matches, setMatches] = useState<NormalizedMatch[]>([]);
  const [pagination, setPagination] = useState<MatchesPagination | null>(null);
  const [page, setPage] = useState(1);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [selectedDistance, setSelectedDistance] = useState(distanceOptions[0]);
  const [selectedTab, setSelectedTab] = useState(tabs[0].label);
  const storedLocation = useMemo(() => getStoredLocation(), []);
  const [position, setPosition] = useState<Coordinates | null>(storedLocation);
  const [locationFilter, setLocationFilter] = useState<SelectedLocation | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [playedWith, setPlayedWith] = useState<PlayedWithPlayer[]>([]);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "error">(
    storedLocation ? "ready" : "idle",
  );
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState<string>(() =>
    storedLocation ? formatCoordinatesLabel(storedLocation) : "",
  );
  const currentUserIdentities = useMemo(() => identityValues(user), [user]);
  const currentUserId = useMemo(() => resolveCurrentUserId(user), [user]);
  const playedWithHosts = useMemo(() => buildPlayedWithHostSet(playedWith), [playedWith]);

  useEffect(() => {
    if (!currentUserId) {
      setPlayedWith([]);
      return;
    }

    const controller = new AbortController();
    getPlayedWith(currentUserId, { signal: controller.signal })
      .then((response) => setPlayedWith(response.playedWith))
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load played-with history", error);
        setPlayedWith([]);
      });

    return () => controller.abort();
  }, [currentUserId]);

  const locationLabel = (() => {
    if (locationFilter) {
      return locationFilter.label;
    }

    if (locationStatus === "loading") {
      return "Locating…";
    }

    if (locationStatus === "error") {
      return "Location unavailable";
    }

    if (locationStatus === "ready") {
      if (resolvedLocationLabel) {
        return resolvedLocationLabel;
      }
      if (position) {
        return formatCoordinatesLabel(position) || "Current location";
      }
      return "Current location";
    }

    return resolvedLocationLabel || "";
  })();

  const applyLocationFilter = useCallback((nextLocation: SelectedLocation | null) => {
    if (nextLocation) {
      const hasCoords =
        typeof nextLocation.latitude === "number" && typeof nextLocation.longitude === "number";

      if (hasCoords) {
        const coords: Coordinates = {
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
        };
        setPosition(coords);
        storeLocation(coords);
      } else {
        setPosition(null);
        storeLocation(null);
      }

      if (nextLocation.isCurrentLocation) {
        setLocationFilter(null);
      } else {
        setLocationFilter({ ...nextLocation, isCurrentLocation: false });
      }

      setResolvedLocationLabel(nextLocation.label);
      setLocationStatus("ready");
      setLocationSearchTerm(nextLocation.label);
      setGeoError("");
      setShowLocationPicker(false);
      return;
    }

    setLocationFilter(null);
    setLocationSearchTerm("");
    setGeoError("");
    setShowLocationPicker(false);
    setResolvedLocationLabel("");
    setLocationStatus("idle");
    setPosition(null);
    storeLocation(null);
  }, []);

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const message = "Location detection is not supported in this browser.";
      setGeoError(message);
      setLocationStatus("error");
      setResolvedLocationLabel("");
      return;
    }

    setIsDetectingLocation(true);
    setLocationStatus("loading");
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => {
        setIsDetectingLocation(false);
        const coords: Coordinates = {
          latitude: nextPosition.coords.latitude,
          longitude: nextPosition.coords.longitude,
        };
        setPosition(coords);
        storeLocation(coords);
        setLocationFilter(null);
        setResolvedLocationLabel(formatCoordinatesLabel(coords));
        setLocationStatus("ready");
        setLocationSearchTerm("");
      },
      (error) => {
        setIsDetectingLocation(false);
        console.error("Failed to detect current location", error);
        const message =
          error.message || "We couldn't detect your location. Please allow access and try again.";
        setGeoError(message);
        setLocationStatus("error");
        setResolvedLocationLabel("");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  const closeLocationPicker = useCallback(() => {
    setShowLocationPicker(false);
    setGeoError("");
    setLocationSearchTerm(locationFilter?.label ?? "");
  }, [locationFilter?.label]);

  useEffect(() => {
    if (!position && locationStatus === "idle" && !isDetectingLocation) {
      detectCurrentLocation();
    }
  }, [position, locationStatus, isDetectingLocation, detectCurrentLocation]);

  useEffect(() => {
    const syncStoredLocation = () => {
      const nextLocation = getStoredLocation();
      if (!nextLocation) return;

      setPosition(nextLocation);
      setLocationFilter(null);
      setResolvedLocationLabel(formatCoordinatesLabel(nextLocation));
      setLocationStatus("ready");
      setGeoError("");
      setShowLocationPicker(false);
    };

    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
    return () => window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
  }, []);

  useEffect(() => {
    if (!position || locationFilter) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const lookupLocationName = async () => {
      try {
        const query = new URLSearchParams({
          format: "jsonv2",
          lat: position.latitude.toString(),
          lon: position.longitude.toString(),
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?${query.toString()}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Failed to lookup location");
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        const address = (data?.address ?? {}) as Record<string, unknown>;
        const locality =
          (address.city as string | undefined) ||
          (address.town as string | undefined) ||
          (address.village as string | undefined) ||
          (address.hamlet as string | undefined) ||
          (address.suburb as string | undefined) ||
          (address.county as string | undefined);
        const region = (address.state as string | undefined) || (address.region as string | undefined);
        const countryCode =
          typeof address.country_code === "string" ? address.country_code.toUpperCase() : null;

        const labelParts = [locality, region, countryCode].filter(Boolean) as string[];
        const resolvedLabel = labelParts.length
          ? labelParts.join(", ")
          : (data?.display_name as string | undefined)?.split(",").slice(0, 2).join(", ") || "";

        setResolvedLocationLabel(resolvedLabel || formatCoordinatesLabel(position));
      } catch (lookupError) {
        if (cancelled) {
          return;
        }
        console.error("Failed to resolve location", lookupError);
        setResolvedLocationLabel(formatCoordinatesLabel(position));
      }
    };

    lookupLocationName();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [position, locationFilter]);

  const locationQuery = useMemo(() => buildLocationSearch(locationFilter), [locationFilter]);
  const hasLocationFilter = Boolean(locationFilter);

  useEffect(() => {
    setAppliedSearch(searchTerm.trim());
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
    setPagination(null);
  }, [appliedSearch, locationQuery, locationFilter, position?.latitude, position?.longitude, selectedDistance, selectedTab]);

  const fetchMatches = useCallback(
    async (signal: AbortSignal) => {
      setIsLoadingMatches(true);
      setMatchesError(null);

      const distanceMiles = parseDistanceMiles(selectedDistance);
      const searchQuery = (appliedSearch || locationQuery).trim();
      const isHostingTab = selectedTab === "Hosting";
      const includeHiddenParams = { includeHidden: true as const, include_hidden: true as const };
      const tabFilters = (() => {
        if (selectedTab === "My Matches") {
          return { filter: "my" as const, status: "upcoming" as const, ...includeHiddenParams };
        }

        if (isHostingTab) {
          return { filter: "my" as const, status: "upcoming" as const, ...includeHiddenParams };
        }

        if (selectedTab === "Open") {
          return { status: "open" as const, ...includeHiddenParams };
        }

        if (selectedTab === "Drafts") {
          return { filter: "my" as const, status: "draft" as const, ...includeHiddenParams };
        }

        if (selectedTab === "Archived") {
          return { filter: "my" as const, status: "archived" as const, ...includeHiddenParams };
        }

        if (selectedTab === "Today" || selectedTab === "Tomorrow" || selectedTab === "Weekend") {
          return { status: "upcoming" as const };
        }

        return { status: "upcoming" as const };
      })();

      const perPage = isHostingTab ? 50 : 20;
      const hasLocationSelection = Boolean(locationFilter || position);
      const locationParams = hasLocationSelection
        ? {
            latitude: position?.latitude,
            longitude: position?.longitude,
            distance: Number.isFinite(distanceMiles) ? distanceMiles : undefined,
          }
        : {};

      try {
        const userIdentitySet = toIdentitySet(identityValues(user));
        const token = getStoredAuthToken({ preferScheme: "Token" });
        const response = await listMatches({
          page,
          perPage,
          search: searchQuery || undefined,
          ...locationParams,
          ...tabFilters,
          token: token ?? undefined,
          signal,
        });

        const normalized = response.matches.map((match) =>
          normalizeMatchRecord(match, { currentUser: user }),
        );
        const accessibleMatches = normalized.filter((match) => {
          const raw = (match.raw ?? {}) as Record<string, unknown>;
          const listingVisibility = deriveListingVisibility(
            match.visibility,
            raw.visibility,
            raw.match_visibility,
            raw,
          );
          const privateMatch = isPrivateMatch(raw) || match.access === "Private";
          const linkOnly = isLinkOnlyVisibility(listingVisibility);
          const isHost = isHostingMatch(match, Array.from(userIdentitySet));
          const isParticipant =
            match.relationship === "participant" ||
            (match.participants ?? []).some((participant) => {
              if (participant.isCurrentUser) return true;
              const participantIds = (participant.identityIds ?? []).map((id) => id.toLowerCase());
              return participantIds.some((id) => userIdentitySet.has(id));
            });
          const isInvited = matchHasInviteForUser(raw, userIdentitySet);
          if (isHost || isParticipant || isInvited) return true;
          if (!privateMatch && !linkOnly) return true;
          return false;
        });
        const filteredMatches =
          selectedTab === "Open" ? accessibleMatches.filter(isOpenMatch) : accessibleMatches;
        setMatches(filteredMatches);
        setPagination(response.pagination ?? null);
      } catch (fetchError) {
        if (signal.aborted) return;
        console.error("Failed to load matches", fetchError);
        setMatchesError(
          fetchError instanceof Error ? fetchError.message : "Unable to load matches right now.",
        );
        setPagination(null);
      } finally {
        if (!signal.aborted) {
          setIsLoadingMatches(false);
        }
      }
    },
    [
      appliedSearch,
      locationFilter,
      locationQuery,
      page,
      position?.latitude,
      position?.longitude,
      selectedDistance,
      selectedTab,
      user,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchMatches(controller.signal);
    return () => controller.abort();
  }, [fetchMatches, refreshIndex]);

  const handleRetryMatches = () => setRefreshIndex((value) => value + 1);

  const activeCoordinates = useMemo(() => {
    const source = locationFilter ?? position;
    if (!source) return null;
    if (typeof source.latitude === "number" && typeof source.longitude === "number") {
      return { latitude: source.latitude, longitude: source.longitude };
    }
    return null;
  }, [locationFilter, position]);

  const visibleMatches = useMemo<MatchWithMeta[]>(() => {
    const now = new Date();
    const todayStart = getStartOfDay(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const weekendBounds = getUpcomingWeekendBounds(now);
    const distanceLimit = parseDistanceMiles(selectedDistance);
    const coords = activeCoordinates;

    const enriched = matches.map((match) => {
      const startDate = getMatchStartDate(match);
      const distanceMiles = deriveDistanceMiles(match, coords);
      const distanceLabel =
        match.distance ||
        (distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi away` : "Distance unavailable");
      return { ...match, startDate, distanceMiles, distanceLabel };
    });

    const filteredByTab = enriched.filter((match) => {
      if (selectedTab === "Hosting") {
        return isHostingMatch(match, currentUserIdentities);
      }
      if (selectedTab === "Open") {
        return isOpenMatch(match);
      }
      if (selectedTab === "Today") {
        return match.startDate ? isSameDay(match.startDate, todayStart) : false;
      }
      if (selectedTab === "Tomorrow") {
        return match.startDate ? isSameDay(match.startDate, tomorrowStart) : false;
      }
      if (selectedTab === "Weekend") {
        if (!match.startDate) return false;
        return match.startDate >= weekendBounds.start && match.startDate < weekendBounds.end;
      }
      return true;
    });

    const filteredByDistance =
      coords && Number.isFinite(distanceLimit)
        ? filteredByTab.filter((match) => match.distanceMiles !== null && match.distanceMiles <= distanceLimit)
        : filteredByTab;

    const sorted = [...filteredByDistance].sort((a, b) => {
      const aTime = a.startDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTime = b.startDate?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aTime === bTime) return 0;
      if (!Number.isFinite(aTime)) return 1;
      if (!Number.isFinite(bTime)) return -1;
      return aTime - bTime;
    });

    return sorted;
  }, [activeCoordinates, currentUserIdentities, matches, selectedDistance, selectedTab]);

  const visibleMatchCount = visibleMatches.length;
  const totalMatchCount = pagination?.total ?? visibleMatchCount;
  const totalPages = useMemo(() => {
    if (!pagination?.perPage) return null;
    if (pagination.total && pagination.total > 0) {
      return Math.max(1, Math.ceil(pagination.total / pagination.perPage));
    }
    if (visibleMatchCount > 0) {
      return Math.max(1, Math.ceil(visibleMatchCount / pagination.perPage));
    }
    return null;
  }, [pagination?.perPage, pagination?.total, visibleMatchCount]);
  const hasNextPage = useMemo(() => {
    if (!pagination?.perPage) return false;
    if (totalPages) return page < totalPages;
    if (pagination.page && visibleMatchCount) {
      return visibleMatchCount >= pagination.perPage;
    }
    return false;
  }, [page, pagination?.page, pagination?.perPage, totalPages, visibleMatchCount]);

  const themeVars = useMemo(
    () =>
      ({
        "--matches-distance-bg": colors.filterChipBg,
        "--matches-distance-hover": colors.filterChipHover,
        "--matches-distance-selected-bg": colors.availableBg,
        "--matches-distance-selected-border": colors.primarySuccess,
        "--matches-distance-selected-text": colors.availableText,
        "--matches-text": colors.primaryText,
        "--matches-muted": colors.secondaryText,
        "--matches-border": colors.border,
        "--matches-surface": colors.surface,
        "--matches-success": colors.primarySuccess,
        "--matches-font": typography.fontFamily,
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
        "--fc-color-error-text": colors.errorText,
      }) as CSSProperties,
    [],
  );

  return (
    <MainLayout>
      <div className="matches-page" style={themeVars}>
        <div className="matches-shell">
          <header className="matches-hero">
            <div className="matches-hero__text">
              <p className="matches-hero__eyebrow">Find a match, fast</p>
              <h1 className="matches-hero__title">Browse Local Matches</h1>
              <p className="matches-hero__subtitle">
                Curated matches near you with quick filters, refreshed live.
              </p>
              <div className="matches-hero__cta">
                <button
                  type="button"
                  className="matches-create-btn"
                  onClick={() => navigate("/matches/create")}
                >
                  + Create Match
                </button>
                <button
                  type="button"
                  className="matches-filter-btn"
                  onClick={() => navigate("/find-players")}
                >
                  <Users size={18} aria-hidden="true" />
                  Find players
                </button>
              </div>
            </div>
            <div className="matches-hero__art">
              <div className="matches-hero__badge">🎾</div>
              <div className="matches-hero__stat">
                <span className="matches-hero__stat-number">{totalMatchCount}</span>
                <span className="matches-hero__stat-label">Active matches</span>
              </div>
            </div>
          </header>

          <section className="fc-filter matches-filter-card">
            <div className="matches-filter-card__header">
              <div>
                <p className="matches-filter-card__eyebrow">Location filter</p>
                <h2 className="matches-filter-card__title">
                  {hasLocationFilter ? "Dialed into your spot" : "Use a location to see closer matches"}
                </h2>
                <p className="matches-filter-card__subtitle">
                  Switch between saved location and nearby radius in one tap.
                </p>
              </div>
              <div className="matches-filter-card__summary">
                <span className="matches-filter-card__summary-label">Showing matches near</span>
                <strong className="matches-filter-card__summary-value">{locationLabel || "Select location"}</strong>
              </div>
            </div>

            <div className="fc-filter__distance-row matches-filter-card__distance-row">
              <div className="fc-filter__distance-group">
                <button
                  type="button"
                  className={`fc-distance-chip fc-distance-chip--location${
                    showLocationPicker ? " fc-distance-chip--active" : ""
                  }`}
                  aria-label={locationLabel ? `Selected location: ${locationLabel}` : "Select location"}
                  aria-expanded={showLocationPicker}
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
                  <MapPin size={18} aria-hidden="true" />
                  {locationLabel || "Select location"}
                </button>
                {distanceOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`fc-distance-chip${selectedDistance === option ? " fc-distance-chip--active" : ""}`}
                    onClick={() => setSelectedDistance(option)}
                    aria-pressed={selectedDistance === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="matches-filter-card__location-hint">Adjust your location or radius to refine nearby matches.</div>
            </div>

            <div className="matches-filter-card__controls">
              <div className="fc-filter__search matches-filter-card__search">
                <Search className="fc-filter__search-icon" size={18} strokeWidth={2} />
                <input
                  type="search"
                  aria-label="Search matches"
                  placeholder="Search by club, host, or vibe"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <nav className="matches-filter-card__tabs" aria-label="Match filters">
                {tabs.map(({ label, icon }) => (
                  <button
                    key={label}
                    type="button"
                    className={`fc-distance-chip matches-tab${
                      selectedTab === label ? " fc-distance-chip--active" : ""
                    }`}
                    onClick={() => setSelectedTab(label)}
                    aria-pressed={selectedTab === label}
                  >
                    <span className="matches-tab__icon" aria-hidden="true">
                      {icon}
                    </span>
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </section>

          {showLocationPicker ? (
            <section className="fp-location-panel" aria-label="Location picker">
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
                  const label = place.formatted_address || place.name || locationSearchTerm || "Custom location";

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
                ) : position ? (
                  <p>
                    Lat {position.latitude.toFixed(4)}, Lng {position.longitude.toFixed(4)}
                  </p>
                ) : (
                  <p>No location selected yet.</p>
                )}
              </div>

              {geoError ? <p className="fp-location-error">{geoError}</p> : null}
              {!import.meta.env.VITE_GOOGLE_API_KEY ? (
                <p className="fp-location-tip">Tip: Provide a Google Places API key to enable location search suggestions.</p>
              ) : null}
            </section>
          ) : null}

          <section className="matches-main">
            <div className="matches-grid">
              {isLoadingMatches ? (
                <div className="matches-state" role="status">
                  Loading matches…
                </div>
              ) : matchesError ? (
              <div className="matches-state matches-state--error" role="alert">
                <p className="matches-state__title">We couldn't load matches right now.</p>
                <p className="matches-state__detail">{matchesError}</p>
                <button type="button" className="matches-state__button" onClick={handleRetryMatches}>
                  Try again
                </button>
              </div>
            ) : (
              visibleMatches.map((match) => {
                const isHost = isHostingMatch(match, currentUserIdentities);
                const isParticipant = !isHost && match.relationship === "participant";
                const playersJoined = match.playersJoined ?? 0;
                const computedTotal =
                  match.totalSpots !== undefined && match.totalSpots !== null
                    ? match.totalSpots
                    : playersJoined + (match.playersNeeded ?? 0);
                const totalSpots = computedTotal > 0 ? computedTotal : playersJoined;
                const spotsAvailable = Math.max(totalSpots - playersJoined, 0);
                const playersNeeded = match.playersNeeded ?? spotsAvailable;
                const availabilityLabel =
                  totalSpots > 0
                    ? spotsAvailable === 0
                      ? "Match is full"
                      : `${spotsAvailable} spot${spotsAvailable === 1 ? "" : "s"} available`
                    : "Spots available";
                const playersLabel =
                  totalSpots > 0
                    ? `${playersJoined}/${totalSpots} players`
                    : `${playersJoined} player${playersJoined === 1 ? "" : "s"}`;
                const roleLabel = isHost ? "Hosting" : isParticipant ? relationshipLabel[match.relationship] : null;
                const isHiddenLink = match.visibility === "hidden";
                const isInviteOnlyPill =
                  match.visibility === "private" ||
                  match.visibilityLabel?.toLowerCase() === "invite only";
                const showVisibilityPill = Boolean(
                  match.visibilityLabel &&
                    match.visibilityLabel !== match.access &&
                    !isInviteOnlyPill &&
                    !isHiddenLink,
                );
                const hostDisplayName = getHostDisplayName(match, isHost);
                const hostingParticipant = match.participants?.some((participant) => participant.hosting) ?? false;
                const showHostPill = Boolean(hostDisplayName) && (isHost || hostingParticipant);
                const rawMatch = (match.raw ?? {}) as Record<string, unknown>;
                const hostId = getMatchHostId(rawMatch);
                const showTrustPill = !isHost && hostId !== undefined && hostId !== null;
                const hasSharedCourt = showTrustPill ? hasPlayedWithHost(rawMatch, playedWithHosts) : false;

                return (
                  <article key={match.id} className="match-card">
                    <header className="match-card__header">
                      <div className="match-pills">
                        <span className={`match-status-pill ${match.access.toLowerCase()}`}>
                          {match.access}
                        </span>
                        {isHiddenLink ? <span className="match-status-pill hidden">Hidden link</span> : null}
                        {showVisibilityPill ? (
                          <span className="match-status-pill visibility">{match.visibilityLabel}</span>
                        ) : null}
                        {roleLabel ? <span className="match-status-pill subtle">{roleLabel}</span> : null}
                        {showTrustPill ? (
                          <span
                            className={`match-status-pill ${
                              hasSharedCourt ? "played-before" : "new-host"
                            }`}
                          >
                            {hasSharedCourt ? "✓ you've played" : "new to you"}
                          </span>
                        ) : null}
                        {isHost ? <span className="match-host-pill match-host-pill--header">Host</span> : null}
                      </div>
                      {spotsAvailable > 0 && playersNeeded > 0 ? (
                        <span className="match-needed">
                          <strong>{playersNeeded}</strong> needed
                        </span>
                      ) : (
                        <span className="match-needed match-needed--quiet">Roster set</span>
                      )}
                    </header>

                    <div className="match-card__body">
                      <div className="match-detail">
                        <Calendar size={18} aria-hidden="true" />
                        <p className="match-detail__primary">{match.startDisplay}</p>
                      </div>
                      <div className="match-detail">
                        <MapPin size={18} aria-hidden="true" />
                        <div>
                          <p className="match-detail__primary">{match.location}</p>
                          <p className="match-detail__secondary">
                            {match.distanceLabel || match.distance || "Distance unavailable"}
                          </p>
                        </div>
                      </div>
                      {hostDisplayName ? (
                        <div className="match-detail match-detail--host">
                          <Users size={18} aria-hidden="true" />
                          <div>
                            <p className="match-detail__primary match-detail__host-primary">
                              {hostDisplayName}
                              {showHostPill ? <span className="match-host-pill">Host</span> : null}
                            </p>
                            <p className="match-detail__secondary">Organizer</p>
                          </div>
                        </div>
                      ) : null}
                      <div className="match-detail">
                        <Users size={18} aria-hidden="true" />
                        <div>
                          <p className="match-detail__primary">{playersLabel}</p>
                          <p className="match-detail__secondary">{availabilityLabel}</p>
                        </div>
                      </div>
                      {match.level ? (
                        <div className="match-detail">
                          <Star size={18} aria-hidden="true" />
                          <div>
                            <p className="match-detail__primary">Suggested level: {match.level.summary}</p>
                            {match.level.detail ? (
                              <p className="match-detail__secondary">{match.level.detail}</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {match.format ? (
                        <div className="match-detail">
                          <Activity size={18} aria-hidden="true" />
                          <div>
                            <p className="match-detail__primary">Match format: {match.format}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <footer className="match-card__footer">
                      <button
                        type="button"
                        className="match-action primary"
                        onClick={() => navigate(`/matches/${match.id}`, { state: { match } })}
                      >
                        {isHost ? "View & manage" : "View match"}
                      </button>
                      {isHost || isParticipant ? (
                        <button type="button" className="match-action" disabled>
                          <MessageCircle size={16} aria-hidden="true" />
                          Message group
                        </button>
                      ) : null}
                    </footer>
                  </article>
                );
              })
            )}
              {!isLoadingMatches && !matchesError && visibleMatches.length === 0 ? (
                <div className="matches-empty">No matches found for these filters yet.</div>
              ) : null}
            </div>
            {pagination?.perPage ? (
              <div className="matches-pagination">
                <button
                  type="button"
                  className="matches-pagination__button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page === 1 || isLoadingMatches}
                >
                  Previous
                </button>
                <span className="matches-pagination__status">
                  Page {page}
                  {totalPages ? ` of ${totalPages}` : ""}
                </span>
                <button
                  type="button"
                  className="matches-pagination__button"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={!hasNextPage || isLoadingMatches}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default BrowseMatchesPage;
