import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import type { HomePlayersState } from "../../hooks/useHomePlayers";
import { ANALYTICS_EVENTS, track } from "../../utils/analytics";
import {
  findPlayersHref,
  HOME_RATING_QUIZ_HREF,
  type PlayerSuggestion,
} from "../../utils/homePlayerSuggestions";
import type { DirectoryPlayer } from "../../utils/suggestedPlayer";
import { PlayerPhoto } from "./PlayerPhoto";

const PROMPT_PHOTOS = 5;
const SKELETON_CARDS = 3;

interface PlayersToHitWithProps {
  state: HomePlayersState;
  onConnect: (player: DirectoryPlayer) => void;
  onViewProfile: (player: DirectoryPlayer) => void;
}

const Header = ({ action }: { action?: ReactNode }) => (
  <div className="home-players__head">
    <div className="home-players__head-copy">
      <h2 className="home-players__heading">Players to hit with</h2>
      <p className="home-players__sub">Near your level and free when you are</p>
    </div>
    {action}
  </div>
);

/**
 * "Players to hit with": a photo-card carousel of nearby players at the viewer's
 * level, or, for a viewer with no level, a prompt to set one. Who is in it and why
 * is decided by utils/homePlayerSuggestions; this only renders it.
 */
export function PlayersToHitWith({ state, onConnect, onViewProfile }: PlayersToHitWithProps) {
  const viewed = useRef<string | null>(null);

  // Once per page view, not per render.
  useEffect(() => {
    if (state.status !== "ready" || viewed.current === state.state) return;
    if (state.state === "suggestions") {
      viewed.current = state.state;
      track(ANALYTICS_EVENTS.homePlayersView, {
        count: state.suggestions.length,
        total: state.total,
        radiusMiles: state.radiusMiles,
      });
    } else if (state.state === "noLevel") {
      viewed.current = state.state;
      track(ANALYTICS_EVENTS.homeRatingPromptView, { nearbyCount: state.nearbyCount });
    }
  }, [state]);

  if (state.status === "off") return null;

  if (state.status === "loading") {
    return (
      <section className="home-players" aria-busy="true" aria-label="Players to hit with">
        <Header />
        <div className="home-players__track">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <div className="home-players__card home-players__card--skeleton" key={index} aria-hidden="true">
              <div className="home-players__band">
                <span className="home-players__skeleton-photo" />
                <span className="home-players__skeleton-line home-players__skeleton-line--chip" />
              </div>
              <div className="home-players__body">
                <span className="home-players__skeleton-line" />
                <span className="home-players__skeleton-line home-players__skeleton-line--short" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (state.state === "hidden") return null;

  if (state.state === "noLevel") {
    const photos = state.nearby.slice(0, PROMPT_PHOTOS);
    const more = state.nearbyCount - photos.length;
    return (
      <section className="home-players" aria-label="Players to hit with">
        <Header />
        <div className="home-players__prompt">
          {photos.length ? (
            <div className="home-players__stack" aria-hidden="true">
              {photos.map((player) => (
                <PlayerPhoto key={player.id} player={player} size={40} className="home-players__stack-photo" />
              ))}
              {more > 0 ? <span className="home-players__stack-more">+{more}</span> : null}
            </div>
          ) : null}
          <p className="home-players__prompt-title">Set your level to see who's a good match</p>
          <p className="home-players__prompt-sub">
            {state.nearbyCount > 0
              ? `${state.nearbyCount} ${state.nearbyCount === 1 ? "player" : "players"} near you. `
              : ""}
            Answer a few quick questions and we'll suggest people at your level.
          </p>
          <Link
            className="home-players__cta"
            to={HOME_RATING_QUIZ_HREF}
            onClick={() => track(ANALYTICS_EVENTS.homeRatingPromptClick, { source: "carousel" })}
          >
            Set my rating
          </Link>
        </div>
      </section>
    );
  }

  return (
    <Carousel
      suggestions={state.suggestions}
      total={state.total}
      radiusMiles={state.radiusMiles}
      onConnect={onConnect}
      onViewProfile={onViewProfile}
    />
  );
}

function Carousel({
  suggestions,
  total,
  radiusMiles,
  onConnect,
  onViewProfile,
}: {
  suggestions: PlayerSuggestion[];
  total: number;
  radiusMiles: number;
  onConnect: (player: DirectoryPlayer) => void;
  onViewProfile: (player: DirectoryPlayer) => void;
}) {
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    setEdges({
      start: node.scrollLeft <= 1,
      end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, suggestions.length]);

  const scrollByCard = (direction: 1 | -1) => {
    const node = trackRef.current;
    const card = node?.querySelector<HTMLElement>(".home-players__card");
    if (!node || !card) return;
    const gap = Number.parseFloat(getComputedStyle(node).columnGap) || 0;
    node.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: "smooth" });
  };

  const props = (suggestion: PlayerSuggestion, index: number) => ({
    position: index + 1,
    reasonType: suggestion.reason.type,
  });

  return (
    <section className="home-players" aria-label="Players to hit with">
      <Header
        action={
          <div className="home-players__actions">
            <Link
              className="home-players__see-all"
              to={findPlayersHref(radiusMiles)}
              onClick={() => track(ANALYTICS_EVENTS.homePlayersSeeAll, { total, radiusMiles })}
            >
              See all {total}
            </Link>
            <button
              type="button"
              className="home-players__arrow"
              aria-label="Previous players"
              disabled={edges.start}
              onClick={() => scrollByCard(-1)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="home-players__arrow"
              aria-label="More players"
              disabled={edges.end}
              onClick={() => scrollByCard(1)}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        }
      />
      <ul className="home-players__track" ref={trackRef} onScroll={updateEdges}>
        {suggestions.map((suggestion, index) => {
          const { player, reason } = suggestion;
          const court = player.localCourts[0] ?? null;
          const viewProfile = () => {
            track(ANALYTICS_EVENTS.homePlayersProfileClick, props(suggestion, index));
            onViewProfile(player);
          };
          return (
            <li className="home-players__card" key={player.id}>
              <div className="home-players__band">
                <button
                  type="button"
                  className="home-players__photo-button"
                  onClick={viewProfile}
                  aria-label={`View ${player.name}'s profile`}
                >
                  <PlayerPhoto player={player} size={84} className="home-players__photo" />
                </button>
                <span className="home-players__reason">{reason.label}</span>
              </div>
              <div className="home-players__body">
                <button type="button" className="home-players__name" onClick={viewProfile}>
                  {player.name}
                </button>
                <div className="home-players__badges">
                  <span className="home-players__level">
                    NTRP <strong>{player.level}</strong>
                  </span>
                  {player.verified ? <span className="home-players__verified">Verified</span> : null}
                </div>
                {court ? (
                  <p className="home-players__court">
                    <MapPin size={14} aria-hidden="true" />
                    <span>{court}</span>
                  </p>
                ) : null}
                <button
                  type="button"
                  className="home-players__connect"
                  onClick={() => {
                    track(ANALYTICS_EVENTS.homePlayersConnect, props(suggestion, index));
                    onConnect(player);
                  }}
                >
                  Connect
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
