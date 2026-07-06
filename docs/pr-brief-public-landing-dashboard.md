# PR Brief: Public landing + root auth-branch + dashboard public mode

## Context

Today `www.thetennisplan.com/` (the root) has only an authenticated route — a logged-out
visitor is bounced to login. We want the root to be a real public front door:

- Logged-out visitor → new public **landing page**
- Logged-in visitor → existing **dashboard** (unchanged)
- From the landing, "Browse all" (and feature tiles / intent flow) let logged-out users
  browse the existing **dashboard in a public, action-gated mode** — they can look freely,
  but any action (Join, Book, etc.) prompts sign-up.

Note: `/matches`, `/group-lessons`, and player profiles already have public
(non-authenticated) routes. The root is the only surface missing a public route. This PR
adds the landing, the root branch, and a public mode for the dashboard component.

## Phasing — three reviewable pieces

This is large; split into separate commits/PRs so each is reviewable. Suggested order:

1. **Root auth-branch + minimal landing** — stop the login bounce; render a landing when
   logged out, dashboard when logged in.
2. **Dashboard public mode** — the careful piece: render the existing dashboard safely for
   logged-out users (hide personal rows, gate actions). Requires the audit below.
3. **Landing polish** — the full designed landing (hero, tiles, proof, live cards, intent
   flow entry). Can follow once 1 and 2 work.

Do the investigation for all three up front, but build and ship in this order.

## Piece 1 — Root auth-branch

- The root route `/` must branch on auth state:
  - Authenticated → existing dashboard (no change to current behaviour).
  - Unauthenticated → new public landing (instead of redirect to login).
- Confirm how auth state is currently determined at the root and how the redirect happens
  today, then replace the redirect with a conditional render.
- Do NOT change the logged-in experience at all — authenticated users see exactly what
  they see today.

## Piece 2 — Dashboard public mode (the careful part)

Goal: the existing dashboard component renders a safe, public, action-gated version when
no user is logged in — visually the same, but with personal content hidden and all actions
routed to the sign-up gate. Reuse the existing component with a mode flag
(`isAuthenticated ? full : public`); do NOT fork a separate dashboard page.

### REQUIRED FIRST: audit every dashboard row/section/action (report, no code)

Before writing any public-mode code, enumerate every section, row, and action the
dashboard renders, and for each one classify it as:

- **PUBLIC** — safe to show logged-out (e.g. upcoming matches/lessons in the area,
  leagues, general activity). Browsable.
- **HIDE** — personal; must not render logged-out (e.g. your invitations, your schedule,
  your matches, your alerts, recommendations tied to the user, anything addressing the
  user by name, anything reading the current user's data).
- **GATE** — a visible element whose action requires auth (Join, Book, Message, RSVP,
  Create) — render it, but the action opens the sign-up gate instead of performing.

Produce this as a table (section → classification → reason). This audit is the substance
of the PR — the goal is that NOTHING personal leaks to an anonymous visitor. When unsure,
default to HIDE.

Also flag: any data the dashboard fetches that requires a logged-in user / would error
without one. Public mode must use the public data sources (the existing non-auth routes)
for the PUBLIC sections, and must not fire authenticated-only fetches when logged out.

### Then, after the audit is approved, build public mode

- Hide all HIDE items when logged out.
- Render PUBLIC items using public data sources.
- Swap all GATE actions to open the sign-up gate (a bottom sheet / modal: "Sign in to
  {action} — we'll bring you right back").
- The page must not call authenticated-only APIs when logged out (no console errors, no
  empty/broken personal sections — they're hidden, not empty).

## Piece 3 — Landing page

Build the designed public landing (reference: the interactive mock from design). Key
elements:

- Hero: "Play more tennis. Find your people." + local framing (West LA / Mar Vista /
  Culver City) + subcopy.
- Primary CTA "Find what's right for me" → intent flow.
- Secondary: "Browse all" → the dashboard in public mode (Piece 2). "Sign up" → signup.
- "Log in" in header.
- Feature tiles (Match play / Group lessons / Flex leagues / Your rating) — **each tile is
  clickable** and routes to that surface's existing public browse page
  (Match play → public `/matches`, Group lessons → public `/group-lessons`, etc.).
- Proof strip (active players / weekly sessions / leagues) — use real counts if available,
  otherwise omit rather than fake.
- Live "happening this week" cards — real public data, action-gated.
- Responsive: mobile single-column; desktop split hero + multi-column grids.

### Intent flow (entry from "Find what's right for me")

- 2–3 questions, **each mapping to a real filter** on the destination page (no busywork
  questions). For the play path: level → format → when/distance, each narrowing the
  result. For lessons: level (→ `/group-lessons`).
- After the questions, route to the relevant **existing public browse page with filters
  pre-applied via URL params** (e.g. `/matches?level=3.5&format=singles`). This depends on
  the separate URL-filter-params PR (browse pages reading filters from URL on mount).
- Persistent "skip — just browse" escape on every step → public dashboard / browse.
- "Just exploring" intent → straight to "Browse all" (public dashboard), no questions.

## Out of scope

- No changes to the authenticated dashboard's logged-in behaviour.
- No new backend/Sahil work — public sections use existing public routes; if a needed
  public data route is missing for a PUBLIC section, flag it rather than building it here.
- Coaches surface: not live yet — show as "coming soon / notify me", don't fake it.
- The URL-param filter reading on browse pages is a SEPARATE PR (already briefed).
- Signup Terms/Privacy line + SMS consent is a SEPARATE PR (already briefed).

## Investigate before building (report first, no code)

1. How the root `/` route and its auth redirect work today; how auth state is read.
2. The dashboard component: its file, every section/row/action it renders, and which data
   each needs (→ feeds the public/hide/gate audit table).
3. Which public (non-auth) data routes already exist for the PUBLIC sections, and whether
   any PUBLIC section lacks one.
4. The existing sign-up gate / modal pattern (if any) to reuse for GATE actions.

Report findings + the public/hide/gate audit table + a build plan, and get approval
before writing code — especially the audit, since it governs what's safe to expose.

## Verification

- Logged out at `/` → new landing, no redirect to login.
- Logged in at `/` → dashboard exactly as today.
- "Browse all" logged out → dashboard in public mode: no personal rows, real public
  content, actions open the sign-up gate, no console errors, no authenticated fetches.
- Feature tiles → correct existing public browse pages.
- Intent flow → correct public browse page with filters pre-applied.
- Sign up via a gate → returns to the same place, now authenticated, actions work.
- Responsive at mobile + desktop.
- eslint clean, build passes.

## Commit

Branch off `main` (e.g. `feat/public-landing-and-dashboard-public-mode`), split into the
three commits above. Separate from the URL-filter-params and signup-terms PRs.
