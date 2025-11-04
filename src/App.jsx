import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import FindCoaches from "./pages/FindCoaches";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LoginPage from "./pages/LoginPage";
import PlayerCoachListPage from "./pages/PlayerCoachListPage";
import CoachProfilePage from "./pages/CoachProfilePage";
import BookingConfirmationPage from "./pages/BookingConfirmationPage";
import PurchaseLessonPackagePage from "./pages/PurchaseLessonPackagePage";
import GroupLessonsPage from "./pages/GroupLessonsPage";
import GroupLessonDetailsPage from "./pages/GroupLessonDetailsPage";
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

const AppRoutes = () => (
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
          <PlayerCoachListPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/find-coaches"
      element={(
        <ProtectedRoute>
          <FindCoaches />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/coaches/:id"
      element={(
        <ProtectedRoute>
          <CoachProfilePage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/coaches/:id/purchase"
      element={(
        <ProtectedRoute>
          <PurchaseLessonPackagePage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/group-lessons"
      element={(
        <ProtectedRoute>
          <GroupLessonsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/group-lessons/:id"
      element={(
        <ProtectedRoute>
          <GroupLessonDetailsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/booking/confirm"
      element={(
        <ProtectedRoute>
          <BookingConfirmationPage />
        </ProtectedRoute>
      )}
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="app-shell">
          <AppRoutes />
        </div>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
