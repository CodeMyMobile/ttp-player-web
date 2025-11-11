import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MessageCircle } from "lucide-react";

import MainLayout from "../components/MainLayout";
import type { Player } from "../data/mockPlayers";

import "./PlayerProfilePage.css";

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

type DirectoryPlayer = Player & { raw?: SuggestedPlayerRecord };

const normalizeStringArray = (value: unknown): string[] => {
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

const PlayerProfilePage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { player?: DirectoryPlayer } | undefined;
  const player = useMemo(() => {
    if (!locationState?.player) {
      return undefined;
    }
    if (!id || locationState.player.id === id) {
      return locationState.player;
    }
    return undefined;
  }, [id, locationState?.player]);

  const goBackToResults = () => {
    if (typeof window !== "undefined" && window.history.length <= 2) {
      navigate("/find-players");
      return;
    }
    navigate(-1);
  };

  const goToPlayers = () => {
    navigate("/find-players");
  };

  if (!player) {
    return (
      <MainLayout>
        <div className="player-profile-page player-profile-page--empty" role="alert">
          <div className="player-profile-empty-card">
            <h1>Player profile not found</h1>
            <p>
              We couldn&apos;t find the player you were looking for. Try heading back to the player directory to explore other
              match partners.
            </p>
            <button type="button" className="fc-button fc-button--primary" onClick={goToPlayers}>
              Back to players
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const firstName = player.name.split(" ")[0];
  const primaryLocation = player.location || normalizeStringArray(player.raw?.playerLocations)[0] || "Location unavailable";

  const messagePlayer = () => {
    window.alert(`Opening a new conversation with ${player.name}.`);
  };

  return (
    <MainLayout>
      <div className="player-profile-page">
        <div className="player-profile-wrapper">
          <button type="button" className="player-profile-back" onClick={goBackToResults}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
            Back to search results
          </button>

          <article className="player-profile-card">
            <div className="player-profile-header">
              <div className="player-profile-media">
                {player.profileImageUrl ? (
                  <img src={player.profileImageUrl} alt={`${player.name} profile portrait`} />
                ) : (
                  <span aria-hidden="true">{player.initials}</span>
                )}
              </div>

              <div className="player-profile-summary">
                <div className="player-profile-heading">
                  <h1>{player.name}</h1>
                  {player.verified && (
                    <span className="player-profile-verified">
                      <BadgeCheck size={16} strokeWidth={2} aria-hidden="true" />
                      Verified player
                    </span>
                  )}
                </div>
                <p className="player-profile-location">{primaryLocation}</p>
              </div>
            </div>

            {player.bio && <p className="player-profile-bio">{player.bio}</p>}

            <button type="button" className="player-profile-contact" onClick={messagePlayer}>
              <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
              <span>Contact {firstName}</span>
            </button>
          </article>
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerProfilePage;
