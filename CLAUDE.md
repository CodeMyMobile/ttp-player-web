# CLAUDE.md

Guidance for working in the **ttp-player-web** repository.

## ⚠️ Critical rule — ask before touching sensitive code

**Never modify payment, authentication, or service-worker code without explicitly asking the user first.**
Propose the change and wait for an OK before editing any of these:

- **Payments / Stripe**
  - `src/components/payments/` (`AddCardForm.tsx`, `LessonPaymentSummary.tsx`)
  - `src/api/playerStripe.ts`, and Stripe usage in `src/api/playerPackages.ts`, `src/api/playerLessons.ts`, `src/api/groupLessons.ts`, `src/api/lessonInvites.ts`
  - Anything using `@stripe/react-stripe-js`, `@stripe/stripe-js`, or `VITE_STRIPE_PUBLISHABLE_KEY`
  - `src/components/coaches/PurchaseLessonPackageExperience.tsx`, `src/pages/PurchaseLessonPackagePage.tsx`, `src/pages/BookingConfirmationPage.tsx`
- **Authentication**
  - `src/context/AuthContext.jsx`
  - `src/services/auth.js`, `src/services/authToken.js`, `src/utils/tokenHelper.ts`
  - `src/play-dates/services/auth.js`, `src/play-dates/services/authToken.js`
  - `src/pages/LoginPage.jsx`, `src/pages/ForgotPasswordPage.jsx`, `src/components/OAuthPhoneCapture.jsx`
  - The `ProtectedRoute` / `AuthRedirectRoute` guards and Google OAuth / `VITE_GOOGLE_CLIENT_ID` handling
- **Service workers** — no service worker exists in the repo today. If one is ever added (e.g. PWA/offline/push), the same rule applies: ask first.

Reading these files to understand them is fine. **Editing them requires explicit approval.**

## What this app is

**The Tennis Plan** ("Matchplay") — a mobile-first, player-facing web client for tennis. Players use it to find and book coaches, buy/redeem lesson packages (credits), join group lessons, discover other players, create/join casual matches, and manage their schedule, profile, payments, and notifications. It talks to a separate backend API (configured via `VITE_API_URL`) and uses Google Sign-In and Google Places.

## Framework & stack

- **React 19** + **Vite 7** (`@vitejs/plugin-react-swc`)
- **Mixed JS + TypeScript** — `.jsx`/`.js` and `.tsx`/`.ts` coexist; newer code trends toward TypeScript
- **Routing:** `react-router-dom` v6 with **`HashRouter`** (URLs use a `#/...` hash). All routes are declared in `src/App.jsx`
- **Styling:** **Tailwind CSS 3** + per-component plain CSS files + some CSS Modules (`*.module.css`). Design tokens in `src/lib/theme.ts`; global CSS variables in `src/index.css`
- **Key libraries:** Stripe (`@stripe/react-stripe-js`), `lucide-react` (icons), `moment`, `react-big-calendar`, `react-google-autocomplete`
- **Tests:** Node's built-in test runner — `node --test src` (test files live next to source as `*.test.js`)

## Run / build / test

```bash
npm install      # one-time, install dependencies
npm run dev      # start Vite dev server → http://localhost:5173/
npm run build    # production build (with sourcemaps)
npm run preview  # serve the production build locally
npm run lint     # ESLint
npm test         # node --test src
```

Environment variables (Vite, so all prefixed `VITE_`) live in `.env` — copy `.env.example` and fill in:
`VITE_API_URL`, `VITE_GOOGLE_API_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GOOGLE_CLIENT_ID`.
`.env` is gitignored. **Restart `npm run dev` after changing `.env`** — Vite does not hot-reload env values.

> Note: Google Sign-In requires `http://localhost:5173` to be whitelisted as an Authorized JavaScript origin for the Google Client ID (done in Google Cloud Console). Without it, login is blocked even though the app runs.

## Folder structure (`src/`)

| Path | What lives here |
|------|-----------------|
| `App.jsx` | Root component, `AuthProvider`, `HashRouter`, and **all route definitions** |
| `main.jsx` | App entry / mount point |
| `pages/` | Top-level route pages (Dashboard, FindCoaches, Credits, GroupLessons, profiles, settings, etc.) |
| `components/` | Shared UI; feature subfolders: `coaches/`, `players/`, `payments/`, `booking/`, `group-lessons/`, `findPlayers/`, `questionnaire/`, `AddressPicker/`, `FilterMenu/` |
| `screens/Player/` | Larger composed screens (e.g. `PlayerCalendar`) |
| `api/` | Backend API call modules (one file per domain: `coachProfile`, `playerPackages`, `playerStripe`, `notification`, …); shared `http.ts` / `config.ts` |
| `services/` | Auth & token helpers, plus app-level services |
| `context/` | React context providers (`AuthContext.jsx`) |
| `hooks/` | Reusable hooks (`useApiRequest`, `usePlayerIdentity`, `useCoachRoster`, …) |
| `utils/` | Pure helpers + their `*.test.js` tests |
| `lib/` | `theme.ts` — design tokens |
| `constants/`, `types/`, `data/` | URLs/constants, TS types, and **mock data** for offline UI work |
| `play-dates/` | **Embedded "matches" sub-app** — its own `pages/`, `components/`, `services/`, `utils/`. Mounted via `TennisMatchApp` at `/matches`, `/players`, `/invites`, `/groups`, etc. Has a parallel copy of services/auth — treat it as a semi-self-contained module |

## Where the main UI lives

- **Top header (desktop):** `src/components/AppNav.jsx` (+ `AppNav.css`) — brand logo "The Tennis *Plan*", primary links (**Home `/`**, **My Coaches `/my-coaches`**, **Schedule `/player/calendar`**), location picker, "New match" button, notifications bell, and the user/profile menu (profile, match profile, payment methods, blocked users, log out).
- **Bottom nav (mobile):** `src/components/MobileHomeBottomNav.tsx` — Home, My Coaches, Alerts (`/notifications`), Profile. Rendered on "home" mobile chrome.
- **Layout wrapper:** `src/components/MainLayout.tsx` — composes `AppNav` + `<main>` content + optional `MobileHomeBottomNav`, controlled by `mobileChrome` (`default` | `home` | `immersive`).
- **Pages:** `src/pages/*` (one file per route, often with a sibling `.css`).
- **Routing map:** `src/App.jsx` — every route, its page, and whether it's wrapped in `ProtectedRoute`.

## Design system

Tokens live in **`src/lib/theme.ts`** (`colors`, `typography`, `radii`, `shadows`, `spacing`) and as CSS custom properties in **`src/index.css`** (the `--coach-color-*` variables). Match the existing tokens/variables rather than hardcoding values.

- **Primary / brand:** purple **`#8B5CF6`** — the single primary across the app (~147 usages), with **`#7C3AED`** as its darker partner in gradients (`linear-gradient(135deg, #8b5cf6, #7c3aed)`). `theme.ts` exposes these as `accentPurple` (`#8B5CF6`) and `accentPurpleDark` (`#7C3AED`). Use `#8B5CF6` for any new purple — do **not** reintroduce the old `#7F56D9` (it was consolidated into `#8B5CF6`).
  - Caveat: most purple in CSS is still **hardcoded hex literals**, not token/CSS-variable references, and `theme.ts` is read by relatively little code. When practical, prefer the tokens; a future cleanup should expose `--color-primary` / `--color-primary-dark` CSS variables and migrate the literals. Watch for naming traps: the global `--coach-color-accent` in `index.css` is **blue** (`#1570ef`), not purple, and `DashboardPage.css` defines its own `--ph-purple: #8b5cf6`.
- **Neutrals:** **slate** scale — page background `#F5F7FB`, white surfaces, headings `#101828`, body `#475467`, subtle `#667085`, borders `#E4E7EC`/`#EAECF0`.
- **Pill chips:** fully-rounded chips (`radii.pill` = `9999px`) for tags/filters — see `src/components/coaches/TagPill.tsx` and the various `*FilterBar`/`FilterMenu` components.
- **Cards:** rounded surfaces, `radii.card` = `16px`, soft elevation via `shadows.card` — see `CoachCard.tsx`, `PlayerCard.tsx`, `LessonDetailCard.tsx`.
- **Typography:** Inter (system-font fallback); scale defined in `theme.typography`.
- **Icons:** `lucide-react`.

## Conventions

- Keep new code consistent with the file you're editing (JS vs TS, CSS file vs Tailwind vs CSS Module).
- API access goes through `src/api/*` modules; auth tokens through `src/services/authToken.js` — don't call `fetch` ad hoc in components.
- Use mock data in `src/data/` to build UI without a live backend.
- New routes go in `src/App.jsx`; wrap player-only pages in `ProtectedRoute`.
- **Stacked branches that touch the same file must branch off the previous branch, not `main`.**
  Seeding a branch by copying a file in from another worktree makes git see an *add*, not an edit.
  Two such branches then conflict by construction — add/add on the same path — regardless of merge
  order, and no amount of sequencing avoids it. This bit a three-PR docs sequence
  (#307/#309/#310); the fix was one consolidated edit PR off `main`.
