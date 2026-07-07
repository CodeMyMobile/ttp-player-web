import { useMemo } from "react";
import { Link } from "react-router-dom";
import { KeyRound, ShieldCheck } from "lucide-react";

// Known SSO providers we can link out to. Detection is best-effort from the persisted
// login response (authLoginResponse) — reliable for Apple, best-effort for Google.
const PROVIDERS: Record<string, { label: string; manageUrl: string }> = {
  google: { label: "Google", manageUrl: "https://myaccount.google.com/security" },
  apple: { label: "Apple", manageUrl: "https://appleid.apple.com/account/manage" },
};

const readJson = (key: string): Record<string, unknown> => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const AccountSignInSection = () => {
  const { provider, email } = useMemo(() => {
    const login = readJson("authLoginResponse");
    const details = readJson("playerPersonalDetails");
    const user = (login.user as Record<string, unknown>) ?? {};
    const rawProvider = String(
      login.oauth_provider ?? login.provider ?? user.oauth_provider ?? user.provider ?? "",
    ).toLowerCase();
    return {
      provider: rawProvider in PROVIDERS ? rawProvider : "",
      email: String(details.email ?? user.email ?? login.email ?? "").trim(),
    };
  }, []);

  const providerInfo = provider ? PROVIDERS[provider] : null;

  return (
    <div className="settings-card">
      <h2 className="settings-card__title">Sign-in</h2>
      <p className="settings-card__subtitle">How you sign in to The Tennis Plan.</p>

      <div className="signin-row">
        <div className="signin-row__info">
          <span className="signin-row__icon" aria-hidden="true">
            <ShieldCheck />
          </span>
          <div>
            <p className="signin-row__method">
              {providerInfo ? `Signed in with ${providerInfo.label}` : "Signed in with email & password"}
            </p>
            {email ? <p className="signin-row__email">{email}</p> : null}
          </div>
        </div>

        {providerInfo ? (
          <a
            className="signin-row__action"
            href={providerInfo.manageUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Manage on {providerInfo.label}
          </a>
        ) : (
          <Link className="signin-row__action" to="/forgot-password">
            <KeyRound aria-hidden="true" />
            Change password
          </Link>
        )}
      </div>
    </div>
  );
};

export default AccountSignInSection;
