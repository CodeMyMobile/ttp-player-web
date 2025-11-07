import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  MapPin,
  MessageCircle,
  PencilLine,
  Phone,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import { createdMatchSummary } from "../data/mockCreateMatch";

import "./MatchDetailsPage.css";

const MatchDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const rosterInvitees = useMemo(
    () => [createdMatchSummary.hostInvitee, ...createdMatchSummary.invitedPlayers],
    [],
  );

  const confirmedInvitees = rosterInvitees.filter((player) =>
    ["host", "confirmed"].includes(player.statusTone),
  );

  const pendingInvitees = createdMatchSummary.invitedPlayers.filter((player) =>
    ["pending", "sms"].includes(player.statusTone),
  );

  const declinedInvitees = createdMatchSummary.invitedPlayers.filter(
    (player) => player.statusTone === "declined",
  );

  const spotsFilled = confirmedInvitees.length;
  const totalSpots = createdMatchSummary.rosterCapacity;

  const handleEditMatch = () => {
    navigate("/matches/create/settings", { state: { fromMatchId: id } });
  };

  const handleInvitePlayers = () => {
    navigate("/matches/create/private/invite", { state: { fromMatchId: id } });
  };

  return (
    <MainLayout>
      <div className="match-details-page">
        <header className="match-details-page__header">
          <div className="match-details-page__header-content">
            <p className="match-details-page__eyebrow">{createdMatchSummary.title}</p>
            <h1>{createdMatchSummary.matchType}</h1>
            <div className="match-details-page__meta" aria-live="polite">
              <span className="match-details-page__chip">
                <ShieldCheck size={14} aria-hidden="true" />
                {createdMatchSummary.matchType}
              </span>
              <span className="match-details-page__meta-item">
                Hosted by {createdMatchSummary.hostName}
              </span>
              <span className="match-details-page__meta-item">
                {spotsFilled} of {totalSpots} spots filled
              </span>
            </div>
            <dl className="match-details-page__schedule">
              <div>
                <dt className="visually-hidden">Date</dt>
                <dd>
                  <CalendarDays size={16} aria-hidden="true" />
                  <span>{createdMatchSummary.dateLabel}</span>
                </dd>
              </div>
              <div>
                <dt className="visually-hidden">Time</dt>
                <dd>
                  <Clock size={16} aria-hidden="true" />
                  <span>{createdMatchSummary.timeLabel}</span>
                </dd>
              </div>
              <div>
                <dt className="visually-hidden">Location</dt>
                <dd>
                  <MapPin size={16} aria-hidden="true" />
                  <span>
                    {createdMatchSummary.locationName}
                    {" · "}
                    {createdMatchSummary.locationDetail}
                  </span>
                </dd>
              </div>
            </dl>
            <div className="match-details-page__tags" aria-hidden="true">
              <span>{createdMatchSummary.formatLabel}</span>
              <span>{createdMatchSummary.skillLevelLabel}</span>
              <span>{createdMatchSummary.courtLabel}</span>
            </div>
          </div>
          <div className="match-details-page__header-actions">
            <button
              type="button"
              className="match-details-page__action match-details-page__action--secondary"
              onClick={handleEditMatch}
            >
              <PencilLine size={16} aria-hidden="true" />
              Edit match
            </button>
            <button
              type="button"
              className="match-details-page__action"
              onClick={handleInvitePlayers}
            >
              <UserPlus size={16} aria-hidden="true" />
              Invite players
            </button>
          </div>
        </header>

        <div className="match-details-page__layout">
          <div className="match-details-page__primary">
            <section
              className="match-details-panel match-details-panel--message"
              aria-labelledby="match-message-heading"
            >
              <div className="match-details-panel__icon" aria-hidden="true">
                <MessageCircle size={18} />
              </div>
              <div className="match-details-panel__content">
                <p className="match-details-panel__eyebrow">Message group</p>
                <h2 id="match-message-heading">Send updates to all confirmed players</h2>
                <p>Keep everyone in the loop with quick texts about weather, timing, or last-minute notes.</p>
              </div>
              <button type="button" className="match-details-panel__action">
                Message group
              </button>
            </section>

            <section className="match-details-panel" aria-labelledby="match-confirmed-heading">
              <div className="match-details-panel__header">
                <div>
                  <p className="match-details-panel__eyebrow">Confirmed players</p>
                  <h2 id="match-confirmed-heading">
                    {spotsFilled} of {totalSpots} spots filled
                  </h2>
                </div>
                <span className="match-details-panel__status">{createdMatchSummary.rosterRemainingLabel}</span>
              </div>
              <ul className="match-details-roster" aria-live="polite">
                {confirmedInvitees.map((player) => (
                  <li key={player.id} className="match-details-roster__item">
                    <div
                      className={`match-details-roster__avatar${
                        player.avatarUrl ? " match-details-roster__avatar--image" : ""
                      }`}
                      aria-hidden="true"
                    >
                      {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span>{player.initials}</span>}
                    </div>
                    <div className="match-details-roster__body">
                      <p className="match-details-roster__name">{player.name}</p>
                      <p className="match-details-roster__detail">{player.relationshipLabel}</p>
                      {player.phoneNumber && (
                        <p className="match-details-roster__contact">
                          <Phone size={14} aria-hidden="true" />
                          <span>{player.phoneNumber}</span>
                        </p>
                      )}
                    </div>
                    <span
                      className={`match-details-roster__status match-details-roster__status--${player.statusTone}`}
                    >
                      {player.statusLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {pendingInvitees.length > 0 && (
              <section className="match-details-panel" aria-labelledby="match-pending-heading">
                <div className="match-details-panel__header">
                  <div>
                    <p className="match-details-panel__eyebrow">Pending invites</p>
                    <h2 id="match-pending-heading">Waiting on {pendingInvitees.length} responses</h2>
                  </div>
                </div>
                <ul className="match-details-roster match-details-roster--compact" aria-live="polite">
                  {pendingInvitees.map((player) => (
                    <li key={player.id} className="match-details-roster__item">
                      <div
                        className={`match-details-roster__avatar match-details-roster__avatar--small${
                          player.avatarUrl ? " match-details-roster__avatar--image" : ""
                        }`}
                        aria-hidden="true"
                      >
                        {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span>{player.initials}</span>}
                      </div>
                      <div className="match-details-roster__body">
                        <p className="match-details-roster__name">{player.name}</p>
                        <p className="match-details-roster__detail">{player.statusDescription ?? player.statusLabel}</p>
                      </div>
                      <span
                        className={`match-details-roster__status match-details-roster__status--${player.statusTone}`}
                      >
                        {player.statusLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {declinedInvitees.length > 0 && (
              <section className="match-details-panel" aria-labelledby="match-declined-heading">
                <div className="match-details-panel__header">
                  <div>
                    <p className="match-details-panel__eyebrow">Declined invites</p>
                    <h2 id="match-declined-heading">{declinedInvitees.length} players can't make it</h2>
                  </div>
                </div>
                <ul className="match-details-roster match-details-roster--compact" aria-live="polite">
                  {declinedInvitees.map((player) => (
                    <li key={player.id} className="match-details-roster__item">
                      <div
                        className={`match-details-roster__avatar match-details-roster__avatar--small${
                          player.avatarUrl ? " match-details-roster__avatar--image" : ""
                        }`}
                        aria-hidden="true"
                      >
                        {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span>{player.initials}</span>}
                      </div>
                      <div className="match-details-roster__body">
                        <p className="match-details-roster__name">{player.name}</p>
                        <p className="match-details-roster__detail">{player.statusDescription ?? player.statusLabel}</p>
                      </div>
                      <span className="match-details-roster__status match-details-roster__status--declined">
                        {player.statusLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section
              className="match-details-panel match-details-panel--invite"
              aria-labelledby="match-invite-heading"
            >
              <div className="match-details-panel__content">
                <p className="match-details-panel__eyebrow">Need more players?</p>
                <h2 id="match-invite-heading">Send a direct invite</h2>
                <p>Share the private invite link or text players individually to round out your roster.</p>
              </div>
              <button
                type="button"
                className="match-details-panel__action match-details-panel__action--primary"
                onClick={handleInvitePlayers}
              >
                Invite players
              </button>
            </section>
          </div>

          <aside className="match-details-page__secondary">
            <section className="match-details-sidebar" aria-labelledby="match-invite-summary-heading">
              <div className="match-details-sidebar__header">
                <p className="match-details-sidebar__eyebrow">Invites overview</p>
                <h2 id="match-invite-summary-heading">Keep tabs on responses</h2>
              </div>
              <dl className="match-details-sidebar__stats">
                <div>
                  <dt>Confirmed</dt>
                  <dd>{confirmedInvitees.length}</dd>
                </div>
                <div>
                  <dt>Pending</dt>
                  <dd>{pendingInvitees.length}</dd>
                </div>
                <div>
                  <dt>Declined</dt>
                  <dd>{declinedInvitees.length}</dd>
                </div>
              </dl>
              <p>{createdMatchSummary.inviteSummaryLabel}</p>
              <button type="button" onClick={handleInvitePlayers} className="match-details-sidebar__action">
                <UserPlus size={16} aria-hidden="true" />
                Send another invite
              </button>
            </section>

            <section className="match-details-sidebar" aria-labelledby="match-visibility-heading">
              <div className="match-details-sidebar__header">
                <p className="match-details-sidebar__eyebrow">Visibility</p>
                <h2 id="match-visibility-heading">Private match link</h2>
              </div>
              <p>{createdMatchSummary.visibilityDescription}</p>
              <div className="match-details-sidebar__link">
                <span>{createdMatchSummary.shareLink}</span>
                <button type="button">Copy link</button>
              </div>
            </section>

            <section className="match-details-sidebar" aria-labelledby="match-notes-heading">
              <div className="match-details-sidebar__header">
                <p className="match-details-sidebar__eyebrow">Notes</p>
                <h2 id="match-notes-heading">Reminders for players</h2>
              </div>
              <p>{createdMatchSummary.notes}</p>
            </section>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
};

export default MatchDetailsPage;
