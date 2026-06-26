import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const AuthDrawerContext = createContext(null);

/**
 * Provides global control of the contextual auth bottom-drawer.
 *
 * Mount once near the app root (inside AuthProvider + Router). Render the
 * <AuthDrawer /> component as a sibling so it can read this context.
 *
 * Any component can then call:
 *   const { openAuthDrawer } = useAuthDrawer();
 *   openAuthDrawer({ mode: "signin", onSuccess: () => doTheThing(), ... });
 */
export const AuthDrawerProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState({ mode: "signin" });
  // Stored in a ref so re-renders don't drop the pending trigger action.
  const pendingActionRef = useRef(null);

  const openAuthDrawer = useCallback((options = {}) => {
    const { mode = "signin", onSuccess, title, subtitle } = options;
    pendingActionRef.current = typeof onSuccess === "function" ? onSuccess : null;
    setConfig({ mode: mode === "signup" ? "signup" : "signin", title, subtitle });
    setIsOpen(true);
  }, []);

  const closeAuthDrawer = useCallback(() => {
    setIsOpen(false);
    pendingActionRef.current = null;
  }, []);

  // Called by AuthDrawer after a successful sign-in/sign-up. Runs the original
  // trigger action, then closes the drawer.
  const completeAuth = useCallback((session) => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsOpen(false);
    if (action) {
      try {
        action(session);
      } catch (err) {
        // A failing follow-up action shouldn't surface as an auth error.
        if (import.meta.env.DEV) console.error("AuthDrawer onSuccess failed", err);
      }
    }
  }, []);

  const value = useMemo(
    () => ({ isOpen, config, openAuthDrawer, closeAuthDrawer, completeAuth }),
    [isOpen, config, openAuthDrawer, closeAuthDrawer, completeAuth],
  );

  return createElement(AuthDrawerContext.Provider, { value }, children);
};

export const useAuthDrawer = () => {
  const context = useContext(AuthDrawerContext);
  if (!context) {
    throw new Error("useAuthDrawer must be used within an AuthDrawerProvider");
  }
  return context;
};
