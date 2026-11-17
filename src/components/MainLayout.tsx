import type { ReactNode } from "react";
import AppNav from "./AppNav";
import MobileHomeBottomNav from "./MobileHomeBottomNav";
import PlaySectionTabs from "./PlaySectionTabs";
import { isPlaySectionsEnabled } from "../utils/playSections";

interface MainLayoutProps {
  children: ReactNode;
  mobileChrome?: "default" | "home" | "immersive";
  desktopChrome?: "default" | "home";
  showDesktopNav?: boolean;
  hideMobileNewMatch?: boolean;
  hideMobileNotifications?: boolean;
  onMobileBack?: () => void;
  hideMobileLocation?: boolean;
  pageClassName?: string;
  mobileCenter?: ReactNode;
  /**
   * The Play switcher (Matches · Lessons · Leagues · Players) as the first thing in the content,
   * so it sits in the same place on every section rather than inside each page's own padding.
   */
  playSections?: boolean;
}

const MainLayout = ({
  children,
  mobileChrome = "default",
  showDesktopNav = true,
  hideMobileNewMatch = false,
  hideMobileNotifications = false,
  onMobileBack,
  hideMobileLocation = false,
  pageClassName = "",
  mobileCenter,
  playSections = false,
}: MainLayoutProps) => {
  const isHomeMobileChrome = mobileChrome === "home";
  const isImmersiveMobileChrome = mobileChrome === "immersive";
  const showPlaySections = playSections && isPlaySectionsEnabled();

  return (
    <div
      className={`dashboard-page${isHomeMobileChrome ? " dashboard-page--home-mobile" : ""}${isImmersiveMobileChrome ? " dashboard-page--immersive-mobile" : ""}${showPlaySections ? " dashboard-page--play-sections" : ""}${pageClassName ? ` ${pageClassName}` : ""}`}
    >
      {showDesktopNav ? (
        <AppNav
          hideMobileNewMatch={isHomeMobileChrome || hideMobileNewMatch}
          hideMobileNotifications={isHomeMobileChrome || hideMobileNotifications}
          showBack={Boolean(onMobileBack)}
          onBack={onMobileBack}
          hideLocation={hideMobileLocation}
          mobileCenter={mobileCenter}
        />
      ) : null}
      <main className="main-layout__content">
        {showPlaySections ? <PlaySectionTabs /> : null}
        {children}
      </main>

      {isHomeMobileChrome ? <MobileHomeBottomNav /> : null}
    </div>
  );
};

export default MainLayout;
