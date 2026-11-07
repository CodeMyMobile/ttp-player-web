import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronRight } from "lucide-react";

import { bookedCount, nextUp, waitingLine } from "../../features/myWeek/homeWeekCard";
import { initialsOf, loadDots, stripLabel, timeLabel } from "../../features/myWeek/screenModel";
import { typeColor } from "../../features/myWeek/typeColors";
import type { WeekDayItems, WeekItem } from "../../features/myWeek/types";

interface MyWeekCardProps {
  days: WeekDayItems[];
  /** Everything waiting on the player, this week and later. */
  waiting: WeekItem[];
  /** The invite Home's invite card is showing, if any, so the waiting line doesn't count it twice. */
  inviteCardToken: string | null;
  loading: boolean;
}

const dayName = (dayKey: string) =>
  new Date(`${dayKey}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

/**
 * Home's My Week card (My Week on), in place of the "This week" tile and the today row: the
 * week's seven days with load dots, a red dot where something is waiting, and what's next.
 * Every part opens My Week; a day opens it at that day.
 */
export function MyWeekCard({ days, waiting, inviteCardToken, loading }: MyWeekCardProps) {
  const navigate = useNavigate();
  const booked = bookedCount(days);
  const next = nextUp(days, Date.now());
  const waitingText = waitingLine(waiting, inviteCardToken);

  return (
    <section className="home-week" aria-labelledby="home-week-title">
      <Link className="home-week__head" to="/my-week">
        <span id="home-week-title" className="home-week__title">
          My Week
          {!loading ? <span className="home-week__count"> · {booked} booked</span> : null}
        </span>
        <span className="home-week__all">
          See all
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      </Link>

      <div className="home-week__strip" role="list">
        {days.map((day, index) => {
          const label = stripLabel(day.dayKey, index);
          return (
            <button
              key={day.dayKey}
              type="button"
              role="listitem"
              className="home-week__day"
              onClick={() => navigate(`/my-week?day=${day.dayKey}`)}
              aria-label={`${index === 0 ? "Today" : dayName(day.dayKey)} ${label.date}: ${day.items.length} planned${day.hasWaiting ? ", something waiting on you" : ""}`}
            >
              <span className="home-week__day-top">{label.top}</span>
              <span className="home-week__day-date">
                {label.date}
                {day.hasWaiting ? <span className="home-week__alert" aria-hidden="true" /> : null}
              </span>
              <span className="home-week__dots" aria-hidden="true">
                {loadDots(day).map((type, dot) => (
                  <span key={dot} className="home-week__dot" style={{ background: typeColor(type) }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? null : next ? (
        <Link className="home-week__next" to={next.item.href ?? "/my-week"}>
          <span className="home-week__next-bar" style={{ background: typeColor(next.item.type) }} aria-hidden="true" />
          <span className="home-week__next-copy">
            <span className="home-week__next-when">
              {next.isToday ? "Today" : dayName(next.item.dayKey)} {timeLabel(next.item)}
            </span>
            <span className="home-week__next-title">{next.item.title}</span>
          </span>
          {next.item.people.length ? (
            <span className="home-week__people" aria-hidden="true">
              {next.item.people.slice(0, 3).map((person) => (
                <span key={person.id ?? person.name} className="home-week__avatar" title={person.name}>
                  {person.photoUrl ? <img src={person.photoUrl} alt="" /> : initialsOf(person.name)}
                </span>
              ))}
            </span>
          ) : null}
          <ChevronRight className="home-week__chevron" size={16} aria-hidden="true" />
        </Link>
      ) : (
        <div className="home-week__empty">
          <CalendarDays size={16} aria-hidden="true" />
          <span>Nothing booked this week</span>
          <Link to="/matches">Find a match</Link>
        </div>
      )}

      {waitingText ? (
        <Link className="home-week__waiting" to="/my-week">
          {waitingText}
        </Link>
      ) : null}
    </section>
  );
}
