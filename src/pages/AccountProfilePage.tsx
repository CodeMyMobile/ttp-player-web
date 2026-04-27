import MainLayout from "../components/MainLayout";
import ProfileManager from "../components/ProfileManager";

import "./PlayerSettingsPages.css";

const AccountProfilePage = () => {
  return (
    <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
      <div className="settings-page">
        <div className="settings-page__inner">
          <header className="settings-hero">
            <span className="settings-hero__badge">Account settings</span>
            <h1 className="settings-hero__title">Player profile</h1>
            <p className="settings-hero__subtitle">
              Manage your personal information, player ratings, and the details that other players see when they check out your
              profile.
            </p>
          </header>

          <section className="settings-section">
            <ProfileManager variant="page" />
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default AccountProfilePage;
