import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import type { Player } from "../../data/mockPlayers";

import "../coaches/coaches.css";
import "./players.css";

type PlayerCardProps = {
  player: Player;
  canConnect: boolean;
  onConnect: (player: Player) => void;
  onViewProfile?: (player: Player) => void;
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

  return (
    <article className="fc-card fp-card" aria-label={`View ${player.name}'s match profile`}>
      <div className="fc-card__profile fp-card__profile">
        <div className="fp-card__avatar" aria-hidden="true">
          {player.initials}
        </div>
        <div className="fc-card__identity fp-card__identity">
          <h3 className="fc-card__name">{player.name}</h3>
          <div className="fp-card__metrics" aria-label={`NTRP ${player.level}${player.verified ? ", verified player" : ""}`}>
            <span className="fp-card__level">
              <span className="fp-card__level-label">NTRP</span>
              <span className="fp-card__level-value">{player.level}</span>
            </span>
            {player.verified && (
              <span
                className="fp-card__verified"
                aria-label="Verified player"
                title="Verified players have confirmed their identity and NTRP level through community reviews."
              >
                <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
                <span>Verified player</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="fp-card__bio">{bioTeaser}</p>

      <div className="fc-card__meta fp-card__meta">
        <div className="fc-card__meta-item fp-card__meta-item">
          <span className="fc-card__meta-label">Availability</span>
          <span className="fc-card__meta-value">{player.availability.join(" · ")}</span>
        </div>
        <div className="fc-card__meta-item fp-card__meta-item">
          <span className="fc-card__meta-label">Local courts</span>
          <span className="fc-card__meta-value">{player.localCourts.join(" · ")}</span>
        </div>
      </div>

      <div className="fp-card__actions">
        <button
          type="button"
          className="fc-button fc-button--secondary fp-card__view-profile"
          onClick={handleViewProfile}
          disabled={!onViewProfile}
        >
          View profile
        </button>
        <button
          type="button"
          className="fc-button fc-button--primary fp-card__connect"
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
