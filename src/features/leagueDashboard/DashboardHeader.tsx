// App chrome header ported from the mock: brand, primary nav, location pill,
// New match, notifications, profile, and the ≤860px hamburger + mobile menu.
// This is static shell (not league data) — reproduced so the page matches the
// mock's own responsive header rather than the app's global AppNav.

import { useState } from "react";

import Icon from "./Icon";

const DashboardHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      <div className="nav">
        <a className="brand" href="#/">
          <span className="logo">
            <Icon name="ball-tennis" />
          </span>
          The Tennis <b>Plan</b>
        </a>
        <nav className="nav-links" aria-label="Primary">
          <a href="#/">
            <Icon name="home" />
            Home
          </a>
          <a href="#/my-coaches">
            <Icon name="users" />
            My Coaches
          </a>
          <a href="#/player/calendar">
            <Icon name="calendar" />
            Schedule
          </a>
        </nav>
        <div className="nav-right">
          <span className="pill">
            <Icon name="map-pin" />
            Current location
            <Icon name="chevron-down" style={{ fontSize: 15 }} />
          </span>
          <button type="button" className="btn newmatch">
            <Icon name="plus" />
            New match
          </button>
          <button type="button" className="icon-btn" aria-label="Notifications">
            <Icon name="bell" />
            <span className="dot" />
          </button>
          <div className="me">
            <span className="av">P</span>
            <span className="who">
              <span className="n">Paul</span>
              <span className="r">NTRP 4.5</span>
            </span>
            <Icon name="chevron-down" style={{ fontSize: 15, color: "var(--ink-3)" }} />
          </div>
          <button
            type="button"
            className="icon-btn hamburger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Icon name="menu-2" />
          </button>
        </div>
      </div>
      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        <a href="#/">
          <Icon name="home" />
          Home
        </a>
        <a href="#/my-coaches">
          <Icon name="users" />
          My Coaches
        </a>
        <a href="#/player/calendar">
          <Icon name="calendar" />
          Schedule
        </a>
        <a href="#/">
          <Icon name="map-pin" />
          Current location
        </a>
        <div className="mm-actions">
          <button type="button" className="btn wide">
            <Icon name="plus" />
            New match
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
