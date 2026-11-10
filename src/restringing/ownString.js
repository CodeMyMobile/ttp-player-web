// A player's own string, named from the whole catalog where it's in there, so ratings and
// recommendations know what went in the racket (the vendor app does the same:
// tennis-garage-vendor src/stringChoice.ts). The shop's stock comes first: players often
// bring a reel of something the shop sells.

const ownStringName = (string) => `${string.brand || ""} ${string.name || ""}`.trim();
const squash = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
// A gauge typed after the name: 16, 17, 16L, 1.25, 1,30 mm.
const GAUGE_TAIL = /^(?:\d{2}l?|1[.,]\d{2}(?:\s?mm)?)$/;

/**
 * Catalog strings for what's typed so far, best first: every word typed appears somewhere in
 * the brand and name ("hyp", "alu pow", "solinco hyper"), a gauge left out. The shop's stock
 * first, then names with a word starting with what was typed first, then A to Z.
 * Each is { id, name, inStock }.
 */
export function searchOwnStrings(text, catalog, limit = 8) {
  const words = squash(text).split(" ").filter((word) => word && word !== "mm" && !GAUGE_TAIL.test(word));
  if (!words.length) return [];
  const startsWithFirst = (key) => key.split(/[\s-]/).some((part) => part.startsWith(words[0]));
  return (Array.isArray(catalog) ? catalog : [])
    .map((string) => ({ string, name: ownStringName(string), key: squash(ownStringName(string)) }))
    .filter((row) => words.every((word) => row.key.includes(word)))
    .sort((left, right) =>
      Number(Boolean(right.string.in_stock)) - Number(Boolean(left.string.in_stock))
      || Number(startsWithFirst(right.key)) - Number(startsWithFirst(left.key))
      || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((row) => ({ id: String(row.string.id), name: row.name, inStock: Boolean(row.string.in_stock) }));
}

/** The catalog string the own-string box names, if any: its brand and name, maybe with a gauge after. */
export function matchOwnString(text, catalog) {
  const typed = squash(text);
  if (!typed) return undefined;
  return (Array.isArray(catalog) ? catalog : [])
    .filter((string) => {
      const name = squash(ownStringName(string));
      if (typed === name) return true;
      return typed.startsWith(`${name} `) && GAUGE_TAIL.test(typed.slice(name.length + 1));
    })
    .sort((left, right) => ownStringName(right).length - ownStringName(left).length)[0];
}

/** The search's results to show: none once a result was picked and left as picked. */
export function ownStringResults(text, stringId, catalog) {
  return searchOwnStrings(text, catalog)
    .filter((result) => !(result.id === String(stringId || "") && result.name === String(text || "").trim()));
}

/** The line under the box: found in the catalog, or not (which is fine). */
export function ownStringHint(text, stringId, catalog) {
  if (stringId) {
    const string = (Array.isArray(catalog) ? catalog : []).find((row) => String(row.id) === String(stringId));
    return string?.in_stock ? "Found it. This shop stocks it too." : "Found it in our string list.";
  }
  return String(text || "").trim() ? "Not in our list: pick one from the list if it's there, or we'll note it as typed." : "";
}
