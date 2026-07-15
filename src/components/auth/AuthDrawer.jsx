import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, X } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { shouldCaptureOAuthPhone } from "../OAuthPhoneCapture";
import { googlePlayerLogin, signup as signupService } from "../../services/auth";
import { createPlayerPersonalDetails } from "../../services/player";
import { getPhoneDigits } from "../../services/phone";
import { SMS_DISCLOSURE_TEXT } from "../../services/smsConsent";
import "./AuthDrawer.css";

// Reusable auth sheet/modal — bottom sheet on mobile, centered modal on desktop (see
// AuthDrawer.css). Mirrors the /login page's auth wiring (email + password, Google, SMS
// consent) but stays on the current page: on success it invokes onAuthenticated + onClose
// instead of navigating. AuthContext updating `user` re-renders the host page.
//
// Signup is a signposted TWO-STEP flow — step 1 identify (Google OR email/password), step 2
// phone + SMS consent — and BOTH Google and email signups land on the same step 2. Sign-in
// is a single step. Summon it app-wide via the shared openAuth() trigger (AuthDrawerContext),
// or render it directly with the props below (both are supported).

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

// A small set of common country dial codes. The required field is the number; the code
// selector defaults to US (+1). Add more here as needed.
const COUNTRY_CODES = [
  { label: "US/CA +1", dial: "1" },
  { label: "UK +44", dial: "44" },
  { label: "AU +61", dial: "61" },
  { label: "IN +91", dial: "91" },
];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let googleIdentityScriptPromise = null;
const loadGoogleIdentityScript = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google sign-in.")), { once: true });
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
  subtitle,
}) => {
  const { login, lastEmail, establishSession } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(1); // 1 = identify, 2 = phone + consent (signup only)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(lastEmail || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dialCode, setDialCode] = useState("1");
  const [phone, setPhone] = useState("");
  const [smsConsentGranted, setSmsConsentGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingSession, setPendingSession] = useState(null);

  const dialogRef = useRef(null);
  const googleButtonRef = useRef(null);
  const googleAuthInitialized = useRef(false);
  const previouslyFocused = useRef(null);

  const isSignup = mode === "signup";
  const fullName = useMemo(() => `${firstName} ${lastName}`.trim(), [firstName, lastName]);

  // Reset to the requested mode/step each time the drawer is opened.
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setStep(1);
    setError("");
    setPassword("");
    setPhone("");
    setSmsConsentGranted(false);
    setPendingSession(null);
  }, [open, initialMode]);

  const finishAuth = useCallback(() => {
    onAuthenticated?.();
    onClose?.();
  }, [onAuthenticated, onClose]);

  // ----- Step 1: email / password -----
  const handleIdentifySubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        // Create the account with email/password/name only; phone + consent are collected
        // in step 2 and persisted the same way as the Google path.
        const response = await signupService({ email, password, name: fullName });
        establishSession?.(response);
        setPendingSession(response);
        setStep(2);
      } else {
        await login(email, password);
        finishAuth();
      }
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          `Unable to ${isSignup ? "sign up" : "sign in"}. Please try again.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleModeToggle = () => {
    setError("");
    setStep(1);
    setSmsConsentGranted(false);
    setMode((current) => (current === "signup" ? "signin" : "signup"));
  };

  // ----- Google -----
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
        establishSession?.(response);
        // Signup intent (or any account still missing a phone) → land on step 2.
        if (mode === "signup" || shouldCaptureOAuthPhone(response)) {
          setPendingSession(response);
          setStep(2);
          return;
        }
        finishAuth();
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || "Unable to sign in with Google.");
      } finally {
        setGoogleLoading(false);
      }
    },
    [mode, establishSession, finishAuth],
  );

  // Render the Google Identity button once the drawer is open on step 1.
  useEffect(() => {
    if (!open || step !== 1) return undefined;
    if (!GOOGLE_CLIENT_ID || typeof window === "undefined") return undefined;

    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleIdentityScript();
        if (cancelled || !google?.accounts?.id) return;
        if (!googleAuthInitialized.current) {
          google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
          googleAuthInitialized.current = true;
        }
        const target = googleButtonRef.current;
        if (target && target.dataset.googleButtonRendered !== "true") {
          google.accounts.id.renderButton(target, GOOGLE_BUTTON_OPTIONS);
          target.dataset.googleButtonRendered = "true";
        }
      } catch {
        // Leave the email path usable; only Google is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, step, handleGoogleCredential]);

  // ----- Step 2: phone + consent -----
  const phoneDigits = useMemo(() => getPhoneDigits(`${dialCode}${phone}`), [dialCode, phone]);
  const phoneValid = phoneDigits.replace(/\D/g, "").length >= 10;
  const canFinish = phoneValid && smsConsentGranted && !loading;

  const handleFinish = async (event) => {
    event.preventDefault();
    if (!canFinish) return;
    setError("");
    setLoading(true);
    try {
      const token =
        pendingSession?.access_token ||
        pendingSession?.token ||
        (typeof window !== "undefined" ? localStorage.getItem("authToken") : null);
      await createPlayerPersonalDetails({
        player: token,
        fullName: fullName || undefined,
        mobile: phoneDigits,
        smsConsentGranted: true,
        smsConsentMethod: "auth_drawer_signup",
      });
      finishAuth();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Unable to save your phone number.");
    } finally {
      setLoading(false);
    }
  };

  const handleBrowse = () => {
    onClose?.();
    navigate("/find-coaches");
  };

  // ----- Accessibility: focus trap, Esc, scroll lock, focus restore -----
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const raf = requestAnimationFrame(() => {
      const node = dialogRef.current?.querySelector(FOCUSABLE);
      (node || dialogRef.current)?.focus?.();
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll(FOCUSABLE);
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = prevOverflow;
      const returnTo = previouslyFocused.current;
      if (returnTo && typeof returnTo.focus === "function") returnTo.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const headingId = "auth-drawer-heading";
  const onStep2 = isSignup && step === 2;

  return (
    <div className="auth-drawer" role="presentation">
      <button type="button" className="auth-drawer__backdrop" aria-label="Close" onClick={onClose} />
      <div
        className="auth-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={dialogRef}
        tabIndex={-1}
      >
        <button type="button" className="auth-drawer__close" aria-label="Close" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
        <div className="auth-drawer__handle" aria-hidden="true" />

        {onStep2 ? (
          <>
            <div className="auth-drawer__header">
              <p className="auth-drawer__step">Step 2 of 2</p>
              <h2 id={headingId}>Add your mobile number</h2>
              <p>
                We use it for match invites, lesson reminders, and account updates — in the app and
                by text.
              </p>
            </div>

            {error ? <div className="auth-drawer__error" role="alert">{error}</div> : null}

            <form className="auth-drawer__form" onSubmit={handleFinish}>
              <div className="auth-drawer__field">
                <label htmlFor="ad-phone">Mobile number</label>
                <div className="auth-drawer__phone-row">
                  <select
                    value={dialCode}
                    onChange={(event) => setDialCode(event.target.value)}
                    aria-label="Country code"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.dial} value={c.dial}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    id="ad-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="Mobile number"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    aria-invalid={phone.length > 0 && !phoneValid}
                    required
                  />
                </div>
                {phone.length > 0 && !phoneValid ? (
                  <small className="auth-drawer__help">Enter a valid mobile number.</small>
                ) : null}
              </div>

              <label className="auth-drawer__consent" htmlFor="ad-sms">
                <input
                  id="ad-sms"
                  type="checkbox"
                  checked={smsConsentGranted}
                  onChange={(event) => setSmsConsentGranted(event.target.checked)}
                />
                <span className="auth-drawer__consent-copy">
                  <small>{SMS_DISCLOSURE_TEXT}</small>
                </span>
              </label>
              {!smsConsentGranted ? (
                <small className="auth-drawer__help">You&apos;ll need to agree to continue.</small>
              ) : null}

              <button type="submit" className="auth-drawer__submit" disabled={!canFinish}>
                <span>{loading ? "Saving…" : "Finish"}</span>
                {!loading ? <ArrowRight size={16} aria-hidden="true" /> : null}
              </button>

              <p className="auth-drawer__terms">
                By continuing you agree to our <a href="/terms/">Terms</a> and{" "}
                <a href="/privacy/">Privacy Policy</a>.
              </p>
            </form>
          </>
        ) : (
          <>
            <div className="auth-drawer__header">
              {isSignup ? <p className="auth-drawer__step">Step 1 of 2</p> : null}
              <h2 id={headingId}>{isSignup ? "Create your account" : "Welcome back"}</h2>
              <p>
                {subtitle ||
                  (isSignup
                    ? "Free — find coaches, players, and leagues near you."
                    : "Pick up right where you left off.")}
              </p>
            </div>

            {error ? <div className="auth-drawer__error" role="alert">{error}</div> : null}

            {GOOGLE_CLIENT_ID ? (
              <>
                <div className="auth-drawer__google" ref={googleButtonRef} aria-busy={googleLoading || loading} />
                <div className="auth-drawer__divider">
                  <span />
                  <small>OR WITH EMAIL</small>
                  <span />
                </div>
              </>
            ) : null}

            <form className="auth-drawer__form" onSubmit={handleIdentifySubmit}>
              {isSignup ? (
                <div className="auth-drawer__row">
                  <div className="auth-drawer__field">
                    <label htmlFor="ad-first">First name</label>
                    <input
                      id="ad-first"
                      type="text"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
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
                  <Link to="/forgot-password" onClick={onClose}>Forgot password?</Link>
                </div>
              ) : null}

              <button type="submit" className="auth-drawer__submit" disabled={loading}>
                <span>
                  {loading
                    ? isSignup
                      ? "Please wait…"
                      : "Signing in…"
                    : isSignup
                      ? "Continue"
                      : "Sign in"}
                </span>
                {!loading ? <ArrowRight size={16} aria-hidden="true" /> : null}
              </button>

              <div className="auth-drawer__mode-switch">
                {isSignup ? "Already play here?" : "New here?"}
                <button type="button" onClick={handleModeToggle}>
                  {isSignup ? "Sign in" : "Create an account"}
                </button>
              </div>
            </form>

            <button type="button" className="auth-drawer__browse" onClick={handleBrowse}>
              Just browsing? Explore coaches →
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthDrawer;
