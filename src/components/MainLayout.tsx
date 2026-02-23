import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { Bell, ChevronDown, CreditCard, LogOut, MessageCircle, ShieldX, Target, UserRound } from "lucide-react";

const navLinks = [
  { label: "Browse Matches", to: "/matches" },
  { label: "Find Players", to: "/find-players" },
  { label: "Group Lessons", to: "/group-lessons" },
  { label: "Coaches", to: "/find-coaches" },
];

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { logout } = useAuth();
  const { displayName, initials, avatarUrl } = usePlayerIdentity();
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const userMenuItems = [
    { label: "Player profile", to: "/settings/profile", icon: UserRound },
    { label: "Player match profile", to: "/settings/match-profile", icon: Target },
    { label: "Payment methods", to: "/settings/payment-methods", icon: CreditCard },
    { label: "Blocked users", to: "/settings/blocked-users", icon: ShieldX },
  ];

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
      <header className="main-nav mobile-header">
        <Link className="brand mobile-header-left header-left" to="/" aria-label="Matchplay home">
          <div className="brand-badge mobile-logo">🎾</div>
          <span className="mobile-brand">Matchplay</span>
        </Link>
        <nav className="nav-links desktop-nav-links">
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
        <div className="header-actions mobile-header-right header-right">
          <button type="button" className="notification-button mobile-header-btn icon-btn" aria-label="Open messages">
            <MessageCircle size={20} aria-hidden="true" />
          </button>
          <button type="button" className="notification-button mobile-header-btn icon-btn" aria-label="View notifications">
            <Bell size={20} aria-hidden="true" />
            <span className="notification-indicator" aria-hidden="true" />
            <span className="mobile-badge" aria-hidden="true">3</span>
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
              <div className={`user-avatar mobile-avatar avatar${avatarUrl ? " user-avatar--image" : ""}`}>
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
                {userMenuItems.map(({ label, to, icon: Icon }) => (
                  <Link
                    key={label}
                    to={to}
                    className="user-menu__item"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </Link>
                ))}
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
    </div>
  );
};

export default MainLayout;
