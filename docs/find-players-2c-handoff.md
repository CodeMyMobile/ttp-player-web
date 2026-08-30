# Find Players 2C — handoff

Written 30 Aug 2026, at the end of the session that built 2C. Everything below is
verified unless it says otherwise.

## Where things are

**`main`** carries 2A (correctness fixes, level scoping, analytics baseline), the
white-screen fix, the type-check gate, the route smoke test, and the PostHog provider.

**`feat/find-players-2c`** — 8 commits, not merged, deliberately.

```
c2a7753 fix(players): quieten the stamp, one green, no repeated count, no title block
bd68ac4 feat(players): two explainer sheets, on one extracted shell
2871dc6 feat(players): rank the results and stamp them only when the claim is true
03b1fba feat(players): delete the viewer's profile row, move the entry into the sheet
d028450 feat(players): filter sheet, chip row, and the above-the-fold rebuild
7a29e84 fix(players): hedge the verdict unless BOTH ratings are confirmed
2acd3a6 feat(players): rebuild the player card to explain the match
752788c feat(players): warm neutral palette for Find Players
```

**`feat/seo-noindex`** — pushed, no PR, blocked on a Search Console check.

## The plan it is waiting on

2C is held back for a **baseline week**, not because it is unfinished. The analytics
events shipped with 2A and fire on the *current* page, so a baseline collects whether or
not 2C merges — which is what made a feature flag unnecessary rather than merely
expensive. Merge 2C after the baseline, hot.

**The baseline is inert until `VITE_POSTHOG_KEY` is set in Netlify's build environment.**
Nothing is being recorded until someone does that. `VITE_POSTHOG_HOST` defaults to
`https://us.i.posthog.com`.

Three standing jobs during the week:

1. **Rebase `feat/find-players-2c` onto main daily.** Main moved nine commits in one
   afternoon. The type-check gate and smoke test make each rebase verifiable now; the
   rebases so far have all conflicted the same way, because the white-screen fix
   reordered `FindPlayersPage.tsx` — keep main's ordering and take only genuinely new
   declarations.
2. **Check event volume after two or three days, not at the end.** With 191 players the
   weekly numbers may be too small to prove anything. If so, say so and ship — a thin
   baseline honestly labelled beats a week that ends in a shrug. A full seven days is the
   minimum shape, since weekday and weekend traffic differ.
3. **Redo the privacy audit against a real project key.** See below.

## Verification, and how to repeat it

```
npm run typecheck                                    # gate: new errors only
npm test                                             # 543 tests
npm run smoke -- http://localhost:5173               # 7 routes mount
node scripts/smoke-routes.mjs http://localhost:5173 --measure   # fold, signed-in
```

**Signed-in states only work against localhost:5173.** Google Sign-In allows
`app.thetennisplan.com` and `localhost:5173` as origins, and no deploy-preview hostname
will ever be on that list — so a preview can only show the signed-out projection, which
is not the state the stamp, ranking or curated header live in.

The six-case capture script is at
`scratchpad/review/cases.mjs` in the session scratchpad; it must be run from the repo
root so `playwright-core` resolves.

### The six cases, as of c2a7753

| case | cards | chrome | stamp | topPick | prompt | chips | strip |
|---|---|---|---|---|---|---|---|
| member / curated | 12 | 263 | yes | yes | — | 0 | yes |
| member / filtered | 6 | 262 | — | — | — | 1 | yes |
| no_level / curated | 12 | 330 | — | — | yes | 0 | — |
| no_level / filtered | 6 | 377 | — | — | yes | 1 | — |
| signed_out / curated | 12 | 330 | — | — | yes | 0 | — |
| signed_out / filtered | 6 | 377 | — | — | yes | 1 | — |

Chrome above the first card went 956 → 263 for a member. The stamp appears in exactly
one case; the top-card flag never appears without it; the tick strip stands down whenever
the prompt header shows.

## Open, in priority order

1. **Hedged vs plain verdicts have never been compared.** `viewerConfirmed` needs an
   authenticated id, so every fixture verdict is hedged and no plain chip has been seen.
   Check on the deploy with a signed-in account: "A step up" and "Likely a step up" must
   be distinguishable at a glance, or the dashed border needs more contrast.
2. **The privacy audit is not complete.** The static call-site audit passes and the
   PostHog init options are asserted by test, but the live round trip is unverified — the
   SDK will not transmit against a stubbed `/flags` endpoint. When redoing it with a real
   key: **decode the base64 `data=` payload before inspecting it.** The first version of
   that probe scanned ciphertext for player names and reported "no leaks" for a body it
   could not read.
3. **Thin-result widening is stubbed**, pending the level distribution. The console
   snippet for collecting it is in the conversation; it needs a signed-in session because
   `/surveys/questions` sits behind the packages-router guard.
4. **The stamp text wraps to two lines** at 390px, because "Why these?" sits beside it.
   Cosmetic, not chased.

## Things that will bite

- **No TypeScript compiler ran here until 30 Aug.** `tsc` is gated on *new* errors only;
  185 pre-existing ones are baselined in `scripts/typecheck-baseline.json`. Regenerate
  with `npm run typecheck:baseline` only after deliberately fixing errors — if the file
  grows in a diff, that is the review question.
- **Do not clean up type errors in time or booking files.** `activityFeed.js`,
  `floatingTime*`, `useHomeStatus*`, `BookingConfirmationPage.tsx`,
  `GroupLessonDetailsPage.tsx`, `playerLessons.ts`. They were fixed deliberately against
  subtle timezone behaviour. They are baselined, not exempted, so a *new* error in them
  still blocks.
- **`tsconfig.json` must not exist at the repo root.** `tsx` reads it at runtime and it
  remapped `leagueSeason.test.js` to `leagueSeason.test.ts`, running one twice and the
  other never — silently dropping 10 tests. The type-check config is
  `tsconfig.typecheck.json` for that reason.
- **Never trust a harness number for the fold.** Three separate harness measurements
  flattered the real page, the last by omitting the 44px title block. Use
  `--measure` against a real page.
- **Component render harnesses do not catch a blank page.** `/find-players` was down in
  production for 106 minutes with the build, 479 tests and the linter all green. That is
  what the smoke test exists for.

## Backend items raised and not yet done

- `/player/verification-level` returns `level: 'Verified'` for **every** user — a stub.
  Write-up: <https://claude.ai/code/artifact/287cc6eb-7e53-4b8e-9e35-e8e35a3a668e>
- The packages router's bare `router.use(verify)` blocks the public player-discovery
  endpoint, so signed-out Find Players 403s. Plus a `perPage` asymmetry and a `venue_name`
  column. <https://claude.ai/code/artifact/d28e34d8-18b3-442f-9431-a600af64fbf1>
- Group-lesson credit refunds silently fail on cancellation.
  <https://claude.ai/code/artifact/5725c731-af4e-4462-9e78-a58c5b89b80e>
- Coach restringing gaps. <https://claude.ai/code/artifact/95cb848a-2b94-4496-b5f4-098b915d923e>
- `GroupLessonDetailsPage` references `lessonStartMoment`, declared nowhere — the
  cancel-success screen throws. Found by the type-check gate on its first run; baselined
  rather than fixed, because it is in a time-sensitive file.
- `LeagueJoinReviewSheet` has focus-on-open, Escape and focus-restore but **no focus trap
  and no scroll lock** — a live accessibility gap in league join.

## Reference

- Brief: `docs/findplayersmobilebrief.md` — where it and the prototype disagree, the brief
  wins.
- Prototype: `docs/find-players-prototype.html`.
- Its accent is `#6D3BEE`; the brand pair `#8B5CF6` / `#7C3AED` is used instead, split by
  role — fills only and text only. `#8B5CF6` is 3.76:1 on the warm ground and fails AA for
  normal text. `src/lib/theme.test.ts` asserts that, and asserts the fill purple *fails*,
  because that assertion is the reason the pair exists.
