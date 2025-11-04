import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import ProfileManager from "./ProfileManager";
import { useAuth } from "../context/AuthContext";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { Bell, ChevronDown, LogOut, Settings } from "lucide-react";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "Browse Matches", href: "#matches" },
  { label: "Find Players", href: "#players" },
  { label: "Group Lessons", to: "/group-lessons" },
  { label: "Find Coaches", to: "/find-coaches" },
  { label: "My Activity", href: "#activity" },
];

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { logout } = useAuth();
  const { displayName, initials, avatarUrl } = usePlayerIdentity();
  const [isProfileManagerOpen, setProfileManagerOpen] = useState(false);
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
          <button type="button" className="notification-button" aria-label="View notifications">
            <Bell size={20} aria-hidden="true" />
            <span className="notification-indicator" aria-hidden="true" />
          </button>
          <div className="user-menu" ref={userMenuRef}>
            <button
              type="button"
              className="user-menu__trigger"
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              aria-label="Open profile menu"
            >
              <div className={`user-avatar${avatarUrl ? " user-avatar--image" : ""}`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName ? `${displayName} profile` : "Player profile"} />
                ) : (
                  initials
                )}
              </div>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {isUserMenuOpen && (
              <div className="user-menu__dropdown" role="menu">
                <button
                  type="button"
                  className="user-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setProfileManagerOpen(true);
                    setUserMenuOpen(false);
                  }}
                >
                  <Settings size={16} aria-hidden="true" />
                  Manage Profile
                </button>
                <button
                  type="button"
                  className="user-menu__item user-menu__item--danger"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={16} aria-hidden="true" />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="main-layout__content">{children}</main>
      <ProfileManager isOpen={isProfileManagerOpen} onClose={() => setProfileManagerOpen(false)} />
    </div>
  );
};

export default MainLayout;
