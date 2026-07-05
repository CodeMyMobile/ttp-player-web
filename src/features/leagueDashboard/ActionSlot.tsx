// Unified contextual action slot — mobile Overview only. ONE smart, specific,
// named prompt the sticky bar can't express. Evaluated top-down; renders nothing
// when no specific action applies (never a generic "post availability" echo of
// the sticky bar — that stays the bar's job).
//
// Ladder (status-colour convention: amber = needs your action, violet = neutral):
//   a. Your own unscored/completed match → report your result   (amber)
//   b. A challenge awaits your response  → respond               (amber)
//   c. A named player is looking near you → view players-looking (green = active
//      opportunity / waiting on others, per the status-colour convention)

import Icon from "./Icon";

interface ActionSlotProps {
  /** Rung a — opponent of your unscored/completed match, if any. */
  reportOpponent?: string | null;
  /** Rung b — who challenged you, if a challenge awaits your response. */
  challengeFrom?: string | null;
  /** Rung c — a specific player looking for a match near you, if any. */
  lookingName?: string | null;
  onReport: () => void;
  onRespond: () => void;
  onSeeLooking: () => void;
}

const ActionSlot = ({
  reportOpponent,
  challengeFrom,
  lookingName,
  onReport,
  onRespond,
  onSeeLooking,
}: ActionSlotProps) => {
  // role="status" so assistive tech announces the prompt when it appears.
  if (reportOpponent) {
    return (
      <section className="action-slot action-slot--amber" role="status">
        <Icon name="clipboard-check" />
        <span className="action-slot__txt">Report your result: you played {reportOpponent}</span>
        <button type="button" className="action-slot__cta" onClick={onReport}>
          Add score
        </button>
      </section>
    );
  }
  if (challengeFrom) {
    return (
      <section className="action-slot action-slot--amber" role="status">
        <Icon name="target-arrow" />
        <span className="action-slot__txt">Respond to {challengeFrom}&apos;s challenge</span>
        <button type="button" className="action-slot__cta" onClick={onRespond}>
          Respond
        </button>
      </section>
    );
  }
  if (lookingName) {
    return (
      <section className="action-slot action-slot--green" role="status">
        <Icon name="ball-tennis" />
        <span className="action-slot__txt">{lookingName} is looking for a match near you</span>
        <button type="button" className="action-slot__cta" onClick={onSeeLooking}>
          View
        </button>
      </section>
    );
  }
  // Nothing specific pending → hide entirely (no generic fallback).
  return null;
};

export default ActionSlot;
