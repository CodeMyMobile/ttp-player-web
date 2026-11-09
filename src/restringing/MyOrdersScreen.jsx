import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, MapPin, Navigation, RefreshCw, RotateCcw, Star } from "lucide-react";
import {
  directionsUrl,
  displayAddress,
  formatOrderTotal,
  formatShopDate,
  isCancelledOrder,
  isRacketSaleOrder,
  orderItemLine,
  orderPaymentNote,
  orderProgressSteps,
  orderStatusChip,
  readyLine,
  restringAgainHref,
  spansVendors,
  splitOrders,
  updatedLabel,
  usualSetup,
} from "./myOrders.js";
import {
  AGAIN_OPTIONS,
  ARM_OPTIONS,
  COMMENT_MAX_LENGTH,
  CONSENT_LINE,
  FEEL_OPTIONS,
  LEVEL_QUESTION,
  TRAIT_KEYS,
  TRAIT_OPTIONS,
  needsLevel,
  nextGameQuestion,
  ratingCards,
  setupLine,
  setupName,
  starsLabel,
  startingAnswers,
} from "./stringFeedback.js";
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
  const taxCents = Number(order.tax_cents || 0);
  return (
    <span className="mo-price">
      <b className={isCancelledOrder(order) ? "is-struck" : ""}>{formatOrderTotal(order.total_cents)}</b>
      {taxCents > 0 ? <span className="mo-pay mo-pay--grey">incl. {formatOrderTotal(taxCents)} sales tax</span> : null}
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

// "#142 · Sat, Oct 3", with the shop's name first only when orders span several shops.
const orderMeta = (order, showVendor, when) =>
  [showVendor ? order.vendor_name : "", `#${order.id}`, formatShopDate(when)].filter(Boolean).join(" · ");

function ActiveOrderCard({ order, showVendor, onCancel }) {
  const directions = directionsUrl(order.vendor_address);
  const ready = readyLine(order);
  const [cancelling, setCancelling] = useState(false);
  return (
    <article className="mo-card mo-card--active">
      <header className="mo-card-head">
        <div>
          <span className="mo-meta">{orderMeta(order, showVendor, order.created_at)}</span>
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
      {order.fulfillment_status === "pending" ? (
        <p className="mo-fine">
          {isRacketSaleOrder(order)
            ? "Free cancellation, with a full refund, until the shop starts on it."
            : "Free cancellation, with a full refund, until your racket is dropped off."}
        </p>
      ) : null}
    </article>
  );
}

// Line 1: racket + chip, price on the right. Line 2: string · gauge · tension. Line 3: #id · date.
// Restring again sits under the price on desktop and on its own line on phones.
function PastOrderRow({ order, showVendor }) {
  const cancelled = isCancelledOrder(order);
  const again = cancelled ? "" : restringAgainHref(order);
  const when = order.picked_up_at || order.fulfilled_at || order.cancelled_at || order.created_at;
  const items = (Array.isArray(order.items) ? order.items : []).map(orderItemLine);
  const [first, ...rest] = items.length ? items : [{ title: `Order #${order.id}`, detail: "" }];
  const againLink = (className) => (
    again ? <a className={`mo-link ${className}`} href={again}><RotateCcw size={14} /> Restring again</a> : null
  );
  return (
    <li className={`mo-row ${cancelled ? "is-cancelled" : ""}`}>
      <div className="mo-row-main">
        <div className="mo-row-title">
          <b>{first.title}</b>
          <StatusChip order={order} />
        </div>
        {first.detail ? <span className="mo-row-detail">{first.detail}</span> : null}
        {rest.map((line, index) => (
          <span className="mo-row-extra" key={index}>
            <b>{line.title}</b>
            {line.detail ? <span className="mo-row-detail">{line.detail}</span> : null}
          </span>
        ))}
        <span className="mo-meta mo-meta--lg">{orderMeta(order, showVendor, when)}</span>
        {/* Phones: status as coloured text, then date and #id, with Restring again on the right. */}
        <div className="mo-row-l3">
          <span className="mo-meta mo-meta--sm">
            <span className={`mo-status-text mo-status-text--${orderStatusChip(order).tone === "grey" ? "green" : orderStatusChip(order).tone}`}>{orderStatusChip(order).label}</span>
            {[showVendor ? order.vendor_name : "", formatShopDate(when), `#${order.id}`].filter(Boolean).map((part) => ` · ${part}`).join("")}
          </span>
          {againLink("mo-row-again--sm")}
        </div>
      </div>
      <div className="mo-row-side">
        <Price order={order} />
        {againLink("mo-row-again--lg")}
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

// ----- How the strings felt -----

function Stars({ value, onChange, size = 30 }) {
  return (
    <div className="mo-stars" role="radiogroup" aria-label="Overall rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={n <= value ? "is-on" : ""}
          onClick={() => onChange(n)}
        >
          <Star size={size} />
        </button>
      ))}
    </div>
  );
}

function Choices({ label, options, value, onChange }) {
  return (
    <div className="mo-choice">
      <span className="mo-choice-label">{label}</span>
      <div className="mo-opts" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(value === option.value ? null : option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Stars first; the rest appear once there's a rating, and are all optional. With no level
// known for the player, their level is asked too and saved first, so it's kept with the rating.
function RatingForm({ row, consented, profile, onSave, onSaveProfile, onDone }) {
  const [answers, setAnswers] = useState(() => startingAnswers(row));
  const [askLevel] = useState(() => needsLevel(profile) && Boolean(onSaveProfile));
  const [level, setLevel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (value) => setAnswers((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (askLevel && level) await onSaveProfile({ level }).catch(() => {});
      await onSave(row.order_item_id, answers);
      onDone?.();
    } catch {
      setError("Couldn’t save your rating. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mo-rate-form">
      <Stars value={answers.overall} onChange={set("overall")} />
      {answers.overall ? (
        <>
          {askLevel && LEVEL_QUESTION ? (
            <Choices
              label={LEVEL_QUESTION.label}
              options={LEVEL_QUESTION.options.map((option) => ({ value: option.value, label: option.hint ? `${option.label} · ${option.hint}` : option.label }))}
              value={level}
              onChange={setLevel}
            />
          ) : null}
          <Choices label="Would you get it again?" options={AGAIN_OPTIONS} value={answers.again} onChange={set("again")} />
          <Choices label="How does it feel?" options={FEEL_OPTIONS} value={answers.feel} onChange={set("feel")} />
          <div className="mo-traits">
            {TRAIT_KEYS.map((trait) => (
              <Choices key={trait.key} label={trait.label} options={TRAIT_OPTIONS} value={answers[trait.key]} onChange={set(trait.key)} />
            ))}
          </div>
          <Choices label="Any arm or elbow discomfort?" options={ARM_OPTIONS} value={answers.arm_discomfort} onChange={set("arm_discomfort")} />
          <label className="mo-choice">
            <span className="mo-choice-label">Anything else? <span className="mo-muted">(optional)</span></span>
            <textarea
              className="mo-comment"
              rows={2}
              maxLength={COMMENT_MAX_LENGTH}
              value={answers.comment}
              onChange={(event) => set("comment")(event.target.value)}
              placeholder="Great on serves, lost tension fast…"
            />
          </label>
          {error ? <p className="mo-rate-error" role="alert">{error}</p> : null}
          <button type="button" className="mo-btn mo-btn--primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save rating"}
          </button>
          {!consented ? <p className="mo-fine">{CONSENT_LINE}</p> : null}
        </>
      ) : null}
    </div>
  );
}

// After a rating: one question about their game, if there's one they haven't answered.
function GameQuestion({ profile, onSaveProfile }) {
  const [question] = useState(() => nextGameQuestion(profile));
  const [answered, setAnswered] = useState(false);
  if (!question) return null;
  if (answered) return <p className="mo-muted">Thanks, that helps us pick strings for you.</p>;
  return (
    <div className="mo-game-q">
      <Choices
        label={`One about your game: ${question.label.charAt(0).toLowerCase()}${question.label.slice(1)}`}
        options={question.options}
        value={null}
        onChange={(value) => {
          if (!value) return;
          setAnswered(true);
          Promise.resolve(onSaveProfile?.({ [question.key]: value })).catch(() => {});
        }}
      />
    </div>
  );
}

function RateStringCard({ row, consented, profile, onRate, onSaveProfile }) {
  const [done, setDone] = useState(false);
  const line = setupLine(row);
  const textRating = row.feedback?.answered_via === "sms" ? row.feedback.overall : null;
  return (
    <section className="mo-card mo-rate" aria-label={`Rate your ${setupName(row)}`}>
      <div className="mo-rate-head">
        <h2>{done ? "Thanks for rating" : `How’s your ${setupName(row)}?`}</h2>
        <span className="mo-meta">{[line.title, line.when].filter(Boolean).join(" · ")}</span>
      </div>
      {done ? (
        <GameQuestion profile={profile} onSaveProfile={onSaveProfile} />
      ) : (
        <>
          {textRating ? <p className="mo-muted">You gave it {starsLabel(textRating)} by text. A few more taps?</p> : null}
          <RatingForm
            row={row}
            consented={consented}
            profile={profile}
            onSave={onRate}
            onSaveProfile={onSaveProfile}
            onDone={() => setDone(true)}
          />
        </>
      )}
    </section>
  );
}

const MY_STRINGS_SHOWN = 5;

function MyStringRow({ row, consented, profile, onRate, onSaveProfile }) {
  const [open, setOpen] = useState(false);
  const line = setupLine(row);
  const overall = row.feedback?.overall;
  return (
    <li className="mo-string">
      <div className="mo-string-main">
        <span className="mo-string-text">
          <b>{setupName(row)}</b>
          <span className="mo-meta">{[line.title, line.when].filter(Boolean).join(" · ")}</span>
        </span>
        {overall ? (
          <span className="mo-string-rating" aria-label={starsLabel(overall)}><Star size={14} /> {overall}/5</span>
        ) : row.can_rate && !open ? (
          <button type="button" className="mo-btn mo-btn--small" onClick={() => setOpen(true)}>Rate</button>
        ) : null}
      </div>
      {open && !overall ? (
        <RatingForm
          row={row}
          consented={consented}
          profile={profile}
          onSave={onRate}
          onSaveProfile={onSaveProfile}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </li>
  );
}

// Every racket strung and collected, with the player's rating of it.
function MyStringsCard({ strings, consented, profile, onRate, onSaveProfile }) {
  const [showAll, setShowAll] = useState(false);
  if (!strings.length) return null;
  const shown = showAll ? strings : strings.slice(0, MY_STRINGS_SHOWN);
  return (
    <section className="mo-card mo-side-card">
      <h2>My strings</h2>
      <ul className="mo-strings">
        {shown.map((row) => (
          <MyStringRow
            key={row.order_item_id}
            row={row}
            consented={consented}
            profile={profile}
            onRate={onRate}
            onSaveProfile={onSaveProfile}
          />
        ))}
      </ul>
      {strings.length > MY_STRINGS_SHOWN ? (
        <button type="button" className="mo-link mo-link--button" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show fewer" : `Show all ${strings.length}`}
        </button>
      ) : null}
    </section>
  );
}

// The indicator moves at half the finger's speed; release past PULL_TRIGGER to refresh.
const PULL_TRIGGER = 56;
const PULL_MAX = 96;

// Pull down at the top of the page to refresh, as in a native list. Same refetch as the button.
function usePullToRefresh(onRefresh, refreshing) {
  const startY = useRef(null);
  const [pull, setPull] = useState(0);

  const onTouchStart = (event) => {
    startY.current = window.scrollY <= 0 && !refreshing ? event.touches[0]?.clientY ?? null : null;
  };
  const onTouchMove = (event) => {
    if (startY.current == null) return;
    const delta = (event.touches[0]?.clientY ?? 0) - startY.current;
    if (delta <= 0 || window.scrollY > 0) {
      setPull(0);
      return;
    }
    setPull(Math.min(PULL_MAX, delta * 0.5));
  };
  const onTouchEnd = () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= PULL_TRIGGER) onRefresh?.();
    setPull(0);
  };

  return { pull, handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: () => { startY.current = null; setPull(0); } } };
}

export default function MyOrdersScreen({
  orders,
  updatedAt,
  refreshing,
  onRefresh,
  onBack,
  onCancel,
  onStartNew,
  myStrings = null,
  onRateString,
  onSaveProfile,
}) {
  const [tab, setTab] = useState("all");
  const { pull, handlers: pullHandlers } = usePullToRefresh(onRefresh, refreshing);
  const [now, setNow] = useState(() => Date.now());
  const rows = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const { active, past } = useMemo(() => splitOrders(rows), [rows]);
  const setup = useMemo(() => usualSetup(rows), [rows]);
  const shopOrder = setup?.order || rows[0] || null;
  const strings = useMemo(() => (Array.isArray(myStrings?.strings) ? myStrings.strings : []), [myStrings]);
  // Cards rated here stay, to thank the player and ask about their game, until the next visit.
  const [ratedHere, setRatedHere] = useState(() => new Set());
  const rateCards = useMemo(
    () => [...ratingCards(strings), ...strings.filter((row) => ratedHere.has(row.order_item_id) && !row.to_rate)],
    [ratedHere, strings],
  );
  const rateFromCard = async (orderItemId, answers) => {
    await onRateString(orderItemId, answers);
    setRatedHere((current) => new Set(current).add(orderItemId));
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = { all: active.length + past.length, active: active.length, past: past.length };
  const showActive = tab !== "past" && active.length > 0;
  const showPast = tab !== "active" && past.length > 0;
  const empty = tab === "active" ? !active.length : tab === "past" ? !past.length : !counts.all;
  const showVendor = spansVendors(rows);
  // Phones only: with nothing in progress, a short prompt above the past orders.
  const showNothingActive = tab === "all" && !active.length && past.length > 0;
  const bookHref = setup?.href || "";

  return (
    <div className="mo-screen" {...pullHandlers}>
      <div
        className={`mo-pull ${refreshing ? "is-refreshing" : ""}`}
        style={{ height: refreshing ? 44 : pull }}
        aria-hidden={!refreshing && !pull}
      >
        <RefreshCw
          size={20}
          className={refreshing ? "is-spinning" : ""}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / 48) }}
        />
      </div>
      <header className="mo-head">
        <button type="button" className="mo-icon-btn mo-icon-btn--bare" aria-label="Back" onClick={onBack}><ChevronLeft size={26} /></button>
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

      <div className={`mo-layout ${tab === "all" && (showActive || showPast) ? "has-section-label" : ""}`}>
        <div className="mo-main">
          {onRateString
            ? rateCards.map((row) => (
              <RateStringCard
                key={row.order_item_id}
                row={row}
                consented={Boolean(myStrings?.consented)}
                profile={myStrings?.profile}
                onRate={rateFromCard}
                onSaveProfile={onSaveProfile}
              />
            ))
            : null}
          {showNothingActive ? (
            <section className="mo-card mo-nothing-active">
              <span className="mo-nothing-text">
                <b>No restrings in progress</b>
                <small>Book one in under a minute</small>
              </span>
              {bookHref ? (
                <a className="mo-btn mo-btn--small" href={bookHref}>Book</a>
              ) : (
                <button type="button" className="mo-btn mo-btn--small" onClick={onStartNew}>Book</button>
              )}
            </section>
          ) : null}
          {showActive ? (
            <section className="mo-section" aria-label="Active orders">
              {tab === "all" ? <h2 className="mo-section-h">Active</h2> : null}
              {active.map((order) => <ActiveOrderCard key={order.id} order={order} showVendor={showVendor} onCancel={onCancel} />)}
            </section>
          ) : null}
          {showPast ? (
            <section className="mo-section" aria-label="Past orders">
              {tab === "all" ? <h2 className="mo-section-h">Past</h2> : null}
              <ul className="mo-card mo-rows">
                {past.map((order) => <PastOrderRow key={order.id} order={order} showVendor={showVendor} />)}
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
          {onRateString ? (
            <MyStringsCard
              strings={strings}
              consented={Boolean(myStrings?.consented)}
              profile={myStrings?.profile}
              onRate={onRateString}
              onSaveProfile={onSaveProfile}
            />
          ) : null}
          {shopOrder ? <ShopCard order={shopOrder} /> : null}
        </aside>
      </div>
    </div>
  );
}

