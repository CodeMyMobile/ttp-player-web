import { ChevronRight, Users } from "lucide-react";
import { Link } from "react-router-dom";

import type { HomePlayersState } from "../../hooks/useHomePlayers";
import { ANALYTICS_EVENTS, track } from "../../utils/analytics";
import { findPlayersHref, HOME_RATING_QUIZ_HREF } from "../../utils/homePlayerSuggestions";
import type { FindPlayersPlacement } from "../../utils/homeTiles";
import type { DirectoryPlayer } from "../../utils/suggestedPlayer";
import { PlayerPhoto } from "./PlayerPhoto";

const PHOTOS = 4;

/** What the tile says and where it goes, from the same data as the carousel. */
const tileContent = (state: HomePlayersState): { photos: DirectoryPlayer[]; sub: string; href: string } => {
  if (state.status === "ready" && state.state === "suggestions") {
    return {
      photos: state.suggestions.slice(0, PHOTOS).map((suggestion) => suggestion.player),
      sub: `${state.total} at your level nearby`,
      href: findPlayersHref(state.radiusMiles),
    };
  }
  if (state.status === "ready" && state.state === "noLevel") {
    return {
      photos: state.nearby.slice(0, PHOTOS),
      sub: "Set your level to get matches",
      href: HOME_RATING_QUIZ_HREF,
    };
  }
  // Fewer than 2 at the viewer's level, or no location yet: still the way into Find Players.
  return { photos: [], sub: "Browse players near you", href: "/find-players" };
};

/**
 * The compact "Find players" tile: the first four photos from the carousel's own
 * list, so the two always agree. `placement` is "row" for the top row (styled as
 * the "This week" tile) or "grid" for the Ladder tile's slot in the action grid.
 */
export function FindPlayersTile({
  state,
  placement,
}: {
  state: HomePlayersState;
  placement: Exclude<FindPlayersPlacement, null>;
}) {
  const loading = state.status === "loading";
  const photoSize = placement === "grid" ? 28 : 36;
  const { photos, sub, href } = tileContent(state);
  const onClick = () =>
    track(ANALYTICS_EVENTS.homeFindPlayersTileClick, {
      placement,
      state: state.status === "ready" ? state.state : state.status,
    });

  const stack = loading ? (
    <span className="home-findtile__stack" aria-hidden="true">
      {Array.from({ length: PHOTOS }, (_, index) => (
        <span
          className="home-findtile__photo home-findtile__photo--skeleton"
          key={index}
          style={{ width: photoSize, height: photoSize }}
        />
      ))}
    </span>
  ) : photos.length ? (
    <span className="home-findtile__stack" aria-hidden="true">
      {photos.map((player) => (
        <PlayerPhoto key={player.id} player={player} size={photoSize} className="home-findtile__photo" />
      ))}
    </span>
  ) : (
    <Users className="home-findtile__icon" size={24} aria-hidden="true" />
  );

  if (placement === "grid") {
    return (
      <Link className="home-grid__tile home-findtile home-findtile--grid" to={href} onClick={onClick}>
        {stack}
        <span className="home-grid__label">Find players</span>
      </Link>
    );
  }

  return (
    <Link className="home-tile home-tile--bookings home-findtile" to={href} onClick={onClick}>
      <span className="home-findtile__top">
        {stack}
        <ChevronRight className="home-findtile__chevron" size={16} aria-hidden="true" />
      </span>
      <span className="home-tile__prompt-title">Find players</span>
      <span className="home-tile__prompt-sub">
        {loading ? <span className="home-findtile__sub-skeleton" aria-hidden="true" /> : sub}
      </span>
    </Link>
  );
}
