import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import "./CoachSearchCard.css";

export interface CoachSearchCardProps {
  /** Coach display name. */
  name: string;
  /** Profile photo URL; falls back to initials when absent. */
  imageUrl?: string | null;
  /** Two-letter initials used when there is no photo. */
  initials: string;
  /** Pre-formatted distance label (e.g. "3.2 mi"). */
  distanceLabel: string;
  /** Primary certification; rendered only when present. */
  certLabel?: string;
  /** Years coaching; rendered only when a positive number. */
  yearsExperience?: number | null;
  /** Players coached; rendered only when a positive number. */
  studentCount?: number | null;
  /** Pre-formatted private hourly rate (e.g. "$135"). */
  privateRate?: string | null;
  /** Pre-formatted per-person group rate; the caller passes null unless it's a real non-zero rate. */
  groupRate?: string | null;
  /** Short coach bio. */
  bio?: string;
  /** Specialty tags (already capped by the caller). */
  tags?: string[];
  /** Availability phrase (e.g. "Next opening · Tue 10am"). */
  availabilityPhrase: string;
  /** A single, de-duplicated location string; rendered once when present. */
  locationLabel?: string | null;
  /** Router target for "View profile". */
  profileTo: string;
  /** Router state passed to the profile link (preserves search context). */
  profileState?: unknown;
  /** Invoked when "Book a lesson" is pressed. */
  onBook?: () => void;
}

// Exact, literal copy — every coach is invited (no open sign-ups). Do not drift into "vetted/verified".
const TRUST_LABEL = "Invited coach";
const TRUST_TOOLTIP =
  "Every coach is someone we know personally and have invited to the platform. No open sign-ups.";

const CoachSearchCard = ({
  name,
  imageUrl,
  initials,
  distanceLabel,
  certLabel,
  yearsExperience,
  studentCount,
  privateRate,
  groupRate,
  bio,
  tags,
  availabilityPhrase,
  locationLabel,
  profileTo,
  profileState,
  onBook,
}: CoachSearchCardProps) => {
  const [tipOpen, setTipOpen] = useState(false);
  const hasYears = typeof yearsExperience === "number" && yearsExperience > 0;
  const hasPlayers = typeof studentCount === "number" && studentCount > 0;
  const showCredibility = Boolean(certLabel) || hasYears || hasPlayers;
  const specialties = (tags ?? []).filter(Boolean);

  return (
    <article className="csc-card">
      <div className="csc-head">
        <div className="csc-photo">
          {imageUrl ? <img src={imageUrl} alt={name} /> : <span>{initials}</span>}
        </div>

        <div className="csc-head-mid">
          <div className="csc-name-row">
            <span className="csc-name">{name}</span>
            {/* Trust mark — renders for every listed coach (all are invited by definition). */}
            <span className={`csc-trust${tipOpen ? " is-open" : ""}`}>
              <button
                type="button"
                className="csc-trust-btn"
                aria-label={`${TRUST_LABEL}. ${TRUST_TOOLTIP}`}
                aria-expanded={tipOpen}
                onClick={() => setTipOpen((open) => !open)}
                onBlur={() => setTipOpen(false)}
              >
                <ShieldCheck size={15} strokeWidth={2.2} />
              </button>
              <span role="tooltip" className="csc-trust-tip">
                <strong>{TRUST_LABEL}</strong>
                <span>{TRUST_TOOLTIP}</span>
              </span>
            </span>
          </div>
          <div className="csc-dist">{distanceLabel}</div>
        </div>

        <div className="csc-rate">
          <div className="csc-rate-main">
            <span className="csc-rate-sm">$</span>
            {privateRate ? privateRate.replace("$", "") : "N/A"}
            <span className="csc-rate-sm">/hour</span>
          </div>
          {groupRate ? <div className="csc-rate-group">group {groupRate}</div> : null}
        </div>
      </div>

      {showCredibility ? (
        <div className="csc-cred">
          {certLabel ? <span className="csc-cert-badge">{certLabel.toUpperCase()}</span> : null}
          {hasYears ? (
            <>
              {certLabel ? <span className="csc-cred-sep">·</span> : null}
              <span className="csc-cred-item">{yearsExperience} yrs coaching</span>
            </>
          ) : null}
          {hasPlayers ? (
            <>
              {certLabel || hasYears ? <span className="csc-cred-sep">·</span> : null}
              <span className="csc-cred-item">
                {studentCount} player{studentCount === 1 ? "" : "s"} coached
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      {bio ? <p className="csc-bio">{bio}</p> : null}

      {specialties.length > 0 ? (
        <div className="csc-tags">
          {specialties.map((tag) => (
            <span key={tag} className="csc-tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="csc-avail">
        <span className="csc-avail-dot" aria-hidden />
        <span>
          {availabilityPhrase}
          {locationLabel ? ` · ${locationLabel}` : ""}
        </span>
      </div>

      <div className="csc-actions">
        <Link to={profileTo} state={profileState} className="csc-btn csc-btn--ghost">
          View profile
        </Link>
        <button type="button" className="csc-btn csc-btn--primary" onClick={onBook}>
          Book a lesson
        </button>
      </div>
    </article>
  );
};

export default CoachSearchCard;
