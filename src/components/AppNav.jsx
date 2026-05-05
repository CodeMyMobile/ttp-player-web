import { createElement, useEffect, useRef, useState } from "react";
import Autocomplete from "react-google-autocomplete";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Home,
  LogOut,
  MapPin,
  Plus,
  Search,
  ShieldX,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";
import {
  extractNotificationList,
  getNotificationCount,
  getNotifications,
} from "../api/notification";
import {
  getStoredLocationLabel,
  getStoredLocationRadius,
  storeLocation,
  storeLocationLabel,
  storeLocationRadius,
  USER_LOCATION_CHANGED_EVENT,
} from "../utils/userLocation";
import "./AppNav.css";

const navItems = [
  { label: "Home", to: "/", icon: Home },
  { label: "Lessons", to: "/group-lessons", icon: Search },
  { label: "Schedule", to: "/player/calendar", icon: CalendarDays },
  { label: "Match Play", to: "/matches", icon: Trophy },
];

const userMenuItems = [
  { label: "Player profile", to: "/settings/profile", icon: UserRound },
  { label: "Player match profile", to: "/settings/match-profile", icon: Target },
  { label: "Payment methods", to: "/settings/payment-methods", icon: CreditCard },
  { label: "Blocked users", to: "/settings/blocked-users", icon: ShieldX },
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
  const [isLocationOpen, setLocationOpen] = useState(false);
  const [locationLabel, setLocationLabel] = useState(getStoredLocationLabel() || "Current location");
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [locationError, setLocationError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [searchRadius, setSearchRadius] = useState(getStoredLocationRadius() ?? 5);
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

  useEffect(() => {
    const syncLocationState = () => {
      setLocationLabel(getStoredLocationLabel() || "Current location");
      setSearchRadius(getStoredLocationRadius() ?? 5);
    };

    syncLocationState();

    window.addEventListener("storage", syncLocationState);
    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncLocationState);

    return () => {
      window.removeEventListener("storage", syncLocationState);
      window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncLocationState);
    };
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

  const applyLocationSelection = ({ label, latitude, longitude }) => {
    storeLocation({ latitude, longitude });
    storeLocationLabel(label);
    setLocationLabel(label);
    setLocationSearchTerm(label);
    setLocationError("");
    setLocationOpen(false);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is unavailable in this browser.");
      return;
    }

    setIsDetectingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetectingLocation(false);
        applyLocationSelection({
          label: "Current location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setIsDetectingLocation(false);
        setLocationError("We couldn't access your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const handlePlaceSelected = (place) => {
    if (!place) {
      setLocationError("Please choose a location from the suggestions.");
      return;
    }

    const latitude = place.geometry?.location?.lat?.();
    const longitude = place.geometry?.location?.lng?.();
    const label = place.formatted_address || place.name || locationSearchTerm;

    if (
      !label ||
      typeof latitude !== "number" ||
      Number.isNaN(latitude) ||
      typeof longitude !== "number" ||
      Number.isNaN(longitude)
    ) {
      setLocationError("We couldn't read that location. Try another search result.");
      return;
    }

    applyLocationSelection({ label, latitude, longitude });
  };

  const radiusProgress = ((searchRadius - 1) / 24) * 100;

  return (
    <>
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
          <div className="app-nav__location-wrap">
            <button
              type="button"
              className="app-nav__location"
              title={locationLabel}
              onClick={() => {
                setLocationSearchTerm(locationLabel);
                setLocationError("");
                setLocationOpen(true);
              }}
            >
              <MapPin size={14} />
              <span>{locationLabel}</span>
              <ChevronDown size={14} />
            </button>
          </div>

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
                    className="app-nav__menu-item"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  className="app-nav__menu-item app-nav__menu-item--danger"
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

      {isLocationOpen ? (
        <div className="app-nav__location-overlay" onClick={() => setLocationOpen(false)}>
          <div className="app-nav__location-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="app-nav__location-handle" />
            <h3 className="app-nav__location-title">Choose Location</h3>

            <p className="app-nav__location-section-title">Use Current Location</p>
            <button
              type="button"
              className="app-nav__location-current"
              onClick={handleUseCurrentLocation}
            >
              <span className="app-nav__location-current-icon">
                <MapPin size={16} />
              </span>
              <span className="app-nav__location-current-copy">
                <strong>{isDetectingLocation ? "Detecting location..." : "Use my current location"}</strong>
                <small>
                  {isDetectingLocation
                    ? "Checking your device coordinates"
                    : "Update results around your device"}
                </small>
              </span>
              <span className="app-nav__location-check">✓</span>
            </button>

            <p className="app-nav__location-section-title">Enter a Location</p>
            <div className="app-nav__location-search">
              <Search size={16} />
              <Autocomplete
                apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                placeholder="City, neighborhood or zip code..."
                className="app-nav__location-search-input"
                value={locationSearchTerm}
                onChange={(event) => {
                  setLocationSearchTerm(event.target.value);
                  if (locationError) setLocationError("");
                }}
                onPlaceSelected={handlePlaceSelected}
                options={{
                  types: ["geocode", "establishment"],
                  fields: ["formatted_address", "geometry", "name", "address_components"],
                }}
              />
            </div>

            {locationError ? <p className="app-nav__location-error">{locationError}</p> : null}
            {!import.meta.env.VITE_GOOGLE_API_KEY ? (
              <p className="app-nav__location-tip">
                Add `VITE_GOOGLE_API_KEY` to enable Google location suggestions.
              </p>
            ) : null}

            <div className="app-nav__location-radius">
              <div className="app-nav__location-radius-head">
                <span>Search Radius</span>
                <strong>{searchRadius} miles</strong>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="1"
                value={searchRadius}
                onChange={(event) => {
                  const nextRadius = Number(event.target.value);
                  setSearchRadius(nextRadius);
                  storeLocationRadius(nextRadius);
                }}
                className="app-nav__location-slider-input"
                aria-label="Search Radius"
                style={{
                  background: `linear-gradient(90deg, #8b5cf6 0%, #8b5cf6 ${radiusProgress}%, #e2e8f0 ${radiusProgress}%, #e2e8f0 100%)`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default AppNav;
