import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CalendarCheck, MessageSquare, Search, Send } from "lucide-react";

import {
  getLeaguePlayers,
  isLeagueSlotAvailable,
  sendLeagueMatchNeedInvites,
  type LeagueMatchSuggestion,
  type LeaguePlayer,
} from "../api/leagues";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { formatDateForDisplay, formatTimeForDisplay } from "../utils/dateTime";
import type { AvailabilitySlot } from "./PostAvailabilityPage";

import "./LeaguesPage.css";

const toNumber = (value: unknown): number => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : NaN;
};

const normalizeIdentity = (value: unknown) => String(value ?? "").trim().toLowerCase();

const INVITE_MESSAGE_MAX = 160;
const DEFAULT_INVITE_MESSAGE =
  "Hey! I just posted my availability in our league — want to lock in a match?";

const AvailabilityReviewPage = () => {
  const { id: leagueId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const token = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );
  const state = (location.state ?? {}) as {
    postedSlots?: AvailabilitySlot[];
    suggestions?: LeagueMatchSuggestion[];
    matchId?: number | string | null;
    returnTo?: string;
  };

  const postedSlots = state.postedSlots ?? [];
  const matchId = state.matchId ?? null;
  // Return to the launching page (e.g. the dashboard) when provided.
  const returnTo = state.returnTo ?? `/leagues/${leagueId}`;

  const currentUserIdentities = useMemo(
    () =>
      new Set(
        [
          normalizeIdentity(user?.id),
          normalizeIdentity(user?.user_id),
          normalizeIdentity(user?.player_id),
          normalizeIdentity(user?.email),
          normalizeIdentity(user?.profile?.email),
          normalizeIdentity(user?.full_name),
          normalizeIdentity(user?.profile?.full_name),
          normalizeIdentity(user?.name),
        ].filter(Boolean),
      ),
    [user],
  );

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

  // Invite step: league players you still need to play (roster minus yourself).
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [inviteMessage, setInviteMessage] = useState(DEFAULT_INVITE_MESSAGE);
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    if (!leagueId || !matchId) return;
    const controller = new AbortController();
    getLeaguePlayers({ leagueId, token, signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const others = (res.players ?? []).filter((player) => {
          const ids = [
            normalizeIdentity(player.player_id),
            normalizeIdentity(player.email),
            normalizeIdentity(player.full_name),
          ].filter(Boolean);
          return !ids.some((identity) => currentUserIdentities.has(identity));
        });
        setPlayers(others);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPlayers([]);
      });
    return () => controller.abort();
  }, [leagueId, matchId, token, currentUserIdentities]);

  const togglePlayer = (playerId: number | string) =>
    setSelectedIds((current) =>
      current.some((x) => String(x) === String(playerId))
        ? current.filter((x) => String(x) !== String(playerId))
        : [...current, playerId],
    );

  const sendInvites = async () => {
    if (!matchId || !selectedIds.length) return;
    if (inviteMessage.length > INVITE_MESSAGE_MAX) {
      setInviteError(`Message must be ${INVITE_MESSAGE_MAX} characters or fewer.`);
      return;
    }
    setSending(true);
    setInviteError(null);
    try {
      await sendLeagueMatchNeedInvites({
        leagueId,
        matchId,
        token,
        body: { player_ids: selectedIds, message: inviteMessage },
      });
      setSentCount(selectedIds.length);
      setSelectedIds([]);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Couldn't send invites. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Direct visit (no navigation state) — nothing to show.
  if (postedSlots.length === 0) {
    return (
      <MainLayout pageClassName="leagues-shell" hideMobileNewMatch>
        <section className="leagues-page">
          <div className="leagues-page__empty">
            <CalendarCheck size={30} />
            <h2>Nothing to review</h2>
            <p>Post your availability first, then you&apos;ll see who it reaches here.</p>
            <Link className="league-detail__back" to={returnTo}>
              Back to league
            </Link>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      pageClassName="leagues-shell leagues-shell--flow"
      hideMobileNewMatch
      hideMobileLocation
      hideMobileNotifications
      onMobileBack={() => navigate(returnTo)}
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
                const tpr = toNumber(s.player_skill);
                const dist = toNumber(s.distance_miles);
                return (
                  <div key={s.id} className="players-looking__item">
                    <div className="players-looking__info">
                      <h4>
                        {s.player_name || "League player"}
                        {!isLeagueSlotAvailable(s) ? <em className="league-full-badge">Full</em> : null}
                      </h4>
                      {Number.isFinite(tpr) ? <div className="players-looking__rating">TPR: {tpr.toFixed(3)}</div> : null}
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

        {matchId && players.length > 0 ? (
          <div className="availability-review__section availability-invite">
            <h2>Invite players you still need to play</h2>
            <p className="availability-invite__sub">Pick opponents in your league and send them an SMS invite to book a match.</p>
            {sentCount > 0 ? (
              <p className="availability-invite__sent">✓ Sent {sentCount} invite{sentCount === 1 ? "" : "s"}.</p>
            ) : null}
            <div className="availability-invite__list">
              {players.map((player) => {
                const checked = selectedIds.some((x) => String(x) === String(player.player_id));
                const tpr = toNumber(player.current_rating);
                return (
                  <label className="league-need-invitee" key={player.player_id}>
                    <input type="checkbox" checked={checked} onChange={() => togglePlayer(player.player_id)} />
                    <span>
                      {player.full_name || `Player ${player.player_id}`}
                      {Number.isFinite(tpr) ? ` · TPR ${tpr.toFixed(3)}` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
            <label className="league-need-field">
              <span>Message</span>
              <textarea
                maxLength={INVITE_MESSAGE_MAX}
                value={inviteMessage}
                onChange={(event) => setInviteMessage(event.target.value)}
              />
            </label>
            <p className="league-need-tip">{inviteMessage.length}/{INVITE_MESSAGE_MAX} characters</p>
            {inviteError ? <p className="league-need-error">{inviteError}</p> : null}
            <button
              type="button"
              className="availability-invite__send"
              disabled={!selectedIds.length || sending}
              onClick={sendInvites}
            >
              <Send size={16} />
              {sending
                ? "Sending…"
                : `Send SMS invite${selectedIds.length === 1 ? "" : "s"}${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
            </button>
          </div>
        ) : null}

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
          <button type="button" className="availability-actions__cancel" onClick={() => navigate(returnTo)}>
            <Search size={16} /> Browse league
          </button>
          <button type="button" className="availability-actions__submit" onClick={() => navigate(returnTo)}>
            Back to league
          </button>
        </div>
      </section>
    </MainLayout>
  );
};

export default AvailabilityReviewPage;
