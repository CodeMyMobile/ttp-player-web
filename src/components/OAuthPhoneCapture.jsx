import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { createPlayerPersonalDetails, updatePlayerPersonalDetails } from "../services/player";
import { formatPhoneNumber, getPhoneDigits } from "../services/phone";
import { SMS_CONSENT_DISCLOSURE, buildSmsConsentPayload } from "../constants/smsConsent";

const extractProfile = (session) =>
  session?.profile || session?.user || session?.player || session?.personal_details || {};

const pickFirstString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const splitName = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  return {
    first: parts[0],
    last: parts.slice(1).join(" "),
  };
};

export const resolveSessionPlayerId = (session) => {
  const profile = extractProfile(session);
  return (
    profile?.id ??
    profile?.player_id ??
    session?.user_id ??
    session?.player_id ??
    session?.id ??
    null
  );
};

export const resolveSessionPhone = (session) => {
  const profile = extractProfile(session);
  return pickFirstString(
    profile?.phone,
    profile?.mobile,
    profile?.phone_number,
    session?.phone,
    session?.mobile,
    session?.phone_number,
  );
};

export const resolveSessionEmail = (session) => {
  const profile = extractProfile(session);
  return pickFirstString(profile?.email, session?.email);
};

export const resolveSessionName = (session) => {
  const profile = extractProfile(session);
  const name = pickFirstString(
    profile?.full_name,
    profile?.fullName,
    profile?.name,
    session?.full_name,
    session?.fullName,
    session?.name,
  );

  return {
    fullName: name,
    firstName: pickFirstString(profile?.first_name, session?.first_name, splitName(name).first),
    lastName: pickFirstString(profile?.last_name, session?.last_name, splitName(name).last),
  };
};

export const shouldCaptureMissingPhone = (session) => {
  if (!session) return false;
  if (resolveSessionPhone(session)) return false;
  return Boolean(resolveSessionPlayerId(session) || session?.access_token || session?.token || localStorage.getItem("authToken"));
};

export const shouldCaptureOAuthPhone = (session) => {
  if (!shouldCaptureMissingPhone(session)) return false;
  const explicitNewUser = [
    session?.is_new_user,
    session?.new_user,
    session?.newUser,
    session?.created,
    session?.signup,
  ].some(Boolean);
  const oauthSession = Boolean(session?.oauth_provider || session?.provider);
  const pendingOAuth = localStorage.getItem("oauthPhoneCapturePending") === "true";
  return explicitNewUser || pendingOAuth || oauthSession;
};

export const shouldCaptureProfilePhone = shouldCaptureMissingPhone;

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

const providerLabel = (provider) => {
  if (provider === "apple") return "Apple";
  if (provider === "google") return "Google";
  return "your account";
};

const OAuthPhoneCapture = ({ session, provider = "google", onBack, onComplete }) => {
  const email = resolveSessionEmail(session);
  const name = useMemo(() => resolveSessionName(session), [session]);
  const [firstName, setFirstName] = useState(name.firstName);
  const [lastName, setLastName] = useState(name.lastName);
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const digits = getPhoneDigits(phone);
    if (digits.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }

      const playerId = resolveSessionPlayerId(session);

    const fullName = `${firstName} ${lastName}`.trim() || name.fullName || null;

    setSaving(true);
    try {
      const savePersonalDetails = playerId ? updatePlayerPersonalDetails : createPlayerPersonalDetails;
      const updatedProfile = await savePersonalDetails({
        player: session?.access_token || session?.token || localStorage.getItem("authToken"),
        ...(playerId ? { id: playerId } : {}),
        fullName,
        mobile: digits,
        smsConsent: buildSmsConsentPayload(),
      });
      const nextSession = {
        ...session,
        phone: digits,
        full_name: fullName || session?.full_name,
        profile: {
          ...extractProfile(session),
          ...(updatedProfile && typeof updatedProfile === "object" ? updatedProfile : {}),
          ...(playerId ? { id: playerId } : {}),
          phone: digits,
          full_name: fullName || extractProfile(session)?.full_name,
        },
      };
      localStorage.setItem("authLoginResponse", JSON.stringify(nextSession));
      localStorage.setItem("playerPersonalDetails", JSON.stringify(nextSession.profile));
      localStorage.removeItem("oauthPhoneCapturePending");
      localStorage.removeItem("oauthPhoneCaptureProvider");
      onComplete?.(nextSession);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to save your phone number.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="oauth-complete">
      <div className="oauth-complete__phone">
        <div className="oauth-complete__screen">
          {onBack ? (
            <button type="button" className="auth-mobile__back oauth-complete__back" onClick={onBack}>
              <ArrowRight size={18} className="auth-mobile__back-icon" />
              <span>Back</span>
            </button>
          ) : null}

          <div className="auth-mobile__eyebrow oauth-complete__brand">
            <div className="auth-mobile__eyebrow-tile">
              <span aria-hidden="true" />
            </div>
            <span>
              The Tennis <span>Plan</span>
            </span>
          </div>

          <div className="oauth-complete__provider">
            <div className="oauth-complete__provider-icon">
              {provider === "google" ? <GoogleMark /> : provider === "apple" ? "A" : "T"}
            </div>
            <div>
              <span>{provider === "google" || provider === "apple" ? "Signed up with" : "Signed in as"} {providerLabel(provider)}</span>
              <strong>{email || "your account"}</strong>
            </div>
          </div>

          <div className="auth-welcome__header auth-welcome__header--mobile oauth-complete__header">
            <h1>Almost there</h1>
            <p>Confirm your details so coaches can text booking reminders.</p>
          </div>

          {error ? <div className="auth-welcome__error">{error}</div> : null}

          <form className="auth-welcome__form oauth-complete__form" onSubmit={handleSubmit}>
            <div className="auth-mobile__row">
              <div className="auth-welcome__field">
                <label htmlFor="oauth-first-name">First name</label>
                <input
                  id="oauth-first-name"
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Paul"
                  autoComplete="given-name"
                />
              </div>
              <div className="auth-welcome__field">
                <label htmlFor="oauth-last-name">Last name</label>
                <input
                  id="oauth-last-name"
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Cochrane"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="auth-welcome__field">
              <label htmlFor="oauth-phone">Phone</label>
              <input
                id="oauth-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(formatPhoneNumber(event.target.value))}
                placeholder="(310) 555-0123"
                autoComplete="tel"
                required
              />
            </div>

            <div className="oauth-complete__footer">
              <label className="auth-welcome__consent">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(event) => setSmsConsent(event.target.checked)}
                />
                <span>{SMS_CONSENT_DISCLOSURE}</span>
              </label>
              <p className="auth-welcome__terms">
                By continuing, you agree to our <a href="/terms">Terms</a> and{" "}
                <a href="/privacy">Privacy Policy</a>
              </p>
              <button
                type="submit"
                className="auth-welcome__submit"
                disabled={saving || !smsConsent || !phone.trim()}
              >
                <span>{saving ? "Saving..." : "Finish setup"}</span>
                {!saving ? <ArrowRight size={16} /> : null}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OAuthPhoneCapture;
