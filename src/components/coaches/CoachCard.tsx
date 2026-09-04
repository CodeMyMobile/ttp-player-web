import { Link } from "react-router-dom";
import { MapPin, Share2 } from "lucide-react";

import CoachTrustMark from "./CoachTrustMark";
import CoachCredibilityLine from "./CoachCredibilityLine";
import "./CoachCard.css";

/**
 * The coach card, in both the shapes /find-coaches renders.
 *
 * There is now ONE layout. The match variant — what the coach-match wizard produces — is
 * the same card as the listing, plus a match percentage, up to two reasons, and an
 * over-budget qualifier. It used to be a separate design with its own DOM order, its own
 * class namespace, a 64px photo against 60px, a 3-line bio clamp against 2, and its own
 * rate presentation. Keeping two shapes meant every card change landed twice and the two
 * drifted apart while appearing to converge.
 *
 * Three blocks were dropped from the match shape rather than carried over:
 *
 *  - "Usually replies within 24 hours" — hardcoded, identical for every coach, with no
 *    data behind it. The only unbacked claim on a card whose whole point is that these
 *    coaches are personally vetted. Computable from message timestamps if wanted later.
 *  - The budget block — "IN YOUR BUDGET" restated a price the player can read against a
 *    budget they set themselves. Only the negative case carries information, so that
 *    survives as a qualifier beside the price.
 *  - "NO LESSON COMMISSION" — there is no per-coach commission field anywhere in the API
 *    (the only `commission` column belongs to restringing orders), so it is a
 *    platform-level claim, not a fact about this coach.
 */
export type BudgetFlag = "in" | "over" | null;

export interface CoachCardProps {
  /** Coach display name. */
  name: string;
  /** Profile photo URL; falls back to initials when absent. */
  imageUrl?: string | null;
  /** Two-letter initials used when there is no photo. */
  initials: string;
  /** Pre-formatted distance label (e.g. "3.2 mi"). */
  distanceLabel: string;
  /** Primary certification. */
  certLabel?: string;
  /** Years coaching; rendered only when a positive number. */
  yearsExperience?: number | null;
  /** Players coached; rendered only when a positive number. */
  studentCount?: number | null;
  /** Pre-formatted private hourly rate (e.g. "$135"). */
  privateRate?: string | null;
  /** Short coach bio. */
  bio?: string;
  /** Specialty tags. */
  tags?: string[];
  /** Skill levels taught; rendered as a pill beside the specialties, on both variants. */
  levels?: string[];
  /** Pre-formatted availability sentence. */
  availabilityPhrase?: string;
  /** Short venue label appended to the availability strip. */
  locationLabel?: string | null;
  /** Router target for the profile link. */
  profileTo: string;
  /** Router state passed to the profile link (preserves search context). */
  profileState?: unknown;
  /** Invoked when "Book a lesson" is pressed. */
  onBook?: () => void;
  /** Invoked when "Share" is pressed; the button is omitted without it. */
  onShare?: () => void;

  /* ---- match variant ---- */
  /** Whole-number match percentage; the pill is hidden when null or <= 0. */
  matchPercent?: number | null;
  /** Why-this-coach-matches reasons, as returned by the recommender. */
  reasons?: string[];
  /** Whether the private rate is over the player's stated budget. */
  privateFlag?: BudgetFlag;
}

/**
 * Reasons that only restate something already visible on the card.
 *
 * The recommender emits these as prose (ttp-api coach_matching.js buildReasons), and two
 * of them duplicate fields the player can already see: distance sits in the sub line, the
 * price sits top-right. Repeating them makes the card look padded and pushes the reasons
 * that actually add something out of the two available rows.
 */
const DUPLICATIVE_REASONS = ["Nearby coach location", "Fits your budget"];

/**
 * Explicit ordering, because the source order is not meaningful.
 *
 * buildReasons pushes in a fixed sequence — level, goals, format, availability, budget —
 * and never sorts by the score breakdown, so "the first two" would be an accident of
 * append order rather than the two strongest. Ordered by how much each tells a player
 * something the card does not already say.
 */
const REASON_RANK = ["Supports your goals", "Availability overlap", "Matches your level", "Offers your preferred"];

const rankReason = (reason: string) => {
  const index = REASON_RANK.findIndex((prefix) => reason.startsWith(prefix));
  return index === -1 ? REASON_RANK.length : index;
};

export const selectCoachMatchReasons = (reasons: string[] | undefined, limit = 2): string[] =>
  (reasons ?? [])
    .map((reason) => (typeof reason === "string" ? reason.trim() : ""))
    .filter(Boolean)
    .filter((reason) => !DUPLICATIVE_REASONS.includes(reason))
    .sort((a, b) => rankReason(a) - rankReason(b))
    .slice(0, limit);

/**
 * One pill summarising the levels a coach teaches. Numeric levels collapse to a range,
 * named levels are listed. Display-only — nothing is inferred that the data does not say.
 */
export const formatLevelsPill = (levels: string[] | undefined): string | null => {
  const clean = (levels ?? []).map((level) => level.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const numbers = clean
    .map((level) => Number(level.match(/\d+(?:\.\d+)?/)?.[0]))
    .filter((value) => Number.isFinite(value));
  if (numbers.length >= 2) {
    return `Levels ${Math.min(...numbers)}–${Math.max(...numbers)}`;
  }
  return clean.length === 1 ? `Level ${clean[0]}` : `Levels ${clean.slice(0, 3).join(", ")}`;
};

const CoachCard = ({
  name,
  imageUrl,
  initials,
  distanceLabel,
  certLabel,
  yearsExperience,
  studentCount,
  privateRate,
  bio,
  tags,
  levels,
  availabilityPhrase = "",
  locationLabel,
  profileTo,
  profileState,
  onBook,
  onShare,
  matchPercent = null,
  reasons,
  privateFlag = null,
}: CoachCardProps) => {
  const specialties = (tags ?? []).filter(Boolean);
  const levelsPill = formatLevelsPill(levels);
  const showMatch = matchPercent != null && matchPercent > 0;
  const matchReasons = selectCoachMatchReasons(reasons);
  const overBudget = privateFlag === "over";
  const hasPillRow = specialties.length > 0 || Boolean(levelsPill) || matchReasons.length > 0;

  return (
    <article className="coach-card">
      <div className="cc-head">
        <div className="cc-photo">
          {imageUrl ? <img src={imageUrl} alt={name} /> : <span>{initials}</span>}
        </div>

        <div className="cc-head-mid">
          <div className="cc-name-row">
            <span className="cc-name">{name}</span>
            <CoachTrustMark />
            {/* Inline, not top-right: top-right is the price, and the price must not move
                between a matched and an unmatched card. */}
            {showMatch ? <span className="cc-match-pill">{matchPercent}% match</span> : null}
          </div>
          <div className="cc-dist">
            <MapPin className="cc-dist__pin" size={14} strokeWidth={2} aria-hidden />
            {distanceLabel}
          </div>
        </div>

        <div className="cc-rate">
          <div className="cc-rate-main">
            <span className="cc-rate-sm">$</span>
            {privateRate ? privateRate.replace("$", "") : "N/A"}
            <span className="cc-rate-sm">/hour</span>
          </div>
          {/* Only the negative case says anything. "In your budget" beside a price the
              player can read, against a budget they set, is noise. */}
          {overBudget ? <div className="cc-rate-note">over budget</div> : null}
        </div>
      </div>

      <CoachCredibilityLine
        certLabel={certLabel}
        yearsExperience={yearsExperience}
        studentCount={studentCount}
      />

      {bio ? <p className="cc-bio">{bio}</p> : null}

      {hasPillRow ? (
        <div className="cc-tags">
          {specialties.map((tag) => (
            <span key={tag} className="cc-tag">
              {tag}
            </span>
          ))}
          {levelsPill ? <span className="cc-tag cc-tag--levels">{levelsPill}</span> : null}
          {/* Reasons sit below the pills and read as sentences, so they get their own
              rows rather than being crammed into the pill flow. Clamped to one line
              each: two of them interpolate an unbounded joined list server-side. */}
          {matchReasons.map((reason) => (
            <span key={reason} className="cc-reason">
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      <div className="cc-avail">
        <span className="cc-avail-dot" aria-hidden />
        <span>
          {availabilityPhrase}
          {locationLabel ? ` · ${locationLabel}` : ""}
        </span>
      </div>

      <div className="cc-actions">
        {onShare ? (
          <button type="button" className="cc-btn cc-btn--ghost cc-btn--share" onClick={onShare}>
            <Share2 size={15} /> Share
          </button>
        ) : null}
        <Link to={profileTo} state={profileState} className="cc-btn cc-btn--ghost">
          View profile
        </Link>
        <button type="button" className="cc-btn cc-btn--primary" onClick={onBook}>
          Book a lesson
        </button>
      </div>
    </article>
  );
};

export default CoachCard;
