# Public Coach Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish static, indexable coach hub, area, and profile pages from an allowlisted build-time roster.

**Architecture:** An Astro-only data module reads a server-only API contract at build time, converts raw records to a narrow public model, and derives routes/sitemap eligibility. Astro components render full HTML with no client hydration; booking links enter the authenticated app.

**Tech Stack:** Astro 7, TypeScript, Node test runner, `@astrojs/sitemap`.

**Spec:** `docs/superpowers/specs/2026-09-08-public-coach-directory-design.md`

## Global Constraints

- `COACH_API_URL` and `COACH_API_TOKEN` are server-only build variables; never use `VITE_GOOGLE_API_KEY`.
- Require `is_public`, stored `slug`, and a non-empty public roster; build failures are deploy failures.
- Use copied `venues.json` as the exclusive venue allowlist; never route from city.
- Emit no phone, email, `sms:`, raw API fields, or residential address.
- Hub card HTML contains every public coach. Area routes require three distinct coaches.
- Profiles with fewer than 60 bio words use `noindex` and are excluded from sitemap.
- Never emit `AggregateRating`; public pages work without JavaScript.

---

### Task 1: Coach Data Boundary

**Files:**
- Create: `apps/public-site/src/data/venues.json`
- Create: `apps/public-site/src/lib/venues.ts`
- Create: `apps/public-site/src/lib/coaches.ts`
- Test: `apps/public-site/tests/coaches.test.mjs`

**Interfaces:**
- Produces `getCoaches(): Promise<Coach>`, `getAreaCoaches(coaches)`, and venue normalization with `{ name, area }` courts.

- [ ] Write failing tests for public-consent filtering, unknown-venue removal, deduplicated areas, short-bio indexability, empty-roster rejection, and non-OK API rejection.
- [ ] Run `node --test tests/coaches.test.mjs`; verify missing module failure.
- [ ] Implement typed allowlist mapping, environment validation, and error handling.
- [ ] Run focused tests; verify pass.

### Task 2: Static Directory UI

**Files:**
- Create: `apps/public-site/src/components/CoachCard.astro`
- Create: `apps/public-site/src/components/CoachDirectory.astro`
- Create: `apps/public-site/src/pages/tennis-coaches/index.astro`
- Create: `apps/public-site/src/pages/tennis-coaches/[area].astro`
- Modify: `apps/public-site/src/styles/global.css`
- Test: `apps/public-site/tests/coach-directory-output.test.mjs`

**Interfaces:**
- Consumes `Coach` and `getCoaches`; produces static cards and three-coach area paths.

- [ ] Write failing output assertions for full roster HTML, profile links, book intent, no contact links, and qualified areas.
- [ ] Run build/output test with a local fixture API; verify failure before pages exist.
- [ ] Implement cards and route generation.
- [ ] Run build/output test; verify pass.

### Task 3: Public Profiles and SEO

**Files:**
- Create: `apps/public-site/src/pages/coaches/[slug].astro`
- Create: `apps/public-site/src/lib/schema.ts`
- Modify: `apps/public-site/src/layouts/BaseLayout.astro`
- Modify: `apps/public-site/astro.config.mjs`
- Test: `apps/public-site/tests/coach-profile-output.test.mjs`

**Interfaces:**
- Consumes indexable `Coach`; produces complete static profile HTML, metadata, and schema.

- [ ] Write failing tests for `noindex`, profile section order, `Person` schema, canonical URL, Open Graph image, and sitemap exclusion.
- [ ] Run focused build/output test; verify failure.
- [ ] Implement profile page, metadata extensions, and sitemap filtering.
- [ ] Run focused test; verify pass.

### Task 4: About, Documentation, and Regression Coverage

**Files:**
- Create: `apps/public-site/src/pages/about.astro`
- Modify: `apps/public-site/README.md`
- Modify: `apps/public-site/tests/public-output.test.mjs`
- Test: `apps/public-site/tests/coach-directory-output.test.mjs`

**Interfaces:**
- Produces data-derived roster/area stats, non-dead about link, env setup instructions, and full output guarantees.

- [ ] Write failing tests for about route/link, derived stats, all public sitemap URLs, and PII absence.
- [ ] Run output tests; verify failure.
- [ ] Implement about page, README env/build-hook instructions, and regression checks.
- [ ] Run `npm run build && npm test && npm run check`; verify build, tests, and diagnostics pass.

## Self-Review

- Data consent, venue routing, static hub, area floor, PII exclusion, noindex/sitemap behavior, metadata/schema, about stats, and build contract have mapped tasks.
- No API payload field passes from fetch to a template except listed public model fields.
- No placeholders appear in implementation steps; unavailable founding facts remain deliberately excluded.
