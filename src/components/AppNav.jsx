import { createElement, useEffect, useRef, useState } from "react";
import Autocomplete from "react-google-autocomplete";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  Home,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldX,
  Target,
  Trophy,
  X,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { getStoredAuthToken } from "../services/authToken";
import { usableAvatar } from "../utils/avatar";
import {
  extractNotificationList,
  getNotificationCount,
  getNotifications,
} from "../api/notification";
import {
  DEFAULT_RADIUS_MILES,
  getStoredLocationLabel,
  getStoredLocationRadius,
  storeLocation,
  storeLocationLabel,
  storeLocationArea,
  getStoredLocationArea,
  readPlaceArea,
  shortLocationLabel,
  storeLocationRadius,
  USER_LOCATION_CHANGED_EVENT,
  USER_LOCATION_REQUEST_EVENT,
} from "../utils/userLocation";
import { getAuthNavState } from "../utils/authNavState";
import "./AppNav.css";

const navItems = [
  { label: "Home", to: "/", icon: Home },
  { label: "My Coaches", to: "/my-coaches", icon: Users },
  { label: "Schedule", to: "/player/calendar", icon: CalendarDays },
];

const userMenuItems = [
  { label: "Restring Service", to: "/restring", icon: RefreshCw },
  { label: "Restring orders", to: "/restring?screen=orders", icon: ClipboardList },
  { label: "My Leagues", to: "/leagues", icon: Trophy },
  { label: "Player profile", to: "/settings/profile", icon: UserRound },
  { label: "Player match profile", to: "/settings/match-profile", icon: Target },
  { label: "Log result", to: "/log-result", icon: Trophy },
  { label: "Match results", to: "/match-results", icon: Trophy },
  { label: "Payment methods", to: "/settings/payment-methods", icon: CreditCard },
  { label: "Blocked users", to: "/settings/blocked-users", icon: ShieldX },
];

const isPathActive = (pathname, target) => {
  if (target === "/") return pathname === "/";
  return pathname === target || pathname.startsWith(`${target}/`);
};

const AppNav = ({
  onNewMatch,
  hideMobileNewMatch = false,
  hideMobileNotifications = false,
  showBack = false,
  onBack,
  hideLocation = false,
  mobileCenter = null,
}) => {
  const { isAuthenticated, logout, user } = useAuth();
  const identity = usePlayerIdentity();
  const authNavState = getAuthNavState({
    isAuthenticated,
    displayName: identity.displayName,
    initials: identity.initials,
    avatarUrl: identity.avatarUrl,
  });
  const { displayName, initials, avatarUrl: rawAvatarUrl } = authNavState;
  // A bucket-root URL is a non-empty string but not a picture; without this the
  // truthy check below renders a broken image instead of the initials.
  const resolvedAvatarUrl = usableAvatar(rawAvatarUrl);
  // Covers the other half: a well-formed URL whose object is missing or expired.
  // Keyed by URL so a later, working one still gets a chance.
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const avatarUrl = resolvedAvatarUrl && resolvedAvatarUrl !== failedAvatarUrl ? resolvedAvatarUrl : null;
  const location = useLocation();
  const navigate = useNavigate();
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsLoading, setNotificationsLoading] = useState(false);
  const [isLocationOpen, setLocationOpen] = useState(false);
  const [locationLabel, setLocationLabel] = useState(getStoredLocationLabel() || "Current location");
  const [locationArea, setLocationArea] = useState(getStoredLocationArea());
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [locationError, setLocationError] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [searchRadius, setSearchRadius] = useState(getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES);
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

  // Esc closes the profile menu (keyboard support for the folded-in nav links).
  useEffect(() => {
    if (!isUserMenuOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isUserMenuOpen]);

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
      setLocationArea(getStoredLocationArea());
      setSearchRadius(getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES);
    };

    syncLocationState();

    // Another surface asking for the picker — the feed's prompt when no
    // location has been set.
    const openOnRequest = () => setLocationOpen(true);

    window.addEventListener("storage", syncLocationState);
    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncLocationState);
    window.addEventListener(USER_LOCATION_REQUEST_EVENT, openOnRequest);

    return () => {
      window.removeEventListener("storage", syncLocationState);
      window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncLocationState);
      window.removeEventListener(USER_LOCATION_REQUEST_EVENT, openOnRequest);
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

  const applyLocationSelection = ({ label, latitude, longitude, area = null }) => {
    storeLocation({ latitude, longitude });
    storeLocationLabel(label);
    // The header shows the neighbourhood, not the full address. Geolocation
    // gives us no place components, so "Current location" clears it and the
    // header falls back to the short label.
    storeLocationArea(area);
    setLocationArea(area);
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

    applyLocationSelection({ label, latitude, longitude, area: readPlaceArea(place) });
  };

  const radiusProgress = ((searchRadius - 1) / 24) * 100;

  return (
    <>
      <header className={`app-nav${mobileCenter ? " app-nav--has-mobile-center" : ""}`}>
        <div className="app-nav__left">
          {showBack ? (
            <button
              type="button"
              className="app-nav__back"
              aria-label="Go back"
              onClick={onBack}
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}
          <Link className="app-nav__brand" to="/">
            <span className="app-nav__brand-mark">🎾</span>
            <strong>
              The Tennis <em>Plan</em>
            </strong>
          </Link>

          {mobileCenter ? <div className="app-nav__mobile-center">{mobileCenter}</div> : null}

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
          <div className={`app-nav__location-wrap${hideLocation ? " app-nav__location-wrap--mobile-hidden" : ""}`}>
            <button
              type="button"
              className="app-nav__location"
              title={locationLabel}
              onClick={() => {
                setLocationSearchTerm("");
                setLocationError("");
                setLocationOpen(true);
              }}
            >
              <MapPin size={14} />
              <span>{locationArea || shortLocationLabel(locationLabel) || locationLabel}</span>
              <ChevronDown size={14} />
            </button>
          </div>

          {authNavState.isAuthenticated ? (
            <button
              className={`app-nav__new-match${hideMobileNewMatch ? " app-nav__new-match--mobile-hidden" : ""}`}
              type="button"
              onClick={handleNewMatch}
            >
              <Plus size={17} />
              <span>New match</span>
            </button>
          ) : null}

          {authNavState.isAuthenticated ? (
            <div
              className={`app-nav__notifications${hideMobileNotifications ? " app-nav__notifications--mobile-hidden" : ""}`}
              ref={notificationRef}
            >
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
          ) : null}

          {authNavState.isAuthenticated ? (
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
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${displayName} profile`}
                      onError={() => setFailedAvatarUrl(avatarUrl)}
                    />
                  ) : (
                    initials
                  )}
                </span>
                <span className="app-nav__user-copy">
                  <strong>{firstName}</strong>
                  <small>NTRP {skillLevel}</small>
                </span>
                <ChevronDown size={16} />
              </button>

              {isUserMenuOpen ? (
                <div className="app-nav__dropdown app-nav__dropdown--user" role="menu">
                  {/* Primary nav links have no home on mobile (app-nav__links is
                      hidden with no hamburger), so fold them into this menu —
                      shown only on mobile via app-nav__menu-item--mobile. */}
                  {navItems.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      role="menuitem"
                      className="app-nav__menu-item app-nav__menu-item--mobile"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
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
          ) : (
            <Link className="app-nav__new-match" to="/login" state={{ from: location }}>
              <span>Sign in</span>
            </Link>
          )}
        </div>
      </header>

      {isLocationOpen ? (
        <div className="app-nav__location-overlay" onClick={() => setLocationOpen(false)}>
          <div className="app-nav__location-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="app-nav__location-handle" />
            <div className="app-nav__location-header">
              <h3 className="app-nav__location-title">Choose Location</h3>
              <button
                type="button"
                className="app-nav__location-close"
                aria-label="Close location picker"
                onClick={() => setLocationOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

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
                placeholder="Enter your location"
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
                  componentRestrictions: { country: "us" },
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
                  background: `linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary) ${radiusProgress}%, #e2e8f0 ${radiusProgress}%, #e2e8f0 100%)`,
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
