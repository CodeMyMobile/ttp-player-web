import { Bell, Home, Plus, Trophy, UserRound } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "../pages/DashboardPage.css";

type MobileHomeBottomNavProps = {
  onPostMatch?: (() => void) | null;
  onPrimaryAction?: (() => void) | null;
};

const MobileHomeBottomNav = ({
  onPostMatch = null,
  onPrimaryAction = null,
}: MobileHomeBottomNavProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isRouteActive = (target: string) => (
    target === "/"
      ? location.pathname === "/"
      : location.pathname === target || location.pathname.startsWith(`${target}/`)
  );

  const items = [
    { icon: Home, label: "Home", to: "/" },
    { icon: Trophy, label: "Post Match", to: "/matches/create", onClick: onPostMatch },
    { icon: Plus, label: "New", to: "/matches/create", isPrimaryAction: true, onClick: onPrimaryAction },
    { icon: Bell, label: "Alerts", to: "/notifications" },
    { icon: UserRound, label: "Profile", to: "/settings/profile" },
  ];

  return (
    <nav className="ph-bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const className = `ph-bottom-nav-link${isRouteActive(item.to) ? " active" : ""}${item.isPrimaryAction ? " ph-bottom-nav-link--primary" : ""}`;

        if (item.onClick) {
          return (
            <button
              key={item.label}
              type="button"
              className={className}
              aria-label={item.label}
              onClick={item.onClick}
            >
              <span className="ph-bottom-nav-icon">
                <item.icon size={item.isPrimaryAction ? 34 : 24} />
              </span>
              <span className="ph-bottom-nav-label">{item.label}</span>
            </button>
          );
        }

        return (
          <NavLink
            key={item.label}
            className={className}
            to={item.isPrimaryAction ? "/matches" : item.to}
            aria-label={item.label}
            onClick={(event) => {
              if (item.isPrimaryAction) {
                event.preventDefault();
                navigate("/matches", { state: { openNewMatch: true } });
                return;
              }

              if (!isRouteActive(item.to)) return;
              event.preventDefault();
              navigate(item.to, { replace: true });
            }}
          >
            <span className="ph-bottom-nav-icon">
              <item.icon size={item.isPrimaryAction ? 34 : 24} />
            </span>
            <span className="ph-bottom-nav-label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default MobileHomeBottomNav;
