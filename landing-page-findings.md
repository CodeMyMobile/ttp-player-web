# Public landing page — Phase 1 findings

Read-only investigation for the new public `/` landing page. No code changed in Phase 1.
Stack: React + Vite SPA; backend is external (`VITE_API_URL`), called via `src/api/*`.

> **Update (Phase 2):** Confirmed that the public *browse routes* already exist and are unwrapped
> (public) on `main` — `/find-coaches`, `/find-players`, `/players/:id`, `/coaches/:id` (+`/book`),
> `/group-lessons`, `/group-lessons/:id`, `/matches`, `/matches/:id`. They already handle their own
> teaser + force sign-in/up on action. So the landing **links into these real pages** (Browse
> coaches → `/find-coaches`, See who's looking → `/find-players`, group lessons → `/group-lessons`,
> matches → `/matches`) rather than embedding data or gating to `/login`. The "missing data
> endpoint" notes below apply to *embedding* live data directly on the landing — no longer needed;
> the browse pages own their data + gating. The one caveat that still stands: `/find-players`'
> public data endpoint returned `403` in testing (see (b) + the Sahil brief), so that page's teaser
> may be thin until the backend route is truly public — a separate, already-diagnosed issue.

---

## 1. Theme tokens & fonts (use these, not the mockup's approximations)

Source of truth: **`src/lib/theme.ts`** + CSS vars in **`src/index.css`**.

| Token | Value | Source |
|---|---|---|
| Primary purple | `#8B5CF6` | `theme.ts:9` `accentPurple` / `index.css:7` `--color-primary` |
| Purple dark (gradient partner) | `#7C3AED` | `theme.ts:10` `accentPurpleDark` / `index.css:8` `--color-primary-dark` |
| Purple light tint | `#F4EBFF` | `theme.ts:11` `accentPurpleLight` |
| Purple border | `#D6BBFB` | `theme.ts:12` `accentPurpleBorder` |
| Page background | `#F5F7FB` | `theme.ts:2` `pageBackground` / `--coach-color-page` |
| Surface (white) | `#FFFFFF` | `theme.ts:3` `surface` |
| Heading / ink | `#101828` | `theme.ts:4` `primaryText` |
| Body text | `#475467` | `theme.ts:6` `mutedText` |
| Subtle text | `#667085` | `theme.ts:5` `secondaryText` |
| Border | `#EAECF0` | `theme.ts:7` `border` |
| Radius: card / button / pill | `16px` / `10px` / `9999px` | `theme.ts:50-52` |
| Shadow (card) | `0 20px 25px -5px rgba(15,23,42,.08), 0 10px 10px -5px rgba(15,23,42,.04)` | `theme.ts:57` |
| Font (display + body) | **Inter** (system fallback) | `theme.ts:40` / `index.css:37` |

**Lime:** EXISTS only as a page-scoped CSS var `--ph-lime: #84cc16` / `--ph-lime-deep: #5f8f12` in `CoachProfilePage.css` — **not** a global token. Use sparingly or prefer purple.
**Lavender page background:** **MISSING** — no such token. Page bg is slate `#F5F7FB`; use that or `accentPurpleLight #F4EBFF` for tinted sections.
**Space Grotesk** (mockup font): do **not** use — the app is Inter, no external font links.

## 2. Reusable components

| Need | What exists | Path |
|---|---|---|
| Button | **No JS component.** CSS classes `.fc-button--primary/secondary/tertiary` | `src/components/coaches/coaches.css:495` |
| Badge / pill | **`TagPill`** (tones: default/available/featured/accent, optional icon) | `src/components/coaches/TagPill.tsx` |
| Avatar (photo + initials) | `PlayerAvatar` (play-dates) | `src/play-dates/components/PlayerAvatar.jsx` |
| Initials from name | `getInitialsFromIdentity(name, email)` | `src/hooks/usePlayerIdentity.ts:25` |
| Editorial marketing card | `TrustCard` (static, responsive) | `src/components/coaches/TrustCard.tsx` |
| Icons | **lucide-react** `^0.473.0` | `import { … } from "lucide-react"` |
| Page layout | `MainLayout` — **auth-aware** (renders `AppNav`, which uses `useAuth`) | `src/components/MainLayout.tsx` |

**Layout decision:** `MainLayout`/`AppNav` assume a logged-in user (nav = Home/My Coaches/Schedule + user menu). The public landing needs its **own minimal marketing shell** (logo · "Sign in" link · "Get started" button), not `AppNav`. Reuse `TagPill`, `getInitialsFromIdentity`, lucide, and the tokens; style CTAs with the tokens.

## 3. Data availability (what's real pre-auth)

Confirmed public endpoints (from `#264 public-discovery-routes` / `#265 public-share`):
`GET /public/players/:id` (single player), `GET /public/lessons/:id` (single lesson),
`GET /player/coach/profile/:id` (single coach — **verified 200 unauthenticated** via curl of coaches 26 & 158).

### (a) Featured coaches with photos — **MISSING (no public list)**
- **No public coaches *list*** endpoint: `/public/coaches` → **404**. `getNearestCoaches` → `/player/in_proximity/coaches` **requires a token and is geo-scoped** (`playerHome.ts:355`) — disallowed for anon (auth + "near you").
- The **single** coach profile *is* public (`/player/coach/profile/:id`, verified 200) and includes a photo (`profile_picture`), rating, and pricing — but there's no endpoint to get a *list of featured coaches*, and hand-picking IDs would be an arbitrary/hardcoded selection.
- **Decision:** render a **static, honest "certified coaches" treatment** (no specific/fabricated coach cards) and flag the gap. Do **not** hardcode a coach list.

### (b) Players looking to play — **PARTIAL → gated (endpoint 403s + no consent flag)**
- A public function exists: `getPublicSuggestedPlayerCheckLocation` → `POST /player/surveys/suggested/player/public-getchecklocation` (no token in the FE call, `playerHome.ts:731`).
- **But the backend route returns `403 "Please provide a valid token"` unauthenticated** (verified via curl). So it is **not actually reachable pre-auth** today.
- **No consent / public-discovery flag** found on any player/availability record in the FE (`is_public`, `public_discovery`, `visibility`, `share_publicly` — none). The public endpoint *presumably* filters to opted-in members server-side, but that's unconfirmed (can't see the response — it 403s).
- **Decision (privacy-safe + truthful):** render **only the "Post your availability" invitation tile** (maps to the real feature) — **no individual member cards** — and flag both the 403 and the unconfirmed consent flag.

### (c) Global open-match count — **MISSING**
- No global count/stats endpoint. `matches.ts` has an `isOpenMatch()` classifier and per-match participant counts, but no aggregate/global total.
- **Decision:** **drop the hero open-match badge** — do not invent a number.

---

## Sahil brief needed

1. **Public featured-coaches list endpoint** — e.g. `GET /public/coaches?featured=true` returning name, `profile_picture`, rating, starting price (non-geo, no auth). Today only single-coach profiles are public; there's no list to power the landing's "meet the coaches" section.
2. **Public players-looking endpoint is 403-ing** — `POST /player/surveys/suggested/player/public-getchecklocation` was added FE-side (#264) but the backend route still rejects unauthenticated requests with `"Please provide a valid token"`. It needs to actually be public. **And** it must expose/guarantee a **consent / public-discovery flag** so only opted-in members are ever shown publicly (the landing will show *no* individuals until this is confirmed).
3. **Global open-match count** — a non-geo aggregate (e.g. `GET /public/stats` → `{ open_matches }`) for the hero badge. None exists today, so the badge is omitted.

*Read-only — no application code modified in Phase 1. Sole Phase-1 deliverable: this file.*
