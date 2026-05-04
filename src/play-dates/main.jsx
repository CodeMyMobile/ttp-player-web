import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import { QueryClientProvider, createQueryClient } from "@tanstack/react-query";
import InvitationPage from "./InvitationPage.jsx";
import MatchPage from "./pages/MatchPage.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import CreateMatchPage from "./pages/CreateMatchPage.jsx";
import TennisMatchApp from "./TennisMatchApp.jsx"; // keep your existing home/app
import MatchSuccessPreview from "./pages/MatchSuccessPreview.jsx";
import CourtFinder from "./pages/CourtFinder.jsx";

const routes = [
  // App home
  { path: "/", element: <TennisMatchApp /> },
  { path: "/invites", element: <TennisMatchApp /> },
  { path: "/matches/:id/invite", element: <TennisMatchApp /> },
  { path: "/players", element: <TennisMatchApp /> },
  { path: "/groups", element: <TennisMatchApp /> },
  { path: "/groups/:id", element: <TennisMatchApp /> },
  { path: "/create", element: <CreateMatchPage /> },
  { path: "/courts", element: <CourtFinder /> },

  // Match details (direct link)
  { path: "/matches/:id", element: <MatchPage /> },

  // Private invite OTP flow
  { path: "/invites/:token", element: <InvitationPage /> },
  // Backward-compatible aliases
  { path: "/i/:token", element: <InvitationPage /> },
  { path: "/m/:token", element: <InvitationPage /> },

  // Password reset
  { path: "/reset-password/:token", element: <ResetPassword /> },

  // Fallback: redirect unknown routes to home
  { path: "*", element: <Navigate to="/" replace /> },
];

if (import.meta.env.DEV) {
  routes.push({
    path: "/__preview/match-success",
    element: <MatchSuccessPreview />,
  });
}

const router = createHashRouter(routes);

const queryClient = createQueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
