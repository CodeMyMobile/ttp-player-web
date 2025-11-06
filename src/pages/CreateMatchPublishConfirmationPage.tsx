import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  MessageCircle,
  Share2,
  Users,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import { createdMatchSummary } from "../data/mockCreateMatch";

import "./CreateMatchPage.css";

const formatDateForCalendar = (isoString: string) => {
  const normalized = new Date(isoString);
  return normalized.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

const CreateMatchPublishConfirmationPage = () => {
  const navigate = useNavigate();

  const eventLocation = `${createdMatchSummary.locationName}, ${createdMatchSummary.locationDetail}`;
  const calendarDetails = `Hosted by ${createdMatchSummary.hostName}. ${createdMatchSummary.formatLabel} • ${createdMatchSummary.skillLevelLabel}. ${createdMatchSummary.notes} RSVP: ${createdMatchSummary.shareLink}`;
  const shareMessage = `Join me for ${createdMatchSummary.title} on ${createdMatchSummary.dateLabel} at ${createdMatchSummary.timeLabel} at ${createdMatchSummary.locationName}. RSVP: ${createdMatchSummary.shareLink}`;

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

  const handleViewMatches = () => {
    navigate("/matches");
  };

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
