# Claude Code Brief — Log a Result page (frontend only)

**Goal:** build the "Log a result" page into the app as a **visually complete, fully interactive page driven by stubbed data**, so Sahil (and anyone else) can click through the whole flow before the backend exists. No real API calls this PR — every backend touchpoint is a clearly-marked stub with the expected shape.

**Design source of truth:** the prototype `LogResult.jsx` (drop it in the repo as reference). It's a single self-contained file using raw Tailwind that maps to our tokens (`violet-600` = `#7C3AED`, `violet-500` = `#8B5CF6`, slate neutrals, amber for pending, lime logo). Reproduce its look and behaviour exactly — it's already been signed off.

---

## How to work this

- **Plan mode first.** Show the plan and the file list before writing anything.
- **One small PR.** Page + fixtures + stubbed submit. Nothing backend.
- **Investigate before building** — see Step 1. Match what's already there; don't reinvent primitives the app already has.
- **Visual validation before shipping** — run it, click through form → review → sent on a phone width and a desktop width, confirm it matches the prototype.

---

## Step 1 — Investigate the existing app first

Before porting anything, find and reuse our conventions. Report what you found, then build against it:

1. **Routing** — how pages mount, and where this one should live. Add a route reachable from the existing "+ New match" / result entry point (don't invent a new nav pattern).
2. **Shared primitives** — do we already have `Button`, `Avatar`, `Card`, `Input`, `BottomBar`, segmented control, etc.? If so, the prototype's inline versions get swapped for ours. Keep the prototype's *visual result* identical, but use our components.
3. **Design tokens** — if colours/spacing/typography are tokenised (Tailwind config or CSS vars), use the tokens, not raw hex/util classes, wherever the app already does.
4. **Data layer** — how does the app fetch (React Query / SWR / plain hooks)? Mirror that pattern for the stubs so the swap to real endpoints later is a one-file change.
5. **Current user** — how do we already get the signed-in player (the `ME` in the prototype)? Wire that in for real if it's available client-side; otherwise stub it too.

If any of these don't exist yet, say so and stub minimally rather than guessing.

---

## Step 2 — Port the page

Reproduce the prototype, reconciled to the app's primitives and tokens. Keep all of its behaviour:

- Casual match type (League present but disabled).
- Opponent picker — **registered players only**, searchable, no free text.
- When & where — date defaults to **today** (local, not UTC) with Today/Yesterday chips + native date input capped at today; **court is required**, searchable picker.
- Score — 1 set / Best of 3, add deciding set, full-set vs **match-tiebreak** decider, optional 7-6 tiebreak points, retirement/walkover, live set validation and winner derivation.
- Flow: **form → review → sent**, sticky bottom action bar, mobile-first responsive (base mobile, centred `max-w-lg` from `sm:`, `env(safe-area-inset-bottom)` on the footer, 16px inputs on mobile dropping to 14px from `sm:`).

Suggested split (adapt to our structure): `LogResultPage` (route + step state) → `MatchTypeToggle`, `PlayerPicker`, `WhenWhere`, `Scoreboard` (+ `ScoreCell`), `ReviewCard`, `SentCard`, plus a `scoring.ts` for the pure helpers (`setStatus`, `cellState`, `fmtSet`, format/winner logic) so they're unit-testable and shared with the backend contract later.

---

## Step 3 — Stubbed data + submit contract

**This is the important part: nothing fake may read as real.**

- Put all stub data in one obvious module, e.g. `fixtures/logResult.fixtures.ts`, exported behind the same hook shape the real data will use (`usePlayers()`, `useCourts()`, `useCurrentUser()`). A `// TODO(Sahil): replace with real endpoint` on each.
- Gate the page behind a flag / non-public route so the fixture version can't reach real users. Confirm how we already do feature flags and use that.
- The submit handler does **not** call an API. It advances to the sent state locally and `console.log`s the payload it *would* POST, shaped to match the Match model in the league brief so Sahil can build straight against it:

```ts
// TODO(Sahil): POST /matches  → { match_id, status: "pending", confirm_window_ends_at }
{
  context: "casual",
  reported_by: currentUserId,        // player_a is the current user
  player_b: opponentId,
  played_at: "2026-06-20",           // the chosen date (local yyyy-mm-dd)
  venue_id: courtId,                 // REQUIRED — new field on Match, FK to courts
  format: "single" | "bo3",
  retired: false,                    // or { winner: "you" | "opp" } for retirement/walkover
  sets: [                            // omitted when retired; player_a (you) first
    { kind: "set", you: 6, opp: 4 },
    { kind: "set", you: 3, opp: 6 },
    { kind: "mtb",  you: 10, opp: 7 },          // match-tiebreak decider
  ],
  score_string: "6-4 3-6 [10-7]",    // canonical display string, player_a first
}
```

Note for Sahil (carry as a code comment): `venue_id` is a **new required field** on Match not yet in the brief's model; the match-tiebreak decider stores as **1-0 games** for the rating engine per `margin_config`, with the points kept only for display.

---

## Out of scope (do not build)

- Any real API, auth-beyond-current-user, SMS/Twilio, the ELO engine, standings.
- The opponent's **confirmation landing screen** (separate next piece).
- Off-list courts / "add a court on the fly" — courts come from the fixture list only for now; an "Other / not listed" fallback is a later decision.

---

## Done = 

The page renders from fixtures, the full form → review → sent flow works on mobile and desktop matching the prototype, the would-be POST payload logs in the correct shape, and every backend seam is a labelled stub. Sahil can open the page, click through it, and read the payload contract from the code.
