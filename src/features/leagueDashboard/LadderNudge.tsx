// The ladder "gap nudge": a prompt under the viewer's own ladder row pointing at
// clinics at their level. Behind VITE_LEAGUE_COACHING_PROMPTS. Dismissing it hides it
// for this league for 7 days (see levelMatchedLessons).

import { useEffect } from "react";
import { Link } from "react-router-dom";

import { track } from "../../utils/analytics";
import Icon from "./Icon";
import { nudgeDetail, nudgeHeadline, type LevelMatchedLesson } from "./levelMatchedLessons";

export interface LadderNudgeInput {
  leagueId: string;
  /** "4.0–4.5". */
  band: string;
  /** The soonest class at the viewer's level, or null for none. */
  next: LevelMatchedLesson | null;
  linkState: unknown;
}

interface LadderNudgeProps {
  nudge: LadderNudgeInput;
  viewer: { rank: number; rating: number | null };
  above: { rank: number; rating: number | null } | null;
  onDismiss: () => void;
}

const LadderNudge = ({ nudge, viewer, above, onDismiss }: LadderNudgeProps) => {
  const props = { leagueId: nudge.leagueId, levelBand: nudge.band };

  useEffect(() => {
    track("ladder_nudge_view", { leagueId: nudge.leagueId, levelBand: nudge.band });
  }, [nudge.leagueId, nudge.band]);

  return (
    <div className="ladder-nudge">
      <div className="ladder-nudge__card">
        <span className="ladder-nudge__icon" aria-hidden="true">
          <Icon name="trending-up" />
        </span>
        <span className="ladder-nudge__text">
          <span className="ladder-nudge__title">{nudgeHeadline(viewer, above)}</span>
          <span className="ladder-nudge__detail">{nudgeDetail(nudge.band, nudge.next)}</span>
        </span>
        <span className="ladder-nudge__actions">
          <Link
            className="btn ladder-nudge__cta"
            to="/group-lessons"
            state={nudge.linkState}
            onClick={() => track("ladder_nudge_click", props)}
          >
            See lessons
          </Link>
          <button
            type="button"
            className="ladder-nudge__dismiss"
            aria-label="Dismiss"
            onClick={() => {
              track("ladder_nudge_dismiss", props);
              onDismiss();
            }}
          >
            <Icon name="x" />
          </button>
        </span>
      </div>
    </div>
  );
};

export default LadderNudge;
