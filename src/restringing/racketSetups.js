import { buildCheckoutItems } from "./playerFlow.js";

// An order of two or more rackets, string first (VITE_RESTRING_V2): one setup per racket,
// each saved from the string setup screen. A setup holds what the screen had (to load it
// back), `input` (that racket's order item, as buildCheckoutItems takes it), `price`
// (restringUnitPrice), `label` and `stringLabel` for the summary, and the racket's own
// `racketMakeModel` and `note`.

const clean = (value) => String(value ?? "").trim();

/** "Same string on all": the one setup on every racket, keeping each racket's make, model and note. */
export function sameSetupForAll(setup, count, previous = []) {
  return Array.from({ length: Math.max(1, Number(count) || 1) }, (_, index) => ({
    ...setup,
    racketMakeModel: previous[index]?.racketMakeModel || "",
    note: previous[index]?.note || "",
  }));
}

/** "Different strings": racket `index` gets `setup`, keeping its make, model and note. */
export function withRacketSetup(setups, index, setup) {
  const next = [...setups];
  next[index] = { ...setup, racketMakeModel: setups[index]?.racketMakeModel || "", note: setups[index]?.note || "" };
  return next;
}

/** Each racket's make, model or note changed. */
export function withRacketDetails(setups, index, changes) {
  return setups.map((setup, rowIndex) => (rowIndex === index ? { ...setup, ...changes } : setup));
}

/** Every racket has its setup and a make and model. */
export function racketSetupsComplete(setups, count) {
  return Array.isArray(setups) && setups.length === Number(count) && setups.every((setup) => setup?.input && clean(setup.racketMakeModel));
}

/** One order item per racket, each with its own service and string; the order's notes on each. */
export function racketSetupsItems(setups, orderNotes = "") {
  return (Array.isArray(setups) ? setups : []).map((setup) => buildCheckoutItems({
    ...setup.input,
    racketMakeModel: setup.racketMakeModel,
    orderNotes: [clean(setup.note), clean(orderNotes)].filter(Boolean).join(" · ") || null,
    quantity: 1,
  })[0]);
}

/** The string line at checkout: the one string when every racket has it, else "Strings". */
export function racketSetupsStringLabel(setups) {
  const labels = [...new Set((Array.isArray(setups) ? setups : []).map((setup) => setup.stringLabel))];
  return labels.length === 1 ? labels[0] : "Strings";
}
