import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, MessageCircle, Star, UserPlus, UserX, X } from "lucide-react";

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

type QuickStat = { label: string; value: string };

type ProfileInfoItem = { label: string; value: string };

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
  const availabilitySlots = [
    { label: "Weekdays AM", value: "Weekdays AM" },
    { label: "Weekdays PM", value: "Weekdays PM" },
    { label: "Weekends", value: "Weekends" },
  ];

  const availability = player.availability.length
    ? player.availability
    : normalizeStringArray(player.raw?.availability);
  const lookingFor = player.matchPreferences.length
    ? player.matchPreferences
    : normalizeStringArray(player.raw?.lookingFor);
  const courts = player.localCourts.length
    ? player.localCourts
    : normalizeStringArray(player.raw?.playerCourtLocations);
  const primaryLocation = player.location || normalizeStringArray(player.raw?.playerLocations)[0] || "Location unavailable";

  const ratingDisplay = player.rating > 0 ? player.rating.toFixed(1) : "New";
  const ratingLabel = player.rating > 0 ? "Player rating" : "New to TTP";

  const quickStats: QuickStat[] = [
    { label: "Availability slots", value: availability.length.toString() },
    { label: "Saved courts", value: courts.length.toString() },
    { label: "Level verifications", value: player.verificationCount.toString() },
  ];

  const profileInfo: ProfileInfoItem[] = [
    { label: "Skill level", value: player.raw?.skillLevel ?? player.level ?? "Not specified" },
    {
      label: "Looking for",
      value: lookingFor.length ? lookingFor.join(", ") : "Not specified",
    },
    {
      label: "Availability",
      value: availability.length ? availability.join(", ") : "Not specified",
    },
    {
      label: "Primary location",
      value: primaryLocation,
    },
    {
      label: "Preferred courts",
      value: courts.length ? courts.join(", ") : "Not specified",
    },
    {
      label: "Contact",
      value: player.raw?.email ?? player.raw?.phone ?? "Not shared",
    },
  ];

  const matchHistory =
    player.matchHistory ?? [
      {
        opponent: "Local player",
        outcome: "Win" as const,
        score: "6-4, 6-4",
        date: "Mar 8, 2024",
        type: "Friendly match",
      },
      {
        opponent: "Community player",
        outcome: "Win" as const,
        score: "7-5, 6-3",
        date: "Mar 1, 2024",
        type: "League match",
      },
      {
        opponent: "Visiting player",
        outcome: "Loss" as const,
        score: "4-6, 6-2, 8-10",
        date: "Feb 20, 2024",
        type: "Friendly match",
      },
    ];
  const reviews =
    player.reviews ?? [
      {
        reviewer: "Match partner",
        rating: 5,
        date: "March 2024",
        summary: "Solid baseliner",
        detail: "Very consistent from the backcourt and easy to coordinate with.",
      },
      {
        reviewer: "League teammate",
        rating: 5,
        date: "February 2024",
        summary: "Great communicator",
        detail: "Helpful with scheduling and brings great energy to every session.",
      },
    ];

  const blockPlayer = () => {
    window.alert(`You won't be matched with ${player.name}.`);
  };

  const messagePlayer = () => {
    window.alert(`Opening a new conversation with ${player.name}.`);
  };

  const connectWithPlayer = () => {
    window.alert(`Match request sent to ${player.name}!`);
  };

  const verifyPlayerLevel = () => {
    if (player.verified) {
      window.alert(`${player.name}'s NTRP level has already been verified.`);
      return;
    }

    window.alert(`Thanks! We'll review ${player.name}'s level and follow up.`);
  };

  const displayedSupporters = player.verificationSupporters.slice(0, 4);
  const extraSupporters = Math.max(0, player.verificationCount - displayedSupporters.length);
  const verificationLabel = player.verified ? "Level verified" : "Verify this level";
  const verificationStatus = player.verified
    ? `${player.name}'s level is verified`
    : `${player.name}'s level verification is pending`;
  const verificationNote =
    player.verificationCount > 0
      ? `${player.verificationCount} ${player.verificationCount === 1 ? "player has" : "players have"} verified this level`
      : "Be the first to verify this level";

  return (
    <MainLayout>
      <div className="player-profile-page">
        <div className="player-profile-hero">
          <div className="player-profile-hero__inner">
            <button type="button" className="player-profile-back" onClick={goBackToResults}>
              <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
              Back to search results
            </button>

            <article className="player-profile-hero-card">
              <div className="player-profile-hero-main">
                <div className="player-profile-media">
                  {player.profileImageUrl ? (
                    <img src={player.profileImageUrl} alt={`${player.name} profile portrait`} />
                  ) : (
                    <span aria-hidden="true">{player.initials}</span>
                  )}
                </div>
                <div className="player-profile-hero-content">
                  <div className="player-profile-hero-heading">
                    <h1>{player.name}</h1>
                    {player.verified && (
                      <span className="player-profile-hero-badge">
                        <BadgeCheck size={16} strokeWidth={2} aria-hidden="true" />
                        Verified player
                      </span>
                    )}
                  </div>
                  <p className="player-profile-hero-location">
                    {primaryLocation}
                    {player.distanceMiles > 0 ? ` • ${player.distanceMiles.toFixed(1)} mi away` : ""}
                  </p>
                  <p className="player-profile-hero-meta">
                    {(player.responseTime ?? "Typically responds within a day")}
                    {player.lastActive ? ` • ${player.lastActive}` : ""}
                  </p>
                  <ul className="player-profile-hero-stats">
                    <li
                      className="player-profile-hero-stat"
                      aria-label={
                        player.rating > 0
                          ? `Player rating ${ratingDisplay} out of 5`
                          : "New player"
                      }
                    >
                      <span className="player-profile-hero-stat__value">
                        <Star size={18} strokeWidth={2} aria-hidden="true" />
                        {ratingDisplay}
                      </span>
                      <span className="player-profile-hero-stat__label">{ratingLabel}</span>
                    </li>
                    {quickStats.map((stat) => (
                      <li key={stat.label} className="player-profile-hero-stat">
                        <span className="player-profile-hero-stat__value">{stat.value}</span>
                        <span className="player-profile-hero-stat__label">{stat.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="player-profile-actions">
                <button
                  type="button"
                  className="player-profile-action player-profile-action--ghost"
                  onClick={messagePlayer}
                >
                  <MessageCircle size={16} strokeWidth={2} aria-hidden="true" />
                  Send message
                </button>
                <button
                  type="button"
                  className="player-profile-action player-profile-action--primary"
                  onClick={connectWithPlayer}
                >
                  <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
                  Request match
                </button>
                <button
                  type="button"
                  className="player-profile-action player-profile-action--danger"
                  onClick={blockPlayer}
                >
                  <UserX size={16} strokeWidth={2} aria-hidden="true" />
                  Block
                </button>
              </div>
            </article>
          </div>
        </div>

        <div className="player-profile-body">
          <section className="player-profile-section">
            <div className="player-profile-card">
              <header>
                <h2>About {firstName}</h2>
                <p>Get a sense of this player&apos;s on-court vibe.</p>
              </header>
              <p className="player-profile-description">{player.bio}</p>
            </div>
          </section>

          <section className="player-profile-section">
            <article className="player-profile-card player-profile-card--level">
              <header>
                <h3>Player level</h3>
                <p>See how {firstName}&apos;s rating is verified by the community.</p>
              </header>
              <div className="player-profile-level-shell">
                <div className="player-profile-level-score-block">
                  <div className="player-profile-level-score" aria-label={`${player.level} NTRP level`}>
                    <span className="player-profile-level-value">{player.level}</span>
                    <span className="player-profile-level-label">NTRP level</span>
                  </div>
                </div>
                <div className="player-profile-level-meta">
                  <header className="player-profile-card-header">
                    <div>
                      <h3>Verify player level</h3>
                      <p>Help the community keep player ratings accurate.</p>
                    </div>
                    <button
                      type="button"
                      className={`player-profile-verify-badge${player.verified ? " is-verified" : ""}`}
                      onClick={verifyPlayerLevel}
                      disabled={player.verified}
                      aria-label={player.verified ? verificationStatus : `Verify ${player.name}'s level`}
                    >
                      <BadgeCheck size={16} strokeWidth={2} aria-hidden="true" />
                      <span>{verificationLabel}</span>
                    </button>
                  </header>
                  <p className="player-profile-level-note">{verificationNote}</p>
                  {displayedSupporters.length > 0 && (
                    <ul
                      className="player-profile-level-supporters"
                      aria-label={`Players who have verified ${player.name}'s level`}
                    >
                      {displayedSupporters.map((supporter) => (
                        <li key={supporter.name}>
                          <img src={supporter.avatarUrl} alt={`${supporter.name} avatar`} />
                        </li>
                      ))}
                      {extraSupporters > 0 && (
                        <li className="player-profile-level-supporters__extra" aria-hidden="true">
                          +{extraSupporters}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          </section>

          <section className="player-profile-section">
            <div className="player-profile-grid">
              <article className="player-profile-card">
                <header>
                  <h3>Play Style</h3>
                  <p>What kind of session {firstName} is looking for.</p>
                </header>
                <ul className="player-profile-pill-list">
                  {lookingFor.length > 0 ? (
                    lookingFor.map((type) => (
                      <li key={type} className="player-profile-pill">
                        {type}
                      </li>
                    ))
                  ) : (
                    <li className="player-profile-pill">Open to any session type</li>
                  )}
                </ul>
              </article>
              <article className="player-profile-card">
                <header>
                  <h3>Preferred courts</h3>
                  <p>Courts {firstName} plays at most often.</p>
                </header>
                <ul className="player-profile-pill-list">
                  {courts.length > 0 ? (
                    courts.map((court) => (
                      <li key={court} className="player-profile-pill">
                        {court}
                      </li>
                    ))
                  ) : (
                    <li className="player-profile-pill">Courts not listed</li>
                  )}
                </ul>
              </article>
            </div>
          </section>

          <section className="player-profile-section">
            <div className="player-profile-grid">
              <article className="player-profile-card">
                <header>
                  <h3>Weekly availability</h3>
                  <p>Times that typically work best.</p>
                </header>
                <ul className="player-profile-availability-list">
                  {availabilitySlots.map((slot) => {
                    const available = availability.some((option) =>
                      option.toLowerCase().includes(slot.value.toLowerCase()),
                    );

                    return (
                      <li
                        key={slot.value}
                        className={`player-profile-availability ${available ? "is-available" : "is-unavailable"}`}
                      >
                        <span className="player-profile-availability-icon" aria-hidden="true">
                          {available ? (
                            <Check size={18} strokeWidth={2.5} />
                          ) : (
                            <X size={18} strokeWidth={2.5} />
                          )}
                        </span>
                        <div className="player-profile-availability-copy">
                          <span className="player-profile-availability-label">{slot.label}</span>
                          <span className="player-profile-availability-status">
                            {available ? "Usually available" : "Not typically available"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
              <article className="player-profile-card">
                <header>
                  <h3>Player information</h3>
                  <p>Key details to help plan your next hit.</p>
                </header>
                <dl className="player-profile-info-grid">
                  {profileInfo.map((item) => (
                    <div key={item.label} className="player-profile-info-item">
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            </div>
          </section>

          <section className="player-profile-section">
            <article className="player-profile-card">
              <header>
                <h3>Match history</h3>
                <p>Recent results logged by {firstName}.</p>
              </header>
              <ul className="player-profile-history-list">
                {matchHistory.map((match) => (
                  <li key={`${match.date}-${match.opponent}`} className="player-profile-history-item">
                    <div className="player-profile-history-main">
                      <span
                        className={`player-profile-history-outcome player-profile-history-outcome--${match.outcome.toLowerCase()}`}
                      >
                        {match.outcome}
                      </span>
                      <div className="player-profile-history-details">
                        <p>vs {match.opponent}</p>
                        <span>{match.score}</span>
                      </div>
                    </div>
                    <p className="player-profile-history-meta">
                      {match.date} • {match.type}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="player-profile-section">
            <article className="player-profile-card player-profile-card--reviews">
              <header>
                <h3>Reviews &amp; feedback</h3>
                <p>What partners have shared after playing with {firstName}.</p>
              </header>
              <ul className="player-profile-review-list">
                {reviews.map((review) => (
                  <li key={`${review.reviewer}-${review.date}`} className="player-profile-review">
                    <div className="player-profile-review-heading">
                      <div>
                        <p className="player-profile-review-author">{review.reviewer}</p>
                        <span className="player-profile-review-date">{review.date}</span>
                      </div>
                      <div className="player-profile-review-rating" aria-label={`${review.rating} star review`}>
                        {Array.from({ length: review.rating }).map((_, index) => (
                          <Star key={index} size={16} strokeWidth={2} aria-hidden="true" />
                        ))}
                      </div>
                    </div>
                    <p className="player-profile-review-summary">{review.summary}</p>
                    <p className="player-profile-review-body">{review.detail}</p>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerProfilePage;
