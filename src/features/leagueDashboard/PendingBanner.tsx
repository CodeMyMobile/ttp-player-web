// Amber "N pending matches need a score" banner. Amber = needs your action.
// Only rendered when there's a non-zero count.

import Icon from "./Icon";

interface PendingBannerProps {
  count: number;
  onView: () => void;
}

const PendingBanner = ({ count, onView }: PendingBannerProps) => {
  if (!count) return null;
  return (
    <section className="banner">
      <Icon name="clock-exclamation" />
      <span className="txt">
        {count} pending {count === 1 ? "match needs" : "matches need"} a score
      </span>
      <button type="button" className="btn ghost" onClick={onView}>
        View
      </button>
    </section>
  );
};

export default PendingBanner;
