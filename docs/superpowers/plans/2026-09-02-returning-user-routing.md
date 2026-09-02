# Returning-user routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send returning players from the marketing homepage to the app without exposing a real session token to the marketing host.

**Architecture:** The application writes a shared boolean hint after successful authentication and removes it whenever it clears authentication. A root-only Netlify edge function consumes that hint to produce a private `302`; every other homepage result continues to serve the Astro HTML with cookie-sensitive no-store headers.

**Tech Stack:** React/Vite, Astro, Netlify Edge Functions, Node’s built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-02-returning-user-routing-design.md`

## Global Constraints

- Keep `https://thetennisplan.com` as the public canonical host and retain the existing `www` to apex redirect.
- The only cross-host authentication signal is `tp_returning=1`; never put an access token, refresh token, or user identifier in it.
- Restrict the edge function to `/`; `/tennis-lessons/santa-monica` and all other paths must bypass it.
- Redirect returning users with `302`, never `301`, and set `Cache-Control: no-store` plus `Vary: Cookie` for both redirect and served homepage responses.
- Preserve app authentication in local storage and host-only cookies; do not write real token cookies to parent domains.

---

### Task 1: Shared returning-user hint

**Files:**
- Create: `src/services/returningUserHint.js`
- Create: `src/services/returningUserHint.test.js`
- Modify: `src/services/auth.js`
- Modify: `src/play-dates/services/authToken.js`
- Modify: `src/pages/LessonInvitePage.tsx`

**Interfaces:**
- Produces `setReturningUserHint(): void` and `clearReturningUserHint(): void`.
- `persistAuthSession`, `storeAuthToken`, and the invite claim persistence use `setReturningUserHint` after storing a real token.
- `clearStoredSession` and `clearStoredAuthToken` use `clearReturningUserHint` when authentication is removed.

- [ ] **Step 1: Write failing tests**

```js
test("setReturningUserHint writes only the shared boolean cookie", () => {
  setReturningUserHint();
  assert.equal(document.cookie, "tp_returning=1; Domain=.thetennisplan.com; Path=/; Max-Age=7776000; SameSite=Lax; Secure");
});

test("clearReturningUserHint expires the shared boolean cookie", () => {
  clearReturningUserHint();
  assert.equal(document.cookie, "tp_returning=; Domain=.thetennisplan.com; Path=/; Max-Age=0; SameSite=Lax; Secure");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --import tsx src/services/returningUserHint.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal browser-safe helper and wire every discovered player-token persistence/clear path through it**

```js
export const setReturningUserHint = () => {
  if (typeof document === "undefined") return;
  document.cookie = "tp_returning=1; Domain=.thetennisplan.com; Path=/; Max-Age=7776000; SameSite=Lax; Secure";
};
```

Only call it after a non-empty access token is stored. Expire the same cookie attributes when a real auth token is cleared.

- [ ] **Step 4: Restrict embedded-match token cookies to the app host**

Make `buildCookieDomains()` return only the host-only cookie option. Leave local-storage behavior intact.

- [ ] **Step 5: Run targeted tests**

Run: `node --test --import tsx src/services/returningUserHint.test.js src/services/auth.test.js`

Expected: PASS.

### Task 2: Root-only Netlify routing

**Files:**
- Create: `apps/public-site/netlify/edge-functions/returning-user.ts`
- Create: `apps/public-site/netlify/edge-functions/returning-user-routing.mjs`
- Create: `apps/public-site/tests/returning-user-routing.test.mjs`

**Interfaces:**
- `returning-user-routing.mjs` exports `shouldRedirectReturningUser({ pathname, search, cookie })` and `withCookieSensitiveHeaders(headers)`.
- The edge function calls those helpers and redirects to `https://app.thetennisplan.com/#/` only when they return true.

- [ ] **Step 1: Write failing tests for the edge decision and response headers**

```js
assert.equal(shouldRedirectReturningUser({ pathname: "/", search: "", cookie: "tp_returning=1" }), true);
assert.equal(shouldRedirectReturningUser({ pathname: "/", search: "?stay=1", cookie: "tp_returning=1" }), false);
assert.equal(shouldRedirectReturningUser({ pathname: "/tennis-lessons/santa-monica", search: "", cookie: "tp_returning=1" }), false);
assert.equal(headers.get("cache-control"), "no-store");
assert.match(headers.get("vary"), /Cookie/);
```

- [ ] **Step 2: Run the edge test to verify it fails**

Run: `npm test --prefix apps/public-site -- tests/returning-user-routing.test.mjs`

Expected: FAIL because the routing helper does not exist.

- [ ] **Step 3: Implement the pure decision helper and root-only edge function**

The function must use `context.next()` for non-redirect responses, preserve existing response headers, set `Cache-Control: no-store` and append `Cookie` to `Vary`, and return an explicit `302` with `Location: https://app.thetennisplan.com/#/` for a returning visitor.

- [ ] **Step 4: Run public-site tests**

Run: `npm test --prefix apps/public-site`

Expected: PASS.

### Task 3: Marketing links and final verification

**Files:**
- Modify: `apps/public-site/src/components/Header.astro`
- Modify: `apps/public-site/src/components/Hero.astro`
- Modify: `apps/public-site/src/components/CommunityCta.astro`
- Modify: `apps/public-site/tests/public-output.test.mjs`

**Interfaces:**
- Public links use the app root `https://app.thetennisplan.com/#/`.

- [ ] **Step 1: Write a failing public-output expectation**

```js
assert.match(html, /href="https:\/\/app\.thetennisplan\.com\/#\/"/);
assert.doesNotMatch(html, /https:\/\/app\.thetennisplan\.com\/#\/login/);
```

- [ ] **Step 2: Run the public-site test to verify it fails**

Run: `npm test --prefix apps/public-site -- tests/public-output.test.mjs`

Expected: FAIL because the public links still target `#/login`.

- [ ] **Step 3: Update all landing-page CTAs to the app root**

- [ ] **Step 4: Run complete verification**

Run: `npm test --prefix apps/public-site && npm run build --prefix apps/public-site && npm test && npm run typecheck && npm run lint`

Expected: public-site tests/build and root tests/typecheck/lint pass; report any pre-existing baseline failure separately.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers src apps/public-site
git commit -m "feat: route returning users to app"
```
