import { Link } from "react-router-dom";
import {
  Award,
  CalendarCheck,
  Trophy,
  Wrench,
  ShieldCheck,
  Users,
  MapPin,
  UserPlus,
  Search,
  Play,
} from "lucide-react";

import "./LandingPage.css";

// Public, unauthenticated landing page — the front door for cold visitors.
// Truthful-UI: static marketing content only. The dynamic sections (coaches list,
// players-looking) have no reachable public data source today (see landing-page-findings.md),
// so they render honest static/invitation treatments — no fabricated coaches, players, or counts.

const signupState = { mode: "signup" as const };

// `to` links a card to its real public browse route (no account needed); cards without
// `to` are authenticated-only features described honestly.
const FEATURES = [
  {
    icon: Award,
    title: "Find certified coaches",
    body: "Browse coaches, see their formats and rates, and book a session that fits your game.",
    to: "/find-coaches",
  },
  {
    icon: Trophy,
    title: "Matches & flex leagues",
    body: "Find open matches, post your availability, and climb the ladder.",
    to: "/matches",
  },
  {
    icon: CalendarCheck,
    title: "Group lessons",
    body: "Join high-energy group liveball and clinics — browse upcoming sessions near a coach.",
    to: "/group-lessons",
  },
  {
    icon: Wrench,
    title: "Restring your racket",
    body: "Keep your gear match-ready with restringing right alongside your lessons and matches.",
    to: undefined as string | undefined,
  },
];

const STEPS = [
  {
    icon: UserPlus,
    title: "Create your account",
    body: "Set up your player profile in a couple of minutes — no commitment to get started.",
  },
  {
    icon: Search,
    title: "Find a coach or a match",
    body: "Book a certified coach, or post your availability to get matched with other players.",
  },
  {
    icon: Play,
    title: "Book, play, and track",
    body: "Manage lessons, packages, and league results — your whole tennis life in one app.",
  },
];

const LandingPage = () => {
  return (
    <div className="landing">
      {/* ---------- Nav ---------- */}
      <header className="landing-nav">
        <div className="landing-container landing-nav__inner">
          <Link to="/" className="landing-brand" aria-label="The Tennis Plan — home">
            The Tennis <span className="landing-brand__accent">Plan</span>
          </Link>
          <nav className="landing-nav__actions" aria-label="Primary">
            <Link to="/login" className="landing-link">
              Sign in
            </Link>
            <Link to="/login" state={signupState} className="landing-btn landing-btn--primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="landing-hero">
          <div className="landing-container landing-hero__inner">
            <p className="landing-eyebrow">Coaches · Players · Leagues</p>
            <h1 className="landing-hero__title">
              Find your tennis <span className="landing-hero__title-accent">community.</span>
            </h1>
            <p className="landing-hero__subtitle">
              The Tennis Plan brings certified coaches, players at your level, and flexible leagues
              together in one place — so you spend less time organizing and more time on court.
            </p>
            <div className="landing-hero__actions">
              <Link
                to="/login"
                state={signupState}
                className="landing-btn landing-btn--primary landing-btn--lg"
              >
                Create your account
              </Link>
              <Link to="/login" className="landing-btn landing-btn--ghost landing-btn--lg">
                I already play here
              </Link>
            </div>
            <p className="landing-hero__browse">
              or{" "}
              <Link to="/find-coaches" className="landing-hero__browse-link">
                browse coaches — no account needed
              </Link>
            </p>
            {/* Actionable quick-links — each routes to a real public page. */}
            <ul className="landing-hero__chips" aria-label="Quick links">
              <li>
                <Link to="/find-coaches" className="landing-chip landing-chip--link">
                  <Award className="landing-chip__icon" aria-hidden="true" /> Browse coaches
                </Link>
              </li>
              <li>
                <Link to="/find-players" className="landing-chip landing-chip--link">
                  <Users className="landing-chip__icon" aria-hidden="true" /> Find a partner
                </Link>
              </li>
              <li>
                <Link to="/matches" className="landing-chip landing-chip--link">
                  <Trophy className="landing-chip__icon" aria-hidden="true" /> Join a league
                </Link>
              </li>
            </ul>
          </div>
        </section>

        {/* ---------- Meet the coaches (honest static — no public coaches-list endpoint) ---------- */}
        <section className="landing-section" aria-labelledby="coaches-heading">
          <div className="landing-container">
            <div className="landing-section__head">
              <h2 id="coaches-heading" className="landing-section__title">
                Coaching from certified pros
              </h2>
              <p className="landing-section__lede">
                Work with coaches who fit your goals — private, semi-private, or group sessions,
                bookable and trackable from your account.
              </p>
            </div>
            <div className="landing-coach-grid">
              <article className="landing-value-card">
                <span className="landing-value-card__icon" aria-hidden="true">
                  <ShieldCheck />
                </span>
                <h3 className="landing-value-card__title">Certified &amp; vetted</h3>
                <p className="landing-value-card__body">
                  Coaches list their experience, formats, and rates so you can choose with
                  confidence.
                </p>
              </article>
              <article className="landing-value-card">
                <span className="landing-value-card__icon" aria-hidden="true">
                  <CalendarCheck />
                </span>
                <h3 className="landing-value-card__title">Flexible formats</h3>
                <p className="landing-value-card__body">
                  Private one-on-one, semi-private with a partner, or high-energy group liveball —
                  your choice.
                </p>
              </article>
              <article className="landing-value-card">
                <span className="landing-value-card__icon" aria-hidden="true">
                  <Award />
                </span>
                <h3 className="landing-value-card__title">Packages that pay off</h3>
                <p className="landing-value-card__body">
                  Buy a package once and redeem credits across sessions — every booking tracked for
                  you.
                </p>
              </article>
            </div>
            <div className="landing-section__cta landing-section__cta--row">
              <Link to="/find-coaches" className="landing-btn landing-btn--primary">
                Browse coaches
              </Link>
              <Link to="/group-lessons" className="landing-btn landing-btn--ghost">
                Browse group lessons
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- Players looking to play (gated — invitation tile only, no individuals) ---------- */}
        <section className="landing-section landing-section--tint" aria-labelledby="players-heading">
          <div className="landing-container">
            <div className="landing-section__head">
              <h2 id="players-heading" className="landing-section__title">
                Players looking to play
              </h2>
              <p className="landing-section__lede">
                Post when and where you want to play, and get matched with players at your level.
              </p>
            </div>
            <article className="landing-invite">
              <span className="landing-invite__icon" aria-hidden="true">
                <MapPin />
              </span>
              <div className="landing-invite__body">
                <h3 className="landing-invite__title">See who&apos;s looking — or post your own</h3>
                <p className="landing-invite__text">
                  Browse players looking for a match by level and area, or post your availability and
                  let The Tennis Plan match you. Signing up unlocks messaging and posting.
                </p>
              </div>
              <div className="landing-invite__actions">
                <Link to="/find-players" className="landing-btn landing-btn--primary">
                  See who&apos;s looking
                </Link>
                <Link to="/login" state={signupState} className="landing-btn landing-btn--ghost">
                  Post your availability
                </Link>
              </div>
            </article>
          </div>
        </section>

        {/* ---------- Feature grid ---------- */}
        <section className="landing-section" aria-labelledby="features-heading">
          <div className="landing-container">
            <div className="landing-section__head">
              <h2 id="features-heading" className="landing-section__title">
                Everything in one place
              </h2>
              <p className="landing-section__lede">
                From your first lesson to your next league match — one account covers it.
              </p>
            </div>
            <div className="landing-feature-grid">
              {FEATURES.map(({ icon: Icon, title, body, to }) => {
                const inner = (
                  <>
                    <span className="landing-feature__icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <h3 className="landing-feature__title">{title}</h3>
                    <p className="landing-feature__body">{body}</p>
                    {to ? <span className="landing-feature__more">Browse — no account needed →</span> : null}
                  </>
                );
                return to ? (
                  <Link key={title} to={to} className="landing-feature landing-feature--link">
                    {inner}
                  </Link>
                ) : (
                  <article key={title} className="landing-feature">
                    {inner}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="landing-section landing-section--tint" aria-labelledby="how-heading">
          <div className="landing-container">
            <div className="landing-section__head">
              <h2 id="how-heading" className="landing-section__title">
                How it works
              </h2>
            </div>
            <ol className="landing-steps">
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="landing-step">
                  <span className="landing-step__num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="landing-step__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <h3 className="landing-step__title">{title}</h3>
                  <p className="landing-step__body">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="landing-cta" aria-labelledby="cta-heading">
          <div className="landing-container landing-cta__inner">
            <h2 id="cta-heading" className="landing-cta__title">
              Ready to play?
            </h2>
            <p className="landing-cta__text">
              Create your account and get your whole tennis life organized in one app.
            </p>
            <div className="landing-cta__actions">
              <Link
                to="/login"
                state={signupState}
                className="landing-btn landing-btn--onDark landing-btn--lg"
              >
                Create your account
              </Link>
              <Link to="/login" className="landing-btn landing-btn--ghostOnDark landing-btn--lg">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer__inner">
          <span className="landing-brand landing-brand--footer">
            The Tennis <span className="landing-brand__accent">Plan</span>
          </span>
          <nav className="landing-footer__links" aria-label="Footer">
            <a className="landing-link" href="/privacy/">
              Privacy Policy
            </a>
            <a className="landing-link" href="/terms/">
              Terms of Service
            </a>
            <Link className="landing-link" to="/login">
              Sign in
            </Link>
          </nav>
          <p className="landing-footer__copy">© {"2026"} The Tennis Plan. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
