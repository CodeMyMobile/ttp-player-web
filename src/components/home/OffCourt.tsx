import { ChevronRight, Dumbbell, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { TipVideo } from "../../utils/tipOfDay";

interface OffCourtProps {
  tip: TipVideo | null;
}

/**
 * "Off court" — the day's coaching video, and the 7-day training plan.
 *
 * The training plan row is unconditional; the video comes and goes with the
 * playlist. That is exactly the degraded state video-unavailable.html draws: no
 * tip leaves the plan row alone rather than removing the whole section, so the
 * card never disappears because a third party's API was slow.
 */
export function OffCourt({ tip }: OffCourtProps) {
  return (
    <section className="home-offcourt">
      <h2 className="home-offcourt__heading">Off court</h2>

      <div className="home-offcourt__card">
        {tip ? (
        <a
          className="home-offcourt__row"
          href={`https://www.youtube.com/watch?v=${tip.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="home-offcourt__thumb">
            {tip.thumbnail ? <img src={tip.thumbnail} alt="" loading="lazy" /> : null}
            <span className="home-offcourt__play" aria-hidden="true">
              <Play size={14} fill="currentColor" />
            </span>
            {/* Omitted when the durations call did not land — the card reads fine
                without it, and an empty badge reads as a broken one. */}
            {tip.duration ? <span className="home-offcourt__duration">{tip.duration}</span> : null}
          </span>

          <span className="home-offcourt__copy">
            <span className="home-offcourt__eyebrow">Tip of the day</span>
            <span className="home-offcourt__title">{tip.title}</span>
            {tip.channel ? <span className="home-offcourt__channel">{tip.channel}</span> : null}
          </span>
        </a>
        ) : null}

        <Link className="home-offcourt__plan" to="/training-plan">
          <span className="home-offcourt__plan-icon" aria-hidden="true">
            <Dumbbell size={16} />
          </span>
          <span className="home-offcourt__plan-copy">
            <span className="home-offcourt__plan-title">7-day training plan</span>
            <span className="home-offcourt__plan-sub">Strength and mobility, no gym needed</span>
          </span>
          <ChevronRight className="home-offcourt__plan-chevron" size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
