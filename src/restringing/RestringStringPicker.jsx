import { useState } from "react";
import { Check, Search, X } from "lucide-react";
import { formatMoneyCents } from "./playerFlow.js";
import { availableFilters, filterGroups, ownStringTier, pickSummary, searchGroups, stringGroups } from "./stringPicker.js";
import "./RestringStringPicker.css";

const sameTier = (left, right) => Number(left) === Number(right);

/**
 * "I know what I want" (VITE_RESTRING_V2): Bring my own string first, a search box, the shop's
 * strings by category with a chip per type, and a sticky bar with the pick, its price and Continue. `catalog` is
 * the shop's whole in-stock list; `initialPick` restores a pick when coming back.
 */
export default function RestringStringPicker({ tiers, catalog, vendor, initialPick = null, racketLabel = "", onContinue }) {
  const [filter, setFilter] = useState("all");
  const [pick, setPick] = useState(initialPick);
  const [query, setQuery] = useState("");
  const groups = stringGroups(tiers, catalog);
  const searching = query.trim().length > 0;
  // A search looks through every string, whichever chip is on.
  const shown = searching ? searchGroups(groups, query) : filterGroups(groups, filter);
  const ownTier = ownStringTier(tiers);
  const summary = pickSummary(pick, groups, tiers);

  const isPicked = (candidate) =>
    Boolean(pick) &&
    pick.kind === candidate.kind &&
    sameTier(pick.tierId, candidate.tierId) &&
    (candidate.kind !== "string" || String(pick.stringId) === String(candidate.stringId));

  return (
    <div className="rsp">
      <header className="rsp-title">
        {racketLabel ? <span className="rsp-racket">{racketLabel}</span> : null}
        <h1>Pick your string</h1>
        <p>{vendor?.name ? `In stock at ${vendor.name}. Price includes stringing.` : "Price includes stringing."}</p>
      </header>

      {ownTier ? (
        <section className="rsp-group" aria-label="Bring my own string">
          <PickRow
            title="Bring my own string"
            detail={`You supply it; you pay for stringing only · ${formatMoneyCents(ownTier.price_cents)}`}
            picked={isPicked({ kind: "own", tierId: ownTier.id })}
            onPick={() => setPick({ kind: "own", tierId: ownTier.id })}
          />
        </section>
      ) : null}

      <label className="rsp-search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search strings, e.g. RPM Blast"
          aria-label="Search strings"
          autoComplete="off"
          enterKeyHint="search"
        />
        {searching ? (
          <button type="button" className="rsp-search__clear" aria-label="Clear search" onClick={() => setQuery("")}>
            <X size={16} />
          </button>
        ) : null}
      </label>

      {searching ? null : (
      <div className="rsp-chips" role="group" aria-label="String type">
        {availableFilters(groups).map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={`rsp-chip ${filter === chip.key ? "is-active" : ""}`}
            aria-pressed={filter === chip.key}
            onClick={() => setFilter(chip.key)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      )}

      {searching && shown.length === 0 ? (
        <p className="rsp-empty">
          No strings here match “{query.trim()}”.{ownTier ? " Bring your own and pay for stringing only." : ""}
        </p>
      ) : null}
      {!searching && shown.length === 0 && !ownTier ? <p className="rsp-empty">No strings in stock here right now.</p> : null}

      {shown.map((group) => (
        <section key={group.key} className="rsp-group" aria-label={group.label}>
          <header className="rsp-group__head">
            <div>
              <h2>{group.label}</h2>
              {group.blurb ? <p>{group.blurb}</p> : null}
            </div>
            <strong>{group.varies ? `from ${formatMoneyCents(group.priceCents)}` : formatMoneyCents(group.priceCents)}</strong>
          </header>
          {group.kind === "preset" ? (
            <PickRow
              title="Shop’s choice"
              detail={`${vendor?.name || "Your stringer"} picks the ${group.label.toLowerCase()} setup`}
              picked={isPicked({ kind: "preset", tierId: group.tierId })}
              onPick={() => setPick({ kind: "preset", tierId: group.tierId })}
            />
          ) : (
            group.strings.map((string) => (
              <PickRow
                key={string.id}
                title={`${string.brand} ${string.name}`.trim()}
                detail={[
                  group.varies ? formatMoneyCents(string.priceCents) : "",
                  Array.isArray(string.gauges_stocked) && string.gauges_stocked.length ? `Gauges ${string.gauges_stocked.join(", ")}` : "",
                ].filter(Boolean).join(" · ")}
                picked={isPicked({ kind: "string", tierId: group.tierId, stringId: string.id })}
                onPick={() => setPick({ kind: "string", tierId: group.tierId, stringId: String(string.id) })}
              />
            ))
          )}
        </section>
      ))}


      <div className="rsp-bar">
        <div className="rsp-bar__pick">
          <span>{summary ? summary.title : "Pick a string"}</span>
          {summary ? <strong>{formatMoneyCents(summary.priceCents)}</strong> : null}
        </div>
        <button type="button" className="rsp-bar__btn" disabled={!summary} onClick={() => onContinue(pick)}>
          Continue
        </button>
      </div>
    </div>
  );
}

function PickRow({ title, detail, picked, onPick }) {
  return (
    <button type="button" className={`rsp-row ${picked ? "is-picked" : ""}`} aria-pressed={picked} onClick={onPick}>
      <span className="rsp-row__text">
        <b>{title}</b>
        {detail ? <small>{detail}</small> : null}
      </span>
      <span className="rsp-row__mark" aria-hidden="true">{picked ? <Check size={16} /> : null}</span>
    </button>
  );
}
