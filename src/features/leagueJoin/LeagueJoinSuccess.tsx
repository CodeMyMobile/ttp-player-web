import { useEffect, useState } from "react";
import { Calendar, Share2, UserPlus } from "lucide-react";

import { getLeagueDetail, type League, type LeagueEnrollmentResponse } from "../../api/leagues";
import { formatLeagueDate as formatDate } from "../../pages/leagueDetailTime";
import { downloadICSFile } from "../../play-dates/utils/calendar";
import { getJoinSuccessCopy } from "./paymentState";

export interface LeagueJoinSuccessProps {
  league: League;
  result: LeagueEnrollmentResponse;
  firstName?: string;
  onViewLeague: () => void;
}

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Confirmation screen (restyle only — enrollment already happened upstream). On mount it
// re-reads the public league detail so "N spots left" in the share action reflects the count
// AFTER this enrollment, not the stale pre-join number (which was one higher — the viewer).
const LeagueJoinSuccess = ({ league, result, firstName, onViewLeague }: LeagueJoinSuccessProps) => {
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getLeagueDetail({ leagueId: league.id, signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const remaining =
          response.metadata?.spots_remaining ?? response.league?.spots_remaining ?? null;
        const numeric = remaining == null ? null : Number(remaining);
        setSpotsRemaining(numeric != null && Number.isFinite(numeric) ? numeric : null);
      })
      .catch(() => {
        // Non-fatal — the share action just omits the spots count.
      });
    return () => controller.abort();
  }, [league.id]);

  const startDate = parseDate(league.start_date);
  const startLabel = league.start_date ? formatDate(league.start_date) : null;

  const handleCalendar = () => {
    if (!startDate) return;
    const end = parseDate(league.end_date) ?? startDate;
    try {
      downloadICSFile(
        {
          title: `${league.name} — season`,
          description: "Your flex league season on The Tennis Plan.",
          location: league.venue_name ?? "",
          start: startDate,
          end,
        },
        "league-season.ics",
      );
    } catch {
      // ICS generation failed — nothing else to do.
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/leagues/${league.id}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: league.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      // dismissed / clipboard blocked
    }
  };

  const shareLabel =
    spotsRemaining != null && spotsRemaining > 0
      ? `Share the league — ${spotsRemaining} spot${spotsRemaining === 1 ? "" : "s"} left`
      : "Share the league";

  return (
    <section className="league-join-step ljr-confirm" aria-labelledby="league-success-title">
      <div className="ljr-confirm__head">
        <div className="ljr-confirm__emoji" aria-hidden="true">🎾</div>
        <h2 id="league-success-title">You&apos;re in{firstName ? `, ${firstName}` : ""}</h2>
        <p>
          Spot confirmed and paid.
          {startLabel ? <> The season starts <b>{startLabel}</b>.</> : null}{" "}
          {getJoinSuccessCopy({
            seeded: Boolean(result.seeding?.seeded),
            startingRating: result.seeding?.starting_rating ?? null,
          })}
        </p>
      </div>

      <div className="ljr-confirm__actions">
        <button type="button" className="ljr-confirm__item" onClick={onViewLeague}>
          <span className="ljr-confirm__ic"><UserPlus size={17} /></span>
          <span>See who else is in the league</span>
          <span className="ljr-confirm__go">→</span>
        </button>
        {startDate ? (
          <button type="button" className="ljr-confirm__item" onClick={handleCalendar}>
            <span className="ljr-confirm__ic"><Calendar size={17} /></span>
            <span>Add season dates to your calendar</span>
            <span className="ljr-confirm__go">→</span>
          </button>
        ) : null}
        <button type="button" className="ljr-confirm__item" onClick={() => void handleShare()}>
          <span className="ljr-confirm__ic"><Share2 size={17} /></span>
          <span>{shareLabel}</span>
          <span className="ljr-confirm__go">→</span>
        </button>
      </div>

      <button type="button" className="league-join-sheet__primary ljr-confirm__primary" onClick={onViewLeague}>
        Go to my league
      </button>
    </section>
  );
};

export default LeagueJoinSuccess;
