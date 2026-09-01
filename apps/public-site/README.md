# The Tennis Plan public site

This directory contains the standalone Astro site for `thetennisplan.com`. It is deployed as a second Netlify site; the authenticated application remains on its existing Vite Netlify site at `app.thetennisplan.com`.

## Local commands

Run all commands from `apps/public-site`:

```bash
npm install
npm run dev
npm run build
npm test
npm run check
```

The project requires Node `>=22.12.0`. Keep Netlify on Node `22.12.0`, as specified in `netlify.toml` and the package engine declaration.

## New Netlify site

Import this repository as a new Netlify site with these values:

- Base directory: `apps/public-site`
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22.12.0` (the repository baseline is `>=22.12.0`)

This creates the public Astro deployment without changing the existing app deployment.

## Hostname assignment

Bind `thetennisplan.com` to the new Astro Netlify site. Retain `app.thetennisplan.com` on the existing Vite Netlify site. Retain the existing permanent `www.thetennisplan.com` to apex redirect.

## Cutover sequence

1. Deploy the Astro site and open its Netlify preview URL.
2. Inspect the rendered HTML, including the title, description, canonical URL, robots metadata, structured data, links, and account boundary.
3. Run the local build, test, and check commands below and confirm the preview has the expected public-only routes.
4. Assign the apex domain `thetennisplan.com` to the new Astro Netlify site only after the preview passes.
5. Confirm `app.thetennisplan.com` still serves the existing application and remains `noindex`.

## Verification commands

Run these after cutover:

```bash
curl -s https://thetennisplan.com/ | rg -i 'find your tennis|canonical|robots|application/ld\+json'
curl -s https://thetennisplan.com/robots.txt
curl -s https://thetennisplan.com/sitemap-index.xml
curl -sI https://www.thetennisplan.com/
curl -s https://app.thetennisplan.com/ | rg -i 'noindex'
```

The homepage should expose the public landing content and apex canonical metadata; `robots.txt` and the sitemap should reference only the public domain; `www` should redirect permanently to the apex; and the app host should still include `noindex`.

## Rollback

If the cutover must be reversed, reassign `thetennisplan.com` to the existing Vite Netlify site. Do not change the app hostname or remove its `noindex` policy. Retain `app.thetennisplan.com` on the existing Vite site and retain the permanent `www.thetennisplan.com` to apex redirect.
