import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import type { MatchDraftDetails } from "../types/matchPlay";

import "./CreateMatchPage.css";
import "./CreatePrivateMatchInvitePage.css";

type Invitee = {
  id: string;
  name: string;
  avatarUrl: string | null;
  initials?: string;
  relationshipLabel?: string;
  statusLabel?: string;
  statusTone?: "host" | "sms" | "pending" | "guest" | "confirmed" | "declined";
};

type ReviewSettings = {
  skillLevel?: string;
  format?: string;
  visibility?: "public" | "hidden";
  courtNumber?: string;
  notes?: string;
};

type PublishState = {
  matchDraft?: MatchDraftDetails;
  settings?: ReviewSettings;
  invitedPlayers?: Invitee[];
  privateFormat?: string;
  matchId?: string;
  shareLink?: string;
};

const formatDateForCalendar = (isoString: string) => {
  const normalized = new Date(isoString);
  return normalized.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

const formatDateLabel = (date?: string) => {
  if (!date) return "Date TBA";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "Date TBA";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(value);
};

const formatTimeLabel = (start?: string, durationMinutes = 0) => {
  if (!start) return "Time TBA";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "Time TBA";
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const startLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(endDate);
  return `${startLabel} – ${endLabel}`;
};

const formatMatchFormat = (value?: string) => {
  if (!value) return "Format TBA";
  switch (value) {
    case "singles":
      return "Singles";
    case "doubles":
      return "Doubles";
    case "round-robin":
      return "Round robin";
    case "dingles":
      return "Dingles";
    default:
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
};

const CreateMatchPublishConfirmationPage = () => {
  const routerLocation = useLocation();
  const navigate = useNavigate();

  const { matchDraft, settings, invitedPlayers, privateFormat, shareLink, matchId } =
    (routerLocation.state as PublishState | null) ?? {};

  const startIso = matchDraft?.date ? new Date(`${matchDraft.date}T${matchDraft.time || "18:00"}`).toISOString() : undefined;
  const durationMinutes = matchDraft?.duration === "60" ? 60 : matchDraft?.duration === "90" ? 90 : 120;
  const endIso = startIso ? new Date(new Date(startIso).getTime() + durationMinutes * 60 * 1000).toISOString() : undefined;
  const dateLabel = formatDateLabel(matchDraft?.date);
  const timeLabel = formatTimeLabel(startIso, durationMinutes);
  const locationName = matchDraft?.location || "TBD";
  const visibilityValue = settings?.visibility === "hidden" ? "Hidden link" : "Public link";
  const formattedSkill = matchDraft?.matchType === "private" ? "Private roster" : settings?.skillLevel ?? "All levels";
  const formattedFormat = formatMatchFormat(settings?.format ?? privateFormat);
  const courtLabel = settings?.courtNumber ? `Court ${settings.courtNumber}` : "Court TBA";
  const formattedNotes = settings?.notes || "";
  const shareLinkLabel = shareLink || "Link available after publish";
  const rosterInvitees = invitedPlayers ?? [];
  const playersNeededText = matchDraft
    ? matchDraft.isUnlimitedPlayers
      ? "Unlimited spots open"
      : `${matchDraft.playersNeeded} more needed`
    : "Roster TBD";

  const eventLocation = `${locationName}`;
  const calendarDetails = `Hosted by you. ${formattedFormat} • ${formattedSkill}. ${formattedNotes} RSVP: ${shareLinkLabel}`;
  const shareMessage = `Join me for ${locationName} on ${dateLabel} at ${timeLabel}. RSVP: ${shareLinkLabel}`;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const googleCalendarUrl = useMemo(() => {
    if (!startIso || !endIso) return "";
    const start = formatDateForCalendar(startIso);
    const end = formatDateForCalendar(endIso);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: locationName,
      dates: `${start}/${end}`,
      details: calendarDetails,
      location: eventLocation,
      ctz: timezone,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, [calendarDetails, endIso, eventLocation, locationName, startIso, timezone]);

  const outlookCalendarUrl = useMemo(() => {
    if (!startIso || !endIso) return "";
    const start = new Date(startIso).toISOString();
    const end = new Date(endIso).toISOString();
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: locationName,
      startdt: start,
      enddt: end,
      body: calendarDetails,
      location: eventLocation,
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }, [calendarDetails, eventLocation]);

  const icsDownloadUrl = useMemo(() => {
    if (!startIso || !endIso) return "";
    const start = formatDateForCalendar(startIso);
    const end = formatDateForCalendar(endIso);
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TTP Tennis//Match Publish//EN",
      "BEGIN:VEVENT",
      `UID:${matchId ?? locationName}@ttp.tennis`,
      `DTSTAMP:${formatDateForCalendar(new Date().toISOString())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${locationName}`,
      `DESCRIPTION:${calendarDetails}`,
      `LOCATION:${eventLocation}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
  }, [calendarDetails, eventLocation]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLinkLabel).catch(() => {
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
    navigate(`/matches/${matchId ?? ""}`);
  };

  const handleViewMatches = () => {
    navigate("/matches");
  };

  if (matchDraft?.matchType === "private") {
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
                  <p className="private-summary-card__eyebrow">{locationName}</p>
                  <h2 id="private-summary-heading">{formattedFormat}</h2>
                </div>
                <span className="private-summary-card__badge">Private</span>
              </div>
            <div className="private-summary-card__schedule">
              <div className="private-summary-card__schedule-item">
                <CalendarDays size={18} aria-hidden="true" />
                <span>{dateLabel}</span>
              </div>
              <div className="private-summary-card__schedule-item">
                <Clock size={18} aria-hidden="true" />
                <span>{timeLabel}</span>
              </div>
            </div>
            <div className="private-summary-card__meta">
              <div className="private-summary-card__detail">
                <MapPin size={18} aria-hidden="true" />
                <div>
                  <span className="private-summary-card__detail-label">{locationName}</span>
                  <span className="private-summary-card__detail-hint">Location shared after approval</span>
                </div>
              </div>
              <div className="private-summary-card__detail">
                <Users size={18} aria-hidden="true" />
                <div>
                  <span className="private-summary-card__detail-label">{`${rosterInvitees.length} players invited`}</span>
                  <span className="private-summary-card__detail-hint">{playersNeededText}</span>
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
                <span className="invite-summary__count">{`${rosterInvitees.length} players invited`}</span>
                <span className="invite-summary__helper">{playersNeededText}</span>
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
                    <span className={`invitee-status invitee-status--${player.statusTone ?? "pending"}`}>
                      {player.statusLabel ?? "Invite"}
                    </span>
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
              <a className="private-calendar-button" href={icsDownloadUrl} download={`${matchId ?? "match"}.ics`}>
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
              <h2>All set, you&apos;re live!</h2>
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
              <p className="review-summary__eyebrow">{matchDraft?.matchType === "private" ? "Private match" : "Open match"}</p>
              <h3 className="review-summary__title">{locationName}</h3>
            </div>
          </div>

          <div className="review-summary__grid" role="list">
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <CalendarDays size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Date</span>
                <span className="review-summary__value">{dateLabel}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <Clock size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Time &amp; duration</span>
                <span className="review-summary__value">{timeLabel}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <MapPin size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Location</span>
                <span className="review-summary__value">{locationName}</span>
                <span className="review-summary__hint">Location shared after approval</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <Users size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Players needed</span>
                <span className="review-summary__value">{playersNeededText}</span>
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
                <code>{shareLinkLabel}</code>
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
            <a className="calendar-action" href={icsDownloadUrl} download={`${matchId ?? "match"}.ics`}>
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
