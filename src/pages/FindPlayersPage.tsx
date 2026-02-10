/// <reference types="google.maps" />

import Autocomplete from "react-google-autocomplete";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../components/MainLayout";
import ResultsHeader from "../components/coaches/ResultsHeader";
import PlayersFilterBar from "../components/players/PlayersFilterBar";
import PlayerCard from "../components/players/PlayerCard";
import PlayerCardSkeleton from "../components/players/PlayerCardSkeleton";
import MatchProfileModal from "../components/players/MatchProfileModal";
import type { MatchProfileDetails } from "../components/players/MatchProfileModal";
import ConnectPlayerModal from "../components/players/ConnectPlayerModal";
import StateBanner from "../components/coaches/StateBanner";
import { colors, typography } from "../lib/theme";
import { getSuggestedPlayerCheckLocation } from "../api/playerHome";
import { fetchPlayerMatchProfile, savePlayerMatchProfile } from "../api/playerMatchProfile";
import { getStoredAuthToken } from "../services/authToken";
import type { Player } from "../data/mockPlayers";
import {
  DEFAULT_POSITION,
  getStoredLocation,
  storeLocation,
  type Coordinates,
} from "../utils/userLocation";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import type { ConnectIntent } from "../types/matchPlay";

import "../components/coaches/coaches.css";
import "../components/players/players.css";

type Mode = "normal" | "empty" | "error";
type Status = "loading" | "ready";

type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  isCurrentLocation?: boolean;
};

type SuggestedPlayerRecord = {
  userId: number;
  email?: string;
  phone?: string;
  full_name?: string;
  profile_picture?: string;
  skillLevel?: string;
  availability?: string[] | string;
  playerLocations?: string[] | string;
  playerCourtLocations?: string[] | string;
  lookingFor?: string[] | string;
  gender?: string;
  about_me?: string;
  genderAdditionalText?: string;
  isLevelConfirmed?: boolean;
  verifiedLevelCount?: string | number;
  is_favorite?: boolean;
  [key: string]: unknown;
};

type DirectoryPlayer = Player & { raw: SuggestedPlayerRecord };

const radiusOptions = ["5 mi", "10 mi", "15 mi", "20 mi", "All"];
const levelOptions = ["All levels", "2.5", "3.0", "3.5", "4.0", "4.5+"];
const genderOptions = ["All genders", "Male", "Female", "Other"];

const USER_LOCATION_STORAGE_KEY = "player:web:user-location";
const MATCH_PROFILE_STORAGE_KEY = "player:web:match-profile";
const MATCH_PROFILE_SUCCESS_MESSAGE =
  "Your match profile is live! You agree to share your contact details with other members and accept our terms. You can remove yourself from player matching anytime in settings.";

const normalize = (value: string) => value.trim().toLowerCase();

const parseRadius = (radius: string) => {
  if (radius === "All") {
    return Number.POSITIVE_INFINITY;
  }
  const match = /^(\d+)/.exec(radius);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const toInitials = (name: string) => {
  const segments = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (segments.length === 0) {
    return "TP";
  }
  if (segments.length === 1) {
    return segments[0].slice(0, 2).toUpperCase();
  }
  return `${segments[0][0]}${segments[segments.length - 1][0]}`.toUpperCase();
};

const canonicalAvailabilityLabels: Record<string, string> = {
  "weekdays am": "Weekdays AM",
  "weekday am": "Weekdays AM",
  "weekday morning": "Weekdays AM",
  "weekday mornings": "Weekdays AM",
  "weekdays pm": "Weekday PM",
  "weekday pm": "Weekday PM",
  "weekday evening": "Weekday PM",
  "weekday evenings": "Weekday PM",
  "weekend": "Weekends",
  "weekends": "Weekends",
  "weekend only": "Weekends",
};

const toCanonicalAvailability = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  return canonicalAvailabilityLabels[normalized] ?? value.trim();
};

const ensureStringArray = (value: unknown, normalizer?: (value: string) => string): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item !== "string") {
          return "";
        }
        const trimmed = item.trim();
        return normalizer ? normalizer(trimmed) : trimmed;
      })
      .filter((item): item is string => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    return [normalizer ? normalizer(trimmed) : trimmed];
  }
  return [];
};

const pickStringField = (record: Record<string, unknown>, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return fallback;
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

type StoredMatchProfile = MatchProfileDetails;

const formatAvailabilityList = (slots: string[]): string => {
  const cleaned = slots
    .map((slot) => (typeof slot === "string" ? toCanonicalAvailability(slot) : ""))
    .filter((slot) => slot.length > 0);

  if (cleaned.length === 0) {
    return "Weekends";
  }
  if (cleaned.length === 1) {
    return cleaned[0];
  }
  if (cleaned.length === 2) {
    return `${cleaned[0]} and ${cleaned[1]}`;
  }
  const head = cleaned.slice(0, -1).join(", ");
  return `${head}, and ${cleaned[cleaned.length - 1]}`;
};

const sanitizeMatchProfile = (value: unknown): StoredMatchProfile | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const level = pickStringField(record, ["level", "ntrp_level", "ntrpLevel"], "3.0") || "3.0";
  const about = pickStringField(record, ["about", "about_me", "bio"], "");
  const gender = pickStringField(record, ["gender", "gender_identity", "genderIdentity"], "");
  const localCourts = pickStringField(record, ["localCourts", "local_courts", "homeCourt", "home_court"], "");
  const playStyles = ensureStringArray(
    record.playStyles ??
      record.play_styles ??
      record.matchPreferences ??
      record.match_preferences ??
      record.playPreferences ??
      record.play_preferences,
  );
  const availabilitySource =
    record.availability ??
    record.matchAvailability ??
    record.match_availability ??
    record.preferredAvailability ??
    record.preferred_availability;
  const availability = ensureStringArray(availabilitySource, toCanonicalAvailability);
  const intensity = pickStringField(record, ["matchIntensity", "match_intensity", "intensity"], "");
  const preferredFormats = ensureStringArray(record.preferredFormats ?? record.preferred_formats);
  const homeCourt = pickStringField(record, ["homeCourt", "home_court"], "");

  return {
    about,
    level,
    playStyles,
    gender,
    localCourts,
    availability,
    intensity: intensity || undefined,
    preferredFormats,
    homeCourt: homeCourt || (localCourts ? localCourts : undefined),
  };
};

const getStoredMatchProfile = (): StoredMatchProfile | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(MATCH_PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeMatchProfile(parsed);
  } catch {
    return null;
  }
};

const storeMatchProfile = (profile: StoredMatchProfile | null) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    if (!profile) {
      window.localStorage.removeItem(MATCH_PROFILE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(MATCH_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage failures
  }
};

const mapSuggestedPlayer = (record: SuggestedPlayerRecord): DirectoryPlayer => {
  const availability = ensureStringArray(record.availability, toCanonicalAvailability);
  const playerLocations = ensureStringArray(record.playerLocations);
  const courtLocations = ensureStringArray(record.playerCourtLocations);
  const lookingFor = ensureStringArray(record.lookingFor);
  const location = playerLocations[0] ?? courtLocations[0] ?? "Location unavailable";
  const initialsSource = record.full_name ?? record.email ?? "TTP Player";
  const skillLabel = typeof record.skillLevel === "string" ? record.skillLevel.trim() : "";
  const levelMatch = skillLabel.match(/NTRP\s*([0-9.]+)/i);
  const normalizedLevel = levelMatch?.[1] ?? (skillLabel || "Unknown");
  const verificationCount = Number.parseInt(String(record.verifiedLevelCount ?? "0"), 10) || 0;
  const normalizedGender = (() => {
    const rawGender = typeof record.gender === "string" ? record.gender.trim().toLowerCase() : "";
    if (rawGender === "male") return "Male" as const;
    if (rawGender === "female") return "Female" as const;
    return "Other" as const;
  })();
  const courts = courtLocations.length > 0 ? courtLocations : playerLocations;
  const bio = typeof record.about_me === "string" && record.about_me.trim().length > 0
    ? record.about_me.trim()
    : "This player hasn\'t added a bio yet.";

  return {
    id: String(record.userId ?? initialsSource.toLowerCase()),
    name: record.full_name?.trim() || record.email || "TTP Player",
    initials: toInitials(initialsSource),
    profileImageUrl:
      typeof record.profile_picture === "string" ? record.profile_picture.trim() : "",
    location,
    distanceMiles: 0,
    gender: normalizedGender,
    level: normalizedLevel,
    availability,
    matchPreferences: lookingFor,
    bio,
    verified: Boolean(record.isLevelConfirmed),
    verificationCount,
    verificationSupporters: [],
    lastActive: "Active recently",
    matchFrequency: "Match frequency unavailable",
    rating: 0,
    favoriteCourt: courts[0] ?? location,
    lookingFor: lookingFor.join(", ") || "Not specified",
    localCourts: courts,
    hitTypes: lookingFor,
    matchesPlayed: undefined,
    reviewsCount: undefined,
    responseTime: undefined,
    memberSince: undefined,
    matchHistory: undefined,
    reviews: undefined,
    raw: record,
  };
};

const extractSuggestedPlayers = (payload: unknown): SuggestedPlayerRecord[] => {
  if (Array.isArray(payload)) {
    return payload as SuggestedPlayerRecord[];
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as SuggestedPlayerRecord[];
    }
    if (Array.isArray(record.players)) {
      return record.players as SuggestedPlayerRecord[];
    }
    if (Array.isArray(record.results)) {
      return record.results as SuggestedPlayerRecord[];
    }
  }
  return [];
};

const FindPlayersPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedRadius, setSelectedRadius] = useState<string>(radiusOptions[1]);
  const [appliedRadius, setAppliedRadius] = useState<string>(radiusOptions[1]);
  const [selectedLevel, setSelectedLevel] = useState<string>(levelOptions[0]);
  const [selectedGender, setSelectedGender] = useState<string>(genderOptions[0]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [players, setPlayers] = useState<DirectoryPlayer[]>([]);
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [matchProfile, setMatchProfile] = useState<StoredMatchProfile | null>(() => getStoredMatchProfile());
  const [connectModalPlayer, setConnectModalPlayer] = useState<Player | null>(null);
  const [isConnectModalOpen, setConnectModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [playerToken] = useState(() =>
    getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
  );
  const hasMatchProfile = Boolean(matchProfile);
  const { displayName } = usePlayerIdentity();
  const storedLocation = useMemo(() => getStoredLocation(), []);
  const [position, setPosition] = useState<Coordinates | null>(storedLocation);
  const [locationFilter, setLocationFilter] = useState<SelectedLocation | null>(null);
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "error">(
    storedLocation ? "ready" : "idle",
  );
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState<string>(() =>
    storedLocation ? formatCoordinatesLabel(storedLocation) : "",
  );

  useEffect(() => {
    if (!playerToken) {
      return;
    }

    let cancelled = false;

    const loadMatchProfile = async () => {
      try {
        const response = await fetchPlayerMatchProfile(playerToken);
        if (cancelled) {
          return;
        }
        const normalized = sanitizeMatchProfile(response);
        if (normalized) {
          setMatchProfile(normalized);
          storeMatchProfile(normalized);
        } else {
          setMatchProfile(null);
          storeMatchProfile(null);
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const status = (loadError as { status?: number } | undefined)?.status;
        if (status === 404) {
          setMatchProfile(null);
          storeMatchProfile(null);
          return;
        }
        console.error("Failed to load match profile", loadError);
      }
    };

    loadMatchProfile();

    return () => {
      cancelled = true;
    };
  }, [playerToken]);

  const positionKey = position ? `${position.latitude.toFixed(4)}:${position.longitude.toFixed(4)}` : "none";
  const locationQuery = buildLocationSearch(locationFilter);
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

  const applyLocationFilter = useCallback(
    (nextLocation: SelectedLocation | null) => {
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
        setMode("normal");
        return;
      }

      setLocationFilter(null);
      setLocationSearchTerm("");
      setGeoError("");
      setShowLocationPicker(false);
      setMode("normal");
      setResolvedLocationLabel("");
      setLocationStatus("idle");
      setPosition(null);
      storeLocation(null);
    },
    [setMode],
  );

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

  const hasLocationFilter = Boolean(locationFilter);

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

  useEffect(() => {
    let isCancelled = false;

    if (!playerToken) {
      setPlayers([]);
      setStatus("ready");
      setMode("error");
      setError("Please sign in to search for players.");
      return undefined;
    }

    const fetchPlayers = async () => {
      setStatus("loading");
      setError(null);
      try {
        const radiusValue = parseRadius(appliedRadius);
        const response = await getSuggestedPlayerCheckLocation({
          token: playerToken,
          perPage: 20,
          page: 1,
          search: appliedSearchTerm,
          location: locationQuery || undefined,
          radius: Number.isFinite(radiusValue) ? radiusValue : undefined,
          position: position
            ? { latitude: position.latitude, longitude: position.longitude }
            : undefined,
        });
        if (isCancelled) {
          return;
        }
        const suggestedPlayers = extractSuggestedPlayers(response);
        const mapped = suggestedPlayers.map(mapSuggestedPlayer);
        setPlayers(mapped);
        setMode(mapped.length > 0 ? "normal" : "empty");
      } catch (requestError) {
        if (isCancelled) {
          return;
        }
        setPlayers([]);
        setMode("error");
        setError(
          requestError instanceof Error
            ? requestError.message
            : "We couldn\'t load suggested players right now.",
        );
      } finally {
        if (!isCancelled) {
          setStatus("ready");
        }
      }
    };

    fetchPlayers();

    return () => {
      isCancelled = true;
    };
  }, [playerToken, appliedSearchTerm, appliedRadius, locationQuery, positionKey]);

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

  const profileShareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "https://tennisplan.app/#/settings/match-profile";
    }
    const { origin, pathname } = window.location;
    const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return `${origin}${normalizedPath}#/settings/match-profile`;
  }, []);

  const handleMatchProfileComplete = useCallback(
    async (profileDetails: MatchProfileDetails) => {
      const normalizedProfile = sanitizeMatchProfile(profileDetails) ?? profileDetails;

      if (!playerToken) {
        setMatchProfile(normalizedProfile);
        storeMatchProfile(normalizedProfile);
        setProfileModalOpen(false);
        window.alert(MATCH_PROFILE_SUCCESS_MESSAGE);
        return;
      }

      try {
        const response = await savePlayerMatchProfile({
          token: playerToken,
          profile: {
            about: normalizedProfile.about,
            level: normalizedProfile.level,
            playStyles: normalizedProfile.playStyles,
            gender: normalizedProfile.gender,
            localCourts: normalizedProfile.localCourts,
            availability: normalizedProfile.availability,
            intensity: normalizedProfile.intensity ?? null,
            preferredFormats: normalizedProfile.preferredFormats,
            homeCourt: normalizedProfile.homeCourt ?? normalizedProfile.localCourts,
          },
        });
        const persistedProfile = sanitizeMatchProfile(response) ?? normalizedProfile;
        setMatchProfile(persistedProfile);
        storeMatchProfile(persistedProfile);
        setProfileModalOpen(false);
        window.alert(MATCH_PROFILE_SUCCESS_MESSAGE);
      } catch (saveError) {
        console.error("Failed to save match profile", saveError);
        const message =
          saveError instanceof Error && saveError.message
            ? saveError.message
            : "We couldn't save your match profile. Please try again.";
        throw new Error(message);
      }
    },
    [playerToken],
  );

  const closeConnectModal = useCallback(() => {
    setConnectModalOpen(false);
    setConnectModalPlayer(null);
  }, []);

  const openConnectModalForPlayer = useCallback(
    (player: Player) => {
      if (!hasMatchProfile) {
        window.alert("Create your match profile to connect.");
        return;
      }
      setConnectModalPlayer(player);
      setConnectModalOpen(true);
    },
    [hasMatchProfile],
  );

  const handleShareIntro = useCallback(
    (nextPlayer: Player) => {
      if (!matchProfile) {
        window.alert("Create your match profile to connect.");
        return;
      }

      const trimmedDisplayName = displayName.trim();
      const senderName = trimmedDisplayName.length ? trimmedDisplayName : "TTP Player";
      const senderLevel = matchProfile?.level ?? "3.0";
      const preferredTimes = formatAvailabilityList(matchProfile?.availability ?? []);
      const message =
        `Hi ${nextPlayer.name}, I found you on the Tennis Plan App. My name is ${senderName} and I'm a ${senderLevel} ` +
        `player looking to hit ${preferredTimes} at one of our local courts. You can check out my profile here: ${profileShareUrl}. ` +
        "Let me know if you'd like to hit sometime.";

      const encodedMessage = encodeURIComponent(message);
      const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      const smsUrl = isIos ? `sms:&body=${encodedMessage}` : `sms:?body=${encodedMessage}`;

      if (typeof window.navigator.share === "function") {
        window.navigator
          .share({ text: message })
          .catch(() => {
            window.location.href = smsUrl;
          });
        return;
      }

      window.location.href = smsUrl;
    },
    [displayName, matchProfile, profileShareUrl],
  );

  const handleCreateMatchPlayIntent = useCallback(
    (nextPlayer: Player) => {
      if (!matchProfile) {
        window.alert("Create your match profile to start building MatchPlay invites.");
        return;
      }

      const connectIntent: ConnectIntent = {
        invitee: {
          id: nextPlayer.id,
          name: nextPlayer.name,
          avatarUrl: nextPlayer.profileImageUrl,
          level: nextPlayer.level,
        },
        senderName: displayName.trim() || "You",
        senderLevel: matchProfile.level,
        suggestedAvailability: [...(matchProfile.availability ?? [])],
        preferredCourt: matchProfile.localCourts?.trim() ? matchProfile.localCourts.trim() : null,
        source: "find-players",
      };

      navigate("/matches/create", { state: { connectIntent } });
      closeConnectModal();
    },
    [closeConnectModal, displayName, matchProfile, navigate],
  );

  const handleSearch = () => {
    setAppliedSearchTerm(normalize(searchTerm));
    setMode("normal");
  };

  const handleRadiusChange = (radius: string) => {
    setSelectedRadius(radius);
    setAppliedRadius(radius);
    setMode("normal");
  };

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level);
  };

  const handleGenderChange = (gender: string) => {
    setSelectedGender(gender);
  };

  const handleVerifiedToggle = (next: boolean) => {
    setVerifiedOnly(next);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setAppliedSearchTerm("");
    setSelectedRadius(radiusOptions[1]);
    setAppliedRadius(radiusOptions[1]);
    setSelectedLevel(levelOptions[0]);
    setSelectedGender(genderOptions[0]);
    setVerifiedOnly(false);
    setMode("normal");
  };

  const filteredPlayers = useMemo(() => {
    if (mode !== "normal") {
      return [];
    }

    const normalizedTerm = normalize(appliedSearchTerm);

    return players.filter((player) => {
      const matchesSearch = (() => {
        if (!normalizedTerm) {
          return true;
        }
        const haystack = [
          player.name,
          player.location,
          player.bio,
          player.lookingFor,
          ...player.availability,
          ...player.matchPreferences,
          ...player.localCourts,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedTerm);
      })();

      const matchesLevel =
        selectedLevel === "All levels" ||
        (selectedLevel === "4.5+"
          ? Number.parseFloat(player.level) >= 4.5
          : player.level === selectedLevel);

      const matchesGender =
        selectedGender === "All genders" || normalize(player.gender) === normalize(selectedGender);

      const matchesVerification = !verifiedOnly || player.verified;

      return matchesSearch && matchesLevel && matchesGender && matchesVerification;
    });
  }, [
    mode,
    appliedSearchTerm,
    players,
    selectedGender,
    selectedLevel,
    verifiedOnly,
  ]);

  const shouldShowError = status === "ready" && mode === "error";
  const shouldShowEmpty =
    status === "ready" && (mode === "empty" || (mode === "normal" && filteredPlayers.length === 0));
  const shouldShowResults = status === "ready" && mode === "normal" && filteredPlayers.length > 0;

  const resultsCountLabel = (() => {
    if (status === "loading") {
      return "Matching you with players…";
    }
    if (shouldShowError) {
      return "Unable to load players";
    }
    if (shouldShowEmpty) {
      return "No players found";
    }
    if (shouldShowResults) {
      return `${filteredPlayers.length} ${filteredPlayers.length === 1 ? "player" : "players"} found`;
    }
    return "Matching you with players…";
  })();

  return (
    <MainLayout>
      <div className="find-players-page" style={themeVars}>
        <div className="find-players-page__inner">
          <ResultsHeader
            title="Find Players"
            description="Connect with local players who match your level and style."
            actionSlot={
              <button
                type="button"
                className="fc-button fc-button--secondary"
                onClick={() => setProfileModalOpen(true)}
              >
                {hasMatchProfile ? "Edit match profile" : "Create match profile"}
              </button>
            }
          />

          {!hasMatchProfile && status === "ready" && mode !== "error" && (
            <StateBanner
              tone="empty"
              title="Create your player match profile"
              message="Share your playing style and availability to unlock player connections."
              action={
                <button
                  type="button"
                  className="fc-button fc-button--primary"
                  onClick={() => setProfileModalOpen(true)}
                >
                  Build my match profile
                </button>
              }
            />
          )}

          <PlayersFilterBar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onSearch={handleSearch}
            locationLabel={locationLabel || "Select location"}
            onLocationClick={() => {
              setGeoError("");
              setShowLocationPicker((prev) => {
                if (!prev) {
                  setLocationSearchTerm(locationFilter?.label ?? "");
                }
                return !prev;
              });
            }}
            isLocationPickerOpen={showLocationPicker}
            radiusOptions={radiusOptions}
            selectedRadius={selectedRadius}
            onRadiusChange={handleRadiusChange}
            levelOptions={levelOptions}
            selectedLevel={selectedLevel}
            onLevelChange={handleLevelChange}
            genderOptions={genderOptions}
            selectedGender={selectedGender}
            onGenderChange={handleGenderChange}
            verifiedOnly={verifiedOnly}
            onVerifiedOnlyChange={handleVerifiedToggle}
          />

          {showLocationPicker ? (
            <section className="fp-location-panel" id="player-location-picker" aria-label="Location picker">
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
                    <button
                      type="button"
                      className="fp-location-secondary"
                      onClick={() => applyLocationFilter(null)}
                    >
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
                <p className="fp-location-tip">
                  Tip: Provide a Google Places API key to enable location search suggestions.
                </p>
              ) : null}
            </section>
          ) : null}

          <span className="fc-results-count">{resultsCountLabel}</span>

          {status === "loading" && (
            <div className="players-results-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <PlayerCardSkeleton key={index} />
              ))}
            </div>
          )}

          {shouldShowError && (
            <StateBanner
              tone="error"
              title="We couldn't load players right now"
              message={error ?? "Please try again in a few minutes or adjust your filters."}
              action={
                <button type="button" className="fc-button fc-button--primary" onClick={resetFilters}>
                  Retry search
                </button>
              }
            />
          )}

          {shouldShowEmpty && !shouldShowError && (
            <StateBanner
              tone="empty"
              title="No players match these filters"
              message="Broaden your distance, clear filters, or try searching by a different playing style."
              action={
                <button type="button" className="fc-button fc-button--secondary" onClick={resetFilters}>
                  Reset filters
                </button>
              }
            />
          )}

          {shouldShowResults && (
            <div className="players-results-grid">
              {filteredPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  canConnect={hasMatchProfile}
                  onConnect={openConnectModalForPlayer}
                  onViewProfile={(nextPlayer) => {
                    navigate(`/players/${nextPlayer.id}`, {
                      state: { player: nextPlayer as DirectoryPlayer },
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <ConnectPlayerModal
        isOpen={isConnectModalOpen}
        player={connectModalPlayer}
        onClose={closeConnectModal}
        onShareIntro={() => {
          if (connectModalPlayer) {
            closeConnectModal();
            handleShareIntro(connectModalPlayer);
          }
        }}
        onCreateMatch={() => {
          if (connectModalPlayer) {
            handleCreateMatchPlayIntent(connectModalPlayer);
          }
        }}
        senderAvailability={matchProfile?.availability ?? []}
        senderCourts={matchProfile?.localCourts ?? ""}
      />

      <MatchProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialProfile={matchProfile}
        onComplete={handleMatchProfileComplete}
      />
    </MainLayout>
  );
};

export default FindPlayersPage;
