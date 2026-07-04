# Match Play Feature — Build Plan for Claude Code

> **File placement note.** The task asked for this at the repo root as `CLAUDE.md`,
> but a `CLAUDE.md` already exists at the root — it's the project's master guide
> (payments/auth/service-worker "ask first" rules + architecture) that Claude Code
> auto-loads every session. Overwriting it would delete that guidance, so this plan
> lives at `docs/match-play-build-plan.md` instead. During the build session, point
> Claude at it explicitly (e.g. `@docs/match-play-build-plan.md`) or say the word and
> I'll relocate/rename it (root `CLAUDE.md` would **append**, not replace).

---

## ⚠️ Read first: Match Play already partly exists

Investigation found substantial pre-existing "matches"/"Match Play" code. **This plan must
extend/reuse it, not duplicate it.** Confirm the relationship with Paul before building.

| Thing the task says to "create" | Reality in the repo |
|---|---|
| `src/data/mockMatches.ts` | **Already exists.** Reuse/extend it; don't recreate. |
| `src/api/matchPlay.ts` | `src/api/matches.ts` **already exists** (e.g. `listMatches(...)`, used in `DashboardPage.jsx` and `PlayerProfilePage.tsx`). Prefer adding to it over a parallel module. |
| A matches UI | An entire embedded sub-app exists at `src/play-dates/` (pages: `CreateMatchPage`, `MatchPage`, `MyGroupsPage`, `PlayerConnectionsPage`, `CourtFinder`, `LandingPage`, …) plus a full route tree in `src/App.jsx`: `/matches`, `/matches/create`, `/matches/create/settings`, `/matches/create/review`, `/matches/create/published`, `/matches/:id`, `/matches/:id/invite`, `/match-profile`, `/settings/match-profile`. |
| The "Match Play" name | Already a flagged feature: `.env.example` has `VITE_MULTI_MATCH=false` — *"Enable the new multi-match Match Play creation flow (off by default)."* |

Two referenced inputs were **not found / inconsistent**, flag with Paul:
- **`match-play-v2.html` prototype** — not present anywhere in the repo. Needs to be added or linked.
- **`GET /api/players/me/played-with`** — does not match the existing API convention. Real endpoints are `/player/...` (e.g. `/player/upcoming_lessons`, `/player/discover/nearby`) hit through `src/api/http.ts` (`buildApiUrl` prefixes `VITE_API_URL`). Expect `GET /player/played-with` (or similar) rather than `/api/players/me/...`.

**Open question for Paul:** Is Match Play a *new* player-home surface that sits alongside the
existing `/matches` flow, a *replacement* for it, or the UI for the `VITE_MULTI_MATCH` flow?
The answer decides routing, whether to reuse `play-dates`, and whether new files are even needed.

---

## Context

Match Play is a player-facing home surface for discovering and managing casual matches:
a top nav (logo, location pill, **Create** button, avatar), a header ("Match Play",
"5 open near you this week"), tabs (**Discover / My Matches / Hosting**), a horizontal
**day strip** (ALL WEEK · TODAY · TUE · WED …), and a list of **match cards** with level/format
filters. A host "trust signal" marks whether you've played with the host before.

---

## Tech Stack & Patterns (verified)

- **Framework:** React 19 + Vite 7 (`@vitejs/plugin-react-swc`); mixed JS/TS, newer code is `.tsx`.
- **Routing:** `react-router-dom` v6 with **`HashRouter`** — all routes declared in `src/App.jsx`;
  player pages wrapped in `ProtectedRoute`. URLs are `#/...`.
- **Page location & naming:** `src/pages/` — newer pages are `PascalCase.tsx`
  (`FindCoaches.tsx`, `GroupLessonsPage.tsx`, `CoachProfilePage.tsx`); older are `.jsx`
  (`DashboardPage.jsx`). The `play-dates` sub-app keeps its own `src/play-dates/pages/`.
  → **Use `src/pages/MatchPlay.tsx` (TypeScript).**
- **Layout:** `src/components/MainLayout.tsx` wraps `AppNav` + `<main>` + optional
  `MobileHomeBottomNav`, controlled by `mobileChrome` (`default | home | immersive`).
  `FindCoaches.tsx` uses `MainLayout`; `DashboardPage.jsx` composes `AppNav` + `MobileHomeBottomNav`
  manually. → Prefer `MainLayout mobileChrome="home"` for a home-like surface.
- **Components:** feature subfolders under `src/components/` (`coaches/`, `players/`,
  `group-lessons/`, `booking/`, `payments/`, `findPlayers/`, `questionnaire/`, `AddressPicker/`,
  `FilterMenu/`). **No `src/features/`.** Pattern: one `Component.tsx` per file + a shared
  folder CSS (e.g. `coaches/coaches.css`) imported by its components; pages get a sibling
  `PageName.css`. BEM-ish class names (`tag-pill tag-pill--accent`).
  → **Use `src/components/match-play/` + `match-play.css`.**
- **Styling:** Tailwind 3 is configured (`tailwind.config.js`, no `theme.extend`) but used
  lightly — most styling is per-component/per-page **plain CSS** + CSS variables. Design tokens
  live in **`src/lib/theme.ts`** (`colors`, `typography`, `radii`, `shadows`, `spacing`) and as
  `--coach-color-*` / `--color-primary` vars in `src/index.css`. Match the existing
  group-lessons pages (`GroupLessonsPage.css`) — they already do day pills, filter chips, and
  cards very close to this design.
- **State:** **local `useState` per page** (no Redux/Zustand/Context for data; no React Query).
  Fetch pattern = `useEffect` + `AbortController` + `Promise.allSettled([...])` with
  status objects (`{ status: "loading" | "ready" | "error", items, error }`). See
  `DashboardPage.jsx` `loadHome()`. A `useApiRequest(fetcher, params, opts)` hook exists
  (`src/hooks/useApiRequest.ts`, returns `{ data, error, loading, refetch }`) but is used sparingly.
- **API layer:** per-domain modules in `src/api/*` over a shared `request()` helper
  (`src/api/http.ts`; base URL from `VITE_API_URL` via `config.ts`). Functions take a `token`
  and return typed promises. Tokens come from `getStoredAuthToken({ preferScheme: "token" })`
  in `src/services/authToken.js`. **Do not call `fetch` directly in components.**
- **Mock data:** `src/data/mockXxx.ts` — exported `type` + `export const mockXxx: Type[]`.
  Examples: `mockCoaches.ts`, `mockPlayers.ts`, **`mockMatches.ts` (exists)**, `mockGroupLessons.ts`.
- **Icons:** `lucide-react`, named imports with a `size` prop (`<Users size={18} />`).
- **Brand:** primary purple **`#8B5CF6`** (`accentPurple`), dark `#7C3AED`. Do **not** use the
  retired `#7F56D9`. Note the trap: `--coach-color-accent` in `index.css` is **blue** (`#1570ef`).

---

## Build Scope

> Gate all new UI behind `VITE_MULTI_MATCH` if Paul confirms this is that flag's surface.

### Phase 0 (new) — Reconcile with existing code
- Read `src/api/matches.ts`, `src/data/mockMatches.ts`, and `src/play-dates/` match pages.
- Decide: new `MatchPlay.tsx` home vs. reskin of existing `/matches`. Get Paul's call.
- Pick the route (e.g. `/match-play`) and confirm it won't collide with `/matches*`.

### Phase 1 — Layout & Navigation
- `src/pages/MatchPlay.tsx` via `MainLayout mobileChrome="home"` (nav/avatar/Create come from
  `AppNav`; don't rebuild them).
- Header ("Match Play", "N open near you this week" — N derived from data).
- Tabs: **Discover / My Matches / Hosting** (local `useState` active tab).
- `DayStrip` (ALL WEEK · TODAY · TUE · WED …), horizontally scrollable.

### Phase 2 — Match Cards & Filtering
- `src/components/match-play/MatchCard.tsx`
- `src/components/match-play/FilterBar.tsx` (Level & Format dropdowns — reuse `FilterMenu/`
  or `coaches/FilterBar.tsx` patterns).
- `src/components/match-play/DayStrip.tsx`
- Day filtering + tab filtering (pure helpers, colocated `*.test.js` if logic is non-trivial).

### Phase 3 — Data & API
- Extend `src/data/mockMatches.ts` (don't recreate) with any fields the cards need.
- Use/extend `src/api/matches.ts` (`listMatches`) rather than a new `matchPlay.ts`, unless Paul
  wants a separate module. Add the "played-with" call here once the endpoint is confirmed.
- Wire mock → cards behind the real fetch, with the `loading/ready/error` status pattern.

### Phase 4 — Responsive & Polish
- Mobile refinements, day-strip scroll, filter interactions.
- Bottom nav: `MobileHomeBottomNav.tsx` (only if Match Play becomes a primary home tab — confirm).

---

## API Contract (waiting on Sahil)
- **Purpose:** host trust signal — "✓ you've played" vs "new to you".
- **Likely endpoint (confirm path):** `GET /player/played-with` (returns players the current
  user has played with). The task's `/api/players/me/played-with` does **not** match the
  existing `/player/...` convention — verify the real path before wiring.
- **Integration:** add to `src/api/matches.ts`, called with `token` from `getStoredAuthToken`,
  through the shared `request()` helper.

---

## Dev Commands (verified, `package.json`)
- Start: `npm run dev` (Vite → http://localhost:5173)
- Build: `npm run build` (`vite build`)
- Lint: `npm run lint` (`eslint .`)
- Test: `npm run test` (`node --test src`; tests are colocated `*.test.js`)
- Preview: `npm run preview`
- Env: copy `.env.example` → `.env` (`VITE_API_URL`, `VITE_GOOGLE_API_KEY`,
  `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GOOGLE_CLIENT_ID`, `VITE_MULTI_MATCH`). Restart dev after edits.

---

## Files to Create / Touch (status-annotated)
| File | Status | Action |
|---|---|---|
| `src/pages/MatchPlay.tsx` | new | main page |
| `src/components/match-play/MatchCard.tsx` | new | card |
| `src/components/match-play/FilterBar.tsx` | new | level/format filters |
| `src/components/match-play/DayStrip.tsx` | new | day strip |
| `src/components/match-play/match-play.css` | new | shared folder CSS |
| `src/data/mockMatches.ts` | **exists** | extend, don't recreate |
| `src/api/matches.ts` | **exists** | extend (add played-with); avoid a parallel `matchPlay.ts` |
| `src/App.jsx` | **exists** | add the `MatchPlay` route under `ProtectedRoute` (HashRouter) |

---

## Design Reference
- **Tokens:** `src/lib/theme.ts` — `colors.accentPurple` `#8B5CF6`, `accentPurpleDark` `#7C3AED`,
  `pageBackground` `#F5F7FB`, text `#101828`/`#475467`/`#667085`, border `#EAECF0`;
  `radii.card` `16px`, `radii.pill` `9999px`; `shadows.card`; `typography` (Inter).
- **Closest existing UI to copy:** `GroupLessonsPage.tsx` + `GroupLessonsPage.css` (day pills,
  filter chips, lesson cards) and `coaches/FilterBar.tsx` / `FilterMenu/`.
- **Icons:** `lucide-react`.
- **Layout:** mobile-first; Tailwind for layout + colocated CSS for component styling.
- **Prototype:** `match-play-v2.html` — **not in repo; add it or link it before building.**

---

## Pre-build checklist for Paul
1. Match Play = new surface, replacement for `/matches`, or the `VITE_MULTI_MATCH` UI?
2. Reuse `src/play-dates/` + `src/api/matches.ts` + `src/data/mockMatches.ts`, or build fresh?
3. Confirm the route path (`/match-play`?) and bottom-nav placement.
4. Add the `match-play-v2.html` prototype to the repo.
5. Confirm the real "played-with" endpoint path/shape with Sahil.
