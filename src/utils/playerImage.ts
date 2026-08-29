/**
 * Avatars are uploaded straight to S3 with no server-side resizing, so the stored file
 * is whatever the player's phone produced — measured examples run to 2048x1536 and
 * ~320KB. Rendering that behind a 48px avatar downloads the full file and throws away
 * 99.9% of it, which on a phone at a court is real money.
 *
 * Netlify's image CDN resizes at the edge and caches the result, so this needs no new
 * infrastructure. It requires the source host to be allow-listed under [images]
 * remote_images in netlify.toml, which ships in the same commit as this file for
 * exactly that reason.
 *
 * A display optimisation must never be able to break display. Two safety nets:
 * this module only rewrites URLs it is confident about (absolute http(s), in a
 * production build), and callers pair the transformed src with `originalImageUrl`
 * in an onError handler, because no function can know ahead of time that a CDN
 * will fail to answer.
 */

const NETLIFY_IMAGE_ENDPOINT = "/.netlify/images";

/** Only Netlify serves this endpoint; locally it 404s, so pass the source through. */
const canTransform = () => Boolean(import.meta.env?.PROD);

export type SizedImageOptions = {
  /** Rendered size in CSS pixels. */
  size: number;
  /** Device pixel ratio to serve for. 2 covers most phones without tripling bytes. */
  dpr?: number;
  fit?: "cover" | "contain";
};

export const sizedImageUrl = (
  src: string | null | undefined,
  { size, dpr = 2, fit = "cover" }: SizedImageOptions,
): string => {
  const source = typeof src === "string" ? src.trim() : "";
  if (!source) return "";

  // Anything we are not certain the transform can handle is returned untouched:
  // relative paths are already ours and already small, data URIs cannot be
  // transformed, and a non-http(s) scheme is not something the CDN accepts.
  if (!canTransform() || !/^https?:\/\//i.test(source)) {
    return source;
  }

  const pixels = Math.max(1, Math.round(size * dpr));
  const params = new URLSearchParams({
    url: source,
    w: String(pixels),
    h: String(pixels),
    fit,
  });
  return `${NETLIFY_IMAGE_ENDPOINT}?${params.toString()}`;
};

/**
 * The untransformed source, for an onError fallback. If the CDN 404s — a missing
 * allow-list entry, a transform outage, an unreachable origin — the browser retries
 * this and the avatar still renders.
 */
export const originalImageUrl = (src: string | null | undefined): string =>
  typeof src === "string" ? src.trim() : "";

/** Swap a failed transform for the original exactly once, then stop. */
export const handleImageTransformError = (
  event: { currentTarget: HTMLImageElement },
  src: string | null | undefined,
) => {
  const original = originalImageUrl(src);
  const node = event.currentTarget;
  if (!original || node.dataset.imgFallback === "done" || node.src === original) return;
  node.dataset.imgFallback = "done";
  node.src = original;
};
