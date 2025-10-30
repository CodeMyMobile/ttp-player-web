import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDisplayName, getInitials } from "../utils/userDisplay";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "Browse Matches", to: { pathname: "/", hash: "#matches" } },
  { label: "Find Players", to: { pathname: "/", hash: "#players" } },
  { label: "Group Lessons", to: { pathname: "/", hash: "#lessons" } },
  { label: "Find Coaches", to: "/coaches" },
  { label: "My Activity", to: { pathname: "/", hash: "#activity" } },
];

const getLinkKey = (link) => {
  if (typeof link.to === "string") {
    return link.to || link.label;
  }

  const { pathname = "", hash = "" } = link.to;
  return `${pathname}${hash || ""}` || link.label;
};

const PlayerHeader = ({ onManageProfile, displayNameOverride }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const computedDisplayName = useMemo(() => getDisplayName(user), [user]);
  const displayName = displayNameOverride ?? computedDisplayName;
  const email = user?.email || "player@matchplay.app";
  const initials = getInitials(displayName, email);

  const isLinkActive = (link) => {
    if (typeof link.to === "string") {
      if (link.to === "/") {
        return location.pathname === "/" && !location.hash;
      }
      return location.pathname === link.to;
    }

    const { pathname = "/", hash } = link.to;
    if (pathname !== location.pathname) {
      return false;
    }

    if (!hash) {
      return location.pathname === pathname;
    }

    return location.hash === hash;
  };

  return (
    <header className="main-nav">
      <div className="brand">
        <div className="brand-badge">MP</div>
        <span>Matchplay</span>
      </div>
      <nav className="nav-links">
        {navLinks.map((link) => (
          <Link
            key={getLinkKey(link)}
            to={link.to}
            className={`nav-link${isLinkActive(link) ? " active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <button type="button" className="play-now">
          Play Now
        </button>
        <button type="button" className="manage-profile" onClick={onManageProfile}>
          Manage Profile
        </button>
        <button type="button" className="logout-button" onClick={logout}>
          Log out
        </button>
        <button type="button" className="user-pill" onClick={onManageProfile}>
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{displayName}</div>
            <div className="user-email">{email}</div>
          </div>
        </button>
      </div>
    </header>
  );
};

export default PlayerHeader;
