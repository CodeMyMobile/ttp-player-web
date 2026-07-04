// "This week" card — four stat cells (played, scheduled, biggest upset, hottest
// streak). Data comes from the active league's WeekStats.

import Icon from "./Icon";
import type { WeekStats } from "./types";

const ThisWeekCard = ({ week }: { week: WeekStats }) => (
  <div className="card week">
    <div className="mini-head m">
      <Icon name="activity" />
      This week
    </div>
    <div className="week-grid">
      <div className="stat-cell">
        <div className="n">{week.matchesPlayed}</div>
        <div className="l">matches played</div>
      </div>
      <div className="stat-cell">
        <div className="n">{week.scheduled}</div>
        <div className="l">scheduled</div>
      </div>
      <div className="stat-cell">
        <div className="t">{week.biggestUpset}</div>
        <div className="l">biggest upset</div>
      </div>
      <div className="stat-cell">
        <div className="t">
          {week.hottestStreak.name} <Icon name="flame" className="flame" />
          {week.hottestStreak.streak}
        </div>
        <div className="l">hottest streak</div>
      </div>
    </div>
  </div>
);

export default ThisWeekCard;
