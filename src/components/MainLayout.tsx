import type { ReactNode } from "react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import ProfileManager from "./ProfileManager";
import { useAuth } from "../context/AuthContext";
import usePlayerIdentity from "../hooks/usePlayerIdentity";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "Browse Matches", href: "#matches" },
  { label: "Find Players", href: "#players" },
  { label: "Group Lessons", href: "#lessons" },
  { label: "Find Coaches", to: "/find-coaches" },
  { label: "My Activity", href: "#activity" },
];

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { logout } = useAuth();
  const { displayName, email, initials } = usePlayerIdentity();
  const [isProfileManagerOpen, setProfileManagerOpen] = useState(false);

  return (
    <div className="dashboard-page">
      <header className="main-nav">
        <div className="brand">
          <div className="brand-badge">MP</div>
          <span>Matchplay</span>
        </div>
        <nav className="nav-links">
          {navLinks.map((link) =>
            link.to ? (
              <NavLink
                key={link.label}
                to={link.to}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                {link.label}
              </NavLink>
            ) : (
              <a key={link.label} className="nav-link" href={link.href}>
                {link.label}
              </a>
            ),
          )}
        </nav>
        <div className="header-actions">
          <button type="button" className="play-now">
            Play Now
          </button>
          <button
            type="button"
            className="manage-profile"
            onClick={() => setProfileManagerOpen(true)}
          >
            Manage Profile
          </button>
          <button type="button" className="logout-button" onClick={logout}>
            Log out
          </button>
          <button
            type="button"
            className="user-pill"
            onClick={() => setProfileManagerOpen(true)}
          >
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-name">{displayName}</div>
              <div className="user-email">{email}</div>
            </div>
          </button>
        </div>
      </header>
      <main className="main-layout__content">{children}</main>
      <ProfileManager isOpen={isProfileManagerOpen} onClose={() => setProfileManagerOpen(false)} />
    </div>
  );
};

export default MainLayout;
