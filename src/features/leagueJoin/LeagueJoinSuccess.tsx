import { CircleCheck } from "lucide-react";

import type { League, LeagueEnrollmentResponse } from "../../api/leagues";
import { getJoinSuccessCopy } from "./paymentState";

export interface LeagueJoinSuccessProps {
  league: League;
  result: LeagueEnrollmentResponse;
  onViewLeague: () => void;
}

const LeagueJoinSuccess = ({ league, result, onViewLeague }: LeagueJoinSuccessProps) => (
  <section className="league-join-step league-join-success" aria-labelledby="league-success-title">
    <div className="league-join-success__icon">
      <CircleCheck size={28} />
    </div>
    <h2 id="league-success-title">You're in</h2>
    <p>{league.name}</p>
    <p>
      {getJoinSuccessCopy({
        seeded: Boolean(result.seeding?.seeded),
        startingRating: result.seeding?.starting_rating ?? null,
      })}
    </p>
    <button type="button" className="league-join-sheet__primary" onClick={onViewLeague}>
      View league
    </button>
  </section>
);

export default LeagueJoinSuccess;
