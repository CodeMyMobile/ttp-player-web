import MainLayout from "../components/MainLayout";
import MatchPlayTab from "../components/profile/MatchPlayTab";

import "./PlayerSettingsPages.css";

// Thin wrapper kept for the legacy /match-profile route. The match-play content
// now lives in MatchPlayTab, which is also rendered inside the Profile hub
// (/settings/profile?tab=matchplay).
const PlayerMatchProfilePage = () => {
  return (
    <MainLayout>
      <div className="settings-page">
        <div className="settings-page__inner">
          <MatchPlayTab />
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerMatchProfilePage;
