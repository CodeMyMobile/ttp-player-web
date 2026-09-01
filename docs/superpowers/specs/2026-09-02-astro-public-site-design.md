# Astro Public Site Design

## Goal

Create a dedicated, indexable public website for `thetennisplan.com` inside this repository while retaining the existing Vite application as the authenticated product on `app.thetennisplan.com`.

The first release is a static Astro homepage built from the existing public landing experience. It must return meaningful page content, metadata, and links without client-side JavaScript. Coach discovery and individual coach pages are intentionally the next delivery slice; their public data source will be the unauthenticated backend API.

## Scope

### Included in the foundation

- A standalone Astro project at `apps/public-site` with its own package manifest, Astro configuration, and build command.
- A static homepage at `/`, structurally ported from `src/pages/LandingPage.tsx` and its `LandingShowcase` section.
- Reuse of existing landing-page imagery as public-site assets. The Astro project owns its copies so its build is independent of the Vite application.
- Public links:
  - Account actions go to `https://app.thetennisplan.com/login`.
  - Coach discovery goes to `/find-coaches`, reserved for the next public-site slice.
  - Other product-only actions point to their corresponding app-host route only when the landing-page copy needs a destination.
- Page-level SEO for `/`: unique title and description, self-referencing apex canonical, matching Open Graph URL, public index directive, organization JSON-LD with `areaServed`, an apex `robots.txt`, and an apex sitemap.
- Netlify configuration and a deployment README that specify a second Netlify site whose base directory is `apps/public-site` and whose custom domain is `thetennisplan.com`.

### Deferred

- `/find-coaches`, `/coaches/{slug}`, group-lesson, and neighborhood landing pages.
- Connecting Astro to the backend API, public coach-list endpoint design, slugs, redirects from old numeric URLs, and rebuild/webhook strategy.
- Migration of any authenticated route, payment flow, or app authentication behavior.
- Changes to the existing Vite app deployment, except documentation that identifies it as the `app.thetennisplan.com` deployment.

## Architecture

The repository contains two independently deployable web applications:

| Project | Host | Responsibility | Rendering |
| --- | --- | --- | --- |
| Root Vite app | `app.thetennisplan.com` | Authenticated player product and private routes | Client-side React application; `noindex` at deployment time |
| `apps/public-site` | `thetennisplan.com` | Marketing, public discovery, and future coach pages | Astro static HTML, publicly indexable |

The public project does not import React application components. The existing landing page depends on React Router links and an authentication drawer, neither of which belongs on the public host. Instead, its presentational structure and CSS are ported into Astro components with ordinary anchor elements. This prevents the app shell, hash routing, and runtime auth state from entering the public response.

`www.thetennisplan.com` continues to permanently redirect to the apex at the hosting layer. The user configures hostname assignments in Netlify because repository code cannot bind custom domains.

## Homepage Components and Data Flow

`src/pages/LandingPage.tsx` is the source design for the homepage. The Astro implementation separates it into focused components:

- `BaseLayout.astro`: document shell, favicon/social metadata, canonical URL, and global styles.
- `Header.astro`: brand plus app-host sign-in and registration links.
- `Hero.astro`: landing imagery, page H1, and primary calls to action.
- `FeaturePillars.astro`, `TrustBand.astro`, and `FeatureGrid.astro`: static marketing copy.
- `AppShowcase.astro`: the three presentational phone recreations currently in `LandingShowcase.tsx`; it uses HTML and CSS only.
- `CommunityCta.astro`: closing public call to action.

The release contains no API requests and no client-side hydration. All content is emitted during the Astro build, so `curl https://thetennisplan.com/` returns the H1, landing copy, navigation links, and image markup.

## SEO and Indexing Rules

- Public homepage response: `index, follow`, canonical `https://thetennisplan.com/`, and `og:url` with the same URL.
- `robots.txt`: permits crawling and declares `https://thetennisplan.com/sitemap-index.xml` (or `sitemap.xml` if Astro’s sitemap integration uses that name).
- Sitemap: contains only canonical public URLs. The first release includes `/`; later routes are added only when they render substantive, indexable content.
- JSON-LD: use `Organization` for The Tennis Plan with Los Angeles/West LA service areas. Do not add an address, aggregate rating, or review markup unless verified business data and visibly rendered reviews support it.
- The public site never links canonical pages to the app host. App-host pages remain non-indexable through their separate deployment configuration.

## Future Coach Pages

The next slice introduces an Astro data client for the unauthenticated backend API. At build time it retrieves the public coach inventory and produces:

- `/find-coaches` listing page;
- `/coaches/{slug}` pages with coach-specific content and `Person` JSON-LD;
- future `/tennis-lessons/{neighborhood}` pages tied to real courts and matching coaches.

This requires a backend contract that returns only public coach data, includes a stable slug, and supports an inventory query. The API response must exclude phone numbers, emails, availability that should not be public, and internal account fields. A successful deploy must not publish a partial coach set: API failures fail the public build rather than silently generating an incomplete sitemap.

## Errors and Deployment

- The static homepage has no runtime data dependency; a public-site build failure fails the deploy rather than serving the Vite app as a fallback.
- Netlify deploy configuration uses `apps/public-site` as the base directory, `npm run build` as the build command, and `dist` as the publish directory.
- The previous apex alias must be removed from the Vite app Netlify site only after the Astro deployment is live and assigned to the apex. The app custom domain remains `app.thetennisplan.com`.
- The app-host `robots.txt` and noindex response are deployment responsibilities to preserve during the hostname split.

## Testing and Launch Verification

- Unit or content tests validate the homepage metadata, canonical, robots content, sitemap entry, and required public/internal destinations.
- Run the public-site production build.
- Preview the public-site output and verify the landing page visually at desktop and mobile widths.
- Verify rendered output with `curl` contains the H1, descriptive copy, canonical, robots directive, and JSON-LD before switching the apex domain.
- After Netlify hostname assignment, check apex, `www`, and app hosts individually: apex is indexable, `www` is a 301 to apex, and app remains noindex.

## Acceptance Criteria

- `apps/public-site` builds independently of the root Vite project.
- The public homepage renders full landing-page copy and visuals as static HTML.
- Homepage SEO metadata, canonical, Open Graph URL, robots file, sitemap, and organization schema use only `https://thetennisplan.com` public URLs.
- Calls to sign in or create an account reach the app host; public coach navigation uses public route paths.
- A Netlify operator can create the second deployment from the repository documentation without guessing its base, build, publish, or domain settings.
- No existing Vite application, authentication, payment, or private routing code is modified.
