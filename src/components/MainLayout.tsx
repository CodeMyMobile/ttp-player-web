import type { ReactNode } from "react";
import AppNav from "./AppNav";
import MobileHomeBottomNav from "./MobileHomeBottomNav";

interface MainLayoutProps {
  children: ReactNode;
  mobileChrome?: "default" | "home";
  desktopChrome?: "default" | "home";
  showDesktopNav?: boolean;
}

const MainLayout = ({
  children,
  mobileChrome = "default",
  showDesktopNav = true,
}: MainLayoutProps) => {
  const isHomeMobileChrome = mobileChrome === "home";

  return (
    <div className={`dashboard-page${isHomeMobileChrome ? " dashboard-page--home-mobile" : ""}`}>
      {showDesktopNav ? (
        <AppNav
          hideMobileNewMatch={isHomeMobileChrome}
          hideMobileNotifications={isHomeMobileChrome}
        />
      ) : null}
      <main className="main-layout__content">{children}</main>

      {isHomeMobileChrome ? <MobileHomeBottomNav /> : null}
    </div>
  );
};

export default MainLayout;
