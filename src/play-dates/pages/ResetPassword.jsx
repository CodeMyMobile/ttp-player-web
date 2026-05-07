import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resetPassword } from "../services/auth";
import Header from "../components/Header.jsx";

export default function ResetPassword() {
  const { token, email } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!password.trim()) {
      setError("Please enter your new password");
      return;
    }
    try {
      setLoading(true);
      await resetPassword({ token, email: decodeURIComponent(email), password });
      setSuccess(true);
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (err) {
      setError(err?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
      <p className="text-sm text-gray-600 mb-6 break-all">{decodeURIComponent(email)}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 font-bold text-gray-800"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Password updated! Redirecting…</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
      </main>
    </>
  );
}
