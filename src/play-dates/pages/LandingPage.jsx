import React, { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { formatPhoneNumber } from "../services/phone";

const skillLevels = [
  { value: "beginner", label: "Beginner (1.0 - 2.5)" },
  { value: "intermediate", label: "Intermediate (3.0 - 3.5)" },
  { value: "advanced", label: "Advanced (4.0 - 4.5)" },
  { value: "expert", label: "Expert (5.0+)" },
];

const emailPattern = /[^@\s]+@[^@\s]+\.[^@\s]+/;

const LandingPage = ({
  onSignup,
  onLogin,
  onForgotPassword,
}) => {
  const [activeTab, setActiveTab] = useState("signup");
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    skillLevel: "",
  });
  const [signinForm, setSigninForm] = useState({
    email: "",
    password: "",
  });
  const [signupErrors, setSignupErrors] = useState({});
  const [signinErrors, setSigninErrors] = useState({});
  const [signupMessage, setSignupMessage] = useState("");
  const [signinMessage, setSigninMessage] = useState("");
  const [forgotMessage, setForgotMessage] = useState(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signinLoading, setSigninLoading] = useState(false);

  const formSectionRef = useRef(null);

  const valueProps = useMemo(
    () => [
      { icon: "⚡", label: "Quick Match Setup" },
      { icon: "🎯", label: "Smart Player Matching" },
      { icon: "📅", label: "Easy Scheduling" },
    ],
    [],
  );

  const stats = useMemo(
    () => [
      { value: "500+", label: "Active Players" },
      { value: "1,200+", label: "Matches Played" },
      { value: "50+", label: "Courts Available" },
    ],
    [],
  );

  const features = useMemo(
    () => [
      {
        icon: "📅",
        title: "Organize Matches in Seconds",
        description:
          "Set match details, send invites, and manage RSVPs from one dashboard.",
      },
      {
        icon: "🔍",
        title: "Find Players Instantly",
        description:
          "Browse nearby players by skill level and availability to fill open spots fast.",
      },
      {
        icon: "🎯",
        title: "Match Your Skill Level",
        description:
          "Filter by rating to guarantee competitive, enjoyable matches every time.",
      },
    ],
    [],
  );

  const scrollToForm = () => {
    if (formSectionRef.current) {
      formSectionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const validateSignup = () => {
    const errors = {};
    if (!signupForm.name.trim()) {
      errors.name = "Please enter your full name";
    }
    if (!signupForm.email.trim()) {
      errors.email = "Please enter your email";
    } else if (!emailPattern.test(signupForm.email)) {
      errors.email = "Please enter a valid email";
    }
    const digits = signupForm.phone.replace(/\D/g, "");
    if (!digits) {
      errors.phone = "Please add your cell phone";
    } else if (digits.length < 10) {
      errors.phone = "Enter a 10 digit phone number";
    }
    if (!signupForm.password.trim()) {
      errors.password = "Create a password to continue";
    } else if (signupForm.password.trim().length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    if (!signupForm.skillLevel) {
      errors.skillLevel = "Select your skill level";
    }
    return errors;
  };

  const validateSignin = () => {
    const errors = {};
    if (!signinForm.email.trim()) {
      errors.email = "Please enter your email";
    } else if (!emailPattern.test(signinForm.email)) {
      errors.email = "Please enter a valid email";
    }
    if (!signinForm.password.trim()) {
      errors.password = "Enter your password";
    }
    return errors;
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    setSignupMessage("");
    const errors = validateSignup();
    setSignupErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    if (!onSignup) return;

    setSignupLoading(true);
    try {
      await onSignup({ ...signupForm });
      setSignupErrors({});
      setSignupMessage("");
    } catch (error) {
      const fieldErrors = error?.fieldErrors ?? {};
      const message = error?.message || "We couldn't create your account. Try again.";
      setSignupErrors((prev) => ({ ...prev, ...fieldErrors }));
      setSignupMessage(message);
      return;
    } finally {
      setSignupLoading(false);
    }
    setSignupForm({ name: "", email: "", phone: "", password: "", skillLevel: "" });
  };

  const handleSigninSubmit = async (event) => {
    event.preventDefault();
    setSigninMessage("");
    const errors = validateSignin();
    setSigninErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    if (!onLogin) return;

    setSigninLoading(true);
    try {
      await onLogin({ ...signinForm });
      setSigninForm({ email: "", password: "" });
      setSigninErrors({});
      setSigninMessage("");
      setForgotMessage(null);
    } catch (error) {
      const message = error?.message || "We couldn't sign you in. Try again.";
      setSigninMessage(message);
      return;
    } finally {
      setSigninLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotMessage(null);
    const errors = validateSignin();
    if (errors.email) {
      setSigninErrors((prev) => ({ ...prev, email: errors.email }));
      setSigninMessage("Add your account email so we can help reset the password.");
      return;
    }
    if (!onForgotPassword) return;

    try {
      await onForgotPassword(signinForm.email.trim());
      setForgotMessage({ type: "success", text: "If the email exists, a reset link is on the way." });
      setSigninMessage("");
    } catch (error) {
      setForgotMessage({
        type: "error",
        text: error?.message || "We couldn't send a reset link. Try again soon.",
      });
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-100/40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(16, 185, 129, 0.08) 1px, transparent 1px), linear-gradient(rgba(16, 185, 129, 0.08) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <a href="#" className="flex items-center gap-3 text-gray-900" aria-label="Matchplay home">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-400 text-2xl shadow-lg">
              🎾
            </span>
            <span className="text-2xl font-black tracking-tight">Matchplay</span>
          </a>
          <button
            type="button"
            onClick={() => {
              setActiveTab("signup");
              scrollToForm();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl"
          >
            Sign Up Free
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-24">
          <section className="text-center">
            <div className="mx-auto max-w-3xl space-y-6 py-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-1 text-sm font-semibold text-emerald-600 shadow-sm">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Trusted by local tennis communities
              </div>
              <h1 className="text-4xl font-black tracking-tight text-gray-900 sm:text-6xl">
                Find Your Next Match
              </h1>
              <p className="text-lg font-medium text-gray-600 sm:text-xl">
                The easiest way to organize tennis matches and connect with local players.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {valueProps.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-2xl bg-white/80 px-5 py-3 text-base font-semibold text-gray-700 shadow-md"
                  >
                    <span className="text-2xl" aria-hidden>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 px-8 py-4 text-lg font-bold text-white shadow-xl transition-transform hover:-translate-y-1 hover:shadow-2xl"
                >
                  Create Free Account
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>
          </section>

          <section ref={formSectionRef} className="mx-auto max-w-3xl">
            <div className="rounded-3xl border border-emerald-100 bg-white/95 p-8 shadow-2xl shadow-emerald-100/60">
              <div className="mb-6 text-center space-y-2">
                <h2 className="text-3xl font-black text-gray-900">Join Matchplay Today</h2>
                <p className="text-sm font-medium text-gray-500">
                  Stop the endless back-and-forth texts. Create or join matches in seconds.
                </p>
              </div>
              <div className="mb-8 grid grid-cols-2 gap-3 rounded-2xl bg-gray-100 p-1" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "signup"}
                  aria-controls="landing-signup-panel"
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    activeTab === "signup"
                      ? "bg-white text-emerald-600 shadow"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => {
                    setActiveTab("signup");
                    setSigninMessage("");
                    setForgotMessage(null);
                  }}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "signin"}
                  aria-controls="landing-signin-panel"
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    activeTab === "signin"
                      ? "bg-white text-emerald-600 shadow"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => {
                    setActiveTab("signin");
                    setSignupMessage("");
                  }}
                >
                  Sign In
                </button>
              </div>

              {activeTab === "signup" ? (
                <form id="landing-signup-panel" onSubmit={handleSignupSubmit} className="space-y-5" aria-labelledby="Sign Up">
                  {signupMessage && (
                    <div
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                      role="alert"
                    >
                      {signupMessage}
                    </div>
                  )}
                  <div>
                    <label htmlFor="landing-signup-name" className="mb-2 block text-sm font-semibold text-gray-700">
                      Full Name
                    </label>
                    <input
                      id="landing-signup-name"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      value={signupForm.name}
                      onChange={(event) =>
                        setSignupForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      className={`w-full rounded-xl border-2 px-4 py-3 text-base font-medium text-gray-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                        signupErrors.name ? "border-red-300" : "border-gray-200 bg-gray-50"
                      }`}
                      placeholder="John Doe"
                    />
                    {signupErrors.name && (
                      <p className="mt-2 text-sm font-medium text-red-600">{signupErrors.name}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="landing-signup-email" className="mb-2 block text-sm font-semibold text-gray-700">
                      Email Address
                    </label>
                    <input
                      id="landing-signup-email"
                      type="email"
                      autoComplete="email"
                      value={signupForm.email}
                      onChange={(event) =>
                        setSignupForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      className={`w-full rounded-xl border-2 px-4 py-3 text-base font-medium text-gray-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                        signupErrors.email ? "border-red-300" : "border-gray-200 bg-gray-50"
                      }`}
                      placeholder="your.email@example.com"
                    />
                    {signupErrors.email && (
                      <p className="mt-2 text-sm font-medium text-red-600">{signupErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="landing-signup-phone" className="mb-2 block text-sm font-semibold text-gray-700">
                      Cell Phone
                    </label>
                    <input
                      id="landing-signup-phone"
                      type="tel"
                      autoComplete="tel"
                      value={signupForm.phone}
                      onChange={(event) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          phone: formatPhoneNumber(event.target.value),
                        }))
                      }
                      className={`w-full rounded-xl border-2 px-4 py-3 text-base font-medium text-gray-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                        signupErrors.phone ? "border-red-300" : "border-gray-200 bg-gray-50"
                      }`}
                      placeholder="(555) 123-4567"
                      inputMode="tel"
                    />
                    {signupErrors.phone ? (
                      <p className="mt-2 text-sm font-medium text-red-600">{signupErrors.phone}</p>
                    ) : (
                      <p className="mt-2 text-xs font-medium text-gray-500">
                        We send match reminders and updates by text.
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="landing-signup-password" className="mb-2 block text-sm font-semibold text-gray-700">
                      Password
                    </label>
                    <input
                      id="landing-signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={signupForm.password}
                      onChange={(event) =>
                        setSignupForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      className={`w-full rounded-xl border-2 px-4 py-3 text-base font-medium text-gray-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                        signupErrors.password ? "border-red-300" : "border-gray-200 bg-gray-50"
                      }`}
                      placeholder="Create a password (8+ characters)"
                    />
                    {signupErrors.password && (
                      <p className="mt-2 text-sm font-medium text-red-600">{signupErrors.password}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="landing-signup-skill" className="mb-2 block text-sm font-semibold text-gray-700">
                      Skill Level
                    </label>
                    <select
                      id="landing-signup-skill"
                      value={signupForm.skillLevel}
                      onChange={(event) =>
                        setSignupForm((prev) => ({ ...prev, skillLevel: event.target.value }))
                      }
                      className={`w-full rounded-xl border-2 px-4 py-3 text-base font-medium text-gray-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                        signupErrors.skillLevel ? "border-red-300" : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <option value="">Select your skill level</option>
                      {skillLevels.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                    {signupErrors.skillLevel && (
                      <p className="mt-2 text-sm font-medium text-red-600">{signupErrors.skillLevel}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={signupLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 px-6 py-3 text-lg font-bold text-white shadow-xl transition-transform hover:-translate-y-0.5 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {signupLoading ? "Creating account..." : "Create Free Account"}
                    {!signupLoading && <Check className="h-5 w-5" aria-hidden />}
                  </button>
                  <p className="text-center text-xs font-medium text-gray-400">
                    By joining Matchplay you agree to our Terms of Service and Privacy Policy.
                  </p>
                </form>
              ) : (
                <form id="landing-signin-panel" onSubmit={handleSigninSubmit} className="space-y-5" aria-labelledby="Sign In">
                  {signinMessage && (
                    <div
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                      role="alert"
                    >
                      {signinMessage}
                    </div>
                  )}
                  {forgotMessage && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                        forgotMessage.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                      role="status"
                    >
                      {forgotMessage.text}
                    </div>
                  )}
                  <div>
                    <label htmlFor="landing-signin-email" className="mb-2 block text-sm font-semibold text-gray-700">
                      Email Address
                    </label>
                    <input
                      id="landing-signin-email"
                      type="email"
                      autoComplete="email"
                      value={signinForm.email}
                      onChange={(event) =>
                        setSigninForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      className={`w-full rounded-xl border-2 px-4 py-3 text-base font-medium text-gray-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                        signinErrors.email ? "border-red-300" : "border-gray-200 bg-gray-50"
                      }`}
                      placeholder="your.email@example.com"
                    />
                    {signinErrors.email && (
                      <p className="mt-2 text-sm font-medium text-red-600">{signinErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="landing-signin-password" className="mb-2 block text-sm font-semibold text-gray-700">
                      Password
                    </label>
                    <input
                      id="landing-signin-password"
                      type="password"
                      autoComplete="current-password"
                      value={signinForm.password}
                      onChange={(event) =>
                        setSigninForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      className={`w-full rounded-xl border-2 px-4 py-3 text-base font-medium text-gray-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                        signinErrors.password ? "border-red-300" : "border-gray-200 bg-gray-50"
                      }`}
                      placeholder="Enter your password"
                    />
                    {signinErrors.password && (
                      <p className="mt-2 text-sm font-medium text-red-600">{signinErrors.password}</p>
                    )}
                    <div className="mt-3 text-right">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-sm font-semibold text-emerald-600 underline-offset-4 transition-colors hover:text-emerald-700"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={signinLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 px-6 py-3 text-lg font-bold text-white shadow-xl transition-transform hover:-translate-y-0.5 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {signinLoading ? "Signing you in..." : "Sign In"}
                  </button>
                </form>
              )}
            </div>
          </section>

          <section className="mt-16">
            <div className="mx-auto flex flex-wrap items-center justify-center gap-8 rounded-3xl border border-emerald-100 bg-white/90 px-8 py-10 shadow-lg">
              {stats.map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-4xl font-black text-emerald-500 sm:text-5xl">{item.value}</div>
                  <p className="mt-1 text-sm font-semibold text-gray-600">{item.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="flex h-full flex-col gap-4 rounded-3xl border border-emerald-100 bg-white/95 p-6 text-center shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900">{feature.title}</h3>
                <p className="text-sm font-medium text-gray-600">{feature.description}</p>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
};

export default LandingPage;
