import { Check, ShieldCheck } from "lucide-react";

import "./TrustCard.css";

// Prominent trust statement for the Find a Coach page: every coach is invited,
// not self-serve. Static — no links or buttons (an honest trust statement).
//
// Desktop only. Below 640px the page folds the same claim into its results-count row
// as a tappable line (FindCoaches.tsx), so this card is hidden there by
// `trust-card--desktop` rather than shrinking into a second mobile treatment.
const HEADLINE = "Coaches you can trust";
const BODY = "Not a self-serve platform. We personally invite every coach on The Tennis Plan.";
const PROOF = ["Invite-only", "Personally vetted", "People we actually know"];

interface TrustCardProps {
  // Optional modifier (e.g. the in-shell instance hidden below the breakpoint).
  className?: string;
}

export default function TrustCard({ className = "" }: TrustCardProps) {
  return (
    <section className={`trust-card ${className}`.trim()} aria-label="About our coaches">
      {/* Editorial card — desktop (>= 640px) */}
      <div className="trust-card__editorial">
        <div className="trust-card__head">
          <span className="trust-card__icon" aria-hidden="true">
            <ShieldCheck size={24} strokeWidth={2} />
          </span>
          <div className="trust-card__copy">
            <h2 className="trust-card__title">{HEADLINE}</h2>
            <p className="trust-card__body">{BODY}</p>
          </div>
        </div>
        <div className="trust-card__proof">
          {PROOF.map((item) => (
            <span className="trust-card__tag" key={item}>
              <Check size={14} strokeWidth={2.5} aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
