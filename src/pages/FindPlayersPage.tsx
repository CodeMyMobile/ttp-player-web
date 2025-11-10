import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../components/MainLayout";
import ResultsHeader from "../components/coaches/ResultsHeader";
import PlayersFilterBar from "../components/players/PlayersFilterBar";
import PlayerCard from "../components/players/PlayerCard";
import PlayerCardSkeleton from "../components/players/PlayerCardSkeleton";
import MatchProfileModal from "../components/players/MatchProfileModal";
import StateBanner from "../components/coaches/StateBanner";
import { colors, typography } from "../lib/theme";
import { getSuggestedPlayerCheckLocation } from "../api/playerHome";
import { getStoredAuthToken } from "../services/authToken";
import type { Player } from "../data/mockPlayers";

import "../components/coaches/coaches.css";
import "../components/players/players.css";

type Mode = "normal" | "empty" | "error";
type Status = "loading" | "ready";

type Coordinates = { latitude: number; longitude: number };

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
const availabilityOptions = [
  "All availability",
  "Mornings",
  "Early mornings",
  "Lunch",
  "Weekdays",
  "Weeknights",
  "Weekends",
];

const USER_LOCATION_STORAGE_KEY = "player:web:user-location";
const DEFAULT_POSITION: Coordinates = { latitude: 34.0549076, longitude: -118.242643 };

const normalize = (value: string) => value.trim().toLowerCase();

const parseRadius = (radius: string) => {
  if (radius === "All") {
    return Number.POSITIVE_INFINITY;
  }
  const match = /^(\d+)/.exec(radius);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const getStoredLocation = (): Coordinates | null => {
  try {
    const raw = localStorage.getItem(USER_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coordinates | null;
    if (!parsed) return null;
    if (typeof parsed.latitude !== "number" || typeof parsed.longitude !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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

const ensureStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is string => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

const mapSuggestedPlayer = (record: SuggestedPlayerRecord): DirectoryPlayer => {
  const availability = ensureStringArray(record.availability);
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
    profileImageUrl: record.profile_picture ?? "",
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
  const [selectedAvailability, setSelectedAvailability] = useState<string>(availabilityOptions[0]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [players, setPlayers] = useState<DirectoryPlayer[]>([]);
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [hasMatchProfile, setHasMatchProfile] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [playerToken] = useState(() =>
    getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
  );
  const [position] = useState<Coordinates | null>(() => getStoredLocation() ?? DEFAULT_POSITION);

  const positionKey = position ? `${position.latitude.toFixed(4)}:${position.longitude.toFixed(4)}` : "none";
  const locationLabel = position ? "Current location" : "";

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
          location: locationLabel,
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
  }, [playerToken, appliedSearchTerm, appliedRadius, locationLabel, positionKey]);

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

  const handleAvailabilityChange = (availability: string) => {
    setSelectedAvailability(availability);
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
    setSelectedAvailability(availabilityOptions[0]);
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

      const matchesAvailability = (() => {
        if (selectedAvailability === "All availability") {
          return true;
        }
        const normalizedAvailability = normalize(selectedAvailability);
        return player.availability.some((option) => option.toLowerCase().includes(normalizedAvailability));
      })();

      const matchesGender =
        selectedGender === "All genders" || normalize(player.gender) === normalize(selectedGender);

      const matchesVerification = !verifiedOnly || player.verified;

      return (
        matchesSearch &&
        matchesLevel &&
        matchesAvailability &&
        matchesGender &&
        matchesVerification
      );
    });
  }, [
    mode,
    appliedSearchTerm,
    players,
    selectedAvailability,
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
            radiusOptions={radiusOptions}
            selectedRadius={selectedRadius}
            onRadiusChange={handleRadiusChange}
            levelOptions={levelOptions}
            selectedLevel={selectedLevel}
            onLevelChange={handleLevelChange}
            genderOptions={genderOptions}
            selectedGender={selectedGender}
            onGenderChange={handleGenderChange}
            availabilityOptions={availabilityOptions}
            selectedAvailability={selectedAvailability}
            onAvailabilityChange={handleAvailabilityChange}
            verifiedOnly={verifiedOnly}
            onVerifiedOnlyChange={handleVerifiedToggle}
          />

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
                  onConnect={(nextPlayer) => {
                    if (!hasMatchProfile) {
                      window.alert("Create your match profile to connect.");
                      return;
                    }
                    window.alert(`Connection request sent to ${nextPlayer.name}`);
                  }}
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
      <MatchProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onComplete={() => {
          setHasMatchProfile(true);
          setProfileModalOpen(false);
          window.alert(
            "Your match profile is live! You agree to share your contact details with other members and accept our terms. You can remove yourself from player matching anytime in settings.",
          );
        }}
      />
    </MainLayout>
  );
};

export default FindPlayersPage;
