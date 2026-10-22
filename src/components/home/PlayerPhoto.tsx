import { useState } from "react";

import { handleImageTransformError, sizedImageUrl } from "../../utils/playerImage";
import type { DirectoryPlayer } from "../../utils/suggestedPlayer";

/**
 * A player's round photo, or their initials in Find Players' avatar colours when
 * there is no photo or it fails to load. The one atom the carousel, the prompt's
 * photo row and the compact tile share, so the three can't drift apart.
 */
export function PlayerPhoto({
  player,
  size,
  className = "",
}: {
  player: Pick<DirectoryPlayer, "name" | "initials" | "profileImageUrl">;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = player.profileImageUrl;

  if (!src || failed) {
    return (
      <span
        className={`home-photo home-photo--initials ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
        role="img"
        aria-label={player.name}
      >
        {player.initials}
      </span>
    );
  }

  return (
    <img
      className={`home-photo ${className}`}
      src={sizedImageUrl(src, { size })}
      width={size}
      height={size}
      alt={player.name}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        // Retry the untransformed source once, then fall back to initials.
        if (event.currentTarget.dataset.imgFallback !== "done") {
          handleImageTransformError(event, src);
          if (event.currentTarget.dataset.imgFallback === "done") return;
        }
        setFailed(true);
      }}
    />
  );
}
