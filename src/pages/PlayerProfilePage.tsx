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
  const playerLevel = player.level || (typeof player.raw?.skillLevel === "string" ? player.raw.skillLevel : undefined);
  const isLevelConfirmed = player.verified || Boolean(player.raw?.isLevelConfirmed);
  const verificationCountRaw = player.verificationCount ?? player.raw?.verifiedLevelCount;
  const verificationCount =
    typeof verificationCountRaw === "number"
      ? verificationCountRaw
      : typeof verificationCountRaw === "string"
        ? Number.parseInt(verificationCountRaw, 10)
        : undefined;
  const matchPreferences =
    (Array.isArray(player.matchPreferences) && player.matchPreferences.length > 0
      ? player.matchPreferences
      : normalizeStringArray(player.raw?.lookingFor)) || [];
  const availabilityOptions =
    (Array.isArray(player.availability) && player.availability.length > 0
      ? player.availability
      : normalizeStringArray(player.raw?.availability)) || [];
  const preferredCourts =
    (Array.isArray(player.localCourts) && player.localCourts.length > 0
      ? player.localCourts
      : normalizeStringArray(player.raw?.playerCourtLocations)) || [];
  const favoriteCourt = typeof player.favoriteCourt === "string" ? player.favoriteCourt : undefined;

  const messagePlayer = () => {
    window.alert(`Opening a new conversation with ${player.name}.`);
  };

  const blockPlayer = () => {
    window.alert(`You blocked ${player.name}.`);
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

            <div className="player-profile-sections">
              <section className="player-profile-section">
                <div className="player-profile-section-heading">
                  <h2>Player level</h2>
                  <span className={isLevelConfirmed ? "player-profile-pill player-profile-pill--verified" : "player-profile-pill"}>
                    {isLevelConfirmed && <BadgeCheck size={14} strokeWidth={2} aria-hidden="true" />}
                    {isLevelConfirmed ? "Verified player" : "Level unverified"}
                  </span>
                </div>
                <p className="player-profile-section-subhead">
                  {isLevelConfirmed
                    ? "This player's rating is verified by the community."
                    : "This player's level hasn't been confirmed yet."}
                </p>
                <div className="player-profile-level-card">
                  <div className="player-profile-level-value">
                    <span>{playerLevel ?? "Level unavailable"}</span>
                    <small>NTRP level</small>
                  </div>
                  <p>
                    {verificationCount && verificationCount > 0
                      ? `${verificationCount} ${verificationCount === 1 ? "player has" : "players have"} verified this level.`
                      : "Be the first to confirm this player's level."}
                  </p>
                </div>
                <div className="player-profile-level-support">
                  <h3>Verify player level</h3>
                  <p>Help the community keep player ratings accurate.</p>
                </div>
              </section>

              <section className="player-profile-section">
                <div className="player-profile-section-heading">
                  <h2>Play style</h2>
                </div>
                <p className="player-profile-section-subhead">What kind of session {firstName} is looking for.</p>
                {matchPreferences.length > 0 ? (
                  <div className="player-profile-chips">
                    {matchPreferences.map((preference) => (
                      <span key={preference} className="player-profile-chip">
                        {preference}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="player-profile-empty-state">No play preferences shared yet.</p>
                )}
              </section>

              <section className="player-profile-section">
                <div className="player-profile-section-heading">
                  <h2>Weekly availability</h2>
                </div>
                <p className="player-profile-section-subhead">Times that typically work best.</p>
                {availabilityOptions.length > 0 ? (
                  <ul className="player-profile-list">
                    {availabilityOptions.map((slot) => (
                      <li key={slot}>{slot}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="player-profile-empty-state">No availability shared yet.</p>
                )}
              </section>

              <section className="player-profile-section">
                <div className="player-profile-section-heading">
                  <h2>Preferred courts</h2>
                </div>
                <p className="player-profile-section-subhead">Courts {firstName} can usually play on.</p>
                {favoriteCourt || preferredCourts.length > 0 ? (
                  <ul className="player-profile-list">
                    {favoriteCourt && <li key={favoriteCourt}>{favoriteCourt}</li>}
                    {preferredCourts.map((court) => (
                      <li key={court}>{court}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="player-profile-empty-state">No preferred courts listed yet.</p>
                )}
              </section>

              <section className="player-profile-section player-profile-section--alert">
                <div className="player-profile-section-heading">
                  <h2>Report or block this player</h2>
                </div>
                <p className="player-profile-section-subhead">
                  Block this player if you no longer want to match or receive messages from them.
                </p>
                <button type="button" className="player-profile-block" onClick={blockPlayer}>
                  Block player
                </button>
              </section>
            </div>
          </article>
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerProfilePage;
