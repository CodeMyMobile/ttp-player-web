import { useMemo, useState, type CSSProperties } from "react";
import {
  CalendarClock,
  Filter,
  FlagTriangleRight,
  GaugeCircle,
  MapPin,
  MessageCircle,
  Search,
  Users,
  UsersRound,
} from "lucide-react";
import MainLayout from "../components/MainLayout";
import { colors, typography } from "../lib/theme";
import { mockMatches } from "../data/mockMatches";

import "./BrowseMatchesPage.css";

const distanceOptions = ["3 mi", "5 mi", "10 mi", "15 mi", "All"];
const tabs = [
  "My Matches",
  "Hosting",
  "Open",
  "Today",
  "Tomorrow",
  "Weekend",
  "Drafts",
  "Archived",
];

const activityFeed = [
  {
    id: "feed-1",
    title: "Need 2 players in 15 hours",
    description: "Sunrise Doubles Rally",
    meta: "Pommer Recreation Center",
    accent: "#16a34a",
  },
  {
    id: "feed-2",
    title: "3 new players joined",
    description: "After-Work Singles League",
    meta: "Griffith Club Los Angeles",
    accent: "#6366f1",
  },
  {
    id: "feed-3",
    title: "Match chat active",
    description: "Weekend Mixed Doubles",
    meta: "Echo Park Tennis Center",
    accent: "#f97316",
  },
];

const BrowseMatchesPage = () => {
  const [selectedDistance, setSelectedDistance] = useState(distanceOptions[1]);
  const [selectedTab, setSelectedTab] = useState(tabs[2]);

  const themeVars = useMemo(
    () => ({
      "--matches-chip-bg": colors.filterChipBg,
      "--matches-chip-hover": colors.filterChipHover,
      "--matches-chip-selected-bg": colors.filterChipSelectedBg,
      "--matches-chip-selected-border": colors.filterChipSelectedBorder,
      "--matches-chip-selected-text": colors.filterChipSelectedText,
      "--matches-surface": colors.surface,
      "--matches-border": colors.border,
      "--matches-text": colors.primaryText,
      "--matches-muted": colors.secondaryText,
      "--matches-accent": colors.primarySuccess,
      "--matches-warning": "#fbbf24",
      "--matches-tag": colors.filterChipBg,
      "--matches-font": typography.fontFamily,
    }) as CSSProperties,
    [],
  );

  return (
    <MainLayout>
      <div className="matches-page" style={themeVars}>
        <header className="matches-hero">
          <div className="matches-hero__text">
            <h1 className="matches-hero__title">Browse Local Matches</h1>
            <p className="matches-hero__subtitle">See what's nearby and jump back in.</p>
          </div>
          <div className="matches-hero__actions">
            <button type="button" className="matches-create-btn">
              + Create Match
            </button>
            <button type="button" className="matches-filter-btn">
              <Filter size={18} aria-hidden="true" />
              Filters
            </button>
          </div>
        </header>

        <section className="location-panel">
          <div className="location-panel__header">
            <div className="location-panel__heading">
              <button type="button" className="location-chip">
                <MapPin size={16} aria-hidden="true" />
                Current location
              </button>
              <div className="location-details">
                <h2>Franklin Canyon Courts</h2>
                <p>Using your verified club location</p>
              </div>
            </div>
            <button type="button" className="location-secondary">Change location</button>
          </div>
          <div
            className="location-panel__filters"
            role="group"
            aria-label="Distance from your current location"
          >
            {distanceOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`distance-chip${selectedDistance === option ? " selected" : ""}`}
                onClick={() => setSelectedDistance(option)}
                aria-pressed={selectedDistance === option}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section className="matches-main">
          <aside className="activity-feed" aria-label="Activity feed">
            <div className="activity-header">
              <h2>Activity Feed</h2>
              <button type="button" className="activity-action">
                <MessageCircle size={16} aria-hidden="true" />
                Match chat
              </button>
            </div>
            <ol className="activity-list">
              {activityFeed.map((item) => (
                <li key={item.id}>
                  <span className="activity-indicator" style={{ background: item.accent }} />
                  <div>
                    <p className="activity-title">{item.title}</p>
                    <p className="activity-description">{item.description}</p>
                    <p className="activity-meta">{item.meta}</p>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className="activity-link">
              View all updates
            </button>
          </aside>

          <div className="matches-column">
            <div className="matches-toolbar">
              <nav className="matches-tabs" aria-label="Match filters">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`tab${selectedTab === tab ? " active" : ""}`}
                    onClick={() => setSelectedTab(tab)}
                    aria-pressed={selectedTab === tab}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
              <div className="toolbar-actions">
                <div className="search-field">
                  <Search size={16} aria-hidden="true" />
                  <input type="search" placeholder="Search matches" aria-label="Search matches" />
                </div>
                <button type="button" className="saved-filter-btn">
                  <FlagTriangleRight size={16} aria-hidden="true" />
                  Saved filters
                </button>
              </div>
            </div>

            <div className="matches-grid">
              {mockMatches.map((match) => {
                const fillPercent = Math.round((match.playersJoined / match.totalSpots) * 100);
                const needsPlayers = match.playersNeeded ?? Math.max(match.totalSpots - match.playersJoined, 0);
                return (
                  <article key={match.id} className="match-card">
                    <header className="match-card__header">
                      <div className="match-pills">
                        <span className={`pill status ${match.status.toLowerCase()}`}>{match.status}</span>
                        <span className="pill type">{match.type}</span>
                        <span className="pill format">{match.format}</span>
                      </div>
                      <button type="button" className="card-menu" aria-label="More match actions">
                        •••
                      </button>
                    </header>
                    <div className="match-card__body">
                      {match.highlights?.length ? (
                        <ul className="match-highlights">
                          {match.highlights.map((highlight) => (
                            <li key={highlight}>{highlight}</li>
                          ))}
                        </ul>
                      ) : null}
                      <h3>{match.title}</h3>
                      <p className="match-level">{match.level}</p>
                      <div className="match-meta">
                        <span>
                          <CalendarClock size={16} aria-hidden="true" />
                          {match.startTime}
                        </span>
                        <span>
                          <MapPin size={16} aria-hidden="true" />
                          {match.location}
                        </span>
                      </div>
                      <div className="match-stats">
                        <div>
                          <Users size={16} aria-hidden="true" />
                          <strong>{match.playersJoined}</strong>/{match.totalSpots} joined
                        </div>
                        <div>
                          <GaugeCircle size={16} aria-hidden="true" />
                          {fillPercent}% filled
                        </div>
                        <div>
                          <UsersRound size={16} aria-hidden="true" />
                          {needsPlayers} spots open
                        </div>
                      </div>
                      {match.tags?.length ? (
                        <div className="match-tags">
                          {match.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <footer className="match-card__footer">
                      <div className="match-footer__info">
                        <span className="distance">{match.distance}</span>
                        {match.cost ? <span className="cost">{match.cost}</span> : null}
                      </div>
                      <div className="match-footer__actions">
                        <button type="button" className="secondary">
                          View & manage
                        </button>
                        <button type="button" className="primary">
                          Message group
                        </button>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default BrowseMatchesPage;
