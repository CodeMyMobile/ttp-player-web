import posthog from "posthog-js";

import { setAnalyticsProvider, type AnalyticsProps } from "./analytics";

/**
 * Plugs PostHog into the provider-agnostic `track`. Nothing at the call sites changes;
 * this is the one function that knows a vendor exists.
 *
 * EVERY DEFAULT THAT COULD LEAK IS TURNED OFF, and that matters more here than the
 * event schema does. Our own payloads were designed to carry properties ABOUT the
 * target and never the target — but PostHog's defaults would bypass that entirely:
 *
 *   autocapture          records clicks and the TEXT of what was clicked, which on this
 *                        page is player names. Off.
 *   session_recording    records the DOM, i.e. the whole directory including names,
 *                        photos and venues. Off.
 *   capture_pageview     sends location.href on every navigation. The app is
 *                        hash-routed, so the fragment — which carries player and coach
 *                        ids, and on other routes password-reset and payment tokens —
 *                        would go with it. Off; page views are sent explicitly.
 *   capture_pageleave    same URL problem on the way out. Off.
 *
 * `sanitize_properties` is the belt to that braces: it strips the URL down to a path
 * with no fragment and no query on everything, whatever the source.
 */

/** Route patterns whose ids should never reach an analytics vendor. */
const scrubUrl = (value: unknown): string => {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    // Fragment carries the client route and its ids; query can carry tokens.
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
};

const SENSITIVE_KEYS = /url|href|pathname|referrer|search|title|screen_name/i;

export const initAnalytics = () => {
  const key = import.meta.env?.VITE_POSTHOG_KEY;
  const host = import.meta.env?.VITE_POSTHOG_HOST || "https://us.i.posthog.com";
  if (!key) {
    // No key configured — `track` stays the no-op it already is. Local development and
    // any deploy without the secret simply record nothing.
    return;
  }

  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: "localStorage",
    // Anonymous by design. The privacy policy describes traffic data as anonymised, and
    // identifying players by their real id would be a different promise.
    sanitize_properties: (properties: Record<string, unknown>) => {
      const cleaned: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(properties ?? {})) {
        cleaned[name] = SENSITIVE_KEYS.test(name) ? scrubUrl(value) : value;
      }
      return cleaned;
    },
  });

  setAnalyticsProvider((event: string, props: AnalyticsProps) => {
    posthog.capture(event, props);
  });
};
