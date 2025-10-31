import { Fragment } from "react";
import type { HeroStat } from "../types";

interface HeroStatsProps {
  stats: HeroStat[];
  loading?: boolean;
}

const PLACEHOLDER_STATS = Array.from({ length: 4 }).map((_, index) => ({
  id: `placeholder-${index}`,
}));

const HeroStats = ({ stats, loading = false }: HeroStatsProps) => {
  const hasStats = stats.length > 0;
  const items = loading && !hasStats ? PLACEHOLDER_STATS : stats;

  return (
    <section className="coaches-page__hero" aria-label="Coach overview">
      <div className="coaches-page__hero-content">
        <h1 className="coaches-page__hero-title">Find Your Perfect Coach</h1>
        <p className="coaches-page__hero-subtitle">
          Get matched with certified tennis professionals in your area.
        </p>
      </div>
      <div className="coaches-page__hero-stats" role="list">
        {items.length === 0 && !loading ? (
          <p className="coaches-page__hero-placeholder">
            {/* TODO: replace with API-powered overview metrics */}
            Coach stats will appear once data is available.
          </p>
        ) : null}
        {items.map((stat) => {
          const className = [
            "coaches-page__hero-stat",
            loading && !hasStats ? "coaches-page__hero-stat--loading" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={stat.id} role="listitem" className={className}>
              {loading && !hasStats ? (
                <Fragment>
                  <div className="coaches-page__hero-stat-icon skeleton" aria-hidden />
                  <div className="coaches-page__hero-stat-text">
                    <span className="skeleton skeleton--text" />
                    <span className="skeleton skeleton--text skeleton--short" />
                  </div>
                </Fragment>
              ) : (
                <Fragment>
                  {stat.icon ? (
                    <span className="coaches-page__hero-stat-icon" aria-hidden>
                      {stat.icon}
                    </span>
                  ) : null}
                  <div className="coaches-page__hero-stat-text">
                    <span className="coaches-page__hero-stat-value">{stat.value}</span>
                    <span className="coaches-page__hero-stat-label">{stat.label}</span>
                    {stat.description ? (
                      <span className="coaches-page__hero-stat-description">{stat.description}</span>
                    ) : null}
                  </div>
                </Fragment>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HeroStats;
