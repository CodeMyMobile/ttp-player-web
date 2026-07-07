import { useState } from "react";

import MainLayout from "../components/MainLayout";
import ProfileManager from "../components/ProfileManager";
import AccountSignInSection from "../components/AccountSignInSection";
import PurchaseHistorySection from "../components/PurchaseHistorySection";
import BookedLessonsSection from "../components/BookedLessonsSection";

import "./PlayerSettingsPages.css";

type ProfileTab = "personal" | "history";

const AccountProfilePage = () => {
  const [tab, setTab] = useState<ProfileTab>("personal");

  return (
    <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
      <div className="settings-page settings-page--profile">
        <div className="settings-page__inner">
          <header className="settings-hero">
            <span className="settings-hero__badge">Account settings</span>
            <h1 className="settings-hero__title">Player profile</h1>
            <p className="settings-hero__subtitle">Your account details and lesson purchases.</p>
          </header>

          <section className="settings-section">
            <div className="settings-tabs" role="tablist" aria-label="Profile sections">
              <button
                type="button"
                role="tab"
                id="tab-personal"
                aria-selected={tab === "personal"}
                aria-controls="panel-personal"
                className={`settings-tab${tab === "personal" ? " settings-tab--active" : ""}`}
                onClick={() => setTab("personal")}
              >
                Personal info
              </button>
              <button
                type="button"
                role="tab"
                id="tab-history"
                aria-selected={tab === "history"}
                aria-controls="panel-history"
                className={`settings-tab${tab === "history" ? " settings-tab--active" : ""}`}
                onClick={() => setTab("history")}
              >
                Purchase history
              </button>
            </div>

            {tab === "personal" ? (
              <div id="panel-personal" role="tabpanel" aria-labelledby="tab-personal" className="settings-panel">
                <ProfileManager variant="page" />
                <AccountSignInSection />
                {/* TODO(delete-account): the "Delete account" danger zone attaches here once a
                    delete-account endpoint exists. No live control is rendered today because the
                    backend exposes none (reported as a Sahil gap) — deliberately no dead button. */}
              </div>
            ) : (
              <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" className="settings-panel">
                <PurchaseHistorySection />
                <BookedLessonsSection />
              </div>
            )}

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
        </div>
      </div>
    </MainLayout>
  );
};

export default AccountProfilePage;
