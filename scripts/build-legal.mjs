// Build-time generator for the public legal pages.
//
// Reads the committed markdown in src/content/, renders it to static HTML with
// the shared LegalPage layout, and writes real prerendered files into dist/ so
// Netlify serves them directly — outside the HashRouter SPA, fully rendered for
// crawlers / OAuth reviewers, with no auth guard and no runtime fetch.
//
// Output:
//   public/privacy/index.html -> served by Vite dev at /privacy/
//   public/terms/index.html   -> served by Vite dev at /terms/
//   dist/privacy/index.html   -> served in production at /privacy/
//   dist/terms/index.html     -> served in production at /terms/
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
const PUBLIC_DIR = resolve(ROOT, "public");
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
    slug: "code-of-conduct",
    source: "code-of-conduct.md",
    title: "Player Code of Conduct | The Tennis Plan",
    description:
      "The conduct we expect on court in every Tennis Plan class, and what happens when it is not met.",
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

// Outbound links leave in a new tab, so a reader following a citation does not
// lose the policy they were reading. `noopener` because `target="_blank"` hands
// the opened page a reference back to this one without it.
// Mirrored in src/components/group-lessons/CodeOfConductModal.tsx, which renders
// the same markdown in-app.
const externalLinksNewTab = (html) =>
  html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');

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

  const contentHtml = externalLinksNewTab(wrapTables(marked.parse(markdown)));
  const canonical = `${SITE_ORIGIN}/${page.slug}/`;
  const document = renderLegalPage({
    title: page.title,
    description: page.description,
    canonical,
    contentHtml,
    appUrl: `${SITE_ORIGIN}/`,
  });

  for (const outputRoot of [PUBLIC_DIR, DIST_DIR]) {
    const outDir = resolve(outputRoot, page.slug);
    await mkdir(outDir, { recursive: true });
    const outFile = resolve(outDir, "index.html");
    await writeFile(outFile, document, "utf8");
    console.log(`[build-legal] wrote ${outFile.replace(`${ROOT}/`, "")}  (/${page.slug}/)`);
  }
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
