import { withCookieSensitiveHeaders, withLegacySessionCookieCleanup } from "../returning-user-routing.mjs";

const privateHomepageHeaders = (headers: Headers) =>
  withLegacySessionCookieCleanup(withCookieSensitiveHeaders(headers));

const withPrivateHomepageHeaders = (response: Response) =>
  new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: privateHomepageHeaders(response.headers),
  });

export default async (_request: Request, context: { next: () => Promise<Response> }) => {
  return withPrivateHomepageHeaders(await context.next());
};

export const config = { path: "/" };
