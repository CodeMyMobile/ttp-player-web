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

  const waitingInvitees = createdMatchSummary.invitedPlayers.filter(
    (player) => player.statusTone === "pending",
  );

  const smsInvitees = createdMatchSummary.invitedPlayers.filter(
    (player) => player.statusTone === "sms",
  );

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
          <div>
            <p className="match-details-page__eyebrow">Match details</p>
            <h1>{createdMatchSummary.title}</h1>
            <div className="match-details-page__meta" aria-live="polite">
              <span className="match-details-page__badge">
                <ShieldCheck size={16} aria-hidden="true" />
                Private match
              </span>
              <span className="match-details-page__host">Hosted by {createdMatchSummary.hostName}</span>
              <span className="match-details-page__players">
                {createdMatchSummary.inviteSummaryLabel}
              </span>
            </div>
            <dl className="match-details-page__schedule">
              <div>
                <dt className="visually-hidden">Date</dt>
                <dd>
                  <CalendarDays size={18} aria-hidden="true" />
                  <span>{createdMatchSummary.dateLabel}</span>
                </dd>
              </div>
              <div>
                <dt className="visually-hidden">Time</dt>
                <dd>
                  <Clock size={18} aria-hidden="true" />
                  <span>{createdMatchSummary.timeLabel}</span>
                </dd>
              </div>
              <div>
                <dt className="visually-hidden">Location</dt>
                <dd>
                  <MapPin size={18} aria-hidden="true" />
                  <span>
                    {createdMatchSummary.locationName}
                    {" · "}
                    {createdMatchSummary.locationDetail}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="match-details-page__header-actions">
            <button
              type="button"
              className="match-details-page__action match-details-page__action--secondary"
              onClick={handleEditMatch}
            >
              <PencilLine size={18} aria-hidden="true" />
              Edit match
            </button>
            <button
              type="button"
              className="match-details-page__action"
              onClick={handleInvitePlayers}
            >
              <UserPlus size={18} aria-hidden="true" />
              Invite players
            </button>
          </div>
        </header>

        <div className="match-details-page__grid">
          <section className="match-details-card" aria-labelledby="match-manage-heading">
            <div className="match-details-card__header">
              <div>
                <p className="match-details-card__eyebrow">Manage match details</p>
                <h2 id="match-manage-heading">Stay in control of your match</h2>
              </div>
              <button
                type="button"
                className="match-details-card__inline-action"
                onClick={handleEditMatch}
              >
                <PencilLine size={16} aria-hidden="true" />
                Edit match
              </button>
            </div>
            <p className="match-details-card__body">{createdMatchSummary.manageCopy}</p>
            <p className="match-details-card__hint">{createdMatchSummary.manageHelper}</p>
          </section>

          <section className="match-details-card" aria-labelledby="match-location-heading">
            <div className="match-details-card__header">
              <div>
                <p className="match-details-card__eyebrow">Location</p>
                <h2 id="match-location-heading">{createdMatchSummary.locationName}</h2>
              </div>
            </div>
            <p className="match-details-card__body">{createdMatchSummary.locationDetail}</p>
          </section>

          <section className="match-details-card" aria-labelledby="match-format-heading">
            <div className="match-details-card__header">
              <div>
                <p className="match-details-card__eyebrow">Match type</p>
                <h2 id="match-format-heading">{createdMatchSummary.formatLabel}</h2>
              </div>
            </div>
            <dl className="match-details-card__meta">
              <div>
                <dt>Skill level</dt>
                <dd>{createdMatchSummary.skillLevelLabel}</dd>
              </div>
              <div>
                <dt>Notes for players</dt>
                <dd>{createdMatchSummary.notes}</dd>
              </div>
            </dl>
          </section>

          <section className="match-details-card" aria-labelledby="match-roster-heading">
            <div className="match-details-card__header">
              <div>
                <p className="match-details-card__eyebrow">Players</p>
                <h2 id="match-roster-heading">{createdMatchSummary.rosterHeaderLabel}</h2>
              </div>
              <span className="match-details-card__status">{createdMatchSummary.rosterRemainingLabel}</span>
            </div>

            <div className="match-details-roster">
              {rosterInvitees.map((player) => (
                <article key={player.id} className="match-details-roster__player">
                  <div
                    className={`match-details-roster__avatar${
                      player.avatarUrl ? " match-details-roster__avatar--image" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span>{player.initials}</span>}
                  </div>
                  <div className="match-details-roster__content">
                    <div className="match-details-roster__heading">
                      <p className="match-details-roster__name">{player.name}</p>
                      <span
                        className={`match-details-roster__chip match-details-roster__chip--${player.statusTone}`}
                      >
                        {player.statusLabel}
                      </span>
                    </div>
                    <p className="match-details-roster__relationship">{player.relationshipLabel}</p>
                    {player.statusDescription && (
                      <p className="match-details-roster__status-description">{player.statusDescription}</p>
                    )}
                    {player.phoneNumber && (
                      <p className="match-details-roster__contact">
                        <Phone size={16} aria-hidden="true" />
                        <span>{player.phoneNumber}</span>
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="match-details-roster__actions">
              <div className="match-details-roster__action" aria-labelledby="match-message-heading">
                <div className="match-details-roster__action-icon" aria-hidden="true">
                  <MessageCircle size={18} />
                </div>
                <div>
                  <h3 id="match-message-heading">Message participants</h3>
                  <p>Add player phone numbers to enable group texts.</p>
                </div>
                <button type="button" className="match-details-roster__action-button">
                  Message group
                </button>
              </div>

              {waitingInvitees.length > 0 && (
                <div className="match-details-roster__section" aria-live="polite">
                  <div className="match-details-roster__section-header">
                    <h3>Waiting on responses ({waitingInvitees.length})</h3>
                  </div>
                  <div className="match-details-roster__list">
                    {waitingInvitees.map((player) => (
                      <div key={player.id} className="match-details-roster__list-item">
                        <div
                          className={`match-details-roster__avatar match-details-roster__avatar--small${
                            player.avatarUrl ? " match-details-roster__avatar--image" : ""
                          }`}
                          aria-hidden="true"
                        >
                          {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span>{player.initials}</span>}
                        </div>
                        <div className="match-details-roster__list-content">
                          <p>{player.name}</p>
                          <span>{player.statusLabel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {smsInvitees.length > 0 && (
                <div className="match-details-roster__section" aria-live="polite">
                  <div className="match-details-roster__section-header">
                    <h3>Invites delivered ({smsInvitees.length})</h3>
                  </div>
                  <div className="match-details-roster__list">
                    {smsInvitees.map((player) => (
                      <div key={player.id} className="match-details-roster__list-item">
                        <div
                          className={`match-details-roster__avatar match-details-roster__avatar--small${
                            player.avatarUrl ? " match-details-roster__avatar--image" : ""
                          }`}
                          aria-hidden="true"
                        >
                          {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span>{player.initials}</span>}
                        </div>
                        <div className="match-details-roster__list-content">
                          <p>{player.name}</p>
                          <span>{player.statusLabel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="match-details-roster__action" aria-labelledby="match-invite-heading">
                <div className="match-details-roster__action-icon" aria-hidden="true">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 id="match-invite-heading">Invite players directly</h3>
                  <p>Send invites to specific players using their phone number.</p>
                </div>
                <button
                  type="button"
                  className="match-details-roster__action-button match-details-roster__action-button--primary"
                  onClick={handleInvitePlayers}
                >
                  Invite players
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default MatchDetailsPage;
