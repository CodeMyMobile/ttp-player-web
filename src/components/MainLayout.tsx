import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredLocationLabel } from "../utils/userLocation";
import {
  extractNotificationList,
  getNotificationCount,
  getNotifications,
  type PlayerNotification,
} from "../api/notification";
import { getStoredAuthToken } from "../services/authToken";
import { Bell, ChevronDown, CreditCard, LogOut, ShieldX, Target, UserRound } from "lucide-react";
import "../pages/DashboardPage.css";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "Browse Matches", to: "/matches" },
  { label: "Find Players", to: "/find-players" },
  { label: "Group Lessons", to: "/group-lessons" },
  { label: "Find Coaches", to: "/find-coaches" },
  { label: "My Coaches", to: "/my-coaches" },
  { label: "Credits", to: "/credits" },
  { label: "My Activity", href: "#activity" },
];

interface MainLayoutProps {
  children: ReactNode;
  mobileChrome?: "default" | "home";
  desktopChrome?: "default" | "home";
  showDesktopNav?: boolean;
}

const homeMobileNavItems = [
  { icon: "🏠", label: "Home", to: "/" },
  { icon: "🏆", label: "Post Match", to: "/matches/create" },
  { icon: "🔔", label: "Alerts", to: "/notifications" },
  { icon: "👤", label: "Profile", to: "/settings/profile" },
];

const homeDesktopNavLinks = [
  { label: "Home", to: "/", icon: "🏠" },
  { label: "Browse Matches", to: "/matches", icon: "🏆" },
  { label: "Find Players", to: "/find-players", icon: "👥" },
];

const MainLayout = ({
  children,
  mobileChrome = "default",
  desktopChrome = "default",
  showDesktopNav = true,
}: MainLayoutProps) => {
  const { logout } = useAuth();
  const { displayName, initials, avatarUrl } = usePlayerIdentity();
  const location = useLocation();
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PlayerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsLoading, setNotificationsLoading] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const userMenuItems = [
    { label: "Player profile", to: "/settings/profile", icon: UserRound },
    { label: "Player match profile", to: "/settings/match-profile", icon: Target },
    { label: "Payment methods", to: "/settings/payment-methods", icon: CreditCard },
    { label: "Blocked users", to: "/settings/blocked-users", icon: ShieldX },
  ];

  const firstName = displayName?.split(" ")?.[0] || "Player";
  const isHomeMobileChrome = mobileChrome === "home";
  const isHomeDesktopChrome = desktopChrome === "home";
  const locationLabel = getStoredLocationLabel() || "Venice, CA";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedInsideDesktopMenu = userMenuRef.current?.contains(event.target as Node);
      const clickedInsideMobileMenu = mobileUserMenuRef.current?.contains(event.target as Node);

      if (!clickedInsideDesktopMenu && !clickedInsideMobileMenu) {
        setUserMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const token = getStoredAuthToken({ preferScheme: "token" });
    if (!token) return;

    const controller = new AbortController();

    getNotificationCount({ token, signal: controller.signal })
      .then((response) => {
        const data = (response as { data?: { unread?: number } }).data ?? response;
        const unread = Number(data?.unread ?? 0);
        setUnreadCount(Number.isFinite(unread) ? unread : 0);
      })
      .catch(() => {
        setUnreadCount(0);
      });

    return () => controller.abort();
  }, []);

  const loadNotifications = async () => {
    const token = getStoredAuthToken({ preferScheme: "token" });
    if (!token) return;

    setNotificationsLoading(true);

    try {
      const response = await getNotifications({ token, perPage: 10, page: 1 });
      setNotifications(extractNotificationList(response));
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const formatNotificationDate = (notification: PlayerNotification) => {
    const rawValue = notification.createdAt ?? notification.created_at;
    if (!rawValue || typeof rawValue !== "string") return "";
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  };

  return (
      <div className={`dashboard-page${isHomeMobileChrome ? " dashboard-page--home-mobile" : ""}`}>
      {isHomeMobileChrome ? (
        <header className="ph-header ph-header--mobile">
          <div className="ph-header-left">
            <Link className="ph-brand" to="/">
              <span className="ph-brand-mark">🎾</span>
              <strong>
                The Tennis <em>Plan</em>
              </strong>
            </Link>
          </div>

          <div className="ph-header-right">
            <div className="ph-user-menu" ref={mobileUserMenuRef}>
              <button
                className="ph-user-trigger"
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
                aria-label="Open profile menu"
              >
                <span className={`ph-avatar${avatarUrl ? " has-image" : ""}`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName ? `${displayName} profile` : "Player profile"} />
                  ) : (
                    initials
                  )}
                </span>
                <span className="ph-user-copy">
                  <strong>{firstName}</strong>
                  <small>Settings</small>
                </span>
                <ChevronDown size={16} />
              </button>

              {isUserMenuOpen ? (
                <div className="ph-user-dropdown" role="menu">
                  {userMenuItems.map(({ label, to, icon: Icon }) => (
                    <Link
                      key={label}
                      to={to}
                      className="ph-user-menu-item"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </Link>
                  ))}

                  <button
                    type="button"
                    className="ph-user-menu-item ph-user-menu-item-danger"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}

      {showDesktopNav && isHomeDesktopChrome ? (
        <header className="ph-header ph-header--desktop">
          <div className="ph-header-left">
            <Link className="ph-brand" to="/">
              <span className="ph-brand-mark">🎾</span>
              <strong>
                The Tennis <em>Plan</em>
              </strong>
            </Link>

            <nav className="ph-nav-desktop" aria-label="Primary">
              {homeDesktopNavLinks.map((item) => (
                <Link
                  key={item.label}
                  className={location.pathname === item.to ? "active" : ""}
                  to={item.to}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="ph-header-right">
            <button className="ph-location" type="button">
              <span>{locationLabel}</span>
            </button>
            <div className="ph-user-menu" ref={userMenuRef}>
              <button
                className="ph-user-trigger"
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
                aria-label="Open profile menu"
              >
                <span className={`ph-avatar${avatarUrl ? " has-image" : ""}`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName ? `${displayName} profile` : "Player profile"} />
                  ) : (
                    initials
                  )}
                </span>
                <span className="ph-user-copy">
                  <strong>{firstName}</strong>
                  <small>Settings</small>
                </span>
                <ChevronDown size={16} />
              </button>

              {isUserMenuOpen ? (
                <div className="ph-user-dropdown" role="menu">
                  {userMenuItems.map(({ label, to, icon: Icon }) => (
                    <Link
                      key={label}
                      to={to}
                      className="ph-user-menu-item"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </Link>
                  ))}

                  <button
                    type="button"
                    className="ph-user-menu-item ph-user-menu-item-danger"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}

      {showDesktopNav && !isHomeDesktopChrome ? (
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
            <div className="notifications-menu" ref={notificationRef}>
              <button
                type="button"
                className="notification-button"
                aria-label="View notifications"
                aria-haspopup="menu"
                aria-expanded={isNotificationsOpen}
                onClick={() => {
                  const nextState = !isNotificationsOpen;
                  setNotificationsOpen(nextState);
                  if (nextState) {
                    loadNotifications();
                  }
                }}
              >
                <Bell size={20} aria-hidden="true" />
                {unreadCount > 0 && <span className="notification-indicator" aria-hidden="true" />}
              </button>
              {isNotificationsOpen && (
                <div className="notifications-dropdown" role="menu" aria-label="Notifications">
                  <div className="notifications-dropdown__header">
                    <h3>Notifications</h3>
                    {unreadCount > 0 && <span>{unreadCount} unread</span>}
                  </div>
                  {isNotificationsLoading ? (
                    <p className="notifications-dropdown__empty">Loading notifications…</p>
                  ) : notifications.length === 0 ? (
                    <p className="notifications-dropdown__empty">No notifications yet.</p>
                  ) : (
                    <ul className="notifications-list">
                      {notifications.map((notification, index) => {
                        const key = notification.id ?? `${notification.title ?? "notification"}-${index}`;
                        const content = notification.message ?? notification.body ?? "New update available.";

                        return (
                          <li key={key} className="notifications-list__item">
                            <p className="notifications-list__title">{notification.title ?? "Notification"}</p>
                            <p className="notifications-list__body">{content}</p>
                            <p className="notifications-list__time">{formatNotificationDate(notification)}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="notifications-dropdown__footer">
                    <Link
                      to="/notifications"
                      className="notifications-dropdown__see-all"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      See all notifications
                    </Link>
                  </div>
                </div>
              )}
            </div>
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
      ) : null}
      <main className="main-layout__content">{children}</main>
      {isHomeMobileChrome ? (
        <nav className="ph-bottom-nav" aria-label="Mobile navigation">
          {homeMobileNavItems.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === item.to
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            const badge = item.to === "/notifications" && unreadCount > 0 ? unreadCount : null;

            return (
              <NavLink key={item.label} className={isActive ? "active" : ""} to={item.to}>
                <span className="ph-bottom-nav-icon">
                  {item.icon}
                  {badge ? <span className="ph-bottom-nav-badge">{badge}</span> : null}
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
};

export default MainLayout;
