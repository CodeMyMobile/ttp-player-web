import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, X } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import OAuthPhoneCapture, { shouldCaptureOAuthPhone } from "../OAuthPhoneCapture";
import {
  googlePlayerLogin,
  logout as clearAuthSession,
  signup as signupService,
} from "../../services/auth";
import "./AuthDrawer.css";

// Reusable bottom-sheet sign in / sign up. Mirrors the /login page's form and
// auth wiring (email + password, Google, SMS consent, OAuth phone capture) but
// stays on the current page: on success it invokes onAuthenticated + onClose
// instead of navigating. AuthContext updating `user` re-renders the host page.

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";
const GOOGLE_BUTTON_OPTIONS = {
  theme: "outline",
  size: "large",
  type: "standard",
  text: "continue_with",
  shape: "rectangular",
  logo_alignment: "left",
  width: 320,
};

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

const AuthDrawer = ({
  open,
  onClose,
  onAuthenticated,
  initialMode = "signup",
  title,
  subtitle,
}) => {
  const { login, lastEmail, establishSession } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(lastEmail || "");
  const [phone, setPhone] = useState("");
  const [smsConsentGranted, setSmsConsentGranted] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingOAuthSession, setPendingOAuthSession] = useState(null);
  const [pendingOAuthProvider, setPendingOAuthProvider] = useState("google");
  const googleButtonRef = useRef(null);
  const googleAuthInitialized = useRef(false);

  const isSignup = mode === "signup";
  const fullName = useMemo(() => `${firstName} ${lastName}`.trim(), [firstName, lastName]);

  // Reset to the requested mode each time the drawer is opened.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError("");
    }
  }, [open, initialMode]);

  const finishAuth = useCallback(() => {
    onAuthenticated?.();
    onClose?.();
  }, [onAuthenticated, onClose]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        if (phone.replace(/\D/g, "") && !smsConsentGranted) {
          setError("Please agree to receive SMS messages before creating your account.");
          setLoading(false);
          return;
        }
        const response = await signupService({
          email,
          password,
          name: fullName,
          phone,
          smsConsentGranted,
        });
        establishSession?.(response);
      } else {
        await login(email, password);
      }
      finishAuth();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          `Unable to ${isSignup ? "sign up" : "login"}. Please try again.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleModeToggle = () => {
    setError("");
    setMode((current) => (current === "signup" ? "signin" : "signup"));
    setSmsConsentGranted(false);
  };

  const handleGoogleCredential = useCallback(
    async (credentialResponse) => {
      if (!GOOGLE_CLIENT_ID) {
        setError("Google sign-in is not configured.");
        return;
      }
      if (!credentialResponse?.credential) {
        setError("Google sign-in did not return a token.");
        return;
      }
      setError("");
      setGoogleLoading(true);
      try {
        const response = {
          ...(await googlePlayerLogin(credentialResponse.credential)),
          oauth_provider: "google",
        };
        if (shouldCaptureOAuthPhone(response)) {
          localStorage.setItem("oauthPhoneCapturePending", "true");
          localStorage.setItem("oauthPhoneCaptureProvider", "google");
          setPendingOAuthProvider("google");
          setPendingOAuthSession(response);
          return;
        }
        establishSession?.(response);
        finishAuth();
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || "Unable to sign in with Google.");
      } finally {
        setGoogleLoading(false);
      }
    },
    [establishSession, finishAuth],
  );

  // Render the Google Identity button once the drawer is open and mounted.
  useEffect(() => {
    if (!open || pendingOAuthSession) return undefined;
    if (!GOOGLE_CLIENT_ID || typeof window === "undefined") return undefined;

    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleIdentityScript();
        if (cancelled || !google?.accounts?.id) return;
        if (!googleAuthInitialized.current) {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredential,
          });
          googleAuthInitialized.current = true;
        }
        const target = googleButtonRef.current;
        if (target && target.dataset.googleButtonRendered !== "true") {
          google.accounts.id.renderButton(target, GOOGLE_BUTTON_OPTIONS);
          target.dataset.googleButtonRendered = "true";
        }
      } catch {
        setError("Google sign-in is unavailable right now.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pendingOAuthSession, handleGoogleCredential]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="auth-drawer" role="dialog" aria-modal="true" aria-label={isSignup ? "Create your account" : "Sign in"}>
      <button type="button" className="auth-drawer__backdrop" aria-label="Close" onClick={onClose} />
      <div className="auth-drawer__panel">
        <button type="button" className="auth-drawer__close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="auth-drawer__handle" />

        {pendingOAuthSession ? (
          <OAuthPhoneCapture
            session={pendingOAuthSession}
            provider={pendingOAuthProvider}
            onBack={() => {
              clearAuthSession();
              localStorage.removeItem("oauthPhoneCapturePending");
              localStorage.removeItem("oauthPhoneCaptureProvider");
              setPendingOAuthSession(null);
            }}
            onComplete={(nextSession) => {
              establishSession?.(nextSession);
              finishAuth();
            }}
          />
        ) : (
          <>
            <div className="auth-drawer__header">
              <h2>{title || (isSignup ? "Create your account" : "Welcome back")}</h2>
              <p>
                {subtitle ||
                  (isSignup
                    ? "Sign up in 30 seconds to get on court."
                    : "Sign in to The Tennis Plan.")}
              </p>
            </div>

            {error ? <div className="auth-drawer__error">{error}</div> : null}

            {GOOGLE_CLIENT_ID ? (
              <>
                <div
                  className="auth-drawer__google"
                  ref={googleButtonRef}
                  aria-busy={googleLoading || loading}
                />
                <div className="auth-drawer__divider">
                  <span />
                  <small>or</small>
                  <span />
                </div>
              </>
            ) : null}

            <form className="auth-drawer__form" onSubmit={handleSubmit}>
              {isSignup ? (
                <div className="auth-drawer__row">
                  <div className="auth-drawer__field">
                    <label htmlFor="ad-first">First name</label>
                    <input
                      id="ad-first"
                      type="text"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Paul"
                      required
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="auth-drawer__field">
                    <label htmlFor="ad-last">Last name</label>
                    <input
                      id="ad-last"
                      type="text"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Cochrane"
                      required
                      autoComplete="family-name"
                    />
                  </div>
                </div>
              ) : null}

              <div className="auth-drawer__field">
                <label htmlFor="ad-email">Email</label>
                <input
                  id="ad-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              {isSignup ? (
                <div className="auth-drawer__field">
                  <label htmlFor="ad-phone">Phone</label>
                  <input
                    id="ad-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(310) 555-0123"
                    autoComplete="tel"
                  />
                </div>
              ) : null}

              {isSignup ? (
                <label className="auth-drawer__consent" htmlFor="ad-sms">
                  <input
                    id="ad-sms"
                    type="checkbox"
                    checked={smsConsentGranted}
                    onChange={(event) => setSmsConsentGranted(event.target.checked)}
                    required
                  />
                  <span className="auth-drawer__consent-copy">
                    <strong>SMS consent</strong>
                    <small>
                      I agree to receive SMS messages from The Tennis Plan. Msg &amp; data rates may
                      apply. Reply STOP to opt out.
                    </small>
                  </span>
                </label>
              ) : null}

              <div className="auth-drawer__field">
                <label htmlFor="ad-password">Password</label>
                <div className="auth-drawer__input-wrap">
                  <input
                    id="ad-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isSignup ? "Create a password" : "Your password"}
                    required
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

              {!isSignup ? (
                <div className="auth-drawer__helper-row">
                  <Link to="/forgot-password" onClick={onClose}>
                    Forgot password?
                  </Link>
                </div>
              ) : null}

              {isSignup ? (
                <p className="auth-drawer__terms">
                  By creating an account, you agree to our <a href="/terms/">Terms</a> and{" "}
                  <a href="/privacy/">Privacy Policy</a>
                </p>
              ) : null}

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

              <div className="auth-drawer__mode-switch">
                {isSignup ? "Already have an account?" : "Don't have an account?"}
                <button type="button" onClick={handleModeToggle}>
                  {isSignup ? "Sign in" : "Create one"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthDrawer;
