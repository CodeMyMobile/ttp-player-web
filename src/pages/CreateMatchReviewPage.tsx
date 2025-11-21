import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  Copy,
  Gauge,
  MapPin,
  MessageSquare,
  Share2,
  Users,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import { createMatch } from "../api/matches";
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

type ReviewState = {
  matchDraft?: MatchDraftDetails;
  settings?: ReviewSettings;
  invitedPlayers?: Invitee[];
  connectIntent?: unknown;
  privateFormat?: string;
  shareLink?: string;
  matchId?: string;
};

const formatDateLabel = (date?: string) => {
  if (!date) return "Date TBA";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "Date TBA";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(value);
};

const formatTimeLabel = (date?: string, durationMinutes = 0) => {
  if (!date) return "Time TBA";
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return "Time TBA";
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const startLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(end);
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

const CreateMatchReviewPage = () => {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const { matchDraft, settings, invitedPlayers, privateFormat, shareLink, matchId } =
    (routerLocation.state as ReviewState | null) ?? {};
  const [isPublishing, setIsPublishing] = useState(false);
  const roster = invitedPlayers ?? [];
  const showInvitedPlayers = roster.length > 0;

  const startIso = useMemo(() => {
    if (!matchDraft?.date) return undefined;
    const time = matchDraft.time || "18:00";
    return new Date(`${matchDraft.date}T${time}`).toISOString();
  }, [matchDraft?.date, matchDraft?.time]);

  const durationMinutes = matchDraft?.duration === "60" ? 60 : matchDraft?.duration === "90" ? 90 : 120;
  const playersNeededLabel = matchDraft
    ? matchDraft.isUnlimitedPlayers
      ? "Unlimited players"
      : `${matchDraft.playersNeeded} players needed`
    : "Players TBD";

  const visibilityLabel = matchDraft?.matchType === "private" ? "Private invitations" : "Open listing";
  const visibilityDescription =
    matchDraft?.matchType === "private"
      ? "Invites are delivered directly to your roster."
      : settings?.visibility === "hidden"
        ? "Only people with the link can view this match."
        : "Visible in match search and to players nearby.";

  const formattedSkill = matchDraft?.matchType === "private" ? "Private roster" : settings?.skillLevel ?? "All levels";
  const formattedFormat = formatMatchFormat(settings?.format ?? privateFormat);
  const formattedNotes = settings?.notes || "";
  const courtLabel = settings?.courtNumber ? `Court ${settings.courtNumber}` : "Court TBA";
  const matchTypeLabel = matchDraft?.matchType === "private" ? "Private match" : "Open match";
  const matchTitle = matchDraft?.location ? `${matchDraft.location}` : "Match details";
  const locationDetail = matchDraft?.location ? "Location shared after approval" : "Location to be confirmed";
  const shareLinkLabel = shareLink || "Link available after publish";

  const handleEditDetails = () => {
    navigate("/matches/create");
  };

  const handleEditSettings = () => {
    navigate("/matches/create/settings");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLinkLabel).catch(() => {
      /* no-op */
    });
  };

  const handlePublish = async () => {
    if (!matchDraft) {
      navigate("/matches/create");
      return;
    }
    setIsPublishing(true);
    try {
      const rosterSize = matchDraft.isUnlimitedPlayers ? undefined : matchDraft.playersNeeded + 1;
      const response = await createMatch({
        privacy: matchDraft.matchType,
        startDateTime: startIso,
        locationText: matchDraft.location,
        rosterSize,
        skillLevel: matchDraft.matchType === "open" ? settings?.skillLevel : undefined,
        matchFormat: matchDraft.matchType === "open" ? settings?.format : privateFormat,
        notes: formattedNotes,
        linkOnly: settings?.visibility === "hidden",
      });

      navigate("/matches/create/published", {
        state: {
          matchDraft,
          settings,
          invitedPlayers,
          privateFormat,
          matchId: response.matchId,
          shareLink: response.shareLink,
        },
      });
    } catch (error) {
      // Keep the review page interactive even if publish fails
      console.error(error);
      setIsPublishing(false);
    }
  };

  const pageSubtitle =
    matchDraft?.matchType === "private"
      ? "Review your private roster, confirm the essentials, and publish when everything looks good."
      : "Confirm the essentials, share the match link, and publish when you're ready. You can always edit the details after publishing.";

  const dateLabel = formatDateLabel(matchDraft?.date);
  const timeLabel = formatTimeLabel(startIso, durationMinutes);
  const locationName = matchDraft?.location || "TBD";
  const visibilityValue = settings?.visibility === "hidden" ? "Hidden link" : "Public link";
  const skillHelper =
    matchDraft?.matchType === "private"
      ? "Private roster only"
      : "Players who match this level will request to join.";

  return (
    <MainLayout>
      <div className="create-match-page">
        <div className="create-match-page__header">
          <div>
            <p className="create-match-page__eyebrow">Create a Match</p>
            <h1 className="create-match-page__title">Review &amp; publish</h1>
            <p className="create-match-page__subtitle">{pageSubtitle}</p>
          </div>
          <div className="create-match-page__progress" aria-label="Match creation progress">
            <div className="progress-step progress-step--complete">
              <span className="progress-step__number">1</span>
              <span className="progress-step__label">Match details</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--complete">
              <span className="progress-step__number">2</span>
              <span className="progress-step__label">
                {matchDraft?.matchType === "private" ? "Invite players" : "Match settings"}
              </span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--active">
              <span className="progress-step__number">3</span>
              <span className="progress-step__label">Review &amp; publish</span>
            </div>
          </div>
        </div>

        <section className="create-match-card" aria-labelledby="review-overview-heading">
          <div className="review-summary__header">
            <div>
              <h2 id="review-overview-heading">Match overview</h2>
              <p className="create-match-card__subtitle">Double-check the key details before sharing.</p>
            </div>
            <button type="button" className="review-summary__edit" onClick={handleEditDetails}>
              Edit details
            </button>
          </div>

          <div className="review-summary__intro">
            <div>
              <p className="review-summary__eyebrow">{matchTypeLabel}</p>
              <h3 className="review-summary__title">{matchTitle}</h3>
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
                <span className="review-summary__hint">{locationDetail}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <Users size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Players needed</span>
                <span className="review-summary__value">{playersNeededLabel}</span>
                <span className="review-summary__hint">Total includes you as host</span>
              </div>
            </div>
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="review-settings-heading">
          <div className="review-summary__header">
            <div>
              <h2 id="review-settings-heading">Match settings</h2>
              <p className="create-match-card__subtitle">Ensure the skill level and format match your goals.</p>
            </div>
            <button type="button" className="review-summary__edit" onClick={handleEditSettings}>
              Edit settings
            </button>
          </div>

          <div className="review-summary__grid" role="list">
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <Gauge size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Skill level</span>
                <span className="review-summary__value">{formattedSkill}</span>
                <span className="review-summary__hint">{skillHelper}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <MessageSquare size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Format &amp; court</span>
                <span className="review-summary__value">
                  {formattedFormat} • {courtLabel}
                </span>
                <span className="review-summary__hint">{formattedNotes || ""}</span>
              </div>
            </div>
          </div>
        </section>

        {showInvitedPlayers && (
          <section className="create-match-card" aria-labelledby="review-invitees-heading">
            <div className="create-match-card__header">
              <div>
                <h2 id="review-invitees-heading">Invited players</h2>
                <p className="create-match-card__subtitle">
                  SMS invites are on their way. Track responses here before you send any updates.
                </p>
              </div>
              <div className="invite-summary" aria-live="polite">
                <span className="invite-summary__count">{`${roster.length} players invited`}</span>
                <span className="invite-summary__helper">{playersNeededLabel}</span>
              </div>
            </div>

            <div className="invitee-list">
              {roster.map((player) => (
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
        )}

        <section className="create-match-card" aria-labelledby="review-share-heading">
          <div className="review-summary__header">
            <div>
              <h2 id="review-share-heading">Share &amp; visibility</h2>
              <p className="create-match-card__subtitle">Control how players discover and join your match.</p>
            </div>
          </div>

          <div className="review-summary__grid" role="list">
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <Share2 size={20} />
              </div>
            <div className="review-summary__content">
              <span className="review-summary__label">Visibility</span>
              <span className="review-summary__value">{visibilityValue}</span>
              <span className="review-summary__hint">{visibilityDescription}</span>
            </div>
          </div>
          {matchDraft?.matchType !== "private" && (
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
            )}
          </div>
        </section>

        <div className="create-match-actions">
          <button type="button" className="create-match-actions__secondary" onClick={handleEditSettings}>
            Back to settings
          </button>
          <button
            type="button"
            className="create-match-actions__primary"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? "Publishing…" : "Publish match"}
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreateMatchReviewPage;
