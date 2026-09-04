import { Link } from "react-router-dom";
import { Check, Clock, MapPin, Share2, Users } from "lucide-react";

import CoachTrustMark from "./CoachTrustMark";
import CoachCredibilityLine from "./CoachCredibilityLine";
import "./CoachCard.css";

/**
 * The coach card, in both the variants /find-coaches renders.
 *
 * `search` is the default listing card. `match` is what the coach-match wizard produces:
 * the same subject with a match percentage, the reasons behind it, and budget flags.
 *
 * They were two components (CoachSearchCard / CoachMatchCard) with two CSS namespaces,
 * so every change to a coach card had to be made twice and the two drifted. This merge is
 * deliberately structural only — both variants render exactly what they rendered before,
 * down to the pixel.
 *
 * The variants are NOT yet one design. Their DOM order differs (match puts the bio near
 * the bottom, search near the top), and 8 of the 11 class names the two namespaces shared
 * carried different values — 64px vs 60px photos, 21px vs 19px names, a 3-line vs 2-line
 * bio clamp. Those live under the `--match` / `--search` modifiers below rather than being
 * reconciled, because reconciling them is a visual change and this commit is not.
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
  /** Pre-formatted per-person group rate (e.g. "$50"). */
  groupRate?: string | null;
  /** Short coach bio. */
  bio?: string;
  /** Router target for the profile link. */
  profileTo: string;
  /** Router state passed to the profile link (preserves search context). */
  profileState?: unknown;
  /** Invoked when "Book a lesson" is pressed. */
  onBook?: () => void;

  /* ---- search variant ---- */
  /** Specialty tags. */
  tags?: string[];
  /** Pre-formatted availability sentence. */
  availabilityPhrase?: string;
  /** Short venue label appended to the availability strip. */
  locationLabel?: string | null;
  /** Invoked when "Share" is pressed; the button is omitted without it. */
  onShare?: () => void;

  /* ---- match variant ---- */
  /**
   * Whole-number match percentage. Its presence is what selects the match variant, so a
   * caller with no wizard result simply omits it.
   */
  matchPercent?: number | null;
  /** Skill levels taught; drives the "Teaches…" meta row. */
  levels?: string[];
  /** Why-this-coach-matches reasons (already capped by the caller). */
  reasons?: string[];
  /** Whether the private rate is in/over the player's budget. */
  privateFlag?: BudgetFlag;
  /** Whether the group rate is in/over the player's budget. */
  groupFlag?: BudgetFlag;
  /**
   * Which rendering to use. Defaults to "search"; the caller passes "match" for wizard
   * results. Kept explicit rather than inferred from matchPercent, because a match with
   * no score is still a match card.
   */
  variant?: "search" | "match";
}

// Display-only: summarize the levels a coach teaches without fabricating descriptors.
// Numeric levels (e.g. 3.5, 4.5) collapse to a range; named levels are listed.
const formatTeaches = (levels: string[] | undefined): string | null => {
  const clean = (levels ?? []).map((level) => level.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const numbers = clean
    .map((level) => Number(level.match(/\d+(?:\.\d+)?/)?.[0]))
    .filter((value) => Number.isFinite(value));
  if (numbers.length >= 2) {
    return `Teaches levels ${Math.min(...numbers)}\u2013${Math.max(...numbers)}`;
  }
  return `Teaches ${clean.slice(0, 3).join(", ")}`;
};

// In-budget options lead; unknown next; over-budget last.
const budgetRank = (flag: BudgetFlag): number => (flag === "in" ? 0 : flag === "over" ? 2 : 1);

type RateOption = { text: string; flag: BudgetFlag };

const CoachCard = ({
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
  profileTo,
  profileState,
  onBook,
  tags,
  availabilityPhrase = "",
  locationLabel,
  onShare,
  matchPercent = null,
  levels,
  reasons,
  privateFlag = null,
  groupFlag = null,
  variant = "search",
}: CoachCardProps) => {
  if (variant === "match") {
  const showMatch = matchPercent != null && matchPercent > 0;
  const hasYears = typeof yearsExperience === "number" && yearsExperience > 0;
  const hasPlayers = typeof studentCount === "number" && studentCount > 0;
  const showCredibility = Boolean(certLabel) || hasYears || hasPlayers;
  const teaches = formatTeaches(levels);
  const trimmedReasons = (reasons ?? []).filter(Boolean);

  const rateOptions: RateOption[] = [];
  if (privateRate) rateOptions.push({ text: `${privateRate}/hr private lesson`, flag: privateFlag });
  if (groupRate) rateOptions.push({ text: `${groupRate}/person group lesson`, flag: groupFlag });
  rateOptions.sort((a, b) => budgetRank(a.flag) - budgetRank(b.flag));
  const primaryRate = rateOptions[0] ?? null;
  const altRate = rateOptions[1] ?? null;

  return (
    <article className="coach-card coach-card--match">
      <div className="cc-m-head">
        <div className="cc-m-photo">
          {imageUrl ? <img src={imageUrl} alt={name} /> : <span>{initials}</span>}
        </div>
        <div className="cc-m-head-mid">
          <div className="cc-m-name">{name}</div>
          <div className="cc-m-dist">{distanceLabel}</div>
        </div>
        {showMatch ? (
          <div className="cc-m-match">
            <div className="cc-m-match-pct">{matchPercent}%</div>
            <div className="cc-m-match-lbl">Match</div>
          </div>
        ) : null}
      </div>

      {showCredibility ? (
        <div className="cc-m-cred">
          {certLabel ? <span className="cc-m-cert-badge">{certLabel.toUpperCase()}</span> : null}
          {hasYears ? (
            <>
              {certLabel ? <span className="cc-m-cred-sep">·</span> : null}
              <span className="cc-m-cred-item">{yearsExperience} yrs coaching</span>
            </>
          ) : null}
          {hasPlayers ? (
            <>
              {certLabel || hasYears ? <span className="cc-m-cred-sep">·</span> : null}
              <span className="cc-m-cred-item">
                {studentCount} player{studentCount === 1 ? "" : "s"} coached
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="cc-m-meta">
        <div className="cc-m-meta-row">
          <Clock size={17} strokeWidth={1.8} />
          <span>Usually replies within 24 hours</span>
        </div>
        {teaches ? (
          <div className="cc-m-meta-row">
            <Users size={17} strokeWidth={1.8} />
            <span>{teaches}</span>
          </div>
        ) : null}
      </div>

      {trimmedReasons.length > 0 ? (
        <div className="cc-m-why">
          {showMatch ? (
            <div className="cc-m-why-head">Why {matchPercent}% match</div>
          ) : (
            <div className="cc-m-why-head">Why this coach matches</div>
          )}
          {trimmedReasons.map((reason) => (
            <div key={reason} className="cc-m-why-row">
              <Check size={16} strokeWidth={3} />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      ) : null}

      {primaryRate ? (
        <div className="cc-m-budget">
          <div className="cc-m-budget-head">
            {primaryRate.flag === "in" ? (
              <span className="cc-m-budget-tag cc-m-budget-tag--in">IN YOUR BUDGET</span>
            ) : primaryRate.flag === "over" ? (
              <span className="cc-m-budget-tag cc-m-budget-tag--over">OVER BUDGET</span>
            ) : null}
            <span className="cc-m-fee-chip">
              <Check size={11} strokeWidth={3} />
              NO LESSON COMMISSION
            </span>
          </div>
          <div className="cc-m-budget-main">{primaryRate.text}</div>
          {altRate ? (
            <div className="cc-m-budget-sub">
              {altRate.text}
              {altRate.flag === "over" ? " (over budget)" : ""}
            </div>
          ) : null}
        </div>
      ) : null}

      {bio ? <p className="cc-m-bio">{bio}</p> : null}

      <div className="cc-m-actions">
        <Link to={profileTo} state={profileState} className="cc-m-btn cc-m-btn--ghost">
          See profile
        </Link>
        <button type="button" className="cc-m-btn cc-m-btn--primary" onClick={onBook}>
          Book a lesson
        </button>
      </div>
    </article>
  );  }

  const specialties = (tags ?? []).filter(Boolean);

  return (
    <article className="coach-card coach-card--search">
      <div className="cc-s-head">
        <div className="cc-s-photo">
          {imageUrl ? <img src={imageUrl} alt={name} /> : <span>{initials}</span>}
        </div>

        <div className="cc-s-head-mid">
          <div className="cc-s-name-row">
            <span className="cc-s-name">{name}</span>
            <CoachTrustMark />
          </div>
          <div className="cc-s-dist">
            <MapPin className="cc-s-dist__pin" size={14} strokeWidth={2} aria-hidden />
            {distanceLabel}
          </div>
        </div>

        <div className="cc-s-rate">
          <div className="cc-s-rate-main">
            <span className="cc-s-rate-sm">$</span>
            {privateRate ? privateRate.replace("$", "") : "N/A"}
            <span className="cc-s-rate-sm">/hour</span>
          </div>
          {groupRate ? <div className="cc-s-rate-group">group {groupRate}</div> : null}
        </div>
      </div>

      <CoachCredibilityLine
        certLabel={certLabel}
        yearsExperience={yearsExperience}
        studentCount={studentCount}
      />

      {bio ? <p className="cc-s-bio">{bio}</p> : null}

      {specialties.length > 0 ? (
        <div className="cc-s-tags">
          {specialties.map((tag) => (
            <span key={tag} className="cc-s-tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="cc-s-avail">
        <span className="cc-s-avail-dot" aria-hidden />
        <span>
          {availabilityPhrase}
          {locationLabel ? ` · ${locationLabel}` : ""}
        </span>
      </div>

      <div className="cc-s-actions">
        {onShare ? <button type="button" className="cc-s-btn cc-s-btn--ghost cc-s-btn--share" onClick={onShare}><Share2 size={15} /> Share</button> : null}
        <Link to={profileTo} state={profileState} className="cc-s-btn cc-s-btn--ghost">
          View profile
        </Link>
        <button type="button" className="cc-s-btn cc-s-btn--primary" onClick={onBook}>
          Book a lesson
        </button>
      </div>
    </article>
  );};

export default CoachCard;
