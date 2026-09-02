# Returning-user routing design

## Goal

Let an already authenticated player who visits the marketing homepage reach the app without an extra click, while ensuring that anonymous visitors and crawlers always receive the indexable marketing page.

## Decisions

- `https://thetennisplan.com` remains the public, indexed canonical host. `www` continues its existing permanent redirect to the apex. `https://app.thetennisplan.com` remains the noindex app host.
- The real session and refresh tokens must not be available to the marketing host. The embedded matches module currently creates parent-domain token cookies; it will be restricted to host-only cookies while retaining local-storage authentication.
- A browser-readable, non-sensitive `tp_returning=1` cookie is set only after a successful player session is persisted. It is scoped to `.thetennisplan.com`, uses `Path=/`, `SameSite=Lax`, `Secure`, and lasts 90 days. It contains neither a token nor user information.
- The hint is removed whenever app code clears an auth token, including explicit logout and confirmed invalid-session cleanup. A failed refresh that intentionally preserves the session does not clear the hint.
- A Netlify edge function runs only for `/`. If the hint is present and `stay=1` is absent, it returns a non-cacheable `302` to `https://app.thetennisplan.com/#/`. Otherwise it serves the Astro homepage with `Cache-Control: no-store` and `Vary: Cookie`.
- Marketing calls to action open the app root. App-root routing sends authenticated users to content and leaves anonymous users within the app’s normal landing/login experience.

## Out of scope

- Changing the actual authentication-token format or introducing a new `auth` host.
- Changing apex/www domain routing, canonical metadata, sitemap URLs, or app path-based routing.
- Adding marketing routes or proxying app paths under the marketing origin.
