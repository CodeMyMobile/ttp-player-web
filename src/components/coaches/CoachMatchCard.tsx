import { Link } from "react-router-dom";
import { Check, Clock, Users } from "lucide-react";

import "./CoachMatchCard.css";

export type BudgetFlag = "in" | "over" | null;

export interface CoachMatchCardProps {
  /** Coach display name. */
  name: string;
  /** Profile photo URL; falls back to initials when absent. */
  imageUrl?: string | null;
  /** Two-letter initials used when there is no photo. */
  initials: string;
  /** Pre-formatted distance label (e.g. "3.2 mi"). */
  distanceLabel: string;
  /** Whole-number match percentage; the badge is hidden when null or <= 0. */
  matchPercent: number | null;
  /** Primary certification, shown as the credibility badge. */
  certLabel?: string;
  /** Years coaching; rendered only when a positive number. */
  yearsExperience?: number | null;
  /** Players coached; bound to real data, rendered only when a positive number. */
  studentCount?: number | null;
  /** Skill levels taught; drives the "Teaches…" meta row. */
  levels?: string[];
  /** Why-this-coach-matches reasons (already capped by the caller). */
  reasons?: string[];
  /** Pre-formatted private hourly rate (e.g. "$135"). */
  privateRate?: string | null;
  /** Pre-formatted per-person group rate (e.g. "$50"). */
  groupRate?: string | null;
  /** Whether the private rate is in/over the player's budget. */
  privateFlag?: BudgetFlag;
  /** Whether the group rate is in/over the player's budget. */
  groupFlag?: BudgetFlag;
  /** Short coach bio. */
  bio?: string;
  /** Router target for "See profile". */
  profileTo: string;
  /** Router state passed to the profile link (preserves search context). */
  profileState?: unknown;
  /** Invoked when "Book a lesson" is pressed. */
  onBook?: () => void;
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
    return `Teaches levels ${Math.min(...numbers)}–${Math.max(...numbers)}`;
  }
  return `Teaches ${clean.slice(0, 3).join(", ")}`;
};

// In-budget options lead; unknown next; over-budget last.
const budgetRank = (flag: BudgetFlag): number => (flag === "in" ? 0 : flag === "over" ? 2 : 1);

type RateOption = { text: string; flag: BudgetFlag };

const CoachMatchCard = ({
  name,
  imageUrl,
  initials,
  distanceLabel,
  matchPercent,
  certLabel,
  yearsExperience,
  studentCount,
  levels,
  reasons,
  privateRate,
  groupRate,
  privateFlag = null,
  groupFlag = null,
  bio,
  profileTo,
  profileState,
  onBook,
}: CoachMatchCardProps) => {
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
    <article className="cmc-card">
      <div className="cmc-head">
        <div className="cmc-photo">
          {imageUrl ? <img src={imageUrl} alt={name} /> : <span>{initials}</span>}
        </div>
        <div className="cmc-head-mid">
          <div className="cmc-name">{name}</div>
          <div className="cmc-dist">{distanceLabel}</div>
        </div>
        {showMatch ? (
          <div className="cmc-match">
            <div className="cmc-match-pct">{matchPercent}%</div>
            <div className="cmc-match-lbl">Match</div>
          </div>
        ) : null}
      </div>

      {showCredibility ? (
        <div className="cmc-cred">
          {certLabel ? <span className="cmc-cert-badge">{certLabel.toUpperCase()}</span> : null}
          {hasYears ? (
            <>
              {certLabel ? <span className="cmc-cred-sep">·</span> : null}
              <span className="cmc-cred-item">{yearsExperience} yrs coaching</span>
            </>
          ) : null}
          {hasPlayers ? (
            <>
              {certLabel || hasYears ? <span className="cmc-cred-sep">·</span> : null}
              <span className="cmc-cred-item">
                {studentCount} player{studentCount === 1 ? "" : "s"} coached
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="cmc-meta">
        <div className="cmc-meta-row">
          <Clock size={17} strokeWidth={1.8} />
          <span>Usually replies within 24 hours</span>
        </div>
        {teaches ? (
          <div className="cmc-meta-row">
            <Users size={17} strokeWidth={1.8} />
            <span>{teaches}</span>
          </div>
        ) : null}
      </div>

      {trimmedReasons.length > 0 ? (
        <div className="cmc-why">
          {showMatch ? (
            <div className="cmc-why-head">Why {matchPercent}% match</div>
          ) : (
            <div className="cmc-why-head">Why this coach matches</div>
          )}
          {trimmedReasons.map((reason) => (
            <div key={reason} className="cmc-why-row">
              <Check size={16} strokeWidth={3} />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      ) : null}

      {primaryRate ? (
        <div className="cmc-budget">
          <div className="cmc-budget-head">
            {primaryRate.flag === "in" ? (
              <span className="cmc-budget-tag cmc-budget-tag--in">IN YOUR BUDGET</span>
            ) : primaryRate.flag === "over" ? (
              <span className="cmc-budget-tag cmc-budget-tag--over">OVER BUDGET</span>
            ) : null}
            <span className="cmc-fee-chip">
              <Check size={11} strokeWidth={3} />
              NO LESSON COMMISSION
            </span>
          </div>
          <div className="cmc-budget-main">{primaryRate.text}</div>
          {altRate ? (
            <div className="cmc-budget-sub">
              {altRate.text}
              {altRate.flag === "over" ? " (over budget)" : ""}
            </div>
          ) : null}
        </div>
      ) : null}

      {bio ? <p className="cmc-bio">{bio}</p> : null}

      <div className="cmc-actions">
        <Link to={profileTo} state={profileState} className="cmc-btn cmc-btn--ghost">
          See profile
        </Link>
        <button type="button" className="cmc-btn cmc-btn--primary" onClick={onBook}>
          Book a lesson
        </button>
      </div>
    </article>
  );
};

export default CoachMatchCard;
