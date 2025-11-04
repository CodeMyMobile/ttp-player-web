import { useEffect, useMemo, useRef, useState } from "react";

import MainLayout from "../components/MainLayout";
import ResultsHeader from "../components/coaches/ResultsHeader";
import PlayersFilterBar from "../components/players/PlayersFilterBar";
import PlayerCard from "../components/players/PlayerCard";
import PlayerCardSkeleton from "../components/players/PlayerCardSkeleton";
import StateBanner from "../components/coaches/StateBanner";
import { mockPlayers, type Player } from "../data/mockPlayers";
import { colors, typography } from "../lib/theme";

import "../components/coaches/coaches.css";
import "../components/players/players.css";

type Mode = "normal" | "empty" | "error";
type Status = "loading" | "ready";

const radiusOptions = ["5 mi", "10 mi", "15 mi", "20 mi", "All"];
const levelOptions = ["All levels", "2.5", "3.0", "3.5", "4.0", "4.5+"];
const availabilityOptions = [
  "All availability",
  "Mornings",
  "Early mornings",
  "Lunch",
  "Weekdays",
  "Weeknights",
  "Weekends",
];

const normalize = (value: string) => value.trim().toLowerCase();

const parseRadius = (radius: string) => {
  if (radius === "All") {
    return Number.POSITIVE_INFINITY;
  }
  const match = /^(\d+)/.exec(radius);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const FindPlayersPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRadius, setSelectedRadius] = useState<string>(radiusOptions[1]);
  const [selectedLevel, setSelectedLevel] = useState<string>(levelOptions[0]);
  const [selectedAvailability, setSelectedAvailability] = useState<string>(availabilityOptions[0]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [mode, setMode] = useState<Mode>("normal");
  const [status, setStatus] = useState<Status>("loading");
  const [hasMatchProfile, setHasMatchProfile] = useState(false);
  const loadingTimer = useRef<number>();

  useEffect(() => {
    loadingTimer.current = window.setTimeout(() => {
      setStatus("ready");
    }, 540);

    return () => {
      if (loadingTimer.current) {
        window.clearTimeout(loadingTimer.current);
      }
    };
  }, []);

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

  const beginLoading = (callback?: () => void) => {
    if (loadingTimer.current) {
      window.clearTimeout(loadingTimer.current);
    }
    setStatus("loading");
    loadingTimer.current = window.setTimeout(() => {
      callback?.();
      setStatus("ready");
    }, 420);
  };

  const handleSearch = () => {
    const trimmed = normalize(searchTerm);
    beginLoading(() => {
      if (trimmed === "error") {
        setMode("error");
      } else if (trimmed === "empty") {
        setMode("empty");
      } else {
        setMode("normal");
      }
    });
  };

  const handleRadiusChange = (radius: string) => {
    setSelectedRadius(radius);
    beginLoading(() => {
      setMode("normal");
    });
  };

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level);
    beginLoading(() => {
      setMode("normal");
    });
  };

  const handleAvailabilityChange = (availability: string) => {
    setSelectedAvailability(availability);
    beginLoading(() => {
      setMode("normal");
    });
  };

  const handleVerifiedToggle = (next: boolean) => {
    setVerifiedOnly(next);
    beginLoading(() => {
      setMode("normal");
    });
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedRadius(radiusOptions[1]);
    setSelectedLevel(levelOptions[0]);
    setSelectedAvailability(availabilityOptions[0]);
    setVerifiedOnly(false);
    beginLoading(() => {
      setMode("normal");
    });
  };

  const filteredPlayers = useMemo(() => {
    if (mode !== "normal") {
      return [];
    }

    const normalizedTerm = normalize(searchTerm);
    const radiusLimit = parseRadius(selectedRadius);

    return mockPlayers.filter((player) => {
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
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedTerm);
      })();

      const matchesLevel =
        selectedLevel === "All levels" ||
        (selectedLevel === "4.5+" ? Number.parseFloat(player.level) >= 4.5 : player.level === selectedLevel);

      const matchesAvailability = (() => {
        if (selectedAvailability === "All availability") {
          return true;
        }
        const normalizedAvailability = normalize(selectedAvailability);
        return player.availability.some((option) =>
          option.toLowerCase().includes(normalizedAvailability),
        );
      })();

      const matchesRadius = player.distanceMiles <= radiusLimit;
      const matchesVerification = !verifiedOnly || player.verified;

      return matchesSearch && matchesLevel && matchesAvailability && matchesRadius && matchesVerification;
    });
  }, [mode, searchTerm, selectedRadius, selectedLevel, selectedAvailability, verifiedOnly]);

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
                onClick={() => {
                  if (hasMatchProfile) {
                    window.alert("Match profile editing coming soon.");
                  } else {
                    setHasMatchProfile(true);
                    window.alert("Match profile created! You can now connect with players.");
                  }
                }}
              >
                {hasMatchProfile ? "Edit match profile" : "Create match profile"}
              </button>
            }
          />

          {!hasMatchProfile && status === "ready" && (
            <StateBanner
              tone="empty"
              title="Create your player match profile"
              message="Share your playing style and availability to unlock player connections."
              action={
                <button
                  type="button"
                  className="fc-button fc-button--primary"
                  onClick={() => {
                    setHasMatchProfile(true);
                    window.alert("Match profile created! You can now connect with players.");
                  }}
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
              message="Please try again in a few minutes or adjust your filters."
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
              {filteredPlayers.map((player: Player) => (
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
                    window.alert(`Previewing ${nextPlayer.name}'s profile.`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default FindPlayersPage;
