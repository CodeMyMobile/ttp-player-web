// Results ticker — a marquee of latest results. Pauses on hover (CSS) and is
// disabled under prefers-reduced-motion (CSS @media). Items are duplicated so the
// -50% translate loop is seamless, matching the mock.

import Icon from "./Icon";
import type { TickerItem } from "./types";

const ResultsTicker = ({ items }: { items: TickerItem[] }) => {
  const doubled = [...items, ...items];
  const latest = items[0];
  return (
    <section className="card ticker">
      <span className="tag">
        <span className="live" />
        Latest
      </span>
      {/* Desktop: scrolling marquee. Mobile: a single static most-recent line
          (marquee truncates/reorders in the narrow flex row) — CSS toggles them. */}
      <div className="view">
        <div className="tick-track">
          {doubled.map((item, index) => (
            <span key={`${item.id}-${index}`}>
              <Icon name="ball-tennis" />
              {item.text}
            </span>
          ))}
        </div>
      </div>
      {latest ? (
        <div className="tick-static">
          <Icon name="ball-tennis" />
          {latest.text}
        </div>
      ) : null}
    </section>
  );
};

export default ResultsTicker;
