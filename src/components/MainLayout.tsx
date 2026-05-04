import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import AppNav from "./AppNav";
import "../pages/DashboardPage.css";

interface MainLayoutProps {
  children: ReactNode;
  mobileChrome?: "default" | "home";
  desktopChrome?: "default" | "home";
  showDesktopNav?: boolean;
}

const homeMobileNavItems = [
  { icon: "🏠", label: "Home", to: "/" },
  { icon: "🏆", label: "Post Match", to: "/matches/create" },
  { icon: "🔔", label: "Alerts", to: "/notifications" },
  { icon: "👤", label: "Profile", to: "/settings/profile" },
];

const MainLayout = ({
  children,
  mobileChrome = "default",
  showDesktopNav = true,
}: MainLayoutProps) => {
  const location = useLocation();
  const isHomeMobileChrome = mobileChrome === "home";

  return (
    <div className={`dashboard-page${isHomeMobileChrome ? " dashboard-page--home-mobile" : ""}`}>
      {showDesktopNav ? <AppNav /> : null}
      <main className="main-layout__content">{children}</main>

      {isHomeMobileChrome ? (
        <nav className="ph-bottom-nav" aria-label="Mobile navigation">
          {homeMobileNavItems.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === item.to
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

            return (
              <NavLink key={item.label} className={isActive ? "active" : ""} to={item.to}>
                <span className="ph-bottom-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
};

export default MainLayout;
