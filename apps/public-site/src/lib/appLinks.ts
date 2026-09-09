const APP = "https://app.thetennisplan.com";

/** Where the app browses coaches. Public, so it works whether or not they sign in. */
export const APP_FIND_COACHES = "/find-coaches";

/**
 * Sign-in link into the app.
 *
 * `#/login` rather than `#/` because the app root renders its own landing page when logged
 * out — no email or password field on it — so pointing at the root sent people to a second
 * landing page instead of a sign-in form.
 *
 * `next` is an in-app path to land on afterwards. LoginPage reads it only when React Router
 * has no `state.from`, so an in-app guard redirect still wins. Omit it and the app decides,
 * which is what the landing page wants.
 *
 * Note the query sits inside the hash — `#/login?next=…` — because the app is a HashRouter.
 * A `?next=` before the `#` would never reach the router.
 */
export const loginHref = (next?: string | null) => {
  const base = `${APP}/#/login`;
  if (!next) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
};
