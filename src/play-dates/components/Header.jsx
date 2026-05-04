import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  clearStoredAuthToken,
  clearStoredRefreshToken,
} from "../services/authToken";

export default function Header() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Keep header in sync if other parts of the app update localStorage
  useEffect(() => {
    const onStorage = () => {
      try {
        const raw = localStorage.getItem("user");
        setUser(raw ? JSON.parse(raw) : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const initials = useMemo(() => {
    const name = (user?.name || "").trim();
    if (!name) return "";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }, [user]);

  const handleLogout = () => {
    clearStoredAuthToken();
    clearStoredRefreshToken();
    try {
      localStorage.removeItem("user");
    } catch {
      // ignore localStorage removal errors
    }
    setUser(null);
    navigate("/", { replace: true });
  };

  const goSignIn = () => {
    navigate("/", { replace: false });
  };

  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-lg bg-white/90">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 select-none">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-xl">🎾</span>
            </div>
            <h1 className="text-xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Matchplay
            </h1>
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                {initials}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-xl transition-all text-gray-800 font-bold border border-gray-200"
              >
                Log Out
              </button>
            </div>
          ) : (
            <button
              onClick={goSignIn}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:shadow-xl hover:scale-105 transition-all shadow-lg"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

