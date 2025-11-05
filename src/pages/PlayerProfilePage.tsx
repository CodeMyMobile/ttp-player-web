import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, MessageCircle, UserX, X } from "lucide-react";

import MainLayout from "../components/MainLayout";
import { findPlayerProfile } from "../data/mockPlayers";

import "./PlayerProfilePage.css";

const PlayerProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const player = useMemo(() => (id ? findPlayerProfile(id) : undefined), [id]);

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
              We couldn&apos;t find the player you were looking for. Try heading back to the
              player directory to explore other match partners.
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

  const blockPlayer = () => {
    window.alert(`You won't be matched with ${player.name}.`);
  };

  const connectWithPlayer = () => {
    window.alert(`Connection request sent to ${player.name}!`);
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
            <button
              type="button"
              className="player-profile-back"
              onClick={goBackToResults}
            >
              <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
              Back to search results
            </button>

            <div className="player-profile-identity">
              <div className="player-profile-media">
                {player.profileImageUrl ? (
                  <img src={player.profileImageUrl} alt={`${player.name} profile portrait`} />
                ) : (
                  <span aria-hidden="true">{player.initials}</span>
                )}
              </div>
              <div className="player-profile-heading">
                <div className="player-profile-name-row">
                  <h1>{player.name}</h1>
                </div>
                <div className="player-profile-actions">
                  <button
                    type="button"
                    className="player-profile-action player-profile-action--primary"
                    onClick={connectWithPlayer}
                  >
                    <MessageCircle size={16} strokeWidth={2} aria-hidden="true" />
                    Connect with {firstName}
                  </button>
                  <button
                    type="button"
                    className="player-profile-action player-profile-action--secondary"
                    onClick={blockPlayer}
                  >
                    <UserX size={16} strokeWidth={2} aria-hidden="true" />
                    Block player
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="player-profile-body">
          <section className="player-profile-section">
            <article className="player-profile-card player-profile-card--level">
              <div className="player-profile-level-shell">
                <div className="player-profile-level-score-block">
                  <p className="player-profile-card-eyebrow">Player level</p>
                  <div className="player-profile-level-score" aria-label={`${player.level} NTRP level`}>
                    <span className="player-profile-level-value">{player.level}</span>
                    <span className="player-profile-level-label">NTRP level</span>
                  </div>
                </div>
                <div className="player-profile-level-meta">
                  <span className="sr-only" role="status">
                    {verificationStatus}
                  </span>
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
            <div className="player-profile-card">
              <header>
                <h2>About {firstName}</h2>
                <p>Get a sense of this player&apos;s on-court vibe.</p>
              </header>
              <p className="player-profile-description">{player.bio}</p>
            </div>
          </section>

          <section className="player-profile-section">
            <div className="player-profile-grid">
              <article className="player-profile-card">
                <header>
                  <h3>Type of hit</h3>
                  <p>What kind of session {firstName} is looking for.</p>
                </header>
                <ul className="player-profile-pill-list">
                  {player.hitTypes.map((type) => (
                    <li key={type} className="player-profile-pill">
                      {type}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section className="player-profile-section">
            <article className="player-profile-card">
              <header>
                <h3>Weekly availability</h3>
                <p>Times that typically work best.</p>
              </header>
              <ul className="player-profile-availability-list">
                {availabilitySlots.map((slot) => {
                  const available = player.availability.some((option) =>
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
                      <span className="player-profile-availability-label">{slot.label}</span>
                      <span className="player-profile-availability-status">
                        {available ? "Usually available" : "Not typically available"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          </section>

          <section className="player-profile-section">
            <article className="player-profile-card">
              <header>
                <h3>Local courts</h3>
                <p>Places you&apos;re most likely to spot {firstName} on the courts.</p>
              </header>
              <ul className="player-profile-court-list">
                {player.localCourts.map((court) => (
                  <li key={court}>{court}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="player-profile-section">
            <div className="player-profile-connect-card">
              <div className="player-profile-connect-copy">
                <h3>Ready to rally with {firstName}?</h3>
                <p>Send a match request to start the conversation and coordinate your next hit.</p>
              </div>
              <button
                type="button"
                className="fc-button fc-button--primary player-profile-connect-button"
                onClick={connectWithPlayer}
              >
                Connect with {firstName}
              </button>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerProfilePage;
