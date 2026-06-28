import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import "./CoachTrustMark.css";

// Exact, literal copy — every coach is invited (no open sign-ups). Single source of truth; do not
// paraphrase or drift into "vetted/verified".
export const TRUST_LABEL = "Invited coach";
export const TRUST_TOOLTIP =
  "Every coach is someone we know personally and have invited to the platform. No open sign-ups.";

/**
 * Quiet emerald "Invited coach" shield with a tooltip, shown by a coach's name on the search card and
 * the profile. Renders for every coach (all are invited by definition) — not gated on any flag.
 */
const CoachTrustMark = () => {
  const [open, setOpen] = useState(false);
  return (
    <span className={`coach-trust${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="coach-trust__btn"
        aria-label={`${TRUST_LABEL}. ${TRUST_TOOLTIP}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
      >
        <ShieldCheck size={15} strokeWidth={2.2} />
      </button>
      <span role="tooltip" className="coach-trust__tip">
        <strong>{TRUST_LABEL}</strong>
        <span>{TRUST_TOOLTIP}</span>
      </span>
    </span>
  );
};

export default CoachTrustMark;
