// "Your next move" card — renders the single action returned by computeNextMove.
// The resolver owns the semantics (kind/tone/icon/copy/target); this component
// only maps them to the mock's visual: icon chip tinted by tone, title/body/meta,
// and a full-width CTA (ghost variant for the low-emphasis "all caught up").

import Icon from "./Icon";
import type { NextMove, NextMoveKind, NextMoveTarget } from "./types";

// Leading glyph for the optional meta line, chosen per action kind (the mock used
// a different meta icon per scenario). The main icon comes from move.icon.
const META_ICON: Partial<Record<NextMoveKind, string>> = {
  report_result: "clock",
  respond_challenge: "clock",
  schedule_candidate: "map-pin",
  browse_open: "arrow-right",
  add_availability: "map-pin",
  challenge_opponent: "bolt",
};

interface NextMoveCardProps {
  move: NextMove;
  onCta: (target: NextMoveTarget) => void;
}

const NextMoveCard = ({ move, onCta }: NextMoveCardProps) => {
  const metaIcon = META_ICON[move.kind];
  return (
    <div className="card move">
      <div className="mini-head v">
        <Icon name="bolt" />
        Your next move
      </div>
      <div className="row">
        <span className={`ic tone-${move.tone}`}>
          <Icon name={move.icon} />
        </span>
        <div>
          <div className="t">{move.title}</div>
          <div className="b">{move.body}</div>
          {move.meta ? (
            <div className="m">
              {metaIcon ? <Icon name={metaIcon} /> : null}
              {move.meta}
            </div>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        className={`btn wide${move.ghost ? " ghost" : ""}`}
        style={{ marginTop: 14 }}
        onClick={() => onCta(move.cta.target)}
      >
        {move.cta.label}
      </button>
    </div>
  );
};

export default NextMoveCard;
