import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  Clock,
  MapPin,
  ShieldCheck,
  Star,
  UserPlus,
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
              <div className="player-profile-avatar" aria-hidden="true">
                {player.initials}
              </div>
              <div className="player-profile-heading">
                <div className="player-profile-name-row">
                  <h1>{player.name}</h1>
                  {player.verified && (
                    <span className="player-profile-verified">
                      <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
                      Verified player
                    </span>
                  )}
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
                    <span>{player.level} NTRP level</span>
                  </div>
                  <div className="player-profile-metric">
                    <Clock size={18} strokeWidth={2} aria-hidden="true" />
                    <span>{player.lastActive}</span>
                  </div>
                  <div className="player-profile-metric">
                    <CalendarCheck size={18} strokeWidth={2} aria-hidden="true" />
                    <span>{player.matchFrequency}</span>
                  </div>
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
                  <h3>Weekly availability</h3>
                  <p>Times that typically work best.</p>
                </header>
                <ul className="player-profile-pill-list">
                  {player.availability.map((slot) => (
                    <li key={slot} className="player-profile-pill">
                      {slot}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section className="player-profile-section">
            <div className="player-profile-grid">
              <article className="player-profile-card player-profile-card--compact">
                <span className="player-profile-stat-label">Home court</span>
                <span className="player-profile-stat-value">{player.favoriteCourt}</span>
              </article>
              <article className="player-profile-card player-profile-card--compact">
                <span className="player-profile-stat-label">Match rhythm</span>
                <span className="player-profile-stat-value">{player.matchFrequency}</span>
              </article>
            </div>
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
