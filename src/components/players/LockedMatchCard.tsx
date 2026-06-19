import { Calendar, Lock, MapPin } from "lucide-react";

import type { PublicMatchSummary } from "../../api/publicPlayerProfile";
import { MatchCardShell, MatchFormatBlock, MatchSpots } from "./matchCardAtoms";

import "./LockedMatchCard.css";

// Bounded ("Tier 2.5") match card for the logged-out profile. Shows format,
// level, day+band, general area and spot counts only — no exact time, no
// address, no roster. The single action opens the sign-in sheet.
export interface LockedMatchCardProps {
  match: PublicMatchSummary;
  onSignIn: () => void;
}

const LockedMatchCard = ({ match, onSignIn }: LockedMatchCardProps) => {
  const total = match.spotsTotal || null;
  const spotsLeft = total ? Math.max(total - match.spotsJoined, 0) : 0;

  return (
    <MatchCardShell className="lmc-card">
      <div className="lmc-row1">
        <MatchFormatBlock format={match.format} levelLabel={match.levelLabel} />
        <MatchSpots
          spotsLeft={spotsLeft}
          joined={match.spotsJoined}
          total={total}
          tight={spotsLeft === 1}
        />
      </div>

      <div className="lmc-detail">
        <Calendar size={15} strokeWidth={2} aria-hidden="true" />
        <span>{match.dayBand}</span>
        <span className="lmc-lock-hint">
          <Lock size={11} strokeWidth={2.2} aria-hidden="true" />
          time after sign-in
        </span>
      </div>
      <div className="lmc-detail">
        <MapPin size={15} strokeWidth={2} aria-hidden="true" />
        <span>{match.generalArea}</span>
      </div>

      <button type="button" className="lmc-join" onClick={onSignIn}>
        Join this match
      </button>
    </MatchCardShell>
  );
};

export default LockedMatchCard;
