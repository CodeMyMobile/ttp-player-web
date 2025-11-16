import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, Clock, Globe, Lock, MapPin, Users } from "lucide-react";

import MainLayout from "../components/MainLayout";
import type { ConnectIntent, MatchDraftDetails, MatchDurationOption } from "../types/matchPlay";

import "./CreateMatchPage.css";

type MatchType = "open" | "private";
type QuickLocation = {
  label: string;
  description: string;
};

const durationLabels: Record<MatchDurationOption, string> = {
  "60": "1 hour",
  "90": "1 hour 30 min",
  "120": "2 hours",
};

const locationQuickPicks: QuickLocation[] = [
  { label: "Penmar Recreation Center", description: "Venice, CA" },
  { label: "Oceanside Tennis Center", description: "Santa Monica, CA" },
  { label: "Mar Vista Courts", description: "Los Angeles, CA" },
];

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatSummaryDate = (value: string) => {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
};

const formatSummaryTime = (value: string) => {
  if (!value) {
    return "";
  }
  const [hours, minutes] = value.split(":").map(Number);
  const reference = new Date();
  reference.setHours(hours);
  reference.setMinutes(minutes ?? 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(reference);
};

const getUpcomingDays = (count: number) => {
  const days: { label: string; value: string }[] = [];
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = 0; index < count; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    days.push({ label: formatter.format(date), value: formatDateInput(date) });
  }

  return days;
};

const CreateMatchPage = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { connectIntent } = (routerLocation.state as { connectIntent?: ConnectIntent } | null) ?? {};
  const dayQuickPicks = useMemo(() => getUpcomingDays(4), []);

  const connectDefaultMatchType: MatchType = connectIntent ? "private" : "open";

  const [matchType, setMatchType] = useState<MatchType>(connectDefaultMatchType);
  const [selectedDate, setSelectedDate] = useState<string>(dayQuickPicks[0]?.value ?? formatDateInput(new Date()));
  const [selectedTime, setSelectedTime] = useState("18:00");
  const [selectedDuration, setSelectedDuration] = useState<MatchDurationOption>("120");
  const [matchLocation, setMatchLocation] = useState(connectIntent?.preferredCourt || "Penmar Recreation Center");
  const [playersNeeded, setPlayersNeeded] = useState(3);
  const [isUnlimitedPlayers, setUnlimitedPlayers] = useState(false);

  const summaryLabel = useMemo(() => {
    const dateLabel = formatSummaryDate(selectedDate);
    const timeLabel = formatSummaryTime(selectedTime);
    const durationLabel = durationLabels[selectedDuration];
    if (!timeLabel) {
      return `${dateLabel}`;
    }
    return `${dateLabel} • ${timeLabel} • ${durationLabel}`;
  }, [selectedDate, selectedTime, selectedDuration]);

  const totalPlayersLabel = isUnlimitedPlayers ? "Unlimited" : `${playersNeeded + 1}`;
  const totalPlayersHelper = isUnlimitedPlayers
    ? "Anyone can join until you close the match"
    : `You + ${playersNeeded} ${playersNeeded === 1 ? "other" : "others"}`;

  const matchDraft: MatchDraftDetails = {
    matchType,
    date: selectedDate,
    time: selectedTime,
    duration: selectedDuration,
    location: matchLocation,
    playersNeeded,
    isUnlimitedPlayers,
  };

  const handleNavigateBack = () => {
    navigate(-1);
  };

  const isPrivateMatch = matchType === "private";

  return (
    <MainLayout>
      <div className="create-match-page">
        <div className="create-match-page__header">
          <div>
            <p className="create-match-page__eyebrow">Create a Match</p>
            <h1 className="create-match-page__title">
              {isPrivateMatch ? "Private match details" : "Open match details"}
            </h1>
            <p className="create-match-page__subtitle">
              Set the basics for your match. You can fine-tune the rest before publishing.
            </p>
          </div>
          <div className="create-match-page__progress" aria-label="Match creation progress">
            <div className="progress-step progress-step--active">
              <span className="progress-step__number">1</span>
              <span className="progress-step__label">Match details</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--upcoming">
              <span className="progress-step__number">2</span>
              <span className="progress-step__label">
                {isPrivateMatch ? "Invite players" : "Match settings"}
              </span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--upcoming">
              <span className="progress-step__number">3</span>
              <span className="progress-step__label">Review &amp; publish</span>
            </div>
          </div>
        </div>

        {connectIntent ? (
          <div className="connect-intent-banner" role="status">
            <div>
              <p className="connect-intent-banner__eyebrow">MatchPlay invite</p>
              <p className="connect-intent-banner__title">
                Prefilling details for {connectIntent.invitee.name}
              </p>
              <p className="connect-intent-banner__helper">
                We'll carry this player into your private roster on the next step.
              </p>
            </div>
          </div>
        ) : null}

        <section className="create-match-card" aria-labelledby="match-type">
          <h2 id="match-type">Match type</h2>
          <p className="create-match-card__subtitle">Choose how players can join.</p>
          <div className="match-type-options" role="radiogroup" aria-label="Match type">
            <button
              type="button"
              className={`match-type-card${matchType === "open" ? " match-type-card--active" : ""}`}
              onClick={() => setMatchType("open")}
              aria-pressed={matchType === "open"}
            >
              <div className="match-type-card__icon" aria-hidden="true">
                <Globe size={22} />
              </div>
              <div className="match-type-card__content">
                <span className="match-type-card__title">Open match</span>
                <span className="match-type-card__description">Anyone nearby can request to join.</span>
              </div>
            </button>
            <button
              type="button"
              className={`match-type-card${matchType === "private" ? " match-type-card--active" : ""}`}
              onClick={() => setMatchType("private")}
              aria-pressed={matchType === "private"}
            >
              <div className="match-type-card__icon" aria-hidden="true">
                <Lock size={22} />
              </div>
              <div className="match-type-card__content">
                <span className="match-type-card__title">Private match</span>
                <span className="match-type-card__description">Invite-only with a shareable link.</span>
              </div>
            </button>
          </div>
          {matchType === "private" && (
            <p className="match-type-card__helper">Switch to open to make this match discoverable to everyone.</p>
          )}
        </section>

        <section className="create-match-card" aria-labelledby="date-time">
          <div className="create-match-card__header">
            <div>
              <h2 id="date-time">Date &amp; time</h2>
              <p className="create-match-card__subtitle">Pick when the match will take place.</p>
            </div>
            <div className="create-match-summary">
              <CalendarDays size={18} aria-hidden="true" />
              <span>{summaryLabel}</span>
            </div>
          </div>

          <div className="create-match-field">
            <span className="create-match-field__label">Quick picks</span>
            <div className="pill-group">
              {dayQuickPicks.map((pick) => (
                <button
                  key={pick.value}
                  type="button"
                  className={`pill${selectedDate === pick.value ? " pill--active" : ""}`}
                  onClick={() => setSelectedDate(pick.value)}
                >
                  {pick.label}
                </button>
              ))}
            </div>
          </div>

          <div className="create-match-grid">
            <label className="input-field" htmlFor="match-date">
              <span className="input-field__label">Date</span>
              <div className="input-wrapper">
                <CalendarDays size={18} aria-hidden="true" />
                <input
                  id="match-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
            </label>
            <label className="input-field" htmlFor="match-time">
              <span className="input-field__label">Time</span>
              <div className="input-wrapper">
                <Clock size={18} aria-hidden="true" />
                <input
                  id="match-time"
                  type="time"
                  value={selectedTime}
                  onChange={(event) => setSelectedTime(event.target.value)}
                />
              </div>
            </label>
            <label className="input-field" htmlFor="match-duration">
              <span className="input-field__label">Duration</span>
              <select
                id="match-duration"
                value={selectedDuration}
                onChange={(event) => setSelectedDuration(event.target.value as MatchDurationOption)}
              >
                {Object.entries(durationLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="match-location">
          <div className="create-match-card__header">
            <div>
              <h2 id="match-location">Location</h2>
              <p className="create-match-card__subtitle">Players will see the exact address after they join.</p>
            </div>
            <div className="create-match-summary">
              <MapPin size={18} aria-hidden="true" />
              <span>{matchLocation || "Add a location"}</span>
            </div>
          </div>

          <label className="input-field" htmlFor="match-location-input">
            <span className="input-field__label">Venue or courts</span>
            <div className="input-wrapper">
              <MapPin size={18} aria-hidden="true" />
              <input
                id="match-location-input"
                type="text"
                placeholder="e.g., Oceanside Tennis Center"
                value={matchLocation}
                onChange={(event) => setMatchLocation(event.target.value)}
              />
            </div>
          </label>

          <div className="create-match-field">
            <span className="create-match-field__label">Recent locations</span>
            <div className="location-pills">
              {locationQuickPicks.map((quickPick) => (
                <button
                  key={quickPick.label}
                  type="button"
                  className={`location-pill${matchLocation === quickPick.label ? " location-pill--active" : ""}`}
                  onClick={() => setMatchLocation(quickPick.label)}
                >
                  <span className="location-pill__title">{quickPick.label}</span>
                  <span className="location-pill__subtitle">{quickPick.description}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="player-count">
          <div className="create-match-card__header">
            <div>
              <h2 id="player-count">Number of players needed</h2>
              <p className="create-match-card__subtitle">Total player count always includes you as the host.</p>
            </div>
            <div className="create-match-summary">
              <Users size={18} aria-hidden="true" />
              <span>{isUnlimitedPlayers ? "Unlimited" : `${playersNeeded + 1} players`}</span>
            </div>
          </div>

          <div className="player-count-card">
            <div className="player-count-card__header">
              <span className="player-count-card__label">Total players</span>
              <button
                type="button"
                className={`pill pill--outline${isUnlimitedPlayers ? " pill--active" : ""}`}
                onClick={() => setUnlimitedPlayers((value) => !value)}
              >
                {isUnlimitedPlayers ? "Unlimited enabled" : "Allow unlimited"}
              </button>
            </div>

            <div className="player-count-display" aria-live="polite">
              <span className="player-count-display__value">{totalPlayersLabel}</span>
              <span className="player-count-display__helper">{totalPlayersHelper}</span>
            </div>

            {!isUnlimitedPlayers && (
              <div className="player-count-controls" role="group" aria-label="Adjust players needed">
                <button
                  type="button"
                  onClick={() => setPlayersNeeded((value) => Math.max(1, value - 1))}
                  aria-label="Decrease players needed"
                >
                  −
                </button>
                <span>{playersNeeded}</span>
                <button
                  type="button"
                  onClick={() => setPlayersNeeded((value) => Math.min(15, value + 1))}
                  aria-label="Increase players needed"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="create-match-actions">
          <button type="button" className="create-match-actions__secondary" onClick={handleNavigateBack}>
            Cancel
          </button>
          <button
            type="button"
            className="create-match-actions__primary"
            onClick={() => {
              if (isPrivateMatch) {
                navigate("/matches/create/private/invite", {
                  state: { connectIntent, matchDraft },
                });
                return;
              }
              navigate("/matches/create/settings");
            }}
          >
            Next
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreateMatchPage;
