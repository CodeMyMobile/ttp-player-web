import { createElement, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, CalendarDays, ChevronDown, Home, LogOut, Plus, Search, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";
import {
  extractNotificationList,
  getNotificationCount,
  getNotifications,
} from "../api/notification";
import "./AppNav.css";

const navItems = [
  { label: "Home", to: "/", icon: Home },
  { label: "Lessons", to: "/group-lessons", icon: Search },
  { label: "Schedule", to: "/player/calendar", icon: CalendarDays },
  { label: "Match Play", to: "/matches", icon: Trophy },
];

const userMenuItems = [
  { label: "Player profile", to: "/settings/profile" },
  { label: "Player match profile", to: "/settings/match-profile" },
  { label: "Payment methods", to: "/settings/payment-methods" },
  { label: "Blocked users", to: "/settings/blocked-users" },
];

const isPathActive = (pathname, target) => {
  if (target === "/") return pathname === "/";
  return pathname === target || pathname.startsWith(`${target}/`);
};

const AppNav = ({ onNewMatch }) => {
  const { logout, user } = useAuth();
  const { displayName, initials, avatarUrl } = usePlayerIdentity();
  const location = useLocation();
  const navigate = useNavigate();
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsLoading, setNotificationsLoading] = useState(false);
  const userMenuRef = useRef(null);
  const notificationRef = useRef(null);
  const firstName = displayName?.split(" ")?.[0] || "Player";
  const skillLevel =
    user?.skillLevel ||
    user?.skill_level ||
    user?.usta_rating ||
    user?.profile?.skillLevel ||
    user?.profile?.skill_level ||
    user?.profile?.usta_rating ||
    "4.5";

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const token = getStoredAuthToken({ preferScheme: "token" });
    if (!token) return;

    const controller = new AbortController();

    getNotificationCount({ token, signal: controller.signal })
      .then((response) => {
        const data = response?.data ?? response;
        const unread = Number(data?.unread ?? 0);
        setUnreadCount(Number.isFinite(unread) ? unread : 0);
      })
      .catch(() => setUnreadCount(0));

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

  const handleNewMatch = () => {
    if (typeof onNewMatch === "function") {
      onNewMatch();
      return;
    }
    navigate("/create");
  };

  return (
    <header className="app-nav">
      <div className="app-nav__left">
        <Link className="app-nav__brand" to="/">
          <span className="app-nav__brand-mark">🎾</span>
          <strong>
            The Tennis <em>Plan</em>
          </strong>
        </Link>

        <nav className="app-nav__links" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={isPathActive(location.pathname, item.to) ? "active" : ""}
            >
              {createElement(item.icon, { size: 16 })}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="app-nav__right">
        <button className="app-nav__new-match" type="button" onClick={handleNewMatch}>
          <Plus size={17} />
          <span>New match</span>
        </button>

        <div className="app-nav__notifications" ref={notificationRef}>
          <button
            type="button"
            className="app-nav__icon-button"
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
            <Bell size={20} />
            {unreadCount > 0 ? <span className="app-nav__dot" /> : null}
          </button>

          {isNotificationsOpen ? (
            <div className="app-nav__dropdown app-nav__dropdown--notifications" role="menu">
              <h3>Notifications</h3>
              {isNotificationsLoading ? (
                <p>Loading notifications...</p>
              ) : notifications.length === 0 ? (
                <p>No notifications yet.</p>
              ) : (
                notifications.map((notification, index) => (
                  <Link
                    key={notification.id ?? index}
                    to="/notifications"
                    className="app-nav__notification"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <strong>{notification.title ?? "Notification"}</strong>
                    <span>{notification.message ?? notification.body ?? "New update available."}</span>
                  </Link>
                ))
              )}
              <Link to="/notifications" onClick={() => setNotificationsOpen(false)}>
                See all notifications
              </Link>
            </div>
          ) : null}
        </div>

        <div className="app-nav__user" ref={userMenuRef}>
          <button
            type="button"
            className="app-nav__user-trigger"
            aria-label="Open profile menu"
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            onClick={() => setUserMenuOpen((open) => !open)}
          >
            <span className={`app-nav__avatar${avatarUrl ? " has-image" : ""}`}>
              {avatarUrl ? <img src={avatarUrl} alt={`${displayName} profile`} /> : initials}
            </span>
            <span className="app-nav__user-copy">
              <strong>{firstName}</strong>
              <small>NTRP {skillLevel}</small>
            </span>
            <ChevronDown size={16} />
          </button>

          {isUserMenuOpen ? (
            <div className="app-nav__dropdown app-nav__dropdown--user" role="menu">
              {userMenuItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
              >
                <LogOut size={15} />
                <span>Log Out</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default AppNav;
