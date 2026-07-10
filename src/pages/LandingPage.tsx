import { Link } from "react-router-dom";
import {
  Award,
  CalendarCheck,
  Wrench,
  BarChart3,
  UserPlus,
  Search,
  ListChecks,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";

import heroImg from "../assets/landing/hero.jpg";
import heroNightImg from "../assets/landing/hero-night.jpg";
import heroClinicImg from "../assets/landing/hero-clinic.jpg";
import coachingImg from "../assets/landing/coaching.jpg";
import groupLessonsImg from "../assets/landing/group-lessons.jpg";
import playPartnersImg from "../assets/landing/play-partners.jpg";
import leaguesImg from "../assets/landing/match-nights.jpg";
import communityImg from "../assets/landing/community.jpg";
import ctaImg from "../assets/landing/cta-highfive.jpg";

import LandingShowcase from "./LandingShowcase";
import "./LandingPage.css";

// Public, unauthenticated landing page. Photography is load-bearing: the hero, community band,
// and CTA are text-over-image; the pillars pair each photo directly with the copy it illustrates.
// Stock photos are used ONLY for marketing sections — never for the real coaches/players data
// cards. Alt text describes the activity generically (no names, no member/coach claims).

const signupState = { mode: "signup" as const };

// Alternating image/text pillars — each pairs a photo with the copy it illustrates and links
// to a real public route. `reverse` toggles the image side, kept L→R→L→R across all rows.
type PillarData = {
  img: string;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  supporting?: string | null;
  verified?: boolean;
  to: string;
  linkLabel: string;
};

const COACHING: PillarData = {
  img: coachingImg,
  alt: "One player guiding another's forehand technique on a clay court.",
  eyebrow: "Coaching",
  title: "Learn from certified coaches",
  body: "Browse coaches by format and rate, book a session, and track every lesson from your account.",
  supporting: "Private · Semi-private · Group sessions",
  to: "/find-coaches",
  linkLabel: "Browse coaches",
};
const GROUP_LESSONS: PillarData = {
  img: groupLessonsImg,
  alt: "A group class warming up together on a tennis court.",
  eyebrow: "Group lessons",
  title: "Clinics, liveball, and group classes",
  body: "Group lessons, clinics, and liveball sessions — browse what's on by date, location, and level, and grab a spot in a couple of taps.",
  to: "/group-lessons",
  linkLabel: "Browse classes",
};
const PLAYERS: PillarData = {
  img: playPartnersImg,
  alt: "Two players greeting each other at the net before a match.",
  eyebrow: "Players",
  title: "Find your hitting partner",
  body: "Post when and where you want to play, set your level, and get matched with players looking for a game. Filter for players with a verified rating — identity and level confirmed through community reviews, so it's a fair match.",
  verified: true,
  to: "/find-players",
  linkLabel: "Find a partner",
};
const LEAGUES: PillarData = {
  img: leaguesImg,
  alt: "Two players in a doubles rally during a daytime match.",
  eyebrow: "Leagues",
  title: "Play flexible league matches",
  body: "Join flex leagues and schedule matches on your own time — then log results and climb the standings.",
  supporting: "Flexible scheduling · Live standings",
  to: "/matches",
  linkLabel: "Join a league",
};

const Pillar = ({ pillar, reverse }: { pillar: PillarData; reverse: boolean }) => (
  <article className={`landing-pillar${reverse ? " landing-pillar--reverse" : ""}`}>
    <div className="landing-pillar__media">
      <img src={pillar.img} alt={pillar.alt} loading="lazy" />
    </div>
    <div className="landing-pillar__body">
      <p className="landing-pillar__eyebrow">{pillar.eyebrow}</p>
      <h3 className="landing-pillar__title">{pillar.title}</h3>
      <p className="landing-pillar__text">{pillar.body}</p>
      {pillar.verified ? (
        <p className="landing-pillar__badge">
          <Check className="landing-pillar__badge-icon" aria-hidden="true" /> Verified rating ·
          community-reviewed
        </p>
      ) : null}
      {pillar.supporting ? <p className="landing-pillar__meta">{pillar.supporting}</p> : null}
      <Link to={pillar.to} className="landing-pillar__link">
        {pillar.linkLabel}
        <ArrowRight className="landing-pillar__link-icon" aria-hidden="true" />
      </Link>
    </div>
  </article>
);

// "Coaches you can trust" — green band matching the in-app banner. Copy stays literally true
// as the roster grows (invite-only, personally vetted).
const TrustBand = () => (
  <section className="landing-trust" aria-labelledby="trust-heading">
    <div className="landing-container landing-trust__inner">
      <span className="landing-trust__icon" aria-hidden="true">
        <ShieldCheck />
      </span>
      <h2 id="trust-heading" className="landing-trust__title">
        Coaches you can trust
      </h2>
      <p className="landing-trust__text">
        Not a self-serve platform. We personally invite every coach on The Tennis Plan.
      </p>
      <div className="landing-trust__markers">
        <span className="landing-trust__marker">
          <Check aria-hidden="true" /> Invite-only
        </span>
        <span className="landing-trust__marker">
          <Check aria-hidden="true" /> Personally vetted
        </span>
        <span className="landing-trust__marker">
          <Check aria-hidden="true" /> People we actually know
        </span>
      </div>
    </div>
  </section>
);

// "Everything in one place" — complements the pillars (no coaches/players/leagues duplication).
const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Group lessons",
    body: "Join high-energy group liveball and clinics near a coach.",
    to: "/group-lessons",
  },
  {
    icon: Award,
    title: "Lesson packages",
    body: "Buy credits once and redeem them across sessions — every booking tracked for you.",
    to: undefined as string | undefined,
  },
  {
    icon: Wrench,
    title: "Restring your racket",
    body: "Keep your gear match-ready right alongside your lessons and matches.",
    to: undefined as string | undefined,
  },
  {
    icon: BarChart3,
    title: "Results & standings",
    body: "Log your match results and follow how your league is shaping up.",
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
    icon: ListChecks,
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
        {/* ---------- Photographic hero ---------- */}
        <section className="landing-hero">
          <div className="landing-hero__slides" aria-hidden="true">
            <div
              className="landing-hero__slide landing-hero__slide--1"
              style={{ backgroundImage: `url(${heroImg})` }}
            />
            <div
              className="landing-hero__slide landing-hero__slide--2"
              style={{ backgroundImage: `url(${heroNightImg})` }}
            />
            <div
              className="landing-hero__slide landing-hero__slide--3"
              style={{ backgroundImage: `url(${heroClinicImg})` }}
            />
          </div>
          <div className="landing-hero__scrim" aria-hidden="true" />
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
              <Link to="/login" className="landing-btn landing-btn--glass landing-btn--lg">
                I already play here
              </Link>
            </div>
            <p className="landing-hero__browse">
              or{" "}
              <Link to="/find-coaches" className="landing-hero__browse-link">
                browse coaches — no account needed
              </Link>
            </p>
          </div>
        </section>

        {/* ---------- Coaching pillar ---------- */}
        <section className="landing-section" aria-labelledby="pillars-heading">
          <div className="landing-container">
            <h2 id="pillars-heading" className="visually-hidden">
              What you can do on The Tennis Plan
            </h2>
            <div className="landing-pillars">
              <Pillar pillar={COACHING} reverse={false} />
            </div>
          </div>
        </section>

        {/* ---------- Coaches you can trust ---------- */}
        <TrustBand />

        {/* ---------- Group lessons + Players + Leagues (alternating L→R→L→R) ---------- */}
        <section className="landing-section">
          <div className="landing-container">
            <div className="landing-pillars">
              <Pillar pillar={GROUP_LESSONS} reverse={true} />
              <Pillar pillar={PLAYERS} reverse={false} />
              <Pillar pillar={LEAGUES} reverse={true} />
            </div>
          </div>
        </section>

        {/* ---------- Everything in one place ---------- */}
        <section className="landing-section landing-section--tint" aria-labelledby="features-heading">
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

        {/* ---------- See it in action ---------- */}
        <LandingShowcase />

        {/* ---------- Community band (text over image) ---------- */}
        <section
          className="landing-community"
          aria-labelledby="community-heading"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(15,23,42,0.76) 0%, rgba(15,23,42,0.58) 50%, rgba(15,23,42,0.52) 100%)," +
              `url(${communityImg})`,
          }}
        >
          <div className="landing-container landing-community__inner">
            <h2 id="community-heading" className="landing-community__title">
              From first-timers to 4.5s
            </h2>
            <p className="landing-community__text">
              Whatever your level, there&apos;s a place for you here — a coach to learn from, a
              partner to hit with, and a league to play in. Tennis is better together.
            </p>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="landing-section" aria-labelledby="how-heading">
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

        {/* ---------- Final CTA (over photo) ---------- */}
        <section
          className="landing-cta landing-cta--photo"
          aria-labelledby="cta-heading"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,23,42,0.5), rgba(15,23,42,0.6))," + `url(${ctaImg})`,
          }}
        >
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
              <Link to="/login" className="landing-btn landing-btn--glass landing-btn--lg">
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
