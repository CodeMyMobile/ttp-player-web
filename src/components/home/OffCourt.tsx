import { Play } from "lucide-react";
import type { TipVideo } from "../../utils/tipOfDay";

interface OffCourtProps {
  tip: TipVideo | null;
}

/**
 * "Off court" — the day's coaching video.
 *
 * The mockups pair this with a "7-day training plan" row, which is not built:
 * that page does not exist yet, and a row that goes nowhere is worse than no
 * row. Once it does, it joins this card and becomes the degraded state that
 * video-unavailable.html draws — until then, no tip means no section.
 */
export function OffCourt({ tip }: OffCourtProps) {
  if (!tip) return null;

  return (
    <section className="home-offcourt">
      <h2 className="home-offcourt__heading">Off court</h2>

      <div className="home-offcourt__card">
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
      </div>
    </section>
  );
}
