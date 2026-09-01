# Astro Public Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separately deployable Astro homepage for `thetennisplan.com` that serves the public Tennis Plan landing experience as indexable static HTML.

**Architecture:** Add an independent static Astro project at `apps/public-site`; it owns its components, styles, copied landing imagery, metadata, crawler files, and Netlify configuration. It never imports the Vite app, React Router, authentication, payment, or any private application code. The existing root deployment continues to serve only `app.thetennisplan.com`.

**Tech Stack:** Astro 7.2.10, `@astrojs/sitemap` 3.7.4, static HTML/CSS, Node 20 test runner, Netlify static hosting.

**Spec:** `docs/superpowers/specs/2026-09-02-astro-public-site-design.md`

## Global Constraints

- The public hostname is exactly `https://thetennisplan.com`; the app hostname is exactly `https://app.thetennisplan.com`.
- The public site must be static: no client hydration, no React Router, and no API request in this foundation release.
- Port the full content intent of `src/pages/LandingPage.tsx`, including the `LandingShowcase.tsx` section, rather than exposing only the showcase.
- Public account CTAs use `https://app.thetennisplan.com/login`; public coach discovery uses `/find-coaches`.
- The public sitemap contains only canonical, substantive public URLs; this release includes `/` only.
- Do not change the root Vite app, its Netlify configuration, payment code, or authentication code.
- Netlify domain assignment is a manual operator task; repository documentation must state the exact configuration.

---

## File Structure

- Create `apps/public-site/package.json`: independent Astro scripts and pinned public-site dependencies.
- Create `apps/public-site/astro.config.mjs`: static output, apex site URL, and sitemap integration.
- Create `apps/public-site/tsconfig.json`: Astro TypeScript configuration.
- Create `apps/public-site/netlify.toml`: second-site build and publish settings plus `_headers` handling.
- Create `apps/public-site/src/layouts/BaseLayout.astro`: document shell and reusable SEO metadata interface.
- Create `apps/public-site/src/components/*.astro`: static homepage sections, each responsible for one content region.
- Create `apps/public-site/src/pages/index.astro`: homepage route, title/description/canonical, and Organization JSON-LD.
- Create `apps/public-site/src/styles/global.css`: all public-site presentation and responsive behavior, including the phone mockups from `LandingShowcase.tsx`.
- Create `apps/public-site/public/images/landing/*`: landing image copies consumed by the public-site build.
- Create `apps/public-site/public/robots.txt`: apex crawler policy and sitemap reference.
- Create `apps/public-site/tests/public-output.test.mjs`: assertions over a built static output directory.
- Create `apps/public-site/README.md`: local development, validation, second Netlify-site setup, hostname cutover order, and rollback instructions.

## Task 1: Scaffold the Independently Buildable Astro Project

**Files:**
- Create: `apps/public-site/package.json`
- Create: `apps/public-site/astro.config.mjs`
- Create: `apps/public-site/tsconfig.json`
- Create: `apps/public-site/netlify.toml`
- Create: `apps/public-site/src/env.d.ts`
- Create: `apps/public-site/.gitignore`

**Interfaces:**
- Consumes: Node 20 and npm from the repository development environment.
- Produces: `npm run dev`, `npm run build`, `npm run preview`, `npm run check`, and `npm test` commands scoped to `apps/public-site`.

- [ ] **Step 1: Write the failing build contract test**

Create the directories with `mkdir -p apps/public-site/tests apps/public-site/src`, then create `apps/public-site/tests/public-output.test.mjs` with the initial missing-output assertion:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build emits the public homepage", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>/);
});
```

- [ ] **Step 2: Run the test to verify the missing build output fails**

Run: `cd apps/public-site && node --test tests/public-output.test.mjs`

Expected: FAIL with `ENOENT` for `dist/index.html`.

- [ ] **Step 3: Create the Astro manifest and configuration**

Create `apps/public-site/package.json`:

```json
{
  "name": "@the-tennis-plan/public-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "node --test tests/*.test.mjs"
  },
  "devDependencies": {
    "@astrojs/check": "0.9.10",
    "@astrojs/sitemap": "3.7.4",
    "astro": "7.2.10",
    "typescript": "5.9.3"
  }
}
```

Create `apps/public-site/astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://thetennisplan.com",
  output: "static",
  integrations: [sitemap()],
});
```

Create `apps/public-site/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict"
}
```

Create `apps/public-site/src/env.d.ts` with `/// <reference types="astro/client" />`, and create `.gitignore` containing `dist/` and `.astro/`.

- [ ] **Step 4: Add Netlify second-site configuration**

Create `apps/public-site/netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

- [ ] **Step 5: Install and validate the scaffold**

Run: `cd apps/public-site && npm install && npm run check`

Expected: dependencies are recorded in `apps/public-site/package-lock.json`; Astro check exits 0 after the page is added in Task 2.

- [ ] **Step 6: Commit the scaffold**

```bash
git add apps/public-site/package.json apps/public-site/package-lock.json apps/public-site/astro.config.mjs apps/public-site/tsconfig.json apps/public-site/netlify.toml apps/public-site/src/env.d.ts apps/public-site/.gitignore apps/public-site/tests/public-output.test.mjs
git commit -m "feat(public-site): scaffold Astro project"
```

## Task 2: Add Static SEO Shell and Crawler Assets

**Files:**
- Create: `apps/public-site/src/layouts/BaseLayout.astro`
- Create: `apps/public-site/src/pages/index.astro`
- Create: `apps/public-site/src/styles/global.css`
- Create: `apps/public-site/public/robots.txt`
- Modify: `apps/public-site/tests/public-output.test.mjs`

**Interfaces:**
- Consumes: Astro static build from Task 1 and `site` configured as `https://thetennisplan.com`.
- Produces: `BaseLayout` props `{ title: string; description: string; canonicalPath?: string }` and an HTML homepage whose base SEO URLs derive only from the apex domain.

- [ ] **Step 1: Extend the failing built-output test for SEO invariants**

Replace the test body with assertions that the eventual output must satisfy:

```js
assert.match(html, /<title>Tennis Coaches & Community in West LA \| The Tennis Plan<\/title>/);
assert.match(html, /name="description" content="Find certified tennis coaches, players, and flexible leagues in West Los Angeles with The Tennis Plan\."/);
assert.match(html, /rel="canonical" href="https:\/\/thetennisplan\.com\/"/);
assert.match(html, /property="og:url" content="https:\/\/thetennisplan\.com\/"/);
assert.match(html, /name="robots" content="index, follow"/);
const head = html.slice(0, html.indexOf("</head>"));
assert.doesNotMatch(head, /app\.thetennisplan\.com/);
```

Add a second test that reads `../dist/robots.txt` and `../dist/sitemap-0.xml`, asserting the robots file permits `/`, references `https://thetennisplan.com/sitemap-index.xml`, and the sitemap includes only `https://thetennisplan.com/`.

- [ ] **Step 2: Run the test to verify it fails before the layout and route exist**

Run: `cd apps/public-site && npm run build && npm test`

Expected: FAIL because `index.astro`, robots output, and the metadata are absent.

- [ ] **Step 3: Implement the reusable document layout**

Create `BaseLayout.astro` with the exact frontmatter interface:

```astro
---
import "../styles/global.css";

interface Props {
  title: string;
  description: string;
  canonicalPath?: string;
}

const { title, description, canonicalPath = "/" } = Astro.props;
const canonical = new URL(canonicalPath, Astro.site).toString();
---
<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="The Tennis Plan" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
  </head>
  <body><slot /></body>
</html>
```

Create `index.astro` that calls `BaseLayout` with the exact title and description asserted in Step 1, includes `<main id="main">`, and includes an `application/ld+json` script generated with `JSON.stringify` for an `Organization` named `The Tennis Plan` whose `url` is `https://thetennisplan.com/` and `areaServed` is `Los Angeles`, `Santa Monica`, `Brentwood`, `Culver City`, and `Venice`.

Create `public/robots.txt`:

```text
User-agent: *
Allow: /

Sitemap: https://thetennisplan.com/sitemap-index.xml
```

- [ ] **Step 4: Implement minimal global baseline styles**

Create `global.css` with `box-sizing: border-box`, zero body margin, system/Inter font stack, `#101828` default text, white background, visible `:focus-visible` outline, responsive `.container` width/padding, and `@media (prefers-reduced-motion: reduce)` that disables animations and transitions.

- [ ] **Step 5: Run built-output tests and Astro static checks**

Run: `cd apps/public-site && npm run build && npm test && npm run check`

Expected: all three commands exit 0; `dist/index.html`, `dist/robots.txt`, `dist/sitemap-index.xml`, and `dist/sitemap-0.xml` exist.

- [ ] **Step 6: Commit the SEO shell**

```bash
git add apps/public-site/src/layouts/BaseLayout.astro apps/public-site/src/pages/index.astro apps/public-site/src/styles/global.css apps/public-site/public/robots.txt apps/public-site/tests/public-output.test.mjs
git commit -m "feat(public-site): add static SEO shell"
```

## Task 3: Port the Landing Page’s Public Content and Visual System

**Files:**
- Create: `apps/public-site/src/components/Header.astro`
- Create: `apps/public-site/src/components/Hero.astro`
- Create: `apps/public-site/src/components/FeaturePillars.astro`
- Create: `apps/public-site/src/components/TrustBand.astro`
- Create: `apps/public-site/src/components/FeatureGrid.astro`
- Create: `apps/public-site/src/components/AppShowcase.astro`
- Create: `apps/public-site/src/components/CommunityCta.astro`
- Create: `apps/public-site/public/images/landing/hero.jpg`
- Create: `apps/public-site/public/images/landing/hero-night.jpg`
- Create: `apps/public-site/public/images/landing/hero-clinic.jpg`
- Create: `apps/public-site/public/images/landing/coaching.jpg`
- Create: `apps/public-site/public/images/landing/group-lessons.jpg`
- Create: `apps/public-site/public/images/landing/play-partners.jpg`
- Create: `apps/public-site/public/images/landing/match-nights.jpg`
- Create: `apps/public-site/public/images/landing/community.jpg`
- Create: `apps/public-site/public/images/landing/cta-highfive.jpg`
- Modify: `apps/public-site/src/pages/index.astro`
- Modify: `apps/public-site/src/styles/global.css`
- Modify: `apps/public-site/tests/public-output.test.mjs`

**Interfaces:**
- Consumes: `BaseLayout` from Task 2 and visual/copy source files `src/pages/LandingPage.tsx`, `src/pages/LandingPage.css`, `src/pages/LandingShowcase.tsx`, and `src/pages/LandingShowcase.css`.
- Produces: semantic static homepage components with no framework-specific router or auth dependencies.

- [ ] **Step 1: Add failing rendered-content assertions**

Extend `public-output.test.mjs` to assert built `index.html` contains:

```js
assert.match(html, /<h1[^>]*>\s*Find your tennis <span[^>]*>community\.<\/span>\s*<\/h1>/);
assert.match(html, /Browse coaches before you sign up/);
assert.match(html, /See who\'s free to play/);
assert.match(html, /Track matches and climb/);
assert.match(html, /href="\/find-coaches"/);
assert.match(html, /href="https:\/\/app\.thetennisplan\.com\/login"/);
assert.match(html, /alt="/);
```

- [ ] **Step 2: Run the test to verify the content assertions fail**

Run: `cd apps/public-site && npm run build && npm test`

Expected: FAIL because the homepage only contains the SEO shell.

- [ ] **Step 3: Copy the public landing imagery into the Astro project**

Copy exactly these source assets, preserving filenames, from `src/assets/landing/` to `apps/public-site/public/images/landing/`:

```text
hero.jpg
hero-night.jpg
hero-clinic.jpg
coaching.jpg
group-lessons.jpg
play-partners.jpg
match-nights.jpg
community.jpg
cta-highfive.jpg
```

Do not use `src/assets` directly: Netlify’s public-site build must be valid when its base directory is `apps/public-site`.

- [ ] **Step 4: Implement public, semantic components**

Port the public copy and layout from the two existing landing-page sources into Astro components. Replace every `Link` with an `<a>`:

```astro
<a class="button button--primary" href="https://app.thetennisplan.com/login">
  Create your account
</a>
<a class="hero__browse-link" href="/find-coaches">Browse coaches — no account needed</a>
```

`Header.astro` must provide a brand home link plus sign-in and get-started app-host links. `Hero.astro` must be the only H1. `FeaturePillars.astro` must render coaching, group lessons, players, and leagues as four `<article>` elements with descriptive image `alt` text. `TrustBand.astro` must render the existing public trust copy without claiming ratings or reviews. `FeatureGrid.astro` must render the existing product capabilities. `CommunityCta.astro` must render the final public account CTA.

`AppShowcase.astro` must port the three representative phone screens from `LandingShowcase.tsx` as semantic static markup. Its fictional names must remain visibly presented as representative application examples; none may be encoded as coach structured data or linked as real profiles.

- [ ] **Step 5: Compose the homepage in a stable source order**

Update `index.astro` inside `<BaseLayout>`:

```astro
<Header />
<main id="main">
  <Hero />
  <FeaturePillars />
  <TrustBand />
  <FeatureGrid />
  <AppShowcase />
  <CommunityCta />
</main>
```

Import each component explicitly. Keep the organization JSON-LD next to the page composition.

- [ ] **Step 6: Port only the required CSS into the public stylesheet**

Port the visual rules from `LandingPage.css` and `LandingShowcase.css` into `global.css`, renaming selectors only when needed to prevent collisions. Preserve the established public palette: purple `#8B5CF6` / `#7C3AED`, lime `#84CC16`, headings `#101828`, body `#475467`, and borders `#E4E7EC`. Preserve responsive single-column behavior for pillars and showcase rows below 760px. Keep the CSS hero crossfade, but stop it under the reduced-motion media query from Task 2.

- [ ] **Step 7: Run the static-content tests, checker, and visual preview**

Run:

```bash
cd apps/public-site
npm run build
npm test
npm run check
npm run preview -- --host 127.0.0.1
```

Expected: build, test, and check exit 0. In a browser at the preview URL, inspect the homepage at 1440px and 390px widths; the primary content, images, phone examples, and calls to action remain readable without horizontal scrolling.

- [ ] **Step 8: Commit the landing port**

```bash
git add apps/public-site/src apps/public-site/public/images/landing apps/public-site/tests/public-output.test.mjs
git commit -m "feat(public-site): add static landing homepage"
```

## Task 4: Document Netlify Deployment, Cutover, and Rollback

**Files:**
- Create: `apps/public-site/README.md`
- Modify: `apps/public-site/tests/public-output.test.mjs`

**Interfaces:**
- Consumes: public-site build output and `apps/public-site/netlify.toml` from Tasks 1–3.
- Produces: operator instructions that unambiguously create and validate the second Netlify deployment without touching the app deployment.

- [ ] **Step 1: Add a failing assertion that the build only exposes public crawler URLs**

Add a test that reads `dist/sitemap-0.xml`, extracts all `<loc>` values, and asserts exact equality:

```js
assert.deepEqual(locations, ["https://thetennisplan.com/"]);
```

Also assert `dist/robots.txt` does not include `app.thetennisplan.com`.

- [ ] **Step 2: Run the test to verify the strict sitemap assertion fails if any unintended route is emitted**

Run: `cd apps/public-site && npm run build && npm test`

Expected: PASS only when the project has exactly one page route; if any extra page has been added, FAIL and remove it from this foundation release.

- [ ] **Step 3: Write deployment instructions with exact values**

Create `README.md` with these sections and exact operator inputs:

1. **Local commands:** `npm install`, `npm run dev`, `npm run build`, `npm test`, and `npm run check`, all run from `apps/public-site`.
2. **New Netlify site:** import this repository; Base directory `apps/public-site`; Build command `npm run build`; Publish directory `dist`; Node version `20`.
3. **Hostname assignment:** bind `thetennisplan.com` to the new Astro Netlify site, retain `app.thetennisplan.com` on the existing Vite Netlify site, and retain the existing permanent `www.thetennisplan.com` to apex redirect.
4. **Cutover sequence:** deploy Astro to its Netlify preview URL; inspect rendered HTML; assign the apex only after the preview passes; then confirm app host remains noindex.
5. **Verification commands:** provide the exact `curl` commands below.
6. **Rollback:** reassign `thetennisplan.com` to the existing Vite Netlify site; do not change the app hostname or remove its noindex policy.

Use these exact verification commands:

```bash
curl -s https://thetennisplan.com/ | rg -i 'find your tennis|canonical|robots|application/ld\+json'
curl -s https://thetennisplan.com/robots.txt
curl -s https://thetennisplan.com/sitemap-index.xml
curl -sI https://www.thetennisplan.com/
curl -s https://app.thetennisplan.com/ | rg -i 'noindex'
```

- [ ] **Step 4: Build and run the complete public-site validation suite**

Run: `cd apps/public-site && npm run build && npm test && npm run check`

Expected: all commands exit 0.

- [ ] **Step 5: Commit deployment documentation**

```bash
git add apps/public-site/README.md apps/public-site/tests/public-output.test.mjs
git commit -m "docs(public-site): add Netlify cutover guide"
```

## Task 5: Final Static-Output and Repository Isolation Verification

**Files:**
- Check only: `apps/public-site/dist/index.html`
- Check only: `apps/public-site/dist/robots.txt`
- Check only: `apps/public-site/dist/sitemap-index.xml`
- Check only: `apps/public-site/dist/sitemap-0.xml`
- Check only: root Vite source and configuration files

**Interfaces:**
- Consumes: completed public-site project from Tasks 1–4.
- Produces: evidence that the public build is indexable and has not modified the authenticated app.

- [ ] **Step 1: Verify static HTML contains actual page content**

Run:

```bash
cd apps/public-site
npm run build
rg -n "Find your tennis|Browse coaches before you sign up|See it in action" dist/index.html
```

Expected: all three text fragments are present in `dist/index.html`.

- [ ] **Step 2: Verify public SEO assets**

Run:

```bash
cd apps/public-site
rg -n "thetennisplan\.com|index, follow" dist/index.html dist/robots.txt dist/sitemap-index.xml dist/sitemap-0.xml
if sed -n '1,/<\/head>/p' dist/index.html | rg -q "app\.thetennisplan\.com"; then exit 1; fi
```

Expected: the apex appears in the HTML and crawler files; the app host does not appear in public page metadata. Explicit app-host account CTA links in the body are required and allowed.

- [ ] **Step 3: Verify the public-site test and type suite**

Run: `cd apps/public-site && npm test && npm run check`

Expected: both commands exit 0.

- [ ] **Step 4: Verify isolation from the Vite app**

Run:

```bash
git diff --name-only HEAD~4..HEAD
git status --short
```

Expected: implementation commits modify only `apps/public-site/**`; working tree is clean. If another contributor’s changes are present, do not remove them—report their paths separately.

- [ ] **Step 5: Commit only if final verification required a correction**

If verification reveals an issue, add the minimal correction, rerun Steps 1–4, then commit it:

```bash
git add apps/public-site
git commit -m "fix(public-site): verify static SEO output"
```

## Spec Coverage Review

- Separate independently deployable Astro site: Task 1.
- Full static landing page derived from the existing landing and showcase: Task 3.
- Public/app-host link boundaries: Tasks 2 and 3.
- Homepage metadata, canonical, Open Graph, index directive, Organization schema, robots, and sitemap: Task 2.
- Netlify second-site setup, apex/domain cutover, and rollback: Task 4.
- Static HTML, crawler output, responsive preview, and app isolation verification: Tasks 3 and 5.
- Coach list/profile API integration, slugs, neighborhood pages, and app changes remain explicitly outside this foundation plan.

## Plan Self-Review

- Placeholder scan: no unassigned implementation steps; commands and file paths are explicit.
- Type/config consistency: `BaseLayout` props, Astro `site`, sitemap file names, and test paths are defined before they are consumed.
- Scope consistency: the plan creates only the public-site foundation and homepage; it does not call the coach API or modify the existing Vite app.
