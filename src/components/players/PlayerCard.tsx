import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MapPin, Navigation } from "lucide-react";
import type { Player } from "../../data/mockPlayers";

import "../coaches/coaches.css";
import "./players.css";

type PlayerCardProps = {
  player: Player;
  canConnect: boolean;
  onConnect: (player: Player) => void;
  onViewProfile?: (player: Player) => void;
};

const formatCourtLocation = (court: string) => {
  const segments = court
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    return `${segments[0]}, ${segments[1]}`;
  }

  return court.trim();
};

const PlayerCard = ({ player, canConnect, onConnect, onViewProfile }: PlayerCardProps) => {
  const bioTeaser = useMemo(() => {
    const teaserLimit = 120;
    if (player.bio.length <= teaserLimit) {
      return player.bio;
    }
    const truncated = player.bio.slice(0, teaserLimit).trimEnd();
    const lastSpace = truncated.lastIndexOf(" ");
    const safeSlice = lastSpace > teaserLimit * 0.6 ? truncated.slice(0, lastSpace) : truncated;
    return `${safeSlice}…`;
  }, [player.bio]);

  const matchPreferenceSummary = useMemo(() => {
    if (player.matchPreferences?.length) {
      return player.matchPreferences.join(" • ");
    }
    if (player.lookingFor?.trim()) {
      return player.lookingFor;
    }
    return bioTeaser;
  }, [bioTeaser, player.lookingFor, player.matchPreferences]);

  const tagline = matchPreferenceSummary.trim();

  const hasProfileImage =
    typeof player.profileImageUrl === "string" && player.profileImageUrl.trim().length > 0;
  const [imageFailedToLoad, setImageFailedToLoad] = useState(false);

  useEffect(() => {
    setImageFailedToLoad(false);
  }, [player.profileImageUrl]);

  const shouldDisplayProfileImage = hasProfileImage && !imageFailedToLoad;

  const distanceLabel = useMemo(() => {
    if (typeof player.distanceMiles !== "number" || Number.isNaN(player.distanceMiles)) {
      return "";
    }

    if (player.distanceMiles <= 0) {
      return "Nearby";
    }

    const isUnderTenMiles = player.distanceMiles < 10;
    const formattedDistance = isUnderTenMiles
      ? player.distanceMiles.toFixed(1)
      : Math.round(player.distanceMiles).toString();

    return `${formattedDistance} mi away`;
  }, [player.distanceMiles]);

  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile(player);
    }
  };

  const localCourts = useMemo(() => {
    const fallback = [player.favoriteCourt, player.location].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );

    const courts = player.localCourts?.length ? player.localCourts : fallback;

    return courts.map(formatCourtLocation);
  }, [player.favoriteCourt, player.localCourts, player.location]);

  return (
    <article className="fc-card fp-card" aria-label={`View ${player.name}'s match profile`}>
      <header className="fp-card__header">
        <div className="fp-card__identity-block">
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
          <div className="fp-card__identity">
            <div className="fp-card__name-row">
              <h3 className="fp-card__name">{player.name}</h3>
              {distanceLabel ? (
                <span className="fp-card__distance" aria-label={`${distanceLabel} from your location`}>
                  <Navigation size={16} aria-hidden="true" />
                  {distanceLabel}
                </span>
              ) : null}
            </div>
            {tagline ? (
              <p className="fp-card__tagline">{tagline}</p>
            ) : null}
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
                  <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
                  Verified rating
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="fp-card__sections">
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
            <MapPin size={16} aria-hidden="true" />
            {localCourts.length ? (
              <div className="fp-card__location-list">
                {localCourts.map((court, index) => (
                  <span className="fp-card__location-item" key={`${court}-${index}`}>
                    {court}
                  </span>
                ))}
              </div>
            ) : (
              <span className="fp-card__location-item">Flexible on courts</span>
            )}
          </div>
        </section>
      </div>

      <div className="fp-card__actions">
        <button
          type="button"
          className="fc-button fp-card__connect"
          disabled={!canConnect}
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
