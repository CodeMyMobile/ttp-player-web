import { MapPin, ShieldCheck, UserPlus, Zap } from "lucide-react";
import TagPill from "../coaches/TagPill";
import type { Player } from "../../data/mockPlayers";

import "../coaches/coaches.css";
import "./players.css";

type PlayerCardProps = {
  player: Player;
  canConnect: boolean;
  onConnect: (player: Player) => void;
  onViewProfile?: (player: Player) => void;
};

const formatDistance = (distanceMiles: number) => {
  if (distanceMiles <= 0) {
    return "In your area";
  }
  if (distanceMiles < 1) {
    return "<1 mile away";
  }
  return `${distanceMiles} mile${distanceMiles === 1 ? "" : "s"} away`;
};

const PlayerCard = ({ player, canConnect, onConnect, onViewProfile }: PlayerCardProps) => {
  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile(player);
    }
  };

  return (
    <article className="fc-card fp-card" aria-label={`View ${player.name}'s match profile`}>
      <div className="fp-card__top">
        <div className="fp-card__labels">
          {player.verified && (
            <TagPill tone="accent" icon={<ShieldCheck size={14} strokeWidth={2} />}>
              Verified player
            </TagPill>
          )}
          <TagPill tone="available">{player.matchFrequency}</TagPill>
        </div>

        <div
          className="fp-card__rating"
          aria-label={`Match rating ${player.rating.toFixed(1)} out of 5`}
        >
          <div className="fp-card__rating-icon">
            <Zap size={18} strokeWidth={2} />
          </div>
          <span className="fp-card__rating-score">{player.rating.toFixed(1)}</span>
          <span className="fp-card__rating-caption">Match rating</span>
        </div>
      </div>

      <div className="fc-card__profile fp-card__profile">
        <div className="fp-card__avatar" aria-hidden="true">
          {player.initials}
        </div>
        <div className="fc-card__identity fp-card__identity">
          <h3 className="fc-card__name">{player.name}</h3>
          <div className="fp-card__meta-line">
            <span>{player.level} NTRP</span>
            <span className="fp-card__separator" aria-hidden="true">
              •
            </span>
            <span>{player.handedness}-handed</span>
          </div>
          <div className="fp-card__location">
            <MapPin size={16} strokeWidth={2} />
            <div className="fp-card__location-copy">
              <span className="fp-card__location-label">{player.location}</span>
              <span className="fp-card__location-distance">{formatDistance(player.distanceMiles)}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="fp-card__bio">{player.bio}</p>

      <div className="fc-card__meta fp-card__meta">
        <div className="fc-card__meta-item">
          <span className="fc-card__meta-label">Availability</span>
          <span className="fc-card__meta-value">{player.availability.join(", ")}</span>
        </div>
        <div className="fc-card__meta-item">
          <span className="fc-card__meta-label">Match style</span>
          <span className="fc-card__meta-value">{player.matchPreferences.join(", ")}</span>
        </div>
        <div className="fc-card__meta-item">
          <span className="fc-card__meta-label">Favorite court</span>
          <span className="fc-card__meta-value">{player.favoriteCourt}</span>
        </div>
      </div>

      <div className="fp-card__looking-for">
        <div className="fp-card__looking-for-icon">
          <UserPlus size={18} strokeWidth={2} />
        </div>
        <div className="fp-card__looking-for-copy">
          <span className="fp-card__looking-for-label">Looking for</span>
          <span className="fp-card__looking-for-value">{player.lookingFor}</span>
        </div>
      </div>

      <div className="fp-card__footer">
        <span className="fp-card__status">{player.lastActive}</span>
        <div className="fc-card__actions fp-card__actions">
          <button
            type="button"
            className="fc-button fc-button--secondary"
            onClick={handleViewProfile}
            disabled={!onViewProfile}
          >
            View profile
          </button>
          <button
            type="button"
            className="fc-button fc-button--primary"
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
      </div>
    </article>
  );
};

export default PlayerCard;
