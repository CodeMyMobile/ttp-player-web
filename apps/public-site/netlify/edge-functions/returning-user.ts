import {
  shouldRedirectReturningUser,
  withCookieSensitiveHeaders,
  withLegacySessionCookieCleanup,
} from "./returning-user-routing.mjs";

const APP_ROOT_URL = "https://app.thetennisplan.com/#/";

const privateHomepageHeaders = (headers: Headers) =>
  withLegacySessionCookieCleanup(withCookieSensitiveHeaders(headers));

const withPrivateHomepageHeaders = (response: Response) =>
  new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: privateHomepageHeaders(response.headers),
  });

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const url = new URL(request.url);
  const headers = privateHomepageHeaders(new Headers());

  if (
    shouldRedirectReturningUser({
      pathname: url.pathname,
      search: url.search,
      cookie: request.headers.get("cookie"),
    })
  ) {
    headers.set("location", APP_ROOT_URL);
    return new Response(null, { status: 302, headers });
  }

  return withPrivateHomepageHeaders(await context.next());
};

export const config = { path: "/" };
