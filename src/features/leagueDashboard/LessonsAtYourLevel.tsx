// "Group lessons at your level" — up to three of our upcoming classes that fit the
// viewer's level, styled as a sibling of "Players looking for matches". Hidden when
// none fit. Behind VITE_LEAGUE_COACHING_PROMPTS.

import { useEffect } from "react";
import { Link } from "react-router-dom";

import { track } from "../../utils/analytics";
import Icon from "./Icon";
import type { LevelMatchedLessons } from "./useLevelMatchedLessons";

const SHOWN = 3;

interface LessonsAtYourLevelProps {
  leagueId: string;
  matched: LevelMatchedLessons;
}

const LessonsAtYourLevel = ({ leagueId, matched }: LessonsAtYourLevelProps) => {
  const { level, band, lessons, linkState } = matched;
  const visible = Boolean(level && band && lessons.length);

  useEffect(() => {
    if (visible) track("league_lessons_card_view", { leagueId, levelBand: band, lessons: Math.min(lessons.length, SHOWN) });
    // Once per league and band, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, leagueId, band]);

  if (!visible) return null;
  const clicked = (target: string) => track("league_lessons_card_click", { leagueId, levelBand: band, target });

  return (
    <section className="card looking lessons-at-level" aria-label="Group lessons at your level">
      <div className="lh">
        <h3>
          <Icon name="users" style={{ color: "var(--violet)" }} />
          Group lessons at your level
        </h3>
        <span className="cnt">Your level · {level}</span>
      </div>
      <div className="desc">Curated for NTRP {band} players near you.</div>

      {lessons.slice(0, SHOWN).map((lesson) => (
        <div className="look-row lesson-row" key={lesson.id}>
          <div className="lesson-row__main">
            <div className="top">
              <span className="nm">{lesson.title}</span>
              <span className="tag-tpr">{lesson.levelPill}</span>
              <span className="tag-ok">{lesson.spotsLabel}</span>
            </div>
            <div className="meta">
              {lesson.when} · {lesson.venue}
              {lesson.coachName ? ` · with ${lesson.coachName}` : ""}
            </div>
          </div>
          <Link
            className="btn ghost lesson-row__reserve"
            to={`/group-lessons/${lesson.id}`}
            onClick={() => clicked("reserve")}
          >
            Reserve
          </Link>
        </div>
      ))}

      <Link
        className="btn wide lessons-at-level__browse"
        to="/group-lessons"
        state={linkState}
        onClick={() => clicked("browse")}
      >
        Browse all {level} lessons
      </Link>
      <Link className="see-all" to="/find-coaches" onClick={() => clicked("coaches")}>
        Or find a private coach <Icon name="arrow-right" style={{ fontSize: 13, verticalAlign: "-1px" }} />
      </Link>
    </section>
  );
};

export default LessonsAtYourLevel;
