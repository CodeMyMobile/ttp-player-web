import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import FindCoachesPage from "./pages/FindCoachesPage";
import CoachDetailPage from "./pages/CoachDetailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LoginPage from "./pages/LoginPage";
import "./App.css";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading-screen">Loading your dashboard…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

const AuthRedirectRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading-screen">Preparing the experience…</div>;
  }

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  return children;
};

const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/" && location.hash) {
      const normalizedHash = location.hash.replace(/^#/, "");

      if (normalizedHash === "coaches" || normalizedHash === "/coaches") {
        navigate("/coaches", { replace: true });
      }
    }
  }, [location, navigate]);

  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <AuthRedirectRoute>
            <LoginPage />
          </AuthRedirectRoute>
        )}
      />
      <Route
        path="/forgot-password"
        element={(
          <AuthRedirectRoute>
            <ForgotPasswordPage />
          </AuthRedirectRoute>
        )}
      />
      <Route
        path="/"
        element={(
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/coaches"
        element={(
          <ProtectedRoute>
            <FindCoachesPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/coaches/:coachId"
        element={(
          <ProtectedRoute>
            <CoachDetailPage />
          </ProtectedRoute>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/ttp-player-web">
        <div className="app-shell">
          <AppRoutes />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
