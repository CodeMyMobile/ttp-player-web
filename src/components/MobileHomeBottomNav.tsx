import { Bell, Home, UserRound, Users } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "../pages/DashboardPage.css";

const MobileHomeBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isRouteActive = (target: string) => (
    target === "/"
      ? location.pathname === "/"
      : location.pathname === target || location.pathname.startsWith(`${target}/`)
  );

  const items = [
    { icon: Home, label: "Home", to: "/" },
    { icon: Users, label: "My Coaches", to: "/my-coaches" },
    { icon: Bell, label: "Alerts", to: "/notifications" },
    { icon: UserRound, label: "Profile", to: "/settings/profile" },
  ];

  return (
    <nav className="ph-bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const className = `ph-bottom-nav-link${isRouteActive(item.to) ? " active" : ""}`;

        return (
          <NavLink
            key={item.label}
            className={className}
            to={item.to}
            aria-label={item.label}
            onClick={(event) => {
              if (!isRouteActive(item.to)) return;
              event.preventDefault();
              navigate(item.to, { replace: true });
            }}
          >
            <span className="ph-bottom-nav-icon">
              <item.icon size={24} />
            </span>
            <span className="ph-bottom-nav-label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default MobileHomeBottomNav;
