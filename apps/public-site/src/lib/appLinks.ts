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

/**
 * The coach's own page in the player app.
 *
 * `#/coaches/:id` is not behind the auth guard, so a logged-out visitor sees the coach and
 * can sign in from there; a logged-in one lands straight on them. Without an id there is
 * nowhere specific to send anyone, so it degrades to the app root rather than inventing a
 * URL that resolves to "Invalid coach identifier".
 */
export const appCoachHref = (appId: number | null | undefined) =>
  appId ? `${APP}/#/coaches/${appId}` : `${APP}/#/`;

/**
 * The coach's booking page — `#/coaches/:id/book`, which renders the date strip, the
 * format filter and their available slots, rather than the profile someone then has to
 * find the button on.
 *
 * Also public, so a logged-out visitor can pick a time and only meets the account wall at
 * the point of actually booking.
 */
export const appCoachBookHref = (appId: number | null | undefined) =>
  appId ? `${APP}/#/coaches/${appId}/book` : `${APP}/#/`;

/**
 * Sign-in that returns to this coach.
 *
 * Deliberately not a bare link to `#/coaches/:id`: that route is public, so it would show
 * the coach without ever signing anyone in — wrong for a control labelled "Sign in". This
 * goes to the real form and carries the coach as `next`.
 */
export const coachLoginHref = (appId: number | null | undefined) =>
  appId ? loginHref(`/coaches/${appId}`) : loginHref(APP_FIND_COACHES);
