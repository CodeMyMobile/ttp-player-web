// Build-time generator for the public legal pages.
//
// Reads the committed markdown in src/content/, renders it to static HTML with
// the shared LegalPage layout, and writes real prerendered files into dist/ so
// Netlify serves them directly — outside the HashRouter SPA, fully rendered for
// crawlers / OAuth reviewers, with no auth guard and no runtime fetch.
//
// Output:
//   dist/privacy/index.html   -> served at /privacy
//   dist/terms/index.html     -> served at /terms
//
// Runs after `vite build` (see package.json "build" script).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { renderLegalPage } from "./legal-template.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CONTENT_DIR = resolve(ROOT, "src/content");
const DIST_DIR = resolve(ROOT, "dist");

// Canonical origin for the deployed app (see index.html og:url).
const SITE_ORIGIN = "https://app.thetennisplan.com";

const PAGES = [
  {
    slug: "privacy",
    source: "privacy.md",
    title: "Privacy Policy | The Tennis Plan",
    description:
      "How The Tennis Plan collects, uses, and shares your information when you use our tennis app.",
  },
  {
    slug: "terms",
    source: "terms.md",
    title: "Terms of Service | The Tennis Plan",
    description:
      "The terms that govern your use of The Tennis Plan tennis app, bookings, and payments.",
  },
];

// GitHub-flavored markdown with tables enabled.
marked.setOptions({ gfm: true });

// Make wide tables (e.g. the privacy sharing table) horizontally scrollable on
// mobile instead of overflowing the viewport.
const wrapTables = (html) =>
  html
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");

const buildPage = async (page) => {
  const sourcePath = resolve(CONTENT_DIR, page.source);
  let markdown;
  try {
    markdown = await readFile(sourcePath, "utf8");
  } catch {
    throw new Error(
      `[build-legal] Missing content file: ${sourcePath}. ` +
        `Add it (committed markdown) before building.`,
    );
  }

  const contentHtml = wrapTables(marked.parse(markdown));
  const canonical = `${SITE_ORIGIN}/${page.slug}`;
  const document = renderLegalPage({
    title: page.title,
    description: page.description,
    canonical,
    contentHtml,
    appUrl: `${SITE_ORIGIN}/`,
  });

  const outDir = resolve(DIST_DIR, page.slug);
  await mkdir(outDir, { recursive: true });
  const outFile = resolve(outDir, "index.html");
  await writeFile(outFile, document, "utf8");
  console.log(`[build-legal] wrote ${outFile.replace(`${ROOT}/`, "")}  (/${page.slug})`);
};

const main = async () => {
  for (const page of PAGES) {
    await buildPage(page);
  }
};

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
