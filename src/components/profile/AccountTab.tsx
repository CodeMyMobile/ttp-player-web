import ProfileManager from "../ProfileManager";

// Account tab content — the identity basics. Composed verbatim from the former
// AccountProfilePage: the existing ProfileManager (name, email, mobile, DOB,
// change-password, SMS consent) plus the legal links. Relocation only — no
// changes to the personal-info / auth UI itself (that lives in ProfileManager).
const AccountTab = () => {
  return (
    <>
      <header className="settings-hero">
        <span className="settings-hero__badge">Account settings</span>
        <h1 className="settings-hero__title">Account</h1>
        <p className="settings-hero__subtitle">
          Manage your personal information, player ratings, and the details that other players see when they check out your
          profile.
        </p>
      </header>

      <section className="settings-section">
        <ProfileManager variant="page" />

        <div className="settings-card">
          <h2 className="settings-card__title">Legal</h2>
          <p className="settings-card__subtitle">
            Review the policies that govern your use of The Tennis Plan.
          </p>
          <div className="settings-legal__links">
            {/* Full-page navigations to the statically served legal pages
                (outside the SPA), so use plain anchors rather than router links. */}
            <a className="settings-legal__link" href="/privacy/">
              Privacy Policy
            </a>
            <a className="settings-legal__link" href="/terms/">
              Terms of Service
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

export default AccountTab;
