import { ArrowUpRight, Brain, MoveRight, PlayCircle, Repeat, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import "./TrainingResourcesPage.css";

const playlists = [
  {
    id: "all",
    title: "Complete Training Library",
    description:
      "Browse the full collection of Matchplay drills, clinics, and match-breakdowns updated weekly for every skill level.",
    focus: "All skills",
    url: "https://youtube.com/playlist?list=PLKffdR1pHOgVEZMCGpHkrVF_b67YUZYmF&si=1Qq2aVIen7n5724W",
    icon: PlayCircle,
  },
  {
    id: "forehand",
    title: "Forehand Fundamentals",
    description:
      "Build repeatable, confident forehands with footwork patterns, timing checkpoints, and pro-inspired swing paths.",
    focus: "Groundstrokes",
    url: "https://youtube.com/playlist?list=PLKffdR1pHOgVEZMCGpHkrVF_b67YUZYmF&si=1Qq2aVIen7n5724W",
    icon: Target,
  },
  {
    id: "backhand",
    title: "Backhand Confidence",
    description:
      "Strengthen both topspin and slice backhands through progressive progressions and situational hitting routines.",
    focus: "Groundstrokes",
    url: "https://youtube.com/playlist?list=PLKffdR1pHOgVEZMCGpHkrVF_b67YUZYmF&si=1Qq2aVIen7n5724W",
    icon: Repeat,
  },
  {
    id: "transition",
    title: "Transition & Net Play",
    description:
      "Sharpen approach patterns, volleys, and finishing instincts so you can close points with confidence at the net.",
    focus: "Net game",
    url: "https://youtube.com/playlist?list=PLKffdR1pHOgVwaejfsQlLNGn6ZgmtPidG&si=lYDOS93QwmGz4T7f",
    icon: MoveRight,
  },
  {
    id: "serve",
    title: "Serve Blueprint",
    description:
      "Dial in consistent toss placement, spin variety, and power progressions to earn more free points on serve.",
    focus: "Serve",
    url: "https://youtube.com/playlist?list=PLKffdR1pHOgXwIW_2Bx4c2h7EQF0DemcA&si=Ybnp1L1KGu1HQjih",
    icon: Sparkles,
  },
  {
    id: "strategy",
    title: "Match Strategy Lab",
    description:
      "Learn how to build patterns, adapt game plans mid-match, and make smarter shot selections in pressure moments.",
    focus: "Tactics",
    url: "https://www.youtube.com/playlist?list=PLKffdR1pHOgVmroqI0kD7EnfuoGf-sddd",
    icon: Brain,
  },
];

const TrainingResourcesPage = () => {
  return (
    <MainLayout>
      <div className="training-page">
        <section className="training-page__hero">
          <div className="training-page__intro">
            <span className="training-page__eyebrow">Player development</span>
            <h1>Level up your Matchplay toolkit</h1>
            <p>
              Unlock curated playlists that target the exact skills you want to sharpen. Each collection blends
              pro-level insight with actionable drills so you can make every hitting session count.
            </p>
            <div className="training-page__cta-group">
            <a className="primary-link" href={playlists[0].url} target="_blank" rel="noreferrer">
              Start with the full library
              <ArrowUpRight aria-hidden="true" size={18} />
            </a>
              <a className="secondary-link" href="#playlists">
                Explore playlists
              </a>
            </div>
          </div>
          <div className="training-page__hero-card" aria-hidden="true">
            <div className="hero-card__badge">Consistent reps</div>
            <p className="hero-card__metric">30+ guided sessions</p>
            <span className="hero-card__caption">Updated monthly with new drills and match breakdowns.</span>
          </div>
        </section>

        <section id="playlists" className="training-page__section">
          <div className="section-heading">
            <h2>Curated playlists for faster progress</h2>
            <p>
              Mix and match focus areas based on your match goals. Every playlist includes clear progressions and
              checkpoints so you can measure your improvement.
            </p>
          </div>
          <div className="playlist-grid">
            {playlists.map(({ id, title, description, focus, url, icon: Icon }) => (
              <article key={id} className="playlist-card">
                <div className="playlist-card__icon">
                  <Icon aria-hidden="true" size={24} />
                </div>
                <div className="playlist-card__body">
                  <span className="playlist-card__focus">{focus}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <a className="playlist-card__link" href={url} target="_blank" rel="noreferrer">
                  Watch playlist
                  <ArrowUpRight aria-hidden="true" size={16} />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="training-page__section training-page__section--tips">
          <div className="tips-card">
            <h2>How players use these playlists</h2>
            <ul>
              <li>
                Pair a skill playlist with a hitting session each week to keep technique cues fresh while you groove the
                movement.
              </li>
              <li>
                Bookmark favorite drills in YouTube and add quick notes in your Matchplay journal after each practice to
                track what clicked.
              </li>
              <li>
                Revisit the strategy playlist before league matches to tighten your plan for different opponent styles.
              </li>
            </ul>
          </div>
          <div className="tips-card tips-card--accent">
            <h3>Need a custom plan?</h3>
            <p>
              Connect with a Matchplay coach to turn these playlists into a personalized roadmap that meets you exactly
              where you are.
            </p>
            <Link className="primary-link" to="/find-coaches">
              Meet coaches
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default TrainingResourcesPage;
