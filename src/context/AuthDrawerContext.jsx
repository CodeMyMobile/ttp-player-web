import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import AuthDrawer from "../components/auth/AuthDrawer";

// Shared app-wide trigger for the reusable AuthDrawer (sheet on mobile / modal on desktop).
// This does NOT authenticate — it controls whether the drawer is open and with what intent.
// Mount <AuthDrawerProvider> once (inside the Router + AuthProvider); it renders a single
// AuthDrawer instance, so any component can summon auth from anywhere via useAuthDrawer().
//
// openAuth({ mode, reason, onSuccess, onDismiss }):
//   mode      — "signup" | "signin" (which view opens; user can toggle inside)
//   reason    — optional context line ("Create an account to message this coach")
//   onSuccess — optional callback run after successful auth, so an in-context trigger
//               (Connect / Book a lesson / Join a league) can resume what the user was doing.
//   onDismiss — optional callback run when the drawer is closed without authenticating
//               (lets callers clear pending state they set before opening).

const AuthDrawerContext = createContext(null);

const CLOSED = { isOpen: false, mode: "signin", reason: null, onSuccess: null, onDismiss: null };

export const AuthDrawerProvider = ({ children }) => {
  const [state, setState] = useState(CLOSED);
  // AuthDrawer calls onAuthenticated THEN onClose on success. This flag lets the close
  // handler tell a success-close from a user-dismiss, so onDismiss (caller cleanup) runs
  // only on a genuine dismiss — never after a successful auth whose resume logic still
  // depends on the pending state the cleanup would clear.
  const successRef = useRef(false);

  const openAuth = useCallback((options = {}) => {
    successRef.current = false;
    setState({
      isOpen: true,
      mode: options.mode === "signup" ? "signup" : "signin",
      reason: options.reason ?? null,
      onSuccess: typeof options.onSuccess === "function" ? options.onSuccess : null,
      onDismiss: typeof options.onDismiss === "function" ? options.onDismiss : null,
    });
  }, []);

  const closeAuth = useCallback(() => {
    setState((current) => ({ ...current, isOpen: false }));
  }, []);

  const handleAuthenticated = useCallback(() => {
    successRef.current = true;
    setState((current) => {
      current.onSuccess?.();
      return current;
    });
  }, []);

  const handleClose = useCallback(() => {
    const wasSuccess = successRef.current;
    successRef.current = false;
    setState((current) => {
      if (!wasSuccess) current.onDismiss?.();
      return { ...current, isOpen: false };
    });
  }, []);

  const value = useMemo(() => ({ ...state, openAuth, closeAuth }), [state, openAuth, closeAuth]);

  return (
    <AuthDrawerContext.Provider value={value}>
      {children}
      <AuthDrawer
        open={state.isOpen}
        initialMode={state.mode}
        subtitle={state.reason || undefined}
        onAuthenticated={handleAuthenticated}
        onClose={handleClose}
      />
    </AuthDrawerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthDrawer = () => {
  const context = useContext(AuthDrawerContext);
  if (!context) {
    throw new Error("useAuthDrawer must be used within an AuthDrawerProvider");
  }
  return context;
};
