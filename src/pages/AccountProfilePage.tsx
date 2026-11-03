import { useSearchParams } from "react-router-dom";

import MainLayout from "../components/MainLayout";
import ProfileManager from "../components/ProfileManager";
import AccountSignInSection from "../components/AccountSignInSection";
import PurchaseHistorySection from "../components/PurchaseHistorySection";
import BookedLessonsSection from "../components/BookedLessonsSection";
import PublicLinkSetting from "../components/profileShare/PublicLinkSetting";
import CircleTab from "../components/circle/CircleTab";

import "./PlayerSettingsPages.css";

type ProfileTab = "personal" | "circle" | "history";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "personal", label: "Account" },
  { key: "circle", label: "Circle" },
  { key: "history", label: "Purchases" },
];

const AccountProfilePage = () => {
  // "?tab=circle" opens the Circle tab, so Home and the weekly email can link straight to it.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ProfileTab = TABS.some((entry) => entry.key === searchParams.get("tab"))
    ? (searchParams.get("tab") as ProfileTab)
    : "personal";
  const setTab = (next: ProfileTab) =>
    setSearchParams(next === "personal" ? {} : { tab: next }, { replace: true });

  return (
    <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
      <div className="settings-page settings-page--profile">
        <div className="settings-page__inner">
          <header className="settings-hero">
            <span className="settings-hero__badge">Account settings</span>
            <h1 className="settings-hero__title">Player profile</h1>
            <p className="settings-hero__subtitle">Your account details, tennis circle and lesson purchases.</p>
          </header>

          <section className="settings-section">
            <div className="settings-tabs" role="tablist" aria-label="Profile sections">
              {TABS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  role="tab"
                  id={`tab-${entry.key}`}
                  aria-selected={tab === entry.key}
                  aria-controls={`panel-${entry.key}`}
                  className={`settings-tab${tab === entry.key ? " settings-tab--active" : ""}`}
                  onClick={() => setTab(entry.key)}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            {tab === "personal" ? (
              <div id="panel-personal" role="tabpanel" aria-labelledby="tab-personal" className="settings-panel">
                <ProfileManager variant="page" />
                <AccountSignInSection />
                <PublicLinkSetting />
                {/* TODO(delete-account): the "Delete account" danger zone attaches here once a
                    delete-account endpoint exists. No live control is rendered today because the
                    backend exposes none (reported as a Sahil gap) — deliberately no dead button. */}
              </div>
            ) : tab === "circle" ? (
              <div id="panel-circle" role="tabpanel" aria-labelledby="tab-circle" className="settings-panel">
                <CircleTab />
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
