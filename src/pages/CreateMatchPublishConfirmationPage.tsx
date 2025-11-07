import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Apple,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Users,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import { createdMatchSummary } from "../data/mockCreateMatch";

import "./CreateMatchPage.css";
import "./CreatePrivateMatchInvitePage.css";

const formatDateForCalendar = (isoString: string) => {
  const normalized = new Date(isoString);
  return normalized.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

const CreateMatchPublishConfirmationPage = () => {
  const navigate = useNavigate();

  const eventLocation = `${createdMatchSummary.locationName}, ${createdMatchSummary.locationDetail}`;
  const calendarDetails = `Hosted by ${createdMatchSummary.hostName}. ${createdMatchSummary.formatLabel} • ${createdMatchSummary.skillLevelLabel}. ${createdMatchSummary.notes} RSVP: ${createdMatchSummary.shareLink}`;
  const shareMessage = `Join me for ${createdMatchSummary.title} on ${createdMatchSummary.dateLabel} at ${createdMatchSummary.timeLabel} at ${createdMatchSummary.locationName}. RSVP: ${createdMatchSummary.shareLink}`;
  const rosterInvitees = [createdMatchSummary.hostInvitee, ...createdMatchSummary.invitedPlayers];

  const googleCalendarUrl = useMemo(() => {
    const start = formatDateForCalendar(createdMatchSummary.startDateTime);
    const end = formatDateForCalendar(createdMatchSummary.endDateTime);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: createdMatchSummary.title,
      dates: `${start}/${end}`,
      details: calendarDetails,
      location: eventLocation,
      ctz: createdMatchSummary.timezone,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, [calendarDetails, eventLocation]);

  const outlookCalendarUrl = useMemo(() => {
    const start = new Date(createdMatchSummary.startDateTime).toISOString();
    const end = new Date(createdMatchSummary.endDateTime).toISOString();
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: createdMatchSummary.title,
      startdt: start,
      enddt: end,
      body: calendarDetails,
      location: eventLocation,
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }, [calendarDetails, eventLocation]);

  const icsDownloadUrl = useMemo(() => {
    const start = formatDateForCalendar(createdMatchSummary.startDateTime);
    const end = formatDateForCalendar(createdMatchSummary.endDateTime);
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TTP Tennis//Match Publish//EN",
      "BEGIN:VEVENT",
      `UID:${createdMatchSummary.id}@ttp.tennis`,
      `DTSTAMP:${formatDateForCalendar(new Date().toISOString())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${createdMatchSummary.title}`,
      `DESCRIPTION:${calendarDetails}`,
      `LOCATION:${eventLocation}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
  }, [calendarDetails, eventLocation]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(createdMatchSummary.shareLink).catch(() => {
      /* no-op */
    });
  };

  const handleShare = (url: string, target: "_blank" | "_self" = "_blank") => {
    window.open(url, target, "noopener,noreferrer");
  };

  const handleCreateAnother = () => {
    navigate("/matches/create");
  };

  const handleGoHome = () => {
    navigate("/");
  };

  const handleViewMatchDetails = () => {
    navigate(`/matches/${createdMatchSummary.id}`);
  };

  const handleViewMatches = () => {
    navigate("/matches");
  };

  if (createdMatchSummary.isPrivate) {
    return (
      <MainLayout>
        <div className="create-match-page">
          <div className="create-match-page__header create-match-page__header--centered">
            <div className="private-success-hero" aria-live="polite">
              <span className="private-success-hero__icon" aria-hidden="true">
                <CheckCircle2 size={36} />
              </span>
              <h1>Private match created!</h1>
              <p>Invitations have been sent to your selected players.</p>
            </div>
          </div>

          <section className="create-match-card private-summary-card" aria-labelledby="private-summary-heading">
            <div className="private-summary-card__header">
              <div>
                <p className="private-summary-card__eyebrow">{createdMatchSummary.title}</p>
                <h2 id="private-summary-heading">{createdMatchSummary.formatLabel}</h2>
              </div>
              <span className="private-summary-card__badge">Private</span>
            </div>
            <div className="private-summary-card__schedule">
              <div className="private-summary-card__schedule-item">
                <CalendarDays size={18} aria-hidden="true" />
                <span>{createdMatchSummary.dateLabel}</span>
              </div>
              <div className="private-summary-card__schedule-item">
                <Clock size={18} aria-hidden="true" />
                <span>{createdMatchSummary.timeLabel}</span>
              </div>
            </div>
            <div className="private-summary-card__meta">
              <div className="private-summary-card__detail">
                <MapPin size={18} aria-hidden="true" />
                <div>
                  <span className="private-summary-card__detail-label">{createdMatchSummary.locationName}</span>
                  <span className="private-summary-card__detail-hint">{createdMatchSummary.locationDetail}</span>
                </div>
              </div>
              <div className="private-summary-card__detail">
                <Users size={18} aria-hidden="true" />
                <div>
                  <span className="private-summary-card__detail-label">{createdMatchSummary.inviteSummaryLabel}</span>
                  <span className="private-summary-card__detail-hint">{createdMatchSummary.inviteNeedsLabel}</span>
                </div>
              </div>
            </div>
            <div className="private-summary-card__notice">
              <div className="private-summary-card__notice-icon" aria-hidden="true">
                <Phone size={18} />
              </div>
              <div>
                <span className="private-summary-card__notice-title">Invites sent via SMS</span>
                <p className="private-summary-card__notice-copy">
                  Selected players receive a private link in their text message. No shared link is available for private matches.
                </p>
              </div>
            </div>
          </section>

          <section className="create-match-card" aria-labelledby="private-roster-heading">
            <div className="create-match-card__header">
              <div>
                <h2 id="private-roster-heading">Invited players</h2>
                <p className="create-match-card__subtitle">Keep tabs on who has confirmed so you can fill any remaining spots.</p>
              </div>
              <div className="invite-summary" aria-live="polite">
                <span className="invite-summary__count">{createdMatchSummary.inviteSummaryLabel}</span>
                <span className="invite-summary__helper">{createdMatchSummary.inviteNeedsLabel}</span>
              </div>
            </div>

            <div className="invitee-list">
              {rosterInvitees.map((player) => (
                <div key={player.id} className="invitee-row">
                  <div className="invitee-row__details">
                    <div
                      className={`invitee-avatar${player.avatarUrl ? " invitee-avatar--image" : ""}`}
                      aria-hidden="true"
                    >
                      {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span>{player.initials}</span>}
                    </div>
                    <div className="invitee-row__text">
                      <span className="invitee-row__name">{player.name}</span>
                      <span className="invitee-row__meta">{player.relationshipLabel}</span>
                    </div>
                  </div>
                  <div className="invitee-row__actions">
                    <span className={`invitee-status invitee-status--${player.statusTone}`}>{player.statusLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="create-match-card private-calendar-card" aria-labelledby="private-calendar-heading">
            <div>
              <h2 id="private-calendar-heading">Add to calendar</h2>
              <p className="create-match-card__subtitle">Keep the court time on everyone&apos;s radar.</p>
            </div>
            <div className="private-calendar-grid" role="list">
              <a className="private-calendar-button" href={googleCalendarUrl} target="_blank" rel="noreferrer">
                <div className="private-calendar-button__icon" aria-hidden="true">
                  <CalendarPlus size={18} />
                </div>
                <div className="private-calendar-button__content">
                  <span className="private-calendar-button__label">Google</span>
                  <span className="private-calendar-button__hint">Create a Google Calendar event</span>
                </div>
                <ExternalLink size={16} aria-hidden="true" />
              </a>
              <a className="private-calendar-button" href={icsDownloadUrl} download={`${createdMatchSummary.id}.ics`}>
                <div className="private-calendar-button__icon" aria-hidden="true">
                  <Apple size={18} />
                </div>
                <div className="private-calendar-button__content">
                  <span className="private-calendar-button__label">Apple</span>
                  <span className="private-calendar-button__hint">Download an .ics file</span>
                </div>
                <Download size={16} aria-hidden="true" />
              </a>
              <a className="private-calendar-button" href={outlookCalendarUrl} target="_blank" rel="noreferrer">
                <div className="private-calendar-button__icon" aria-hidden="true">
                  <CalendarDays size={18} />
                </div>
                <div className="private-calendar-button__content">
                  <span className="private-calendar-button__label">Outlook</span>
                  <span className="private-calendar-button__hint">Schedule from Outlook on web</span>
                </div>
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
            <button type="button" className="private-calendar-primary" onClick={handleViewMatchDetails}>
              View match details
            </button>
          </section>

          <div className="create-match-actions">
            <button type="button" className="create-match-actions__secondary" onClick={handleGoHome}>
              Back to home
            </button>
            <button type="button" className="create-match-actions__primary" onClick={handleCreateAnother}>
              Create another match
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="create-match-page">
        <div className="create-match-page__header create-match-page__header--celebration">
          <div>
            <p className="create-match-page__eyebrow">Create a Match</p>
            <h1 className="create-match-page__title">Match published</h1>
            <p className="create-match-page__subtitle">
              Share the invite, add it to your calendar, and keep an eye on new player requests. You can always edit the
              match from your dashboard.
            </p>
          </div>
          <div className="create-match-page__progress" aria-label="Match creation progress">
            <div className="progress-step progress-step--complete">
              <span className="progress-step__number">1</span>
              <span className="progress-step__label">Match details</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--complete">
              <span className="progress-step__number">2</span>
              <span className="progress-step__label">Match settings</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--complete">
              <span className="progress-step__number">3</span>
              <span className="progress-step__label">Review &amp; publish</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--active">
              <span className="progress-step__number">4</span>
              <span className="progress-step__label">Share</span>
            </div>
          </div>
        </div>

        <section className="create-match-card create-match-card--celebration" aria-live="polite">
          <div className="create-match-confirmation__hero">
            <div className="create-match-confirmation__icon" aria-hidden="true">
              <CheckCircle2 size={32} />
            </div>
            <div className="create-match-confirmation__content">
              <h2>All set, {createdMatchSummary.hostName}!</h2>
              <p>
                Your open match is now live. Share the invite link so players can request a spot and keep everyone in sync
                with calendar reminders.
              </p>
            </div>
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="published-details-heading">
          <div className="review-summary__header">
            <div>
              <h2 id="published-details-heading">Match details</h2>
              <p className="create-match-card__subtitle">Key information at a glance.</p>
            </div>
          </div>

          <div className="review-summary__intro">
            <div>
              <p className="review-summary__eyebrow">{createdMatchSummary.matchType}</p>
              <h3 className="review-summary__title">{createdMatchSummary.title}</h3>
            </div>
          </div>

          <div className="review-summary__grid" role="list">
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <CalendarDays size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Date</span>
                <span className="review-summary__value">{createdMatchSummary.dateLabel}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <Clock size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Time &amp; duration</span>
                <span className="review-summary__value">{createdMatchSummary.timeLabel}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <MapPin size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Location</span>
                <span className="review-summary__value">{createdMatchSummary.locationName}</span>
                <span className="review-summary__hint">{createdMatchSummary.locationDetail}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <Users size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Players needed</span>
                <span className="review-summary__value">{createdMatchSummary.playersNeededLabel}</span>
                <span className="review-summary__hint">Total includes you as host</span>
              </div>
            </div>
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="share-invite-heading">
          <div className="review-summary__header">
            <div>
              <h2 id="share-invite-heading">Share the invite</h2>
              <p className="create-match-card__subtitle">Send the link directly or post to your go-to chats.</p>
            </div>
          </div>

          <div className="review-summary__item review-summary__item--link" role="listitem">
            <div className="review-summary__content">
              <span className="review-summary__label">Share link</span>
              <div className="review-summary__link">
                <code>{createdMatchSummary.shareLink}</code>
                <button type="button" className="review-summary__copy" onClick={handleCopyLink}>
                  <Copy size={16} aria-hidden="true" />
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="share-actions" role="list">
            <button
              type="button"
              className="share-action"
              onClick={() => handleShare(`sms:&body=${encodeURIComponent(shareMessage)}`, "_self")}
            >
              <div className="share-action__icon" aria-hidden="true">
                <MessageCircle size={18} />
              </div>
              <div className="share-action__content">
                <span className="share-action__label">Send via SMS</span>
                <span className="share-action__hint">Opens your default messaging app</span>
              </div>
            </button>
            <button
              type="button"
              className="share-action"
              onClick={() => handleShare(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`)}
            >
              <div className="share-action__icon" aria-hidden="true">
                <Share2 size={18} />
              </div>
              <div className="share-action__content">
                <span className="share-action__label">Share to WhatsApp</span>
                <span className="share-action__hint">Post to chats or group threads</span>
              </div>
            </button>
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="calendar-tools-heading">
          <div className="review-summary__header">
            <div>
              <h2 id="calendar-tools-heading">Add to calendar</h2>
              <p className="create-match-card__subtitle">Keep the court time on everyone&apos;s radar.</p>
            </div>
          </div>

          <div className="calendar-actions" role="list">
            <a
              className="calendar-action"
              href={googleCalendarUrl}
              target="_blank"
              rel="noreferrer"
            >
              <div className="calendar-action__icon" aria-hidden="true">
                <CalendarPlus size={18} />
              </div>
              <div className="calendar-action__content">
                <span className="calendar-action__label">Google Calendar</span>
                <span className="calendar-action__hint">Create an event in Google Calendar</span>
              </div>
              <ExternalLink size={16} aria-hidden="true" />
            </a>
            <a className="calendar-action" href={outlookCalendarUrl} target="_blank" rel="noreferrer">
              <div className="calendar-action__icon" aria-hidden="true">
                <CalendarDays size={18} />
              </div>
              <div className="calendar-action__content">
                <span className="calendar-action__label">Outlook Calendar</span>
                <span className="calendar-action__hint">Schedule it from Outlook on web</span>
              </div>
              <ExternalLink size={16} aria-hidden="true" />
            </a>
            <a className="calendar-action" href={icsDownloadUrl} download={`${createdMatchSummary.id}.ics`}>
              <div className="calendar-action__icon" aria-hidden="true">
                <CalendarDays size={18} />
              </div>
              <div className="calendar-action__content">
                <span className="calendar-action__label">Apple / iCal (.ics)</span>
                <span className="calendar-action__hint">Download an .ics file for any calendar</span>
              </div>
              <Download size={16} aria-hidden="true" />
            </a>
          </div>
        </section>

        <div className="create-match-actions">
          <button type="button" className="create-match-actions__secondary" onClick={handleCreateAnother}>
            Create another match
          </button>
          <button type="button" className="create-match-actions__primary" onClick={handleViewMatches}>
            View all matches
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreateMatchPublishConfirmationPage;
