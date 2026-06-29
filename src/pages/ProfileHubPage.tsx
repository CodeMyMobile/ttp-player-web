import { useSearchParams } from "react-router-dom";
import { Target, UserRound, Wallet } from "lucide-react";

import MainLayout from "../components/MainLayout";
import AccountTab from "../components/profile/AccountTab";
import MatchPlayTab from "../components/profile/MatchPlayTab";
import PurchasesTab from "../components/profile/PurchasesTab";

import "./PlayerSettingsPages.css";

// Permanent contract: these ?tab= values are encoded into Share/QR links in a
// later PR and must never be renamed. account | matchplay | purchases.
const TABS = [
  { key: "account", label: "Account", icon: UserRound },
  { key: "matchplay", label: "Match play", icon: Target },
  { key: "purchases", label: "Purchases", icon: Wallet },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const isTabKey = (value: string | null): value is TabKey =>
  value === "account" || value === "matchplay" || value === "purchases";

const ProfileHubPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const activeTab: TabKey = isTabKey(requested) ? requested : "account";

  const selectTab = (key: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    setSearchParams(next, { replace: true });
  };

  return (
    <MainLayout mobileChrome="home" desktopChrome="home" showDesktopNav={true}>
      <div className="settings-page">
        <div className="settings-page__inner">
          <nav className="profile-hub__tabs" role="tablist" aria-label="Profile sections">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const selected = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`profile-tab-${tab.key}`}
                  aria-selected={selected}
                  aria-controls={`profile-panel-${tab.key}`}
                  className={`profile-hub__tab${selected ? " profile-hub__tab--active" : ""}`}
                  onClick={() => selectTab(tab.key)}
                >
                  <Icon size={16} aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div
            role="tabpanel"
            id={`profile-panel-${activeTab}`}
            aria-labelledby={`profile-tab-${activeTab}`}
          >
            {activeTab === "account" ? <AccountTab /> : null}
            {activeTab === "matchplay" ? <MatchPlayTab /> : null}
            {activeTab === "purchases" ? <PurchasesTab /> : null}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProfileHubPage;
