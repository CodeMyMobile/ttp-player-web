// "Players looking for matches" card — players wanting times similar to yours,
// with TRP, W–L, a "still needs to play" chip, and when/where. Includes the
// "Need a match" CTA and "See all" link.

import Icon from "./Icon";
import type { LookingPlayer } from "./types";

interface PlayersLookingProps {
  looking: LookingPlayer[];
  onNeedMatch: () => void;
}

const PlayersLooking = ({ looking, onNeedMatch }: PlayersLookingProps) => (
  <section className="card looking">
    <div className="lh">
      <h3>
        <Icon name="ball-tennis" style={{ color: "#8fd14f" }} />
        Players looking for matches
      </h3>
      <span className="cnt">
        {looking.length} looking
      </span>
    </div>
    <div className="desc">These players want times similar to yours.</div>

    {looking.length ? (
      looking.map((player) => (
        <div className="look-row" key={player.playerId}>
          <div className="top">
            <span className="nm">{player.name}</span>
            <span className="tag-trp">TRP {player.rating.toFixed(3)}</span>
            <span className="tag-wl">
              W–L {player.wins}–{player.losses}
            </span>
            {player.stillNeedsToPlay ? (
              <span className="tag-ok">
                <Icon name="check" />
                Still needs to play
              </span>
            ) : null}
          </div>
          <div className="meta">
            <Icon name="calendar" style={{ fontSize: 13, verticalAlign: "-1px" }} /> {player.when} · {player.location}
          </div>
        </div>
      ))
    ) : (
      <div className="looking-empty">No players are looking for a match right now.</div>
    )}

    <button type="button" className="btn wide" style={{ marginTop: 14 }} onClick={onNeedMatch}>
      <Icon name="plus" />
      Need a match
    </button>
    <a className="see-all" href="#/leagues">
      See all <Icon name="arrow-right" style={{ fontSize: 13, verticalAlign: "-1px" }} />
    </a>
  </section>
);

export default PlayersLooking;
