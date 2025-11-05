import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  Check,
  Clock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserPlus,
  UserX,
  X,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import { findPlayerProfile } from "../data/mockPlayers";

import "./PlayerProfilePage.css";

const formatDistance = (distanceMiles: number) => {
  if (distanceMiles < 0.25) {
    return "Less than 0.25 mi away";
  }
  if (distanceMiles % 1 === 0) {
    return `${distanceMiles} mi away`;
  }
  return `${distanceMiles.toFixed(1)} mi away`;
};

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
                <img src={player.profileImageUrl} alt={`${player.name} profile portrait`} />
              </div>
              <div className="player-profile-heading">
                <div className="player-profile-name-row">
                  <h1>{player.name}</h1>
                </div>
                <div className="player-profile-ntrp-row" role="status">
                  <span className="player-profile-ntrp-value">{player.level} NTRP level</span>
                  <span
                    className={`player-profile-ntrp-status ${player.verified ? "is-verified" : "is-unverified"}`}
                  >
                    {player.verified ? (
                      <>
                        <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
                        Level verified
                      </>
                    ) : (
                      <>
                        <ShieldAlert size={16} strokeWidth={2} aria-hidden="true" />
                        Verification pending
                      </>
                    )}
                  </span>
                </div>
                <p className="player-profile-subtitle">
                  <MapPin size={18} strokeWidth={2} aria-hidden="true" />
                  <span>
                    {player.location}
                    {player.distanceMiles ? ` • ${formatDistance(player.distanceMiles)}` : ""}
                  </span>
                </p>
                <div className="player-profile-metrics" aria-label="Player highlights">
                  <div className="player-profile-metric">
                    <Star size={18} strokeWidth={2} aria-hidden="true" />
                    <span>{player.rating.toFixed(1)} match rating</span>
                  </div>
                  <div className="player-profile-metric">
                    <Activity size={18} strokeWidth={2} aria-hidden="true" />
                    <span>{player.matchFrequency}</span>
                  </div>
                  <div className="player-profile-metric">
                    <Clock size={18} strokeWidth={2} aria-hidden="true" />
                    <span>{player.lastActive}</span>
                  </div>
                  <div className="player-profile-metric">
                    <CalendarCheck size={18} strokeWidth={2} aria-hidden="true" />
                    <span>{player.availability.join(" · ")}</span>
                  </div>
                </div>
                <div className="player-profile-actions">
                  <button
                    type="button"
                    className="player-profile-action player-profile-action--secondary"
                    onClick={() => window.alert(`You won't be matched with ${player.name}.`)}
                  >
                    <UserX size={16} strokeWidth={2} aria-hidden="true" />
                    Block player
                  </button>
                  <button
                    type="button"
                    className="player-profile-action player-profile-action--primary"
                    disabled={player.verified}
                    onClick={() =>
                      window.alert(
                        player.verified
                          ? `${player.name}'s NTRP level has already been verified.`
                          : `Thanks! We'll review ${player.name}'s level and follow up.`,
                      )
                    }
                  >
                    <BadgeCheck size={16} strokeWidth={2} aria-hidden="true" />
                    {player.verified ? "NTRP level verified" : "Verify NTRP level"}
                  </button>
                </div>
              </div>
            </div>
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
              <div className="player-profile-looking-for">
                <div className="player-profile-looking-for-icon">
                  <UserPlus size={20} strokeWidth={2} aria-hidden="true" />
                </div>
                <div>
                  <span className="player-profile-looking-for-label">Looking for</span>
                  <p>{player.lookingFor}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="player-profile-section">
            <div className="player-profile-grid">
              <article className="player-profile-card">
                <header>
                  <h3>Match preferences</h3>
                  <p>How {firstName} likes to compete.</p>
                </header>
                <ul className="player-profile-pill-list">
                  {player.matchPreferences.map((preference) => (
                    <li key={preference} className="player-profile-pill">
                      {preference}
                    </li>
                  ))}
                </ul>
              </article>

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
                onClick={() => window.alert(`Connection request sent to ${player.name}!`)}
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
