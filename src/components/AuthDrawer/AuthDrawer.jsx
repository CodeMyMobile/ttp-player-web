import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User, X } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import {
  googlePlayerLogin,
  logout as clearAuthSession,
  signup as signupService,
} from "../../services/auth";
import OAuthPhoneCapture, {
  shouldCaptureOAuthPhone,
} from "../OAuthPhoneCapture";
import { useAuthDrawer } from "../../hooks/useAuthDrawer";
import {
  formatPhoneNumber,
  getPhoneDigits,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
} from "../../utils/authValidation";

import "./AuthDrawer.css";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";

const SMS_CONSENT_TEXT =
  "I agree to receive SMS messages from The Tennis Plan. Msg & data rates may apply. Reply STOP to opt out.";

let googleIdentityScriptPromise = null;

const loadGoogleIdentityScript = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }
  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise;
  }

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google sign-in.")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google sign-in."));
    document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
};

// Mirrors LoginPage's mapping so the drawer never shows raw API/Postgres errors.
const getAuthErrorMessage = (err, { isSignup }) => {
  const status = err?.status ?? err?.response?.status;
  const data = err?.response?.data;

  if (err?.message === "Failed to fetch") {
    return "We couldn't reach the server. Check your connection and try again.";
  }

  if (isSignup) {
    const duplicateEmail =
      data?.err?.constraint === "users_email_unique" ||
      data?.err?.code === "23505" ||
      /already exists/i.test(data?.err?.detail || "");
    if (duplicateEmail) {
      return "An account with this email already exists. Try signing in instead.";
    }
    return "Unable to create your account. Please try again.";
  }

  if (status === 401 || status === 403 || status === 404) {
    return "The email or password you entered is incorrect. Please try again.";
  }

  const guardMessage = data?.error || data?.message;
  if (guardMessage) return guardMessage;

  return "Unable to sign in. Please try again.";
};

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
    />
    <path
      fill="#FF3D00"
      d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
    />
  </svg>
);

const AuthDrawer = () => {
  const { isOpen, config, closeAuthDrawer, completeAuth } = useAuthDrawer();
  const { login, lastEmail, establishSession } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("signin");
  // Field state is intentionally shared across tabs so values persist on switch.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [smsConsentGranted, setSmsConsentGranted] = useState(true); // pre-checked per spec
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingOAuthSession, setPendingOAuthSession] = useState(null);

  const googleAuthInitialized = useRef(false);
  const pendingGoogleAuth = useRef(null);
  const firstFieldRef = useRef(null);

  const isSignup = mode === "signup";
  const fullName = useMemo(() => `${firstName} ${lastName}`.trim(), [firstName, lastName]);

  // Sync mode + prefill email each time the drawer is opened.
  useEffect(() => {
    if (!isOpen) return;
    setMode(config.mode === "signup" ? "signup" : "signin");
    setError("");
    setEmail((current) => current || lastEmail || "");
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [isOpen, config.mode, lastEmail]);

  // Preload Google script while the drawer is open.
  useEffect(() => {
    if (!isOpen || !GOOGLE_CLIENT_ID) return;
    loadGoogleIdentityScript().catch(() => {});
  }, [isOpen]);

  // Close on Escape + lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event) => {
      if (event.key === "Escape") closeAuthDrawer();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, closeAuthDrawer]);

  if (!isOpen) return null;

  const handlePhoneBlur = () => {
    setPhone((current) => (current ? formatPhoneNumber(current) : current));
  };

  const switchMode = (nextMode) => {
    setError("");
    setMode(nextMode);
  };

  const validate = () => {
    const emailError = validateEmail(email);
    if (emailError) return emailError;
    const passwordError = validatePassword(password, { isSignup });
    if (passwordError) return passwordError;
    if (isSignup) {
      const firstNameError = validateName(firstName, "First name");
      if (firstNameError) return firstNameError;
      const phoneError = validatePhone(phone);
      if (phoneError) return phoneError;
      if (getPhoneDigits(phone) && !smsConsentGranted) {
        return "Please agree to receive SMS messages before creating your account.";
      }
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      let session;
      if (isSignup) {
        session = await signupService({
          email,
          password,
          name: fullName,
          phone,
          smsConsentGranted,
        });
        establishSession?.(session);
      } else {
        session = await login(email, password);
      }
      completeAuth(session);
    } catch (err) {
      setError(getAuthErrorMessage(err, { isSignup }));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to enable it.");
      return;
    }
    setError("");
    setGoogleLoading(true);
    try {
      const google = await loadGoogleIdentityScript();
      if (!google?.accounts?.id) {
        throw new Error("Google sign-in is unavailable right now.");
      }

      const credential = await new Promise((resolve, reject) => {
        pendingGoogleAuth.current = { resolve, reject };
        if (!googleAuthInitialized.current) {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response) => {
              if (response?.credential) {
                pendingGoogleAuth.current?.resolve(response.credential);
                pendingGoogleAuth.current = null;
                return;
              }
              pendingGoogleAuth.current?.reject(new Error("Google sign-in did not return a token."));
              pendingGoogleAuth.current = null;
            },
            error_callback: () => {
              pendingGoogleAuth.current?.reject(new Error("Google sign-in was cancelled or failed."));
              pendingGoogleAuth.current = null;
            },
          });
          googleAuthInitialized.current = true;
        }
        google.accounts.id.prompt((notification) => {
          const notDisplayed =
            typeof notification?.isNotDisplayed === "function" && notification.isNotDisplayed();
          const skipped =
            typeof notification?.isSkippedMoment === "function" && notification.isSkippedMoment();
          if (notDisplayed || skipped) {
            pendingGoogleAuth.current?.reject(
              new Error("Google sign-in is unavailable for this browser session."),
            );
            pendingGoogleAuth.current = null;
          }
        });
      });

      const session = {
        ...(await googlePlayerLogin(credential)),
        oauth_provider: "google",
      };

      if (shouldCaptureOAuthPhone(session)) {
        localStorage.setItem("oauthPhoneCapturePending", "true");
        localStorage.setItem("oauthPhoneCaptureProvider", "google");
        setPendingOAuthSession(session);
        return;
      }
      establishSession?.(session);
      completeAuth(session);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Unable to sign in with Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const drawer = (
    <div className="auth-drawer" role="dialog" aria-modal="true" aria-label={isSignup ? "Create your account" : "Sign in"}>
      <div className="auth-drawer__backdrop" onClick={closeAuthDrawer} />
      <div className="auth-drawer__sheet" role="document">
        {pendingOAuthSession ? (
          <OAuthPhoneCapture
            session={pendingOAuthSession}
            provider="google"
            onBack={() => {
              clearAuthSession();
              localStorage.removeItem("oauthPhoneCapturePending");
              localStorage.removeItem("oauthPhoneCaptureProvider");
              setPendingOAuthSession(null);
            }}
            onComplete={(nextSession) => {
              establishSession?.(nextSession);
              completeAuth(nextSession);
            }}
          />
        ) : (
          <>
            <div className="auth-drawer__grabber" aria-hidden="true" />
            <button
              type="button"
              className="auth-drawer__close"
              onClick={closeAuthDrawer}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="auth-drawer__header">
              <h2>{config.title || (isSignup ? "Create your account" : "Welcome back")}</h2>
              <p>
                {config.subtitle ||
                  (isSignup
                    ? "Join The Tennis Plan to book, message, and play."
                    : "Sign in to continue.")}
              </p>
            </div>

            <div className="auth-drawer__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignup}
                className={`auth-drawer__tab ${!isSignup ? "is-active" : ""}`}
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignup}
                className={`auth-drawer__tab ${isSignup ? "is-active" : ""}`}
                onClick={() => switchMode("signup")}
              >
                Sign up
              </button>
            </div>

            <button
              type="button"
              className="auth-drawer__google"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              <GoogleMark />
              <span>{googleLoading ? "Connecting to Google…" : "Continue with Google"}</span>
            </button>

            <div className="auth-drawer__divider">
              <span>or with email</span>
            </div>

            {error ? <div className="auth-drawer__error">{error}</div> : null}

            <form className="auth-drawer__form" onSubmit={handleSubmit}>
              {isSignup ? (
                <div className="auth-drawer__row">
                  <div className="auth-drawer__field">
                    <label htmlFor="auth-drawer-first">First name</label>
                    <div className="auth-drawer__input-wrap">
                      <User size={17} className="auth-drawer__input-icon" />
                      <input
                        id="auth-drawer-first"
                        ref={firstFieldRef}
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Paul"
                        autoComplete="given-name"
                      />
                    </div>
                  </div>
                  <div className="auth-drawer__field">
                    <label htmlFor="auth-drawer-last">Last name</label>
                    <div className="auth-drawer__input-wrap">
                      <input
                        id="auth-drawer-last"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Cochrane"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="auth-drawer__field">
                <label htmlFor="auth-drawer-email">Email</label>
                <div className="auth-drawer__input-wrap">
                  <Mail size={17} className="auth-drawer__input-icon" />
                  <input
                    id="auth-drawer-email"
                    ref={isSignup ? undefined : firstFieldRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {isSignup ? (
                <div className="auth-drawer__field">
                  <label htmlFor="auth-drawer-phone">Phone</label>
                  <div className="auth-drawer__input-wrap">
                    <Phone size={17} className="auth-drawer__input-icon" />
                    <input
                      id="auth-drawer-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={handlePhoneBlur}
                      placeholder="(310) 555-0123"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              ) : null}

              <div className="auth-drawer__field">
                <label htmlFor="auth-drawer-password">Password</label>
                <div className="auth-drawer__input-wrap auth-drawer__input-wrap--trailing">
                  <Lock size={17} className="auth-drawer__input-icon" />
                  <input
                    id="auth-drawer-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignup ? "Create a password" : "Your password"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    className="auth-drawer__input-action"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {isSignup ? (
                <label className="auth-drawer__consent" htmlFor="auth-drawer-sms">
                  <input
                    id="auth-drawer-sms"
                    type="checkbox"
                    checked={smsConsentGranted}
                    onChange={(e) => setSmsConsentGranted(e.target.checked)}
                  />
                  <span>{SMS_CONSENT_TEXT}</span>
                </label>
              ) : null}

              {!isSignup ? (
                <div className="auth-drawer__helper-row">
                  <button
                    type="button"
                    className="auth-drawer__link"
                    onClick={() => {
                      closeAuthDrawer();
                      navigate("/forgot-password");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="auth-drawer__remember"
                onClick={() => setRememberMe((current) => !current)}
                aria-pressed={rememberMe}
              >
                <span className={`auth-drawer__toggle ${rememberMe ? "is-on" : ""}`}>
                  <span />
                </span>
                <span className="auth-drawer__remember-copy">
                  <strong>Keep me signed in</strong>
                  <small>Stay logged in on this device for 30 days</small>
                </span>
              </button>

              <button type="submit" className="auth-drawer__submit" disabled={loading}>
                <span>
                  {loading
                    ? isSignup
                      ? "Creating account…"
                      : "Signing in…"
                    : isSignup
                      ? "Create account"
                      : "Sign in"}
                </span>
                {!loading ? <ArrowRight size={16} /> : null}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
};

export default AuthDrawer;
