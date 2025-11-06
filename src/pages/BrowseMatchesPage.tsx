import { useMemo, useState, type CSSProperties } from "react";
import { Calendar, Filter, MapPin, MessageCircle, Search, Star, Users } from "lucide-react";
import MainLayout from "../components/MainLayout";
import { colors, typography } from "../lib/theme";
import { mockMatches } from "../data/mockMatches";

import "./BrowseMatchesPage.css";

const distanceOptions = ["3 mi", "5 mi", "10 mi", "15 mi", "All"];
const tabs = ["My Matches", "Hosting", "Open", "Today", "Tomorrow", "Weekend", "Drafts", "Archived"];

const relationshipLabel: Record<string, string> = {
  host: "Hosting",
  participant: "Joined",
};

const BrowseMatchesPage = () => {
  const [selectedDistance, setSelectedDistance] = useState(distanceOptions[1]);
  const [selectedTab, setSelectedTab] = useState(tabs[0]);

  const themeVars = useMemo(
    () =>
      ({
        "--matches-distance-bg": colors.filterChipBg,
        "--matches-distance-hover": colors.filterChipHover,
        "--matches-distance-selected-bg": colors.availableBg,
        "--matches-distance-selected-border": colors.primarySuccess,
        "--matches-distance-selected-text": colors.availableText,
        "--matches-text": colors.primaryText,
        "--matches-muted": colors.secondaryText,
        "--matches-border": colors.border,
        "--matches-surface": colors.surface,
        "--matches-success": colors.primarySuccess,
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
          <div className="location-panel__chips" role="group" aria-label="Distance from your current location">
            <button type="button" className="distance-chip distance-chip--location" aria-label="Selected location">
              <MapPin size={16} aria-hidden="true" />
              Franklin Canyon Courts
            </button>
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
            </div>
          </div>

          <div className="matches-grid">
            {mockMatches.map((match) => {
              const isHost = match.relationship === "host";
              const isParticipant = match.relationship === "participant";
              const isFull = match.playersJoined >= match.totalSpots;
              const spotsAvailable = Math.max(match.totalSpots - match.playersJoined, 0);
              const playersNeeded = match.playersNeeded ?? spotsAvailable;
              const availabilityLabel = isFull
                ? "Match is full"
                : `${spotsAvailable} spot${spotsAvailable === 1 ? "" : "s"} available`;
              const playersLabel = `${match.playersJoined}/${match.totalSpots} players`;
              const roleLabel = relationshipLabel[match.relationship] ?? null;

              return (
                <article key={match.id} className="match-card">
                  <header className="match-card__header">
                    <div className="match-pills">
                      <span className={`match-status-pill ${match.access.toLowerCase()}`}>{match.access}</span>
                      {roleLabel ? <span className="match-status-pill subtle">{roleLabel}</span> : null}
                    </div>
                    {!isFull && playersNeeded > 0 ? (
                      <span className="match-needed">{playersNeeded} needed</span>
                    ) : null}
                  </header>

                  <div className="match-card__body">
                    <div className="match-detail">
                      <Calendar size={18} aria-hidden="true" />
                      <p className="match-detail__primary">{match.startDisplay}</p>
                    </div>
                    <div className="match-detail">
                      <MapPin size={18} aria-hidden="true" />
                      <div>
                        <p className="match-detail__primary">{match.location}</p>
                        <p className="match-detail__secondary">{match.distance}</p>
                      </div>
                    </div>
                    <div className="match-detail">
                      <Users size={18} aria-hidden="true" />
                      <div>
                        <p className="match-detail__primary">{playersLabel}</p>
                        <p className="match-detail__secondary">{availabilityLabel}</p>
                      </div>
                    </div>
                    {match.access === "Open" && match.level ? (
                      <div className="match-detail">
                        <Star size={18} aria-hidden="true" />
                        <div>
                          <p className="match-detail__primary">Skill level: {match.level.summary}</p>
                          <p className="match-detail__secondary">{match.level.detail}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <footer className="match-card__footer">
                    {isHost ? (
                      <>
                        <button type="button" className="match-action primary">
                          View &amp; manage
                        </button>
                        <button type="button" className="match-action" disabled>
                          <MessageCircle size={16} aria-hidden="true" />
                          Message group
                        </button>
                      </>
                    ) : isParticipant ? (
                      <>
                        <button type="button" className="match-action">
                          View match
                        </button>
                        <button type="button" className="match-action primary">
                          <MessageCircle size={16} aria-hidden="true" />
                          Message group
                        </button>
                      </>
                    ) : (
                      <button type="button" className="match-action primary">
                        View match
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default BrowseMatchesPage;
