import { useRef } from "react";
import { ChevronRight, ClipboardList, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { HomeAlert, HomeAlertType } from "../../utils/homeAlertStack";

interface AlertStackProps {
  alerts: HomeAlert[];
}

/**
 * "unentered_score" is here so the component can render the type the moment a
 * source exists. Nothing emits it today — there is no endpoint — so this entry
 * is reachable only by a future builder, never by current data.
 */
const ICONS: Record<HomeAlertType, LucideIcon> = {
  restring_pickup: Wrench,
  unentered_score: ClipboardList,
};

/**
 * The divided list between the today row and the action grid.
 *
 * Collapses to nothing when empty rather than rendering a shell — see
 * rated-no-bookings.html, where the stack takes the slot directly under the
 * tiles because the today row isn't there. HomePage.css animates the collapse
 * so the grid slides instead of snapping ~90px under a thumb.
 */
export function AlertStack({ alerts }: AlertStackProps) {
  // The collapse has to animate a real height, so the rows must still be in the
  // DOM while it runs — clearing them in the same frame collapses the track
  // instantly and the grid snaps, which is exactly what the transition is for.
  // Holding the last non-empty list keeps the outgoing content around; once
  // collapsed it is zero-height, clipped, and hidden from assistive tech.
  const lastNonEmpty = useRef<HomeAlert[]>([]);
  if (alerts.length) lastNonEmpty.current = alerts;

  const collapsed = alerts.length === 0;
  const rows = alerts.length ? alerts : lastNonEmpty.current;

  // Nothing has ever been shown, so there is nothing to animate away.
  if (collapsed && !rows.length) return null;

  return (
    <section
      className={`home-alerts${collapsed ? " home-alerts--collapsed" : ""}`}
      // Not just aria-hidden: the outgoing rows are still links, and a
      // zero-height container would otherwise keep them in the tab order.
      inert={collapsed}
    >
      <div className="home-alerts__list">
        {rows.map((alert) => {
          const Icon = ICONS[alert.type];
          const body = (
            <>
              <span
                className={`home-alerts__chip home-alerts__chip--${alert.tone}`}
                aria-hidden="true"
              >
                <Icon size={16} />
              </span>
              <span className="home-alerts__copy">
                <span className="home-alerts__title">{alert.title}</span>
                {alert.subtitle ? (
                  <span className="home-alerts__meta">{alert.subtitle}</span>
                ) : null}
              </span>
              {alert.destination ? (
                <ChevronRight className="home-alerts__chevron" size={16} aria-hidden="true" />
              ) : null}
            </>
          );

          // No destination means no chevron and no link — a row that looks
          // tappable but goes nowhere is worse than a plain row.
          return alert.destination ? (
            <Link key={alert.id} className="home-alerts__row" to={alert.destination}>
              {body}
            </Link>
          ) : (
            <div key={alert.id} className="home-alerts__row">
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
