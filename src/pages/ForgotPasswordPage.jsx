import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ForgotPasswordPage = () => {
  const { forgotPassword, lastEmail } = useAuth();
  const [email, setEmail] = useState(lastEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSuccess("Password reset instructions have been sent by email or text message if we have a phone number on file.");
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Unable to process the request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div>
          <h1>Forgot password</h1>
          <p>Enter the email address associated with your account and we will send a reset link by email or text message when possible.</p>
        </div>
        {error ? <div className="error-message">{error}</div> : null}
        {success ? <div className="success-message">{success}</div> : null}
        <form onSubmit={handleSubmit}>
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
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Sending reset link…" : "Send reset link"}
          </button>
        </form>
        <Link className="secondary-link" to="/login">
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
