// Season progress bar — label + fill percentage from the active league.

import Icon from "./Icon";
import type { SeasonProgress as SeasonProgressData } from "./types";

const SeasonProgress = ({ season }: { season: SeasonProgressData }) => (
  <section className="card season">
    <div className="top">
      <span className="l">
        <Icon name="flag" />
        Season progress
      </span>
      <span className="r">{season.label}</span>
    </div>
    <div className="bar">
      <i style={{ width: `${Math.max(0, Math.min(100, season.pct))}%` }} />
    </div>
  </section>
);

export default SeasonProgress;
