import type { ReactNode } from "react";
import AppNav from "./AppNav";
import MobileHomeBottomNav from "./MobileHomeBottomNav";

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
}: MainLayoutProps) => {
  const isHomeMobileChrome = mobileChrome === "home";
  const isImmersiveMobileChrome = mobileChrome === "immersive";

  return (
    <div
      className={`dashboard-page${isHomeMobileChrome ? " dashboard-page--home-mobile" : ""}${isImmersiveMobileChrome ? " dashboard-page--immersive-mobile" : ""}${pageClassName ? ` ${pageClassName}` : ""}`}
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
      <main className="main-layout__content">{children}</main>

      {isHomeMobileChrome ? <MobileHomeBottomNav /> : null}
    </div>
  );
};

export default MainLayout;
