import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  Mail,
  MapPinned,
  Phone,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import OAuthPhoneCapture, { shouldCaptureOAuthPhone } from "../components/OAuthPhoneCapture";
import LegalFooter from "../components/LegalFooter";
import {
  googlePlayerLogin,
  logout as clearAuthSession,
  signup as signupService,
} from "../services/auth";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";

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

const tennisBallMark = (
  <svg width="92" height="92" viewBox="0 0 88 88" aria-hidden="true">
    <defs>
      <radialGradient id="auth-ball-grad" cx="38%" cy="32%">
        <stop offset="0%" stopColor="#ECFCCB" />
        <stop offset="55%" stopColor="#BEF264" />
        <stop offset="100%" stopColor="#65A30D" />
      </radialGradient>
    </defs>
    <circle cx="44" cy="44" r="34" fill="url(#auth-ball-grad)" />
    <path
      d="M 16 25 Q 44 44 16 63"
      stroke="white"
      strokeWidth="3.2"
      fill="none"
      opacity="0.95"
      strokeLinecap="round"
    />
    <path
      d="M 72 25 Q 44 44 72 63"
      stroke="white"
      strokeWidth="3.2"
      fill="none"
      opacity="0.95"
      strokeLinecap="round"
    />
    <ellipse cx="32" cy="27" rx="8" ry="3.5" fill="white" opacity="0.5" />
  </svg>
);

const featureItems = [
  {
    icon: MapPinned,
    text: "Find certified coaches in your neighborhood",
  },
  {
    icon: CalendarDays,
    text: "Book lessons and manage packages in one tap",
  },
  {
    icon: Users,
    text: "Join matches and flex leagues at your level",
  },
];

const GOOGLE_BUTTON_OPTIONS = {
  theme: "outline",
  size: "large",
  type: "standard",
  text: "continue_with",
  shape: "rectangular",
  logo_alignment: "left",
  width: 320,
};

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, lastEmail, establishSession } = useAuth();
  const [mode, setMode] = useState(location.state?.mode === "signup" ? "signup" : "signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(lastEmail || "");
  const [phone, setPhone] = useState("");
  const [smsConsentGranted, setSmsConsentGranted] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileScreen, setMobileScreen] = useState("welcome");
  const [pendingOAuthSession, setPendingOAuthSession] = useState(null);
  const [pendingOAuthProvider, setPendingOAuthProvider] = useState("google");
  const mobileGoogleButtonRef = useRef(null);
  const desktopGoogleButtonRef = useRef(null);
  const googleAuthInitialized = useRef(false);

  const isSignup = mode === "signup";
  const fullName = useMemo(
    () => `${firstName} ${lastName}`.trim(),
    [firstName, lastName],
  );

  const navigateAfterAuth = useCallback(() => {
    const from = location.state?.from;
    if (from) {
      navigate(
        {
          pathname: from.pathname || "/",
          search: from.search || "",
          hash: from.hash || "",
        },
        { replace: true, state: from.state },
      );
      return;
    }
    navigate("/", { replace: true });
  }, [location.state?.from, navigate]);

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
      navigateAfterAuth();
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

  const handleGoogleCredential = useCallback(async (credentialResponse) => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to enable it.");
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
      navigateAfterAuth();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Unable to sign in with Google.");
    } finally {
      setGoogleLoading(false);
    }
  }, [establishSession, navigateAfterAuth]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window === "undefined") return;

    let isCancelled = false;

    const renderGoogleButtons = async () => {
      try {
        const google = await loadGoogleIdentityScript();
        if (isCancelled) return;
        if (!google?.accounts?.id) {
          throw new Error("Google sign-in is unavailable right now.");
        }

        if (!googleAuthInitialized.current) {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredential,
          });
          googleAuthInitialized.current = true;
        }

        [mobileGoogleButtonRef.current, desktopGoogleButtonRef.current].forEach((target) => {
          if (!target || target.dataset.googleButtonRendered === "true") return;
          google.accounts.id.renderButton(target, GOOGLE_BUTTON_OPTIONS);
          target.dataset.googleButtonRendered = "true";
        });
      } catch {
        // Surface errors only when Google is configured but cannot render.
        setError("Google sign-in is unavailable right now.");
      }
    };

    renderGoogleButtons();

    return () => {
      isCancelled = true;
    };
  }, [handleGoogleCredential, mobileScreen]);

  const openMobileForm = (nextMode = mode) => {
    setError("");
    setMode(nextMode);
    setMobileScreen("form");
  };

  if (pendingOAuthSession) {
    return (
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
          navigateAfterAuth();
        }}
      />
    );
  }

  return (
    <div className="auth-welcome">
      <div className="auth-welcome__mobile">
        <div className="auth-mobile">
          {mobileScreen === "welcome" ? (
            <div className="auth-mobile__screen auth-mobile__screen--welcome">
              <div className="auth-mobile__hero">
                <div className="auth-mobile__logo-tile">{tennisBallMark}</div>
                <div className="auth-mobile__wordmark">
                  The Tennis <span>Plan</span>
                </div>
                <p className="auth-mobile__tagline">Find your coach. Play your match.</p>
              </div>

              <div className="auth-mobile__actions">
                {/* <button
                  type="button"
                  className="auth-welcome__social auth-welcome__social--apple"
                  onClick={handleAppleLogin}
                >
                  <Apple size={18} />
                  <span>Continue with Apple</span>
                </button> */}
                <div
                  className="auth-welcome__social auth-welcome__social--google auth-welcome__google-button"
                  ref={mobileGoogleButtonRef}
                  aria-busy={googleLoading || loading}
                />
                <button
                  type="button"
                  className="auth-mobile__email-entry"
                  onClick={() => openMobileForm("signup")}
                >
                  <Mail size={18} />
                  <span>Continue with email</span>
                </button>
                <div className="auth-mobile__signin-link">
                  Already a member?
                  <button type="button" onClick={() => openMobileForm("signin")}>
                    Sign in
                  </button>
                </div>
              </div>

              <div className="auth-mobile__welcome-footer">
                <p className="auth-welcome__terms auth-welcome__terms--signin">
                  By continuing, you agree to The Tennis Plan&apos;s{" "}
                  <a href="/terms/">Terms of Service</a> and <a href="/privacy/">Privacy Policy</a>
                </p>
              </div>
            </div>
          ) : (
            <div className="auth-mobile__screen auth-mobile__screen--form">
              <div className="auth-mobile__nav">
                <button type="button" className="auth-mobile__back" onClick={() => setMobileScreen("welcome")}>
                  <ArrowRight size={18} className="auth-mobile__back-icon" />
                  <span>Back</span>
                </button>
              </div>

              <div className="auth-mobile__body">
                <div className="auth-mobile__eyebrow">
                  <div className="auth-mobile__eyebrow-tile">{tennisBallMark}</div>
                  <span>
                    The Tennis <span>Plan</span>
                  </span>
                </div>

                <div className="auth-welcome__header auth-welcome__header--mobile">
                  <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
                  <p>
                    {isSignup
                      ? "Welcome to The Tennis Plan"
                      : "Sign in to The Tennis Plan"}
                  </p>
                </div>

                {error ? <div className="auth-welcome__error">{error}</div> : null}

                <form className="auth-welcome__form" onSubmit={handleSubmit}>
                  {isSignup ? (
                    <div className="auth-mobile__row">
                      <div className="auth-welcome__field">
                        <label htmlFor="mobile-first-name">First name</label>
                        <input
                          id="mobile-first-name"
                          type="text"
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                          placeholder="Paul"
                          required
                          autoComplete="given-name"
                        />
                      </div>
                      <div className="auth-welcome__field">
                        <label htmlFor="mobile-last-name">Last name</label>
                        <input
                          id="mobile-last-name"
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

                  <div className="auth-welcome__field">
                    <label htmlFor="mobile-email">Email</label>
                    <input
                      id="mobile-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>

                  {isSignup ? (
                    <div className="auth-welcome__field">
                      <label htmlFor="mobile-phone">Phone</label>
                      <input
                        id="mobile-phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="(310) 555-0123"
                        autoComplete="tel"
                      />
                    </div>
                  ) : null}

                  {isSignup ? (
                    <label className="auth-welcome__remember" htmlFor="mobile-sms-consent">
                      <input
                        id="mobile-sms-consent"
                        type="checkbox"
                        checked={smsConsentGranted}
                        onChange={(event) => setSmsConsentGranted(event.target.checked)}
                        required
                      />
                      <span className="auth-welcome__remember-copy">
                        <strong>SMS consent</strong>
                        <small>
                          I agree to receive SMS messages from The Tennis Plan. Msg &amp; data rates may apply. Reply STOP to opt out.
                        </small>
                      </span>
                    </label>
                  ) : null}

                  <div className="auth-welcome__field">
                    <label htmlFor="mobile-password">Password</label>
                    <div className="auth-welcome__input-wrap auth-welcome__input-wrap--trailing">
                      <input
                        id="mobile-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={isSignup ? "Create a password" : "Your password"}
                        required
                        autoComplete={isSignup ? "new-password" : "current-password"}
                      />
                      <button
                        type="button"
                        className="auth-welcome__input-action"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {!isSignup ? (
                    <div className="auth-welcome__helper-row">
                      <Link to="/forgot-password">Forgot password?</Link>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="auth-welcome__remember"
                    onClick={() => setRememberMe((current) => !current)}
                    aria-pressed={rememberMe}
                  >
                    <span className={`auth-welcome__toggle ${rememberMe ? "is-on" : ""}`}>
                      <span />
                    </span>
                    <span className="auth-welcome__remember-copy">
                      <strong>Keep me signed in</strong>
                      <small>Stay logged in on this device for 30 days</small>
                    </span>
                  </button>

                  <div className="auth-mobile__footer">
                    {isSignup ? (
                      <p className="auth-welcome__terms">
                        By creating an account, you agree to our{" "}
                        <a href="/terms/">Terms</a> and <a href="/privacy/">Privacy Policy</a>
                      </p>
                    ) : null}

                    <button type="submit" className="auth-welcome__submit" disabled={loading}>
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

                    <div className="auth-welcome__mode-switch auth-welcome__mode-switch--mobile">
                      {isSignup ? "Already have an account?" : "Don't have an account?"}
                      <button type="button" onClick={handleModeToggle}>
                        {isSignup ? "Sign in" : "Create one"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="auth-welcome__desktop">
        <div className="auth-welcome__shell">
        <section className="auth-welcome__brand-panel">
          <div className="auth-welcome__brand-inner">
            <div className="auth-welcome__logo-tile">{tennisBallMark}</div>
            <div className="auth-welcome__wordmark">
              The Tennis <span>Plan</span>
            </div>
            <p className="auth-welcome__tagline">Find your coach. Play your match.</p>

            <div className="auth-welcome__features">
              {featureItems.map(({ icon, text }) => (
                <div key={text} className="auth-welcome__feature">
                  <div className="auth-welcome__feature-icon">
                    {createElement(icon, { size: 18 })}
                  </div>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-welcome__form-panel">
          <div className="auth-welcome__form-wrap">
            <div className="auth-welcome__header">
              <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
              <p>
                {isSignup
                  ? "Welcome to The Tennis Plan. Get on court in minutes."
                  : "Sign in to The Tennis Plan to find your next match."}
              </p>
            </div>

            {error ? <div className="auth-welcome__error">{error}</div> : null}

            <div className="auth-welcome__socials">
              {/* <button
                type="button"
                className="auth-welcome__social auth-welcome__social--apple"
                onClick={handleAppleLogin}
              >
                <Apple size={18} />
                <span>Continue with Apple</span>
              </button> */}
              <div
                className="auth-welcome__social auth-welcome__social--google auth-welcome__google-button"
                ref={desktopGoogleButtonRef}
                aria-busy={googleLoading || loading}
              />
            </div>

            <div className="auth-welcome__divider">
              <span>or with email</span>
            </div>

            <form className="auth-welcome__form" onSubmit={handleSubmit}>
              {isSignup ? (
                <div className="auth-welcome__row">
                  <div className="auth-welcome__field">
                    <label htmlFor="first-name">First name</label>
                    <input
                      id="first-name"
                      type="text"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Paul"
                      required
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="auth-welcome__field">
                    <label htmlFor="last-name">Last name</label>
                    <input
                      id="last-name"
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

              <div className="auth-welcome__field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              {isSignup ? (
                <div className="auth-welcome__field">
                  <label htmlFor="phone">Phone</label>
                  <div className="auth-welcome__input-wrap">
                    <Phone size={17} className="auth-welcome__input-icon" />
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="(310) 555-0123"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              ) : null}

              {isSignup ? (
                <label className="auth-welcome__remember" htmlFor="sms-consent">
                  <input
                    id="sms-consent"
                    type="checkbox"
                    checked={smsConsentGranted}
                    onChange={(event) => setSmsConsentGranted(event.target.checked)}
                    required
                  />
                  <span className="auth-welcome__remember-copy">
                    <strong>SMS consent</strong>
                    <small>
                      I agree to receive SMS messages from The Tennis Plan. Msg &amp; data rates may apply. Reply STOP to opt out.
                    </small>
                  </span>
                </label>
              ) : null}

              <div className="auth-welcome__field">
                <label htmlFor="password">Password</label>
                <div className="auth-welcome__input-wrap auth-welcome__input-wrap--trailing">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isSignup ? "Create a password" : "Your password"}
                    required
                    autoComplete={isSignup ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    className="auth-welcome__input-action"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {!isSignup ? (
                <div className="auth-welcome__helper-row">
                  <Link to="/forgot-password">Forgot password?</Link>
                </div>
              ) : null}

              <button
                type="button"
                className="auth-welcome__remember"
                onClick={() => setRememberMe((current) => !current)}
                aria-pressed={rememberMe}
              >
                <span className={`auth-welcome__toggle ${rememberMe ? "is-on" : ""}`}>
                  <span />
                </span>
                <span className="auth-welcome__remember-copy">
                  <strong>Keep me signed in</strong>
                  <small>Stay logged in on this device for 30 days</small>
                </span>
              </button>

              {isSignup ? (
                <p className="auth-welcome__terms">
                  By creating an account, you agree to our{" "}
                  <a href="/terms/">Terms</a> and <a href="/privacy/">Privacy Policy</a>
                </p>
              ) : (
                <p className="auth-welcome__terms auth-welcome__terms--signin">
                  By continuing, you agree to The Tennis Plan&apos;s{" "}
                  <a href="/terms/">Terms of Service</a> and <a href="/privacy/">Privacy Policy</a>
                </p>
              )}

              <button type="submit" className="auth-welcome__submit" disabled={loading}>
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

            <div className="auth-welcome__mode-switch">
              {isSignup ? "Already have an account?" : "Don't have an account?"}
              <button type="button" onClick={handleModeToggle}>
                {isSignup ? "Sign in" : "Create one"}
              </button>
            </div>
          </div>
        </section>
      </div>
      </div>
      <LegalFooter />
    </div>
  );
};

export default LoginPage;
