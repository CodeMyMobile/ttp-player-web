import {
  buildAppRedirectUrl,
  buildGatewayShareUrl,
  parseSharePath,
} from "../../src/utils/shareLinks.js";

const DEFAULT_API_BASE_URL = "https://api.thetennisplan.com/api";
const DEFAULT_TITLE = "The Tennis Plan";
const DEFAULT_DESCRIPTION = "Book coaches, join group lessons, and play matches across West LA.";

function getEnv(name) {
  if (globalThis.Netlify?.env?.get) {
    return globalThis.Netlify.env.get(name);
  }
  if (globalThis.Deno?.env?.get) {
    return globalThis.Deno.env.get(name);
  }
  return undefined;
}

function getApiBaseUrl() {
  const raw =
    getEnv("API_BASE_URL") ||
    getEnv("VITE_API_BASE_URL") ||
    getEnv("VITE_API_URL") ||
    DEFAULT_API_BASE_URL;
  return String(raw).replace(/\/+$/, "");
}

function escapeHtmlAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadShareData(type, id) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/public/share/${type}/${id}`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function renderSharePage({ title, description, image, gatewayUrl, appUrl }) {
  const safeTitle = escapeHtmlAttribute(title);
  const safeDescription = escapeHtmlAttribute(description);
  const safeImage = escapeHtmlAttribute(image);
  const safeGatewayUrl = escapeHtmlAttribute(gatewayUrl);
  const safeAppUrl = escapeHtmlAttribute(appUrl);

  return `<!doctype html><html><head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<meta property="og:type" content="website">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeGatewayUrl}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">
<script>window.location.replace(${JSON.stringify(appUrl)});</script>
<noscript><meta http-equiv="refresh" content="0;url=${safeAppUrl}"></noscript>
</head><body></body></html>`;
}

export default async (request) => {
  const url = new URL(request.url);
  const parsed = parseSharePath(url.pathname);
  const origin = url.origin;

  if (!parsed) {
    return Response.redirect(`${origin}/`, 302);
  }

  const { type, id } = parsed;
  const appUrl = buildAppRedirectUrl(type, id, { origin });
  const gatewayUrl = buildGatewayShareUrl(type, id, { origin });
  const defaultImage = `${origin}/og-image.png`;
  const data = await loadShareData(type, id);
  const ok = data && data.status === "ok";

  const html = renderSharePage({
    title: ok ? data.title : DEFAULT_TITLE,
    description: ok ? data.description : DEFAULT_DESCRIPTION,
    image: (ok && data.image) || defaultImage,
    gatewayUrl,
    appUrl,
  });

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, s-maxage=300",
    },
  });
};

export const config = { path: "/s/*" };
