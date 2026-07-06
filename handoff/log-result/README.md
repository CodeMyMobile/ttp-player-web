# Log a Result — module

The result-entry flow, split into one concern per file. Mount `LogResultPage` on a route.
Currently driven entirely by **stub data** so it renders before the backend exists.

## Files

```
scoring.js          Pure logic — date helpers, set validation, winner derivation,
                    and buildSubmitPayload() (the POST body, no React). Unit-test this.
fixtures.js         Fake players / courts / current user. All fake — Sahil replaces.
data.js             Stub hooks (useCurrentUser/usePlayers/useCourts). The swap-to-real seam.
ui.jsx              Shared primitives (Avatar, Chip, PrimaryButton…). Swap for the app's
                    design-system components where they exist.
Shell.jsx           Responsive app frame: header + centred column + sticky safe-area footer.
MatchTypeToggle.jsx Casual / League (League disabled — Phase 1.1).
PlayerPicker.jsx    You vs opponent; registered-players-only searchable picker.
WhenWhere.jsx       Date (defaults to today) + required court picker.
Scoreboard.jsx      ScoreSection (editable), ReadBoard (review), ScoreCell, ResultPill.
ReviewCard.jsx      The confirm step before sending.
SentCard.jsx        Success state with the pending card.
LogResultPage.jsx   Orchestrator — state, set controls, form/review/sent steps, submit.
index.js            Barrel export.
```

## Integration notes

- **JS today.** If the repo is TypeScript, rename `.js`/`.jsx` → `.ts`/`.tsx` and add types
  (start with `scoring.js`, which has the data shapes).
- **Stub data only.** Gate the page behind a flag / non-public route so fixtures can't reach
  real users. `submit()` does **not** call an API — it `console.log`s the payload and shows
  the sent state. Replace `data.js` and `submit()` when the endpoints exist.
- **Submit contract** lives in `scoring.js` → `buildSubmitPayload`. It matches the Match model
  in the league brief. Two things for Sahil (also in code comments): `venue_id` is a **new
  required field** on Match; a match-tiebreak decider stores as **1-0 games** for the rating
  engine (points kept for display only).
- **Out of scope here:** the opponent's confirmation landing screen, real SMS/Twilio, ELO,
  standings, and off-list ("Other") courts.
