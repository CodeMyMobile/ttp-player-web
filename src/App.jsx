import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import PlayDatesMatchesApp from "./play-dates/TennisMatchApp";
import PlayDatesInvitationPage from "./play-dates/InvitationPage";
import PlayDatesMatchPage from "./play-dates/pages/MatchPage";
import PlayDatesResetPasswordPage from "./play-dates/pages/ResetPassword";
import PlayDatesCreateMatchPage from "./play-dates/pages/CreateMatchPage";
import PlayDatesCourtFinderPage from "./play-dates/pages/CourtFinder";
import PlayDatesMatchSuccessPreview from "./play-dates/pages/MatchSuccessPreview";
import {
  QueryClientProvider as PlayDatesQueryClientProvider,
  createQueryClient as createPlayDatesQueryClient,
} from "./play-dates/utils/react-query-shim";
import AppNav from "./components/AppNav";
import CreateMatchPage from "./pages/CreateMatchPage";
import CreateMatchSettingsPage from "./pages/CreateMatchSettingsPage";
import CreateMatchReviewPage from "./pages/CreateMatchReviewPage";
import CreateMatchPublishConfirmationPage from "./pages/CreateMatchPublishConfirmationPage";
import CreatePrivateMatchInvitePage from "./pages/CreatePrivateMatchInvitePage";
import FindCoaches from "./pages/FindCoaches";
import CoachMatchRecommendationsPage from "./pages/CoachMatchRecommendationsPage";
import FindPlayersPage from "./pages/FindPlayersPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LoginPage from "./pages/LoginPage";
import OAuthPhoneCapture, { shouldCaptureProfilePhone } from "./components/OAuthPhoneCapture";
import LessonInvitePage from "./pages/LessonInvitePage";
import PlayerCoachListPage from "./pages/PlayerCoachListPage";
import CoachProfilePage from "./pages/CoachProfilePage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import AccountProfilePage from "./pages/AccountProfilePage";
import PlayerMatchProfilePage from "./pages/PlayerMatchProfilePage";
import PlayerMatchProfileEditPage from "./pages/PlayerMatchProfileEditPage";
import PaymentMethodsPage from "./pages/PaymentMethodsPage";
import BlockedUsersPage from "./pages/BlockedUsersPage";
import BookingConfirmationPage from "./pages/BookingConfirmationPage";
import PurchaseLessonPackagePage from "./pages/PurchaseLessonPackagePage";
import GroupLessonsPage from "./pages/GroupLessonsPage";
import GroupLessonDetailsPage from "./pages/GroupLessonDetailsPage";
import PlayerLessonDetailsPage from "./pages/PlayerLessonDetailsPage";
import MyCoachesPage from "./pages/MyCoachesPage";
import CreditsPage from "./pages/CreditsPage";
import NotificationsPage from "./pages/NotificationsPage";
import PlayerCalendar from "./screens/Player/PlayerCalendar";
import LogResultPage from "./pages/log-result";
import MobileHomeBottomNav from "./components/MobileHomeBottomNav";
import { resolveShareHostId } from "./play-dates/utils/multiMatchCreate";
import { isLogResultEnabled } from "./play-dates/utils/featureFlags";
import { getScrollResetKey } from "./utils/routerScroll";
import "./App.css";

const playDatesQueryClient = createPlayDatesQueryClient();

const readStoredObject = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const hasOwnValue = (record, key) =>
  record && Object.prototype.hasOwnProperty.call(record, key);

const pickFirstProfilePhone = (profile, loginResponse, legacyUser) => {
  if (
    hasOwnValue(profile, "phone") ||
    hasOwnValue(profile, "mobile") ||
    hasOwnValue(profile, "phone_number")
  ) {
    return profile?.phone ?? profile?.mobile ?? profile?.phone_number ?? "";
  }

  return (
    loginResponse?.phone ||
    loginResponse?.mobile ||
    loginResponse?.phone_number ||
    legacyUser?.phone ||
    ""
  );
};

const buildPhoneCaptureSession = (authUser) => {
  const personalDetails = readStoredObject("playerPersonalDetails");
  const loginResponse = readStoredObject("authLoginResponse");
  const legacyUser = readStoredObject("user");
  const profile = authUser || loginResponse?.profile || loginResponse?.user || personalDetails || legacyUser || {};

  return {
    ...loginResponse,
    ...profile,
    profile,
    user_id:
      profile?.id ??
      profile?.player_id ??
      loginResponse?.user_id ??
      loginResponse?.player_id ??
      loginResponse?.id ??
      legacyUser?.id ??
      null,
    email: profile?.email || loginResponse?.email || legacyUser?.email || "",
    phone: pickFirstProfilePhone(profile, loginResponse, legacyUser),
    full_name:
      profile?.full_name ||
      profile?.fullName ||
      profile?.name ||
      loginResponse?.full_name ||
      legacyUser?.name ||
      "",
  };
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, establishSession, user } = useAuth();
  const location = useLocation();
  const [phoneCaptureSession, setPhoneCaptureSession] = useState(() => buildPhoneCaptureSession(user));

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setPhoneCaptureSession(buildPhoneCaptureSession(user));
    }
  }, [isAuthenticated, loading, user]);

  if (loading) {
    return <div className="loading-screen">Loading your dashboard…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (shouldCaptureProfilePhone(phoneCaptureSession)) {
    return (
      <OAuthPhoneCapture
        session={phoneCaptureSession}
        provider={
          localStorage.getItem("oauthPhoneCaptureProvider") ||
          phoneCaptureSession?.oauth_provider ||
          phoneCaptureSession?.provider ||
          "profile"
        }
        onComplete={(nextSession) => {
          establishSession?.(nextSession);
          setPhoneCaptureSession(nextSession);
        }}
      />
    );
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
    const from = location.state?.from;
    const to = from
      ? {
          pathname: from.pathname || "/",
          search: from.search || "",
          hash: from.hash || "",
        }
      : "/";
    return <Navigate to={to} replace state={from?.state} />;
  }

  return children;
};

const buildMatchesUser = (authUser) => {
  const personalDetails = readStoredObject("playerPersonalDetails");
  const loginResponse = readStoredObject("authLoginResponse");
  const profile = authUser || personalDetails || loginResponse?.profile || loginResponse?.user || {};
  const playerId = resolveShareHostId({
    ...loginResponse,
    ...profile,
    profile: profile?.profile || loginResponse?.profile || profile,
    user: loginResponse?.user,
  });

  return {
    ...profile,
    id: playerId,
    user_id: playerId ?? profile?.user_id ?? loginResponse?.user_id ?? null,
    type: profile?.user_type ?? loginResponse?.user_type ?? 2,
    name:
      profile?.name ||
      profile?.full_name ||
      profile?.fullName ||
      loginResponse?.full_name ||
      profile?.email ||
      "Player",
    email: profile?.email || loginResponse?.email || "",
    phone: profile?.phone || profile?.mobile || loginResponse?.phone || "",
    skillLevel:
      profile?.skillLevel ||
      profile?.skill_level ||
      profile?.usta_rating ||
      loginResponse?.skillLevel ||
      "",
    profile,
  };
};

const PlayDatesAppRoute = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const matchesUser = useMemo(() => buildMatchesUser(user), [user]);
  const shouldOpenCreateOnReady = Boolean(location.state?.openNewMatch);
  const [playDatesScreen, setPlayDatesScreen] = useState("browse");
  const isCreatingMatch = playDatesScreen === "create";

  useEffect(() => {
    try {
      localStorage.setItem("user", JSON.stringify(matchesUser));
    } catch {
      // ignore storage errors
    }
  }, [matchesUser]);

  const openNewMatch = useCallback(() => {
    window.dispatchEvent(new CustomEvent("play-dates:new-match"));
  }, []);

  return (
    <ProtectedRoute>
      <div className={`dashboard-page${isCreatingMatch ? " dashboard-page--playdates-create" : ""}`}>
        <AppNav
          onNewMatch={openNewMatch}
          hideMobileNewMatch
          hideMobileNotifications
        />
        <main className="main-layout__content">
          <PlayDatesQueryClientProvider client={playDatesQueryClient}>
            <PlayDatesMatchesApp
              externalUser={matchesUser}
              onExternalLogout={logout}
              hideAppHeader
              openCreateOnReady={shouldOpenCreateOnReady}
              onCreateReadyHandled={() => navigate("/matches", { replace: true })}
              onScreenChange={setPlayDatesScreen}
            />
          </PlayDatesQueryClientProvider>
        </main>
        {!isCreatingMatch ? <MobileHomeBottomNav /> : null}
      </div>
    </ProtectedRoute>
  );
};

const PlayDatesProtectedPageRoute = ({ children, pageClassName = "" }) => (
  <ProtectedRoute>
    <div className={`dashboard-page${pageClassName ? ` ${pageClassName}` : ""}`}>
      <AppNav />
      <main className="main-layout__content">
        <PlayDatesQueryClientProvider client={playDatesQueryClient}>
          {children}
        </PlayDatesQueryClientProvider>
      </main>
    </div>
  </ProtectedRoute>
);

const PlayDatesPublicPageRoute = ({ children }) => (
  <PlayDatesQueryClientProvider client={playDatesQueryClient}>
    {children}
  </PlayDatesQueryClientProvider>
);

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
      path="/li/:token"
      element={<LessonInvitePage />}
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
      path="/matches"
      element={<PlayDatesAppRoute />}
    />
    <Route
      path="/matches/:id/invite"
      element={<PlayDatesAppRoute />}
    />
    <Route
      path="/matches/create"
      element={(
        <ProtectedRoute>
          <CreateMatchPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/matches/create/settings"
      element={(
        <ProtectedRoute>
          <CreateMatchSettingsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/matches/create/private/invite"
      element={(
        <ProtectedRoute>
          <CreatePrivateMatchInvitePage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/matches/create/review"
      element={(
        <ProtectedRoute>
          <CreateMatchReviewPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/matches/create/published"
      element={(
        <ProtectedRoute>
          <CreateMatchPublishConfirmationPage />
        </ProtectedRoute>
      )}
    />
    {/* Stub-driven "Log a result" flow. Gated on VITE_LOG_RESULT (off by default) so
        the fixture page never reaches real users — enable it only in deploy previews. */}
    {isLogResultEnabled() ? (
      <Route
        path="/log-result"
        element={(
          <ProtectedRoute>
            <LogResultPage />
          </ProtectedRoute>
        )}
      />
    ) : null}
    <Route
      path="/matches/:id"
      element={(
        <PlayDatesPublicPageRoute>
          <PlayDatesMatchPage />
        </PlayDatesPublicPageRoute>
      )}
    />
    <Route
      path="/create"
      element={(
        <PlayDatesProtectedPageRoute pageClassName="dashboard-page--playdates-create">
          <PlayDatesCreateMatchPage />
        </PlayDatesProtectedPageRoute>
      )}
    />
    <Route
      path="/courts"
      element={(
        <PlayDatesProtectedPageRoute>
          <PlayDatesCourtFinderPage />
        </PlayDatesProtectedPageRoute>
      )}
    />
    <Route
      path="/invites"
      element={<PlayDatesAppRoute />}
    />
    <Route
      path="/players"
      element={<PlayDatesAppRoute />}
    />
    <Route
      path="/groups"
      element={<PlayDatesAppRoute />}
    />
    <Route
      path="/groups/:id"
      element={<PlayDatesAppRoute />}
    />
    <Route
      path="/invites/:token"
      element={(
        <PlayDatesPublicPageRoute>
          <PlayDatesInvitationPage />
        </PlayDatesPublicPageRoute>
      )}
    />
    <Route
      path="/i/:token"
      element={(
        <PlayDatesPublicPageRoute>
          <PlayDatesInvitationPage />
        </PlayDatesPublicPageRoute>
      )}
    />
    <Route
      path="/m/:token"
      element={(
        <PlayDatesPublicPageRoute>
          <PlayDatesInvitationPage />
        </PlayDatesPublicPageRoute>
      )}
    />
    <Route
      path="/reset-password/:token"
      element={(
        <PlayDatesPublicPageRoute>
          <PlayDatesResetPasswordPage />
        </PlayDatesPublicPageRoute>
      )}
    />
    {import.meta.env.DEV ? (
      <Route
        path="/__preview/match-success"
        element={(
          <PlayDatesPublicPageRoute>
            <PlayDatesMatchSuccessPreview />
          </PlayDatesPublicPageRoute>
        )}
      />
    ) : null}
    <Route
      path="/coaches"
      element={(
        <ProtectedRoute>
          <PlayerCoachListPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/my-coaches"
      element={(
        <ProtectedRoute>
          <MyCoachesPage />
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
      path="/coach-match/recommendations"
      element={(
        <ProtectedRoute>
          <CoachMatchRecommendationsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/credits"
      element={(
        <ProtectedRoute>
          <CreditsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/notifications"
      element={(
        <ProtectedRoute>
          <NotificationsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/find-players"
      element={(
        <ProtectedRoute>
          <FindPlayersPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/players/:id"
      element={(
        <ProtectedRoute>
          <PlayerProfilePage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/coaches/:id"
      element={<CoachProfilePage />}
    />
    <Route
      path="/coaches/:id/purchase"
      element={<PurchaseLessonPackagePage />}
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
      path="/lessons/external/:externalLessonId"
      element={(
        <ProtectedRoute>
          <GroupLessonsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/player/externallesson/:externallessonid"
      element={(
        <ProtectedRoute>
          <GroupLessonsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/player/lesson/:id"
      element={(
        <ProtectedRoute>
          <PlayerLessonDetailsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/player/calendar"
      element={(
        <ProtectedRoute>
          <PlayerCalendar />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/settings/profile"
      element={(
        <ProtectedRoute>
          <AccountProfilePage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/settings/match-profile"
      element={(
        <ProtectedRoute>
          <PlayerMatchProfilePage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/settings/match-profile/edit"
      element={(
        <ProtectedRoute>
          <PlayerMatchProfileEditPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/match-profile"
      element={(
        <ProtectedRoute>
          <PlayerMatchProfilePage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/match-profile/edit"
      element={(
        <ProtectedRoute>
          <PlayerMatchProfileEditPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/settings/payment-methods"
      element={(
        <ProtectedRoute>
          <PaymentMethodsPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/settings/blocked-users"
      element={(
        <ProtectedRoute>
          <BlockedUsersPage />
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

const ScrollToTop = () => {
  const location = useLocation();
  const scrollResetKey = getScrollResetKey(location);
  const previousScrollResetKey = useRef(scrollResetKey);

  useEffect(() => {
    if (previousScrollResetKey.current === scrollResetKey) return;
    previousScrollResetKey.current = scrollResetKey;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [scrollResetKey]);

  return null;
};

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <ScrollToTop />
        <div className="app-shell">
          <AppRoutes />
        </div>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
