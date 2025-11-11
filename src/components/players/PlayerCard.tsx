import { useMemo } from "react";
import { CheckCircle2, MapPin } from "lucide-react";
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
    const teaserLimit = 160;
    if (player.bio.length <= teaserLimit) {
      return player.bio;
    }
    const truncated = player.bio.slice(0, teaserLimit).trimEnd();
    const lastSpace = truncated.lastIndexOf(" ");
    const safeSlice = lastSpace > teaserLimit * 0.6 ? truncated.slice(0, lastSpace) : truncated;
    return `${safeSlice}…`;
  }, [player.bio]);

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
          <div className="fp-card__avatar" aria-hidden="true">
            {player.profileImageUrl || player.avatarUrl ? (
              <img
                src={player.profileImageUrl || player.avatarUrl || ""}
                alt=""
                className="fp-card__avatar-image"
                loading="lazy"
                decoding="async"
              />
            ) : (
              player.initials
            )}
          </div>
          <div className="fp-card__identity">
            <div className="fp-card__name-row">
              <h3 className="fp-card__name">{player.name}</h3>
            </div>
            <div
              className="fp-card__badges"
              aria-label={`NTRP ${player.level}${player.verified ? ", verified player" : ""}`}
            >
              <span className="fp-card__badge fp-card__badge--level">
                NTRP <strong>{player.level}</strong>
              </span>
              {player.verified ? (
                <span
                  className="fp-card__badge fp-card__badge--verified"
                  aria-label="Verified player"
                  title="Verified players have confirmed their identity and NTRP level through community reviews."
                >
                  <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
                  Verified player
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <p className="fp-card__bio">{bioTeaser}</p>
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
          className="fc-button fp-card__view-profile"
          onClick={handleViewProfile}
          disabled={!onViewProfile}
        >
          View profile
        </button>
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
      </div>
    </article>
  );
};

export default PlayerCard;
