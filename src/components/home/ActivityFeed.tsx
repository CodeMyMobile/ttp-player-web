import { useMemo, useState } from "react";
import {
  buildDayTabs,
  collapseCoachAvailability,
  filterActivities,
  filterToMyCoaches,
  itemsWithinWindow,
  typeCounts,
} from "../../utils/activityFeed";
import { ActivityCard } from "./ActivityCard";
import { hasStoredLocation, requestLocationPicker } from "../../utils/userLocation";
import type { FeedItem } from "../../utils/homeFeedLabels";
import { feedItemViewerState } from "../../utils/homeBookingState";

interface ActivityFeedProps {
  items: FeedItem[];
  windowStart: string | null;
  windowEnd: string | null;
  /** Accepted coaches. Empty means the "My coaches" chip is not offered. */
  myCoachIds?: number[];
  loading?: boolean;
  /** What the player is booked into, "<kind>:<id>" (utils/homeBookingState). */
  bookedKeys?: Set<string>;
  viewerId?: number | null;
}

const NO_KEYS = new Set<string>();

/** The mockups show three cards and then a button; the rest is one tap away. */
const PREVIEW_COUNT = 3;

/** Up next's empty state scrolls here. */
export const PLAY_THIS_WEEK_ID = "home-play-this-week";
const SECTION_ID = PLAY_THIS_WEEK_ID;

const TYPE_CHIPS = [
  { key: "all", label: "All" },
  { key: "private", label: "Lessons" },
  { key: "group", label: "Groups" },
  { key: "match", label: "Matches" },
] as const;

/**
 * "Play this week" — the largest section of the mockups.
 *
 * Day chips, type chips and filtering all come from utils/activityFeed, shared
 * with the legacy dashboard so the two screens count the same things the same
 * way. Only the presentation is new.
 *
 * There is deliberately no "My level" control. The mockups draw one, but
 * filters.level is exact string equality on free text and silently returns
 * nothing on an unrecognised value — see the omissions table in the build brief.
 */
export function ActivityFeed({
  items,
  windowStart,
  windowEnd,
  myCoachIds = [],
  loading = false,
  bookedKeys = NO_KEYS,
  viewerId = null,
}: ActivityFeedProps) {
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Offered only to players who have coaches. A filter that can only ever empty
  // the feed is worse than no filter.
  const canFilterByCoach = myCoachIds.length > 0;

  // Bounded once, up front, so the chips and the list can never disagree about
  // what "this week" contains.
  const weekItems = useMemo(
    // Collapse first, so the chip counts describe the cards on screen rather
    // than the slots behind them.
    () => {
      const inWindow = itemsWithinWindow({ items, windowStart, windowEnd });
      const scoped = mineOnly && canFilterByCoach ? filterToMyCoaches(inWindow, myCoachIds) : inWindow;
      return collapseCoachAvailability(scoped);
    },
    [items, windowStart, windowEnd, mineOnly, canFilterByCoach, myCoachIds],
  );

  const dayTabs = useMemo(
    () => (windowStart && windowEnd ? buildDayTabs({ items: weekItems, windowStart, windowEnd }) : []),
    [weekItems, windowStart, windowEnd],
  );
  const counts = useMemo(() => typeCounts({ items: weekItems, selectedDay }), [weekItems, selectedDay]);
  const visible = useMemo(
    () => filterActivities({ items: weekItems, selectedDay, selectedType }),
    [weekItems, selectedDay, selectedType],
  );

  const shown = expanded ? visible : visible.slice(0, PREVIEW_COUNT);
  const hidden = visible.length - shown.length;
  const windowLabel = dayTabs[0]?.fullDate ?? null;

  // An empty feed has two very different causes, and until now they looked the
  // same: there is genuinely nothing nearby, or we have no idea where the player
  // is and have been searching a default. Only the second is worth interrupting
  // for, and it is the one a first-time player always hits.
  const locationUnknown = !hasStoredLocation();
  // Empty before the coach toggle: "Only my coaches" emptying the list must not hide the
  // section, toggle and all.
  const nothingThisWeek = !itemsWithinWindow({ items, windowStart, windowEnd }).length;

  if (!loading && nothingThisWeek) {
    if (!locationUnknown) return null;

    return (
      <section id={SECTION_ID} className="home-sec home-feed">
        <div className="home-sec__head">
          <h2 className="home-sec__title">Play this week</h2>
        </div>
        <div className="home-card home-feed__prompt">
          <p className="home-feed__prompt-copy">
            Set your location to see coaches, group lessons and matches near you.
          </p>
          <button type="button" className="home-btn home-btn--outline" onClick={requestLocationPicker}>
            Set location
          </button>
        </div>
      </section>
    );
  }

  const resetExpanded = () => setExpanded(false);

  return (
    <section id={SECTION_ID} className="home-sec home-feed" aria-busy={loading && !items.length}>
      <div className="home-sec__head">
        <h2 className="home-sec__title">Play this week</h2>
        {windowLabel ? <span className="home-sec__aside">{windowLabel}</span> : null}
      </div>

      {loading && !items.length ? (
        <div className="home-card home-skeleton" aria-hidden="true">
          {Array.from({ length: PREVIEW_COUNT }, (_, index) => (
            <span key={index} className="home-skeleton__row">
              <span className="home-skeleton__line home-skeleton__line--short" />
              <span className="home-skeleton__line" />
            </span>
          ))}
        </div>
      ) : (
        <>
          <div className="home-feed__days" role="tablist" aria-label="Days">
            {dayTabs.map((day) => (
              <button
                key={day.key}
                type="button"
                role="tab"
                aria-selected={selectedDay === day.key}
                className={`home-feed__day${selectedDay === day.key ? " home-feed__day--on" : ""}`}
                onClick={() => {
                  setSelectedDay(day.key);
                  resetExpanded();
                }}
              >
                <span className="home-feed__day-label">
                  {day.key === "all" ? "Week" : day.label === "Today" ? "Today" : `${day.label} ${day.date}`}
                </span>
                <span className="home-feed__day-count">{day.count}</span>
              </button>
            ))}
          </div>

          {/* One type row. Lessons + Groups + Matches add up to All: external lessons
              count with Groups (utils/activityFeed typeCounts). */}
          <div className="home-feed__types" role="tablist" aria-label="Session types">
            {TYPE_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={selectedType === chip.key}
                className={`home-feed__type-chip${selectedType === chip.key ? " home-feed__type-chip--on" : ""}`}
                onClick={() => {
                  setSelectedType(chip.key);
                  resetExpanded();
                }}
              >
                {chip.label}
                <span className="home-feed__type-count">{counts[chip.key as keyof typeof counts]}</span>
              </button>
            ))}
          </div>

          {canFilterByCoach ? (
            <button
              type="button"
              role="switch"
              aria-checked={mineOnly}
              className="home-feed__mine"
              onClick={() => {
                setMineOnly((on) => !on);
                resetExpanded();
              }}
            >
              Only my coaches
              <span className={`home-switch${mineOnly ? " home-switch--on" : ""}`} aria-hidden="true">
                <span className="home-switch__knob" />
              </span>
            </button>
          ) : null}

          {shown.length ? (
            <ul className="home-card home-feed__list">
              {shown.map((item) => (
                <ActivityCard
                  key={String(item.id)}
                  item={item as FeedItem}
                  viewerState={feedItemViewerState(item, { bookedKeys, viewerId })}
                />
              ))}
            </ul>
          ) : (
            <p className="home-feed__status">
              {mineOnly ? "Nothing with your coaches on this day." : "Nothing on this day. Try another."}
            </p>
          )}

          {/* Expands in place: no route shows lessons, groups and matches together. */}
          {hidden > 0 || expanded ? (
            <button type="button" className="home-feed__more" onClick={() => setExpanded((on) => !on)}>
              {expanded ? "Show fewer" : `See all ${visible.length} this week`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
