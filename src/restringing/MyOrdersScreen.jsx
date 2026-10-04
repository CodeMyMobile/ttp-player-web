import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, MapPin, Navigation, RefreshCw, RotateCcw } from "lucide-react";
import {
  directionsUrl,
  displayAddress,
  formatOrderTotal,
  formatShopDate,
  isCancelledOrder,
  orderItemLine,
  orderPaymentNote,
  orderProgressSteps,
  orderStatusChip,
  readyLine,
  restringAgainHref,
  splitOrders,
  updatedLabel,
  usualSetup,
} from "./myOrders.js";
import { vendorOpenStatus } from "./vendorPage.js";
import { vendorSlug } from "./vendorProfileRoutes.js";
import "./MyOrdersScreen.css";

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "past", label: "Past" },
];

function StatusChip({ order }) {
  const chip = orderStatusChip(order);
  return <span className={`mo-chip mo-chip--${chip.tone}`}>{chip.label}</span>;
}

function Price({ order }) {
  const note = orderPaymentNote(order);
  return (
    <span className="mo-price">
      <b className={isCancelledOrder(order) ? "is-struck" : ""}>{formatOrderTotal(order.total_cents)}</b>
      {note ? <span className={`mo-pay mo-pay--${note.tone}`}>{note.tone === "red" ? "⚠ " : ""}{note.label}</span> : null}
    </span>
  );
}

function ItemLines({ order, compact = false }) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return null;
  return (
    <ul className={`mo-items ${compact ? "mo-items--compact" : ""}`}>
      {items.map((item) => {
        const line = orderItemLine(item);
        return (
          <li key={item.id}>
            <b>{line.title}</b>
            {line.detail ? <span>{line.detail}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Progress({ order }) {
  const steps = orderProgressSteps(order);
  return (
    <ol className="mo-progress" aria-label="Order progress">
      {steps.map((step) => (
        <li key={step.label} className={`is-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
          <span className="mo-progress-dot" aria-hidden="true" />
          <span className="mo-progress-label">{step.label}</span>
          {step.date ? <span className="mo-progress-date">{step.date}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function ActiveOrderCard({ order, onCancel }) {
  const directions = directionsUrl(order.vendor_address);
  const ready = readyLine(order);
  const [cancelling, setCancelling] = useState(false);
  return (
    <article className="mo-card mo-card--active">
      <header className="mo-card-head">
        <div>
          <span className="mo-meta">{order.vendor_name} · #{order.id} · {formatShopDate(order.created_at)}</span>
        </div>
        <StatusChip order={order} />
      </header>
      <ItemLines order={order} />
      <Progress order={order} />
      {ready ? <p className="mo-ready">{ready}</p> : null}
      <footer className="mo-card-foot">
        <Price order={order} />
        <div className="mo-actions">
          {directions ? (
            <a className="mo-btn" href={directions} target="_blank" rel="noreferrer"><Navigation size={16} /> Get directions</a>
          ) : null}
          {order.fulfillment_status === "pending" && onCancel ? (
            <button
              type="button"
              className="mo-btn mo-btn--quiet"
              disabled={cancelling}
              onClick={async () => {
                setCancelling(true);
                try {
                  await onCancel(order.id);
                } finally {
                  setCancelling(false);
                }
              }}
            >
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
          ) : null}
        </div>
      </footer>
      {order.fulfillment_status === "pending" ? <p className="mo-fine">Free cancellation, with a full refund, until your racket is dropped off.</p> : null}
    </article>
  );
}

function PastOrderRow({ order }) {
  const cancelled = isCancelledOrder(order);
  const again = cancelled ? "" : restringAgainHref(order);
  const when = order.picked_up_at || order.fulfilled_at || order.cancelled_at || order.created_at;
  return (
    <li className={`mo-row ${cancelled ? "is-cancelled" : ""}`}>
      <div className="mo-row-main">
        <ItemLines order={order} compact />
        <span className="mo-meta">{order.vendor_name} · #{order.id} · {formatShopDate(when)}</span>
      </div>
      <div className="mo-row-side">
        <StatusChip order={order} />
        <Price order={order} />
        {again ? <a className="mo-link" href={again}><RotateCcw size={14} /> Restring again</a> : null}
      </div>
    </li>
  );
}

function UsualSetupCard({ setup, onStartNew }) {
  return (
    <section className="mo-card mo-side-card">
      <h2>Your usual setup</h2>
      {setup ? (
        <>
          <div className="mo-usual">
            <b>{setup.line.title}</b>
            <span>{setup.line.detail}</span>
            <span className="mo-meta">Last at {setup.order.vendor_name} · {formatShopDate(setup.order.picked_up_at || setup.order.fulfilled_at || setup.order.created_at)}</span>
          </div>
          {setup.href ? (
            <a className="mo-btn mo-btn--primary" href={setup.href}>Book a restring</a>
          ) : (
            <button type="button" className="mo-btn mo-btn--primary" onClick={onStartNew}>Book a restring</button>
          )}
        </>
      ) : (
        <>
          <p className="mo-muted">Once a restring is picked up, its racket, string and tension show here so you can book it again in one tap.</p>
          <button type="button" className="mo-btn mo-btn--primary" onClick={onStartNew}>Book a restring</button>
        </>
      )}
    </section>
  );
}

function ShopCard({ order }) {
  const open = vendorOpenStatus(order.vendor_hours);
  const directions = directionsUrl(order.vendor_address);
  const slug = vendorSlug(order.vendor_name);
  return (
    <section className="mo-card mo-side-card">
      <h2>Your shop</h2>
      <div className="mo-shop">
        <b>{order.vendor_name}</b>
        {order.vendor_address ? <span><MapPin size={14} /> {displayAddress(order.vendor_address)}</span> : null}
        {open ? <span className={`mo-chip ${open.isOpen ? "mo-chip--green" : "mo-chip--grey"}`}>{open.label}</span> : null}
      </div>
      <div className="mo-actions">
        {directions ? <a className="mo-btn" href={directions} target="_blank" rel="noreferrer"><Navigation size={16} /> Get directions</a> : null}
        {slug ? <a className="mo-btn mo-btn--quiet" href={`/${slug}`}>View shop</a> : null}
      </div>
    </section>
  );
}

export default function MyOrdersScreen({ orders, updatedAt, refreshing, onRefresh, onBack, onCancel, onStartNew }) {
  const [tab, setTab] = useState("all");
  const [now, setNow] = useState(() => Date.now());
  const rows = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const { active, past } = useMemo(() => splitOrders(rows), [rows]);
  const setup = useMemo(() => usualSetup(rows), [rows]);
  const shopOrder = setup?.order || rows[0] || null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = { all: active.length + past.length, active: active.length, past: past.length };
  const showActive = tab !== "past" && active.length > 0;
  const showPast = tab !== "active" && past.length > 0;
  const empty = tab === "active" ? !active.length : tab === "past" ? !past.length : !counts.all;

  return (
    <div className="mo-screen">
      <header className="mo-head">
        <button type="button" className="mo-icon-btn" aria-label="Back" onClick={onBack}><ChevronLeft size={22} /></button>
        <div className="mo-title">
          <h1>My orders</h1>
          <span className="mo-muted" aria-live="polite">{refreshing ? "Updating…" : updatedLabel(updatedAt, now)}</span>
        </div>
        <button type="button" className="mo-icon-btn" aria-label="Refresh orders" disabled={refreshing} onClick={onRefresh}>
          <RefreshCw size={19} className={refreshing ? "is-spinning" : ""} />
        </button>
      </header>

      <div className="mo-tabs" role="tablist" aria-label="Filter orders">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={tab === item.key ? "is-active" : ""}
            onClick={() => setTab(item.key)}
          >
            {item.label} <span>{counts[item.key]}</span>
          </button>
        ))}
      </div>

      <div className="mo-layout">
        <div className="mo-main">
          {showActive ? (
            <section className="mo-section" aria-label="Active orders">
              {tab === "all" ? <h2 className="mo-section-h">Active</h2> : null}
              {active.map((order) => <ActiveOrderCard key={order.id} order={order} onCancel={onCancel} />)}
            </section>
          ) : null}
          {showPast ? (
            <section className="mo-section" aria-label="Past orders">
              {tab === "all" ? <h2 className="mo-section-h">Past</h2> : null}
              <ul className="mo-card mo-rows">
                {past.map((order) => <PastOrderRow key={order.id} order={order} />)}
              </ul>
            </section>
          ) : null}
          {empty ? (
            <section className="mo-card mo-empty">
              {tab === "active" ? "No restrings in progress." : tab === "past" ? "No past orders yet." : "No restringing orders yet."}
            </section>
          ) : null}
        </div>
        <aside className="mo-side">
          <UsualSetupCard setup={setup} onStartNew={onStartNew} />
          {shopOrder ? <ShopCard order={shopOrder} /> : null}
        </aside>
      </div>
    </div>
  );
}

