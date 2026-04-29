import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signup as signupService } from "../services/auth";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, lastEmail, establishSession } = useAuth();
  const [mode, setMode] = useState(location.state?.mode === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(lastEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigateAfterAuth = () => {
    const from = location.state?.from;
    if (from) {
      navigate(
        {
          pathname: from.pathname || "/",
          search: from.search || "",
          hash: from.hash || "",
        },
        { replace: true, state: from.state },
      );
      return;
    }
    navigate("/", { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const response = await signupService({ email, password, name });
        establishSession?.(response);
      } else {
        await login(email, password);
      }
      navigateAfterAuth();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || `Unable to ${mode === "signup" ? "sign up" : "login"}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div>
          <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          <p>
            {mode === "signup"
              ? "Sign up to book lessons, buy packages, and manage your tennis plan."
              : "Sign in to track your matches, lessons, and player activity."}
          </p>
        </div>
        {error ? <div className="error-message">{error}</div> : null}
        <form onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <div className="form-group">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                required
                autoComplete="name"
              />
            </div>
          ) : null}
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? (mode === "signup" ? "Creating account…" : "Signing in…") : mode === "signup" ? "Create account" : "Sign In"}
          </button>
        </form>
        <button
          type="button"
          className="secondary-link"
          onClick={() => {
            setError("");
            setMode((current) => (current === "signup" ? "signin" : "signup"));
          }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create a free account"}
        </button>
        <Link className="secondary-link" to="/forgot-password">
          Forgot your password?
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
