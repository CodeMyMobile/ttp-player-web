import { Sparkles } from "lucide-react";

import "./CuratedStamp.css";

/**
 * "Recommended by The Tennis Plan" — the mark that says the platform did the choosing.
 *
 * IT IS A CLAIM, NOT A DECORATION. Render it only where an actual ranking ran and the
 * ordering carries information. A brand mark on an unranked list spends trust to say
 * something untrue, which costs more than showing nothing. The caller owns that gate —
 * see isCurated in utils/playerRanking — and this component owns only the appearance.
 *
 * Shared on purpose. Its value comes from being identical everywhere the platform is
 * choosing — recommended coaches, suggested leagues, suggested players — and that is
 * only true if the first use is reusable rather than a string in one page.
 */

export type CuratedStampProps = {
  /** What was chosen, e.g. "players" or "coaches". Used in the accessible label. */
  subject?: string;
  /** Optional line under the stamp explaining the basis of the ordering. */
  basis?: string;
  className?: string;
};

const CuratedStamp = ({ subject = "results", basis, className }: CuratedStampProps) => (
  <div className={`curated-stamp${className ? ` ${className}` : ""}`}>
    <p className="curated-stamp__mark">
      <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
      <span>Recommended by The Tennis Plan</span>
    </p>
    {basis ? (
      <p className="curated-stamp__basis" aria-label={`How these ${subject} were chosen`}>
        {basis}
      </p>
    ) : null}
  </div>
);

export default CuratedStamp;
