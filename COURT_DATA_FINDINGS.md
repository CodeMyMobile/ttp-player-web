# Court data investigation — findings

Read-only. No code changed, no live authed calls issued. Court/location capture, persistence, and
per-player readability, to decide whether a player's home courts are derivable from match history
rather than a new signup field. Where the code can't answer, the answer is **UNKNOWN — needs Sahil**.

---

## Verdict

**DERIVABLE AFTER BACKEND AGGREGATION — and even then, weak.**

A court *is* captured per match and *does* persist and read back — but as a **free-text label
(`location_text`) plus a raw `latitude`/`longitude` pair, with no stable venue id**, so there is
nothing to group "Cheviot Hills" / "cheviot hills rec center" / "Cheviot Hills Park" by except
coordinate clustering or fuzzy string matching (Q1, Q5, Q7, Q10). More decisively, **there is no
working endpoint that returns an arbitrary player's match history**: the only per-player path
(`GET /matches?created_by={id}`) is, by the frontend's own comment, **ignored by the backend today**,
so the app scopes client-side and can only surface matches the profile owner *hosts* and that are
*upcoming* — never their past matches, never matches they merely joined (Q6, `PlayerProfilePage.tsx:434-436`).
So deriving home courts per player needs the backend to (a) expose a real per-player match-history
query and (b) aggregate/normalise the free-text+coords into venues. Two caveats keep this from being a
strong source even then: the field degrades silently to a label with **null coordinates** on the
challenge path when Google autocomplete fails (Q3), and real coverage of court values in casual matches
is **UNKNOWN** — it's auth-gated and was not sampled under the read-only constraint (Q9). A separate,
already-present signal exists that sidesteps match history entirely: a self-declared **"Preferred
courts"** profile field (`favoriteCourt` / `localCourts` / `playerCourtLocations`), whose provenance is
UNKNOWN (Q8).

---

## Findings

### A. What is captured

**1. What the court input produces + payload shape.** A **plain-text label + separate lat/lng** — NOT a
Google `place_id`, NOT an internal venue id. In `ChallengeComposer.jsx`, `LocationPicker`'s
`onSave({ label, latitude, longitude })` sets `location`/`latitude`/`longitude`
(`src/play-dates/components/ChallengeComposer.jsx:49-51, 84-91`). These go into the `card`
(`:136-148`) → `buildMatchPayloadFromCard` (`src/play-dates/utils/buildMatchPayload.js:95-124`) →
`buildMatchPayload` (`:36-79`), which emits:
```
location_text: card.location,        // string label
latitude:      card.latitude ?? undefined,   // number | undefined
longitude:     card.longitude ?? undefined,  // number | undefined
```
sent to `createMatch` → `POST /matches` (`src/play-dates/services/matches.js:34`). So the persisted
court is `{ location_text: string, latitude?: number, longitude?: number }`. **UNKNOWN — needs Sahil:**
what the backend does with the triple (store as-is? reverse-geocode? dedupe to a venue?).

**2. Required or optional.** In **ChallengeComposer, required — but only the label**: validation is
`if (!location) { setError("Pick a court."); return; }` (`ChallengeComposer.jsx:125-127`). It does
**not** require `latitude`/`longitude`, so a match can be created with a label and **null coords** (see
Q3). The multi-match flow is stricter — it requires coords (`geoOk`, `MultiMatchCreatorFlow.jsx:386-406`).

**3. Google Places wiring + failure path.** Uses the `react-google-autocomplete` `Autocomplete`
component (`package.json` `react-google-autocomplete ^2.7.5`), configured with `apiKey` and
`options.fields: ["formatted_address","geometry","name"]` (`LocationPicker.jsx:51-60`;
`PostAvailabilityPage.tsx:254-277`). That wrapper drives the **classic/legacy Places Autocomplete
widget** (the `AutocompleteService`/`PlacesService` stack — the one failing `REQUEST_DENIED` on our
key); there is **no** use of Places API (New) `AutocompleteSuggestion.fetchAutocompleteSuggestions`
anywhere. **No explicit error handler** for `REQUEST_DENIED` exists. Failure path (from the code
structure, so partly UNKNOWN at runtime): predictions silently return nothing, the text input still
accepts free typing, but `onPlaceSelected` never fires so **`latitude`/`longitude` stay null**.
Consequence differs by flow: **ChallengeComposer will still submit** (it only checks the label) →
persists a court label with **no coordinates**, degrading the one stable grouping signal;
**MultiMatchCreatorFlow blocks** with "Pick a location from the dropdown so we can map it"
(`MultiMatchCreatorFlow.jsx:400`).

**4. Other match-creation paths.** All use the same label+lat/lng shape:
- **MultiMatchCreatorFlow** (`src/play-dates/components/MultiMatchCreatorFlow.jsx:89-101`) → same
  `location_text`+lat/lng via `buildMatchPayloadFromCard`; coords required.
- **MatchCreatorFlow (legacy single)** (`src/play-dates/components/MatchCreatorFlow.jsx:85-87, 821-823`)
  → `location_text` + lat/lng.
- **PostAvailabilityPage (league match-needs)** (`src/pages/PostAvailabilityPage.tsx:14-23, 141-165`;
  `src/api/leagues.ts:410-420`) → per-slot `{ location, latitude?, longitude?, timezone? }` (note the
  key is **`location`**, not `location_text`). **On the "multiple locations per record" claim:** it is
  **not** one record with a location array — each availability slot is a **separate** match-need POST,
  each carrying a single location. So "multiple options" = multiple single-location records, not an
  array field.

### B. What is persisted and readable

**5. Court on read-back.** **Not dropped — but not a single canonical field.** The normalizer
`deriveLocationLabel` (`src/api/matches.ts:791-820`) coalesces a long alias list —
`location`, `location_text`, `court`, `court_name`, `venue`, `venue_name`, `club`, `club_name`,
`location_name`, `place`, `title`, `label` (+ nested) — into `NormalizedMatch.location: string`
(`src/api/matches.ts:25-45`), plus `locationDetail?: string` and a `distance` label. Raw `latitude`/
`longitude` are **not** on the typed `NormalizedMatch` but are retained in `NormalizedMatch.raw`
(`:45`), reachable as `match.raw.latitude`. So on read you reliably get a **location string**; coords
survive only inside `raw`. Which exact field the backend actually returns is **UNKNOWN** (the alias
fan-out exists precisely because it's not pinned down).

**6. Per-player match history (the decisive question).** **No working server-side per-player history.**
The one per-player path is `listMatches(..., { created_by: id, when: "upcoming" })` →
`GET /matches?created_by={id}` (`src/pages/PlayerProfilePage.tsx:230-238`, import from
`src/play-dates/services/matches.js:15`/`:286`). But the frontend states the backend **ignores**
`created_by`: *"the feed guard — the backend currently ignores created_by, so we scope client-side and
drop anything we can't attribute to the owner"* (`PlayerProfilePage.tsx:434-436`), filtering to
`getMatchHostId(match) === id` (`:441`). Two hard limits even as intended: it requests
`when: "upcoming"` (**no past matches**) and filters on **host** id (**only matches they created**, not
joined). Other per-player endpoints: `GET /players/{playerId}/played-with`
(`src/api/playerHistory.ts:7-16`) returns a *players* network (no court data), and
`/public/players/{userId}` can include a `matches` array (`PlayerProfilePage.tsx:409`) — same
upcoming/host-scoped shape. **Conclusion: there is no endpoint that returns an arbitrary player's
completed match history today.**

**7. Existing venue/court table.** **None — court is free-form.** No `/courts`, `/venues`, or
`/locations` list endpoint. The only "our own" location store is client-side **recent locations** in
`localStorage` (key `matchCreator.recentLocations`, max 5, shape `{ label, latitude, longitude }`) —
`src/play-dates/utils/recentLocations.js:1-94` — ephemeral, per-device, not synced. `src/api/locations.ts`
offers only `getReverseCodeLocation(lat, lng)` (coords → name), not a managed venue list.

**8. Existing "plays at" aggregation.** **Yes, but self-declared, not match-derived.** The player
profile renders a **"Preferred courts"** section from `player.favoriteCourt` (`PlayerProfilePage.tsx:529`),
`player.localCourts`, and `player.raw.playerCourtLocations` (`:526-528`, displayed `:643, 912-924`) —
sourced from the **player profile payload**, not computed from matches. **No** code scans match history
to derive frequent courts; the "Open match play" section just lists upcoming matches with a per-match
`location`. **UNKNOWN — needs Sahil:** whether `playerCourtLocations`/`localCourts`/`favoriteCourt` are
user-entered or backend-derived, and their fill rate.

### C. Quality and coverage

**9. Real court values + coverage.** **UNKNOWN — not sampled.** Real casual-match court values live only
in auth-gated `/matches` responses; per the read-only/no-live-call constraint and lacking the viewer's
token, none was fetched, so I cannot report real coverage or paste real values. The only court strings
in the repo are **hardcoded mock data** (see Data samples) — indicative of the intended *shape*
(free-text venue labels, some with a "· Court N" suffix) but **not** evidence of real coverage or
normalisation. (Adjacent signal, different dataset: the public `/match-results/rankings` response I do
have shows ~95% of ranked players with `matches_played: 0` — but that counts *rating/league* matches,
not casual `/matches`, so it does not directly measure casual-court coverage.)

**10. Is the data normalised?** **No.** The persisted court is a free-text `location_text` label with no
stable identifier (Q1), and read-back coalesces a dozen alias field names into a plain string (Q5).
There is no venue id anywhere (Q7). So "Cheviot Hills", "cheviot hills rec center", and "Cheviot Hills
Park" would be **distinct strings** with nothing to group them — the only stable grouping signal is the
`latitude`/`longitude` pair (in `raw`), and only when it's present (it can be null on the challenge
path, Q3). Grouping by court therefore requires **coordinate clustering or fuzzy string matching**, not
a simple GROUP BY.

**11. Other location signals on the record.** Beyond the label: **`latitude`/`longitude`** (kept in
`NormalizedMatch.raw`, `src/api/matches.ts:45`); a derived **`distance`** label
(`distance_label`/`distance_miles`/…, `:1330-1338`); **city/state/region** extracted from nested
location objects when present (`:821-850`); **address detail** (`address`, `formatted_address`,
`street_address`, …, `:743-754, 858-879`); league match-needs also carry a **`timezone`**
(`src/api/leagues.ts:410-420`). **Postcode:** not extracted. **Match-record timezone:** UNKNOWN (not
found in match normalisation).

---

## Data samples

No **real** match court values could be captured (Q9 — auth-gated, not fetched under the read-only
constraint). The only court/location strings present in the repo are **mock/fixture data**, shown here
verbatim purely to illustrate the expected *shape* (they are fabricated, not production values):

```
src/data/mockMatches.ts
  location: "Griffin Club Los Angeles"
  location: "Franklin Canyon Courts"
  location: "Echo Park Tennis Center"

src/data/mockCoaches.ts
  location: "Vista Courts"
  courts:   ["Greenwich Tennis Center", "Harbor Indoor Courts"]
  court:    "Greenwich Tennis Center · Court 4"
  courts:   ["Vista Courts", "North Ridge Tennis Park"]
  court:    "Vista Courts · Court 2"
  courts:   ["Carlsbad Tennis Club"]
  court:    "Carlsbad Tennis Club · Stadium Court"
  courts:   ["Exchange Tennis Centre", "Lakeside Racquet Club"]
  court:    "Exchange Tennis Centre · Court 7"

src/data/mockGroupLessons.ts
  locationName: "Greenwich Tennis Center · Court 4"
  locationName: "Vista Courts · Court 2"
  locationName: "Lakeview Park Courts"
```
Shape read from these: free-text venue names, human-formatted, sometimes with a "· Court N" suffix, and
no accompanying identifier — consistent with the free-text `location_text` capture in Q1. Whether real
data looks like this, and how consistently it's filled, is **UNKNOWN**.

---

## Open questions for Sahil

1. **Per-player match history:** Is there (or can there be) an endpoint that returns a *specific*
   player's matches — including **completed** matches and matches they **joined** (not only hosted,
   upcoming) — and does the backend intend to honor `created_by` (today the FE says it's ignored)?
2. **What is stored for a court:** Does `POST /matches` persist `location_text` + `latitude` +
   `longitude` as-is, or resolve them to a normalized/deduped venue? Is any place identifier stored?
3. **Coverage:** Across real casual `/matches`, what fraction carry a non-empty `location_text`, and how
   many carry non-null `latitude`/`longitude` (vs the null-coords case when autocomplete fails)?
4. **Profile "preferred courts":** Are `playerCourtLocations` / `localCourts` / `favoriteCourt`
   user-entered or backend-derived, and what is their fill rate across the player base?
5. **Normalisation:** Is there any server-side venue normalisation/geocoding that could group free-text
   court labels (or their coordinates) into stable venues for aggregation?
