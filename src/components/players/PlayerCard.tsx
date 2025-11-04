import { ShieldCheck, User, Zap } from "lucide-react";
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
  return (
    <article className="fp-card" aria-label={`View ${player.name}'s match profile`}>
      <div className="fp-card__header">
        <div className="fp-card__identity">
          <div className="fp-card__avatar" aria-hidden="true">
            {player.initials}
          </div>
          <div className="fp-card__identity-text">
            <div className="fp-card__identity-row">
              <h3 className="fp-card__name">{player.name}</h3>
              {player.verified && (
                <span className="fp-card__verified" role="img" aria-label="Verified player">
                  <ShieldCheck size={14} />
                  Verified
                </span>
              )}
            </div>
            <div className="fp-card__meta-line">
              <span>{player.level} NTRP</span>
              <span className="fp-card__separator" aria-hidden="true">
                •
              </span>
              <span>{player.matchFrequency}</span>
            </div>
          </div>
        </div>
        <div className="fp-card__rating" aria-label={`Player rating ${player.rating} out of 5`}>
          <Zap size={16} />
          {player.rating.toFixed(1)}
        </div>
      </div>

      <div className="fp-card__location">
        <User size={16} />
        <span>
          {player.location}
          <span className="fp-card__distance"> · {formatDistance(player.distanceMiles)}</span>
        </span>
      </div>

      <p className="fp-card__bio">{player.bio}</p>

      <dl className="fp-card__details">
        <div className="fp-card__detail">
          <dt>Availability</dt>
          <dd>{player.availability.join(", ")}</dd>
        </div>
        <div className="fp-card__detail">
          <dt>Match style</dt>
          <dd>{player.matchPreferences.join(", ")}</dd>
        </div>
        <div className="fp-card__detail">
          <dt>Looking for</dt>
          <dd>{player.lookingFor}</dd>
        </div>
      </dl>

      <div className="fp-card__footer">
        <div className="fp-card__status">{player.lastActive}</div>
        <div className="fp-card__actions">
          <button
            type="button"
            className="fc-button fc-button--secondary"
            onClick={() => onViewProfile?.(player)}
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
