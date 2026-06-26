import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Sends the user to /find-coaches when they log out.
 *
 * Watches `isAuthenticated` and only fires on a true -> false transition, so it
 * never redirects on initial app load (where the value starts false) or while
 * the session is still being restored (`loading`).
 *
 * Call once inside the Router + AuthProvider tree.
 */
const useLogoutRedirect = (destination = "/find-coaches") => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const wasAuthenticatedRef = useRef(isAuthenticated);

  useEffect(() => {
    // Don't track or act until the initial session check has settled.
    if (loading) return;

    const wasAuthenticated = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = isAuthenticated;

    if (wasAuthenticated && !isAuthenticated) {
      navigate(destination);
    }
  }, [isAuthenticated, loading, navigate, destination]);
};

export default useLogoutRedirect;
