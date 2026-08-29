import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { handleImageTransformError, sizedImageUrl } from "../../utils/playerImage";
import { isMeaningfulBio } from "../../utils/suggestedPlayer";
import {
  availabilitySentence,
  courtLine,
  initialsBackground,
  matchVerdict,
} from "../../utils/playerCard";
import type { Player } from "../../data/mockPlayers";

import "../coaches/coaches.css";
import "./players.css";

/** The photo slot in CSS pixels. Kept here so the image request cannot drift from it. */
const PHOTO_SIZE = 72;

export type CardViewer = {
  level: string | null;
  courts: string[];
  availability: string[];
};

type PlayerCardProps = {
  player: Player;
  canConnect: boolean;
  onConnect: (player: Player) => void;
  onViewProfile?: (player: Player) => void;
  viewer?: CardViewer | null;
};

const PlayerCard = ({ player, canConnect, onConnect, onViewProfile, viewer }: PlayerCardProps) => {
  const hasProfileImage =
    typeof player.profileImageUrl === "string" && player.profileImageUrl.trim().length > 0;
  const [imageFailedToLoad, setImageFailedToLoad] = useState(false);

  useEffect(() => {
    setImageFailedToLoad(false);
  }, [player.profileImageUrl]);

  const showPhoto = hasProfileImage && !imageFailedToLoad;

  const bio = useMemo(
    () => (isMeaningfulBio(player.bio) ? String(player.bio).trim() : ""),
    [player.bio],
  );

  const verdict = useMemo(
    () => matchVerdict(viewer?.level ?? null, player.level, Boolean(player.verified)),
    [viewer?.level, player.level, player.verified],
  );

  const court = useMemo(() => {
    const courts = player.localCourts?.length
      ? player.localCourts
      : [player.favoriteCourt].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    return courtLine(viewer?.courts, courts);
  }, [player.localCourts, player.favoriteCourt, viewer?.courts]);

  const together = useMemo(
    () => availabilitySentence(viewer?.availability, player.availability),
    [viewer?.availability, player.availability],
  );

  return (
    <article className="fc-card fp-card" aria-label={`${player.name}'s match profile`}>
      <div className="fp-card__top">
        {/* The photo leads. Square, not a small circle sharing a row with the name. */}
        <div className="fp-card__photo">
          {showPhoto ? (
            <img
              className="fp-card__photo-image"
              // 3x the CSS slot: a 72px square needs a 216px asset to stay sharp.
              src={sizedImageUrl(player.profileImageUrl, { size: PHOTO_SIZE, dpr: 3 })}
              alt=""
              loading="lazy"
              decoding="async"
              // One handler: a second onError prop would silently replace this one, and
              // the CDN fallback has to run before we give up on the photo entirely.
              onError={(event) => {
                const node = event.currentTarget;
                const alreadyRetried = node.dataset.imgFallback === "done";
                handleImageTransformError(event, player.profileImageUrl);
                if (alreadyRetried) setImageFailedToLoad(true);
              }}
            />
          ) : (
            <span
              className="fp-card__photo-initials"
              // Hue from the name, so a person's tile is the same every visit; held to a
              // muted band so a list of them sits inside the palette.
              style={{ background: initialsBackground(player.name) }}
              aria-hidden="true"
            >
              {player.initials}
            </span>
          )}

          {player.verified ? (
            <span className="fp-card__photo-tick" aria-hidden="true">
              <Check size={12} strokeWidth={3} />
            </span>
          ) : null}
        </div>

        <div className="fp-card__identity">
          <h3 className="fp-card__name">{player.name}</h3>

          {verdict ? (
            <p className={`fp-card__verdict fp-card__verdict--${verdict.tone}${verdict.hedged ? " is-hedged" : ""}`}>
              {verdict.text}
            </p>
          ) : null}

          <p className="fp-card__rating">
            {player.verified ? (
              <>
                <span className="fp-card__rating-tick" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
                <strong>NTRP {player.level}</strong>
                <span className="fp-card__rating-note">
                  confirmed by {player.verificationCount || 3} players
                </span>
              </>
            ) : (
              <>
                <strong>NTRP {player.level}</strong>
                <span className="fp-card__rating-note">self-rated</span>
              </>
            )}
          </p>
        </div>
      </div>

      {court ? (
        <p className={`fp-card__court${court.isShared ? " is-shared" : ""}`}>{court.text}</p>
      ) : null}

      {together ? <p className="fp-card__together">{together}</p> : null}

      {/* Quoted and set in a serif so it reads as a person's voice, not a column. */}
      {bio ? <blockquote className="fp-card__bio">{bio}</blockquote> : null}

      <div className="fp-card__actions">
        <button
          type="button"
          className="fp-card__connect"
          aria-disabled={canConnect ? undefined : true}
          onClick={() => onConnect(player)}
          title={
            canConnect
              ? `Connect with ${player.name}`
              : "Create your match profile to start connecting"
          }
        >
          Connect
        </button>
        <button
          type="button"
          className="fp-card__view-profile"
          onClick={() => onViewProfile?.(player)}
          disabled={!onViewProfile}
        >
          Profile
        </button>
      </div>
    </article>
  );
};

export default PlayerCard;
