import { useEffect, useMemo, useState } from "react";
import { MapPin, ShieldCheck } from "lucide-react";
import type { Player } from "../../data/mockPlayers";

import "../coaches/coaches.css";
import "./players.css";

type PlayerCardProps = {
  player: Player;
  canConnect: boolean;
  onConnect: (player: Player) => void;
  onViewProfile?: (player: Player) => void;
};

const formatCourtLocation = (court: string) => court.split(",")[0]?.trim() || court.trim();

const getLastActiveMeta = (lastActive: string) => {
  if (!lastActive) {
    return null;
  }

  const label = lastActive.trim();
  if (!label) {
    return null;
  }

  const normalized = label.toLowerCase();
  if (normalized.includes("today")) {
    return { label, tone: "today" as const };
  }

  if (/active\s+[23]d\s+ago/.test(normalized)) {
    return { label, tone: "recent" as const };
  }

  return { label, tone: "older" as const };
};

const PlayerCard = ({ player, canConnect, onConnect, onViewProfile }: PlayerCardProps) => {
  const hasProfileImage =
    typeof player.profileImageUrl === "string" && player.profileImageUrl.trim().length > 0;
  const [imageFailedToLoad, setImageFailedToLoad] = useState(false);

  useEffect(() => {
    setImageFailedToLoad(false);
  }, [player.profileImageUrl]);

  const shouldDisplayProfileImage = hasProfileImage && !imageFailedToLoad;

  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile(player);
    }
  };

  const bio = useMemo(() => {
    if (typeof player.bio === "string" && player.bio.trim()) {
      return player.bio.trim();
    }

    return "";
  }, [player.bio]);

  const lastActiveMeta = useMemo(() => getLastActiveMeta(player.lastActive), [player.lastActive]);

  const localCourts = useMemo(() => {
    const fallback = [player.favoriteCourt].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );

    const courts = player.localCourts?.length ? player.localCourts : fallback;

    return courts.map(formatCourtLocation);
  }, [player.favoriteCourt, player.localCourts]);

  return (
    <article
      className={`fc-card fp-card${player.verified ? " fp-card--verified" : ""}`}
      aria-label={`View ${player.name}'s match profile`}
    >
      <header className="fp-card__header">
        <div className="fp-card__identity-block">
          <div className="fp-card__identity-media">
            <div className="fp-card__avatar" aria-hidden={shouldDisplayProfileImage ? undefined : true}>
              {shouldDisplayProfileImage ? (
                <img
                  className="fp-card__avatar-image"
                  src={player.profileImageUrl}
                  alt={`${player.name}'s profile picture`}
                  loading="lazy"
                  decoding="async"
                  onError={() => setImageFailedToLoad(true)}
                />
              ) : (
                player.initials
              )}
            </div>
          </div>
          <div className="fp-card__identity">
            <h3 className="fp-card__name">{player.name}</h3>
            <div className="fp-card__meta-row">
              {lastActiveMeta ? (
                <span className={`fp-card__active fp-card__active--${lastActiveMeta.tone}`}>
                  <span className="fp-card__active-dot" aria-hidden="true" />
                  {lastActiveMeta.label}
                </span>
              ) : null}
              {player.distanceMiles > 0 ? (
                <span className="fp-card__distance">
                  <MapPin size={13} aria-hidden="true" />
                  {player.distanceMiles.toFixed(1)} mi
                </span>
              ) : null}
            </div>
            <div
              className="fp-card__badges"
              aria-label={`NTRP ${player.level}${player.verified ? ", verified rating" : ""}`}
            >
              <span className="fp-card__badge fp-card__badge--level">
                NTRP <strong>{player.level}</strong>
              </span>
              {player.verified ? (
                <span
                  className="fp-card__badge fp-card__badge--verified"
                  aria-label="Verified rating"
                  title="Verified players have confirmed their identity and NTRP level through community reviews."
                >
                  <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
                  Verified
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="fp-card__sections">
        {bio ? (
          <section className="fp-card__section fp-card__section--bio" aria-label="Player bio">
            <p className="fp-card__bio">{bio}</p>
          </section>
        ) : null}
        <section className="fp-card__section fp-card__section--availability" aria-label="Availability">
          <span className="fp-card__section-label">Availability</span>
          {player.availability.length ? (
            <div className="fp-card__availability-chips">
              {player.availability.map((slot, index) => (
                <span className="fp-card__availability-chip" key={`${slot}-${index}`}>
                  {slot}
                </span>
              ))}
            </div>
          ) : (
            <span className="fp-card__availability-empty">
              Share when you're free to help others match faster
            </span>
          )}
        </section>
        <section className="fp-card__section" aria-label="Local courts">
          <span className="fp-card__section-label">Local courts</span>
          <div className="fp-card__section-value fp-card__section-value--location">
            {localCourts.length ? (
              <div className="fp-card__location-list">
                {localCourts.map((court, index) => (
                  <span className="fp-card__location-item" key={`${court}-${index}`}>
                    <MapPin size={14} aria-hidden="true" />
                    {court}
                  </span>
                ))}
              </div>
            ) : (
              <span className="fp-card__location-item fp-card__location-item--empty">
                <MapPin size={14} aria-hidden="true" />
                Flexible on courts
              </span>
            )}
          </div>
        </section>
      </div>

      <div className="fp-card__actions">
        <button
          type="button"
          className="fc-button fp-card__connect"
          aria-disabled={canConnect ? undefined : true}
          onClick={() => onConnect(player)}
          title={
            canConnect
              ? `Connect with ${player.name}`
              : "Create your player match profile to start connecting"
          }
        >
          Connect
        </button>
        <button
          type="button"
          className="fc-button fp-card__view-profile"
          onClick={handleViewProfile}
          disabled={!onViewProfile}
        >
          View profile
        </button>
      </div>
    </article>
  );
};

export default PlayerCard;
