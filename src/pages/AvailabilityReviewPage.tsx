import { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CalendarCheck, MessageSquare, Search } from "lucide-react";

import type { LeagueMatchSuggestion } from "../api/leagues";
import MainLayout from "../components/MainLayout";
import { formatDateForDisplay, formatTimeForDisplay } from "../utils/dateTime";
import type { AvailabilitySlot } from "./PostAvailabilityPage";

import "./LeaguesPage.css";

const toNumber = (value: unknown): number => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : NaN;
};

const AvailabilityReviewPage = () => {
  const { id: leagueId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as {
    postedSlots?: AvailabilitySlot[];
    suggestions?: LeagueMatchSuggestion[];
  };

  const postedSlots = state.postedSlots ?? [];

  // Combine + de-dupe suggestions from all the POSTs (same player can match many slots).
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const unique: LeagueMatchSuggestion[] = [];
    (state.suggestions ?? []).forEach((s) => {
      const key = String(s.suggested_player_id ?? s.player_id ?? s.id);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(s);
    });
    return unique.sort((a, b) => {
      const da = toNumber(a.distance_miles);
      const db = toNumber(b.distance_miles);
      return (Number.isFinite(da) ? da : Infinity) - (Number.isFinite(db) ? db : Infinity);
    });
  }, [state.suggestions]);

  // Direct visit (no navigation state) — nothing to show.
  if (postedSlots.length === 0) {
    return (
      <MainLayout pageClassName="leagues-shell" hideMobileNewMatch>
        <section className="leagues-page">
          <div className="leagues-page__empty">
            <CalendarCheck size={30} />
            <h2>Nothing to review</h2>
            <p>Post your availability first, then you&apos;ll see who it reaches here.</p>
            <Link className="league-detail__back" to={`/leagues/${leagueId}`}>
              Back to league
            </Link>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      pageClassName="leagues-shell"
      hideMobileNewMatch
      hideMobileLocation
      hideMobileNotifications
      onMobileBack={() => navigate(`/leagues/${leagueId}`)}
    >
      <section className="leagues-page leagues-page--flow">
        <header className="leagues-page__header">
          <div>
            <h1>You&apos;re on the board 🎾</h1>
            <p>
              {postedSlots.length} slot{postedSlots.length === 1 ? "" : "s"} posted — here&apos;s who it can reach.
            </p>
          </div>
        </header>

        <div className="availability-review__section">
          <h2>Your posted availability</h2>
          <div className="availability-list">
            {postedSlots.map((slot) => (
              <div key={slot.id} className="availability-item">
                <div>
                  <strong>
                    {slot.dateStr || formatDateForDisplay(slot.date)} · {slot.timeStr || formatTimeForDisplay(slot.time)}
                  </strong>
                  <p>{slot.location}</p>
                </div>
                <CalendarCheck size={18} className="availability-item__ok" />
              </div>
            ))}
          </div>
        </div>

        <div className="availability-review__section">
          <h2>Players your post can reach</h2>
          {suggestions.length === 0 ? (
            <p className="league-detail__empty">
              No one&apos;s looking at these times yet — you&apos;ll be notified when a match appears.
            </p>
          ) : (
            <div className="players-looking__list">
              {suggestions.map((s) => {
                const trp = toNumber(s.player_skill);
                const dist = toNumber(s.distance_miles);
                return (
                  <div key={s.id} className="players-looking__item">
                    <div className="players-looking__info">
                      <h4>{s.player_name || "League player"}</h4>
                      {Number.isFinite(trp) ? <div className="players-looking__rating">TRP: {trp.toFixed(3)}</div> : null}
                      <div className="players-looking__meta">
                        <strong>
                          {formatDateForDisplay(s.match_date ?? "")} · {formatTimeForDisplay(s.match_time ?? "")}
                        </strong>
                        <span>
                          {s.match_location || "Location TBD"}
                          {Number.isFinite(dist) ? ` · ${dist.toFixed(1)} mi` : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="availability-review__next">
          <h2>What happens next</h2>
          <ul>
            <li>
              <MessageSquare size={16} /> Players looking at your times &amp; courts will see your post and can reach
              out.
            </li>
            <li>
              <CalendarCheck size={16} /> You&apos;ll get a notification when someone wants to play.
            </li>
          </ul>
        </div>

        <div className="availability-actions">
          <button type="button" className="availability-actions__cancel" onClick={() => navigate(`/leagues/${leagueId}`)}>
            <Search size={16} /> Browse league
          </button>
          <button type="button" className="availability-actions__submit" onClick={() => navigate(`/leagues/${leagueId}`)}>
            Back to league
          </button>
        </div>
      </section>
    </MainLayout>
  );
};

export default AvailabilityReviewPage;
