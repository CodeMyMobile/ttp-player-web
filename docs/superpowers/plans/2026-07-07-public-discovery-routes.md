# Public Discovery Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/find-players`, `/group-lessons`, and `/matches` publicly viewable while keeping all mutating/contact/booking actions behind authentication.

**Architecture:** Frontend route guards become read/action gates instead of page gates. Backend read handlers use optional authentication and redact sensitive fields for anonymous viewers. Existing authenticated behavior remains the default when a valid token is present.

**Tech Stack:** React 19, Vite, React Router, Node `fetch`, Express, Knex, Jest, Node test runner.

## Global Constraints

- Viewing public data should work from promoted links and shared links.
- Taking any action that mutates data, contacts another user, books a lesson, joins a match, creates a match, or manages account state still requires sign-in or sign-up.
- Anonymous list pages should not show "missing auth token" errors.
- Write/action routes remain authenticated.
- Redact phone/email/private profile fields from anonymous list responses.

---

## File Structure

- Modify `/Users/prem/Projects/React/ttp-player-web/src/App.jsx`: remove `ProtectedRoute` wrappers from public discovery list routes and make `/matches` render public-capable match app shell.
- Modify `/Users/prem/Projects/React/ttp-player-web/src/pages/FindPlayersPage.tsx`: allow anonymous list loading; gate connect/share/create actions.
- Modify `/Users/prem/Projects/React/ttp-player-web/src/pages/GroupLessonsPage.tsx`: allow anonymous list loading; gate booking/payment/external click attribution.
- Modify `/Users/prem/Projects/React/ttp-player-web/src/services/matches.js`: allow explicit anonymous read calls when needed.
- Modify `/Users/prem/Projects/React/ttp-player-web/src/api/groupLessons.ts`: support optional token for list calls.
- Modify `/Users/prem/Projects/React/ttp-player-web/src/api/playerHome.ts`: add public player discovery helper.
- Modify `/Users/prem/Projects/Server/ttp-api/routes/matches.js`: replace global route auth with per-route auth; `GET /` and `GET /:id` use `optionalVerify`, writes use `verify`.
- Modify `/Users/prem/Projects/Server/ttp-api/routes/player_survey.js`: add public read-only suggested-player route using same mapper/query with no current user.
- Modify `/Users/prem/Projects/Server/ttp-api/routes/player_lesson.js`: allow public read-only group/external lesson list routes with optional auth.
- Add or update focused tests near touched frontend/backend modules.

### Task 1: Frontend Public Route Access

**Files:**
- Modify: `/Users/prem/Projects/React/ttp-player-web/src/App.jsx`

**Interfaces:**
- Consumes: `ProtectedRoute`, `PlayDatesQueryClientProvider`, `PlayDatesMatchesApp`
- Produces: public route elements for `/find-players`, `/group-lessons`, `/matches`

- [ ] **Step 1: Change `/find-players` route**

Replace:

```jsx
<Route
  path="/find-players"
  element={(
    <ProtectedRoute>
      <FindPlayersPage />
    </ProtectedRoute>
  )}
/>
```

With:

```jsx
<Route
  path="/find-players"
  element={<FindPlayersPage />}
/>
```

- [ ] **Step 2: Change `/group-lessons` route**

Replace:

```jsx
<Route
  path="/group-lessons"
  element={(
    <ProtectedRoute>
      <GroupLessonsPage />
    </ProtectedRoute>
  )}
/>
```

With:

```jsx
<Route
  path="/group-lessons"
  element={<GroupLessonsPage />}
/>
```

- [ ] **Step 3: Make `/matches` shell public-capable**

Refactor `PlayDatesAppRoute` so it no longer wraps the entire page in `ProtectedRoute`. Keep authenticated user data when present, but render `PlayDatesMatchesApp` for anonymous users. Any create/join flow must be gated inside match UI or route-level create pages.

- [ ] **Step 4: Run frontend build**

Run: `npm run build`

Expected: Vite build completes.

### Task 2: Backend Public Matches Feed

**Files:**
- Modify: `/Users/prem/Projects/Server/ttp-api/routes/matches.js`
- Test: `/Users/prem/Projects/Server/ttp-api/__test__/matches_public_routes.test.js`

**Interfaces:**
- Consumes: `middleware.optionalVerify`, `middleware.verify`
- Produces: anonymous `GET /api/matches` with public/open non-hidden response; authenticated match writes unchanged

- [ ] **Step 1: Add regression tests**

Create tests that assert:

```js
await request(server).get("/api/matches").expect(200);
await request(server).post("/api/matches").send({}).expect(403);
```

Also assert anonymous response rows do not contain `phone`, `phone_number`, `email`, or hidden matches.

- [ ] **Step 2: Replace global middleware**

Remove:

```js
router.use(middleware.verify);
```

Add `middleware.verify` to every mutating route: `POST /`, `PUT /:id`, `DELETE /:id`, join/leave/invite/participant/share-link routes that currently rely on global auth.

- [ ] **Step 3: Make `GET /` optional-auth**

Change:

```js
router.get('/', async (req, res) => {
```

To:

```js
router.get('/', middleware.optionalVerify, async (req, res) => {
```

When `!req.user`, force `flt.match_type = 'open'`, `flt.hidden = false`, remove `participant_id`, ignore `filter=my`, ignore `includeHidden`, and compute counts without `req.user.id`.

- [ ] **Step 4: Redact anonymous response**

Before `res.json`, if `!req.user`, map each match to remove phone/email fields from `participants`, `invitees`, nested `profile`, and host/player profiles.

- [ ] **Step 5: Run backend focused tests**

Run: `npx jest __test__/matches_public_routes.test.js --runInBand`

Expected: PASS.

### Task 3: Backend Public Player Discovery

**Files:**
- Modify: `/Users/prem/Projects/Server/ttp-api/routes/player_survey.js`
- Test: `/Users/prem/Projects/Server/ttp-api/__test__/public_players_discovery.test.js`
- Modify: `/Users/prem/Projects/React/ttp-player-web/src/api/playerHome.ts`
- Modify: `/Users/prem/Projects/React/ttp-player-web/src/pages/FindPlayersPage.tsx`

**Interfaces:**
- Produces backend route: `POST /api/player/surveys/suggested/player/public-getchecklocation`
- Produces frontend helper: `getPublicSuggestedPlayerCheckLocation(params): Promise<unknown>`

- [ ] **Step 1: Backend route**

Add a route next to the authenticated suggested-player route. It accepts `position`, `filters`, `search`, `radius`, `page`, `perPage`. It calls `find_in_proximity_players_by_locationids` with `playersID: null` and `currentUserId: null`, then strips `phone`, `email`, `mobile`, `phone_number`.

- [ ] **Step 2: Frontend helper**

In `src/api/playerHome.ts`, add:

```ts
export const getPublicSuggestedPlayerCheckLocation = async ({
  perPage = 20,
  page = 1,
  search = "",
  location,
  radius,
  position,
  filters = {},
  signal,
}: PublicSuggestedPlayersParams) =>
  request<unknown>("/player/surveys/suggested/player/public-getchecklocation", {
    method: "POST",
    signal,
    query: { perPage, page, search, locationSearch: location, radius },
    body: buildBody({ position, filters }),
  });
```

- [ ] **Step 3: FindPlayers anonymous behavior**

In `FindPlayersPage`, if `playerToken` exists keep current `getSuggestedPlayerCheckLocation` call. If no token, call `getPublicSuggestedPlayerCheckLocation`, skip match-profile answered-question request, and set `hasCompletedMatchProfile` false.

- [ ] **Step 4: Gate actions**

Before opening connect modal/share/create invite, if no `playerToken`, navigate to `/login` with `state: { from: { pathname: "/find-players" } }`.

- [ ] **Step 5: Run frontend build and targeted tests**

Run: `npm run build`

Expected: PASS.

### Task 4: Backend Public Group Lessons List

**Files:**
- Modify: `/Users/prem/Projects/Server/ttp-api/routes/player_lesson.js`
- Test: `/Users/prem/Projects/Server/ttp-api/__test__/public_group_lessons.test.js`
- Modify: `/Users/prem/Projects/React/ttp-player-web/src/api/groupLessons.ts`
- Modify: `/Users/prem/Projects/React/ttp-player-web/src/pages/GroupLessonsPage.tsx`

**Interfaces:**
- Produces anonymous `POST /api/player/upcoming_group_lessons`
- Produces anonymous `POST /api/player/upcoming_external_lessons`

- [ ] **Step 1: Backend optional auth**

Change group/external list routes from `middleware.verify, middleware.authorize` to `middleware.optionalVerify`. Do not rely on `req.user` in those list handlers.

- [ ] **Step 2: Redact participant fields**

For anonymous list responses, remove `phone`, `email`, `user_type` from `group_players`.

- [ ] **Step 3: Frontend list load**

In `GroupLessonsPage`, remove the early `Missing authentication token` branch. Call `fetchUpcomingGroupLessons` and `getPlayerExternalLessons` with `token: authToken` only when present; otherwise omit token.

- [ ] **Step 4: Gate booking/payment actions**

Any handler that books, opens checkout, purchases package, uses payment method, or navigates to authenticated booking flow should redirect to `/login` with the current route in state when `!authToken`.

- [ ] **Step 5: Run tests**

Run backend focused test and frontend build.

Expected: PASS.

### Task 5: End-to-End Verification

**Files:**
- Check only; no planned edits unless failures reveal bugs.

**Interfaces:**
- Consumes completed Tasks 1-4.
- Produces verified public discovery flow.

- [ ] **Step 1: Run full frontend build**

Run: `npm run build` in `/Users/prem/Projects/React/ttp-player-web`

Expected: PASS.

- [ ] **Step 2: Run focused backend tests**

Run:

```bash
npx jest __test__/matches_public_routes.test.js __test__/public_players_discovery.test.js __test__/public_group_lessons.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 3: Manual browser check**

Start frontend dev server and verify anonymous browser can load:

- `/#/find-players`
- `/#/group-lessons`
- `/#/matches`
- `/#/matches/:id` with a known public match id

Verify protected actions redirect to login.

## Self-Review

- Spec coverage: routes, read/action gate split, backend public read access, redaction, and test coverage each map to Tasks 1-5.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: new frontend helper and backend route names match Task 3 references.
