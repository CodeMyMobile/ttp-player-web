import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { handleImageTransformError, sizedImageUrl } from "../../utils/playerImage";
import { isMeaningfulBio } from "../../utils/suggestedPlayer";
import {
  availabilitySentence,
  courtLine,
  initialsBackground,
  initialsForeground,
  matchVerdict,
} from "../../utils/playerCard";
import type { Player } from "../../data/mockPlayers";

import "../coaches/coaches.css";
import "./players.css";

/** The photo slot in CSS pixels. Kept here so the image request cannot drift from it. */
const PHOTO_SIZE = 72;

export type CardViewer = {
  level: string | null;
  /** Whether the VIEWER's own rating is peer-confirmed. Defaults to false, so an
   *  unknown tier hedges rather than overstating. */
  confirmed: boolean;
  courts: string[];
  availability: string[];
};

type PlayerCardProps = {
  player: Player;
  canConnect: boolean;
  onConnect: (player: Player) => void;
  onViewProfile?: (player: Player) => void;
  viewer?: CardViewer | null;
  /** First card of a genuinely curated list. Only ever true when the stamp shows. */
  topPick?: boolean;
  /** Any tick on the card opens the explainer. */
  onExplainTick?: () => void;
};

const PlayerCard = ({ player, canConnect, onConnect, onViewProfile, viewer, topPick, onExplainTick }: PlayerCardProps) => {
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
    () =>
      matchVerdict(
        viewer?.level ?? null,
        player.level,
        Boolean(player.verified),
        Boolean(viewer?.confirmed),
      ),
    [viewer?.level, viewer?.confirmed, player.level, player.verified],
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
    <article
      className={`fc-card fp-card${topPick ? " is-top-pick" : ""}`}
      aria-label={`${player.name}'s match profile`}
    >
      {/* Gated on the same claim as the stamp — never flagged on an unranked list. */}
      {topPick ? <p className="fp-card__flag">Closest match for you</p> : null}
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
              // Monochrome on purpose — see initialsBackground.
              style={{ background: initialsBackground(), color: initialsForeground() }}
              aria-hidden="true"
            >
              {player.initials}
            </span>
          )}

          {player.verified ? (
            <button
              type="button"
              className="fp-card__photo-tick"
              aria-label="What the confirmed-rating tick means"
              onClick={onExplainTick}
              disabled={!onExplainTick}
            >
              <Check size={12} strokeWidth={3} aria-hidden="true" />
            </button>
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
                <button
                  type="button"
                  className="fp-card__rating-tick"
                  aria-label="What the confirmed-rating tick means"
                  onClick={onExplainTick}
                  disabled={!onExplainTick}
                >
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </button>
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
