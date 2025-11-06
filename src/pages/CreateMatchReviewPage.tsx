import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Gauge,
  MapPin,
  MessageSquare,
  Share2,
  Users,
} from "lucide-react";

import MainLayout from "../components/MainLayout";

import "./CreateMatchPage.css";

const reviewSummary = {
  title: "Sunset rally at Penmar",
  matchType: "Open match",
  date: "Fri, Apr 26",
  time: "6:00 PM – 8:00 PM",
  location: "Penmar Recreation Center",
  locationDetail: "Venice, CA",
  playersNeeded: "You + 3 players",
  skillLevel: "3.0 – 3.5 NTRP",
  skillDescription: "Consistent baseline play",
  format: "Doubles",
  court: "Court 4",
  notes: "Bring a new can of balls and arrive 10 minutes early.",
  visibility: "Public link",
  visibilityDescription: "Appears in match search and accepts requests.",
  shareLink: "ttp.tennis/matches/sunset-rally",
};

const CreateMatchReviewPage = () => {
  const navigate = useNavigate();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const handleEditDetails = () => {
    navigate("/matches/create");
  };

  const handleEditSettings = () => {
    navigate("/matches/create/settings");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(reviewSummary.shareLink).catch(() => {
      /* no-op */
    });
  };

  const handlePublish = () => {
    setIsPublishing(true);
    window.setTimeout(() => {
      setIsPublishing(false);
      setIsPublished(true);
    }, 900);
  };

  const handleViewMatch = () => {
    navigate("/matches");
  };

  return (
    <MainLayout>
      <div className="create-match-page">
        <div className="create-match-page__header">
          <div>
            <p className="create-match-page__eyebrow">Create a Match</p>
            <h1 className="create-match-page__title">Review &amp; publish</h1>
            <p className="create-match-page__subtitle">
              Confirm the essentials, share the match link, and publish when you&apos;re ready. You can always edit the
              details after publishing.
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
            <div className="progress-step progress-step--active">
              <span className="progress-step__number">3</span>
              <span className="progress-step__label">Review &amp; publish</span>
            </div>
          </div>
        </div>

        {isPublished && (
          <section className="create-match-card create-match-card--success" aria-live="polite">
            <div className="create-match-success">
              <div className="create-match-success__icon" aria-hidden="true">
                <CheckCircle2 size={28} />
              </div>
              <div className="create-match-success__content">
                <h2>Match published</h2>
                <p className="create-match-card__subtitle">
                  Players can now request to join. Share the link or keep building momentum with another match.
                </p>
              </div>
            </div>
          </section>
        )}

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
              <p className="review-summary__eyebrow">{reviewSummary.matchType}</p>
              <h3 className="review-summary__title">{reviewSummary.title}</h3>
            </div>
          </div>

          <div className="review-summary__grid" role="list">
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <CalendarDays size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Date</span>
                <span className="review-summary__value">{reviewSummary.date}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <Clock size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Time &amp; duration</span>
                <span className="review-summary__value">{reviewSummary.time}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <MapPin size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Location</span>
                <span className="review-summary__value">{reviewSummary.location}</span>
                <span className="review-summary__hint">{reviewSummary.locationDetail}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <Users size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Players needed</span>
                <span className="review-summary__value">{reviewSummary.playersNeeded}</span>
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
                <span className="review-summary__value">{reviewSummary.skillLevel}</span>
                <span className="review-summary__hint">{reviewSummary.skillDescription}</span>
              </div>
            </div>
            <div className="review-summary__item" role="listitem">
              <div className="review-summary__icon" aria-hidden="true">
                <MessageSquare size={20} />
              </div>
              <div className="review-summary__content">
                <span className="review-summary__label">Format &amp; court</span>
                <span className="review-summary__value">
                  {reviewSummary.format} • {reviewSummary.court}
                </span>
                <span className="review-summary__hint">{reviewSummary.notes}</span>
              </div>
            </div>
          </div>
        </section>

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
                <span className="review-summary__value">{reviewSummary.visibility}</span>
                <span className="review-summary__hint">{reviewSummary.visibilityDescription}</span>
              </div>
            </div>
            <div className="review-summary__item review-summary__item--link" role="listitem">
              <div className="review-summary__content">
                <span className="review-summary__label">Share link</span>
                <div className="review-summary__link">
                  <code>{reviewSummary.shareLink}</code>
                  <button type="button" className="review-summary__copy" onClick={handleCopyLink}>
                    <Copy size={16} aria-hidden="true" />
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="create-match-actions">
          {!isPublished ? (
            <>
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
            </>
          ) : (
            <>
              <button type="button" className="create-match-actions__secondary" onClick={handleEditDetails}>
                Create another match
              </button>
              <button type="button" className="create-match-actions__primary" onClick={handleViewMatch}>
                View match
              </button>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default CreateMatchReviewPage;
