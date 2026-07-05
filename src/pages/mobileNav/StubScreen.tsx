import type { LucideIcon } from "lucide-react";

import MainLayout from "../../components/MainLayout";

// Shared layout for the mobile-nav stub screens. Each screen is a simple titled
// empty state, wrapped in mobileChrome="home" so the global bottom nav shows.
const StubScreen = ({ icon: Icon, title }: { icon: LucideIcon; title: string }) => (
  <MainLayout mobileChrome="home" hideMobileNewMatch>
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "48px 24px 120px",
        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: 20,
          background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
          color: "#fff",
        }}
      >
        <Icon size={30} />
      </span>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#101828" }}>{title}</h1>
      <p style={{ margin: 0, fontSize: 14, color: "#667085" }}>Coming soon</p>
    </div>
  </MainLayout>
);

export default StubScreen;
