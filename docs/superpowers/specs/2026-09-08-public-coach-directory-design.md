# Public Coach Directory Design

## Goal

Publish a crawlable, JavaScript-independent coach directory on `thetennisplan.com` while preserving booking and messaging as app-host actions.

## Architecture

Astro owns all public coach URLs. At build time, `src/lib/coaches.ts` fetches a deliberately allowlisted coach payload from the server-only `COACH_API_URL` with `COACH_API_TOKEN`; failure or an empty public roster aborts the build. `venues.json` is copied into the site and is the only venue-to-area source. Unknown labels and address-like labels are excluded and logged.

The hub renders every public coach in HTML. Area routes only exist for areas with at least three coaches. Profile routes exist for every public coach; short-bio profiles are rendered with `noindex` and omitted from the sitemap. No public template imports authenticated React profile code because it contains app routing, booking, live data, and contact behaviors; Astro copies only the public visual language and static data boundary.

## Data and Safety

The public model contains only `slug`, `name`, `photo`, private/group rates, bio, focus areas, certifications, student count, normalized courts, and derived areas/indexability. It never passes through raw API objects. `is_public` is the consent gate. No phone, email, street/residential address, or `sms:` URL is emitted.

## Pages

- `/tennis-coaches`: full roster, area navigation, vetting, data-derived stats, courts, FAQ, CTA.
- `/tennis-coaches/[area]`: same static card surface for qualifying areas only.
- `/coaches/[slug]`: court-first public profile with all SEO-relevant sections initially rendered.
- `/about`: indexable page with non-placeholder company story and no dead link.

## SEO

Each public page gets a unique title, description, self canonical, Open Graph image, Twitter card, and JSON-LD. Hub/area pages include `ItemList` and `LocalBusiness`; qualifying profiles include `Person`. No rating schema is emitted. Sitemap URLs are generated from indexable static paths only.

## Delivery Contract

Netlify config documents required build environment variables and a build-hook/nightly-rebuild setup. `COACH_API_URL` and `COACH_API_TOKEN` are server-side build variables; `VITE_GOOGLE_API_KEY` is unrelated and never read by this site.

## Deferred Facts

The prototype's founding-year and named-court story cannot ship as generic copy. Until supplied, the about page and hub about section use a truthful, specific-free public description and do not claim unavailable facts.
