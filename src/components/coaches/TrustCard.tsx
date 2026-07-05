import { Check, ShieldCheck } from "lucide-react";

import "./TrustCard.css";

// Prominent trust statement for the Find a Coach page: every coach is invited,
// not self-serve. Static — no links or buttons (an honest trust statement).
//
// Responsive (switched by CSS at the page's 640px breakpoint):
//  - >= 640px: the editorial card (icon tile + headline + body + proof tags).
//  - <  640px: a compact single-line strip (icon + headline + "Invite-only" pill).
// Copy lives here once and is shared by both layouts.
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

      {/* Compact strip — mobile (< 640px). Single line, never wraps. The pill is a
          static label (no link/route — the fuller explainer doesn't exist yet). */}
      <div className="trust-card__strip">
        <span className="trust-card__strip-icon" aria-hidden="true">
          <ShieldCheck size={16} strokeWidth={2} />
        </span>
        <span className="trust-card__strip-title">{HEADLINE}</span>
        <span className="trust-card__strip-pill">{PROOF[0]}</span>
      </div>
    </section>
  );
}
