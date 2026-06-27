// Reusable LegalPage layout for the statically-generated /privacy and /terms
// pages. Produces a self-contained HTML document (inline CSS so the page renders
// fully and correctly for crawlers/OAuth reviewers, independent of the SPA's
// hashed Tailwind bundle). Design tokens mirror src/lib/theme.ts / index.css.

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const STYLES = `
  :root {
    --brand: #8B5CF6;
    --brand-dark: #7C3AED;
    --ink: #101828;
    --body: #475467;
    --subtle: #667085;
    --border: #E4E7EC;
    --bg: #F5F7FB;
    --surface: #FFFFFF;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--body);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.65;
  }
  .legal-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .legal-header__inner,
  .legal__body,
  .legal-footer__inner {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 20px;
  }
  .legal-header__inner { display: flex; align-items: center; min-height: 64px; }
  .legal-brand {
    font-weight: 700;
    font-size: 18px;
    color: var(--ink);
    text-decoration: none;
  }
  .legal-brand em { color: var(--brand); font-style: normal; }
  main.legal { padding: 40px 0 56px; }
  .legal__body { color: var(--body); }
  .legal__body h1 {
    color: var(--ink);
    font-size: 32px;
    line-height: 1.2;
    margin: 0 0 8px;
  }
  .legal__body h2 {
    color: var(--ink);
    font-size: 22px;
    line-height: 1.3;
    margin: 36px 0 12px;
  }
  .legal__body h3 {
    color: var(--ink);
    font-size: 18px;
    margin: 28px 0 10px;
  }
  .legal__body p { margin: 0 0 16px; }
  .legal__body ul, .legal__body ol { margin: 0 0 16px; padding-left: 22px; }
  .legal__body li { margin: 6px 0; }
  .legal__body a { color: var(--brand); text-decoration: underline; }
  .legal__body a:hover { color: var(--brand-dark); }
  .legal__body blockquote {
    margin: 0 0 20px;
    padding: 12px 16px;
    border-left: 3px solid var(--brand);
    background: #F4F0FF;
    border-radius: 8px;
    color: var(--subtle);
  }
  .legal__body code {
    background: #F2F4F7;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 0.9em;
  }
  .table-wrap { overflow-x: auto; margin: 0 0 20px; -webkit-overflow-scrolling: touch; }
  .legal__body table {
    width: 100%;
    border-collapse: collapse;
    font-size: 15px;
    min-width: 480px;
  }
  .legal__body th, .legal__body td {
    border: 1px solid var(--border);
    padding: 10px 12px;
    text-align: left;
    vertical-align: top;
  }
  .legal__body th { background: #F9FAFB; color: var(--ink); font-weight: 600; }
  .legal-footer {
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .legal-footer__inner {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    align-items: center;
    padding-top: 24px;
    padding-bottom: 24px;
    font-size: 14px;
    color: var(--subtle);
  }
  .legal-footer a { color: var(--subtle); text-decoration: none; }
  .legal-footer a:hover { color: var(--brand-dark); text-decoration: underline; }
  .legal-footer__spacer { flex: 1 1 auto; }
  @media (max-width: 600px) {
    .legal__body h1 { font-size: 27px; }
    .legal__body h2 { font-size: 20px; }
  }
`;

/**
 * @param {object} opts
 * @param {string} opts.title          Page <title> / SEO title
 * @param {string} opts.description    Meta description
 * @param {string} opts.canonical      Absolute canonical URL
 * @param {string} opts.contentHtml    Rendered markdown body (HTML)
 * @param {string} opts.appUrl         Absolute URL back to the app home
 */
export const renderLegalPage = ({ title, description, canonical, contentHtml, appUrl }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <style>${STYLES}</style>
  </head>
  <body>
    <header class="legal-header">
      <div class="legal-header__inner">
        <a class="legal-brand" href="${escapeHtml(appUrl)}">The Tennis <em>Plan</em></a>
      </div>
    </header>
    <main class="legal">
      <article class="legal__body">
${contentHtml}
      </article>
    </main>
    <footer class="legal-footer">
      <div class="legal-footer__inner">
        <span>&copy; The Tennis Plan</span>
        <span class="legal-footer__spacer"></span>
        <a href="/privacy/">Privacy Policy</a>
        <a href="/terms/">Terms of Service</a>
        <a href="${escapeHtml(appUrl)}">Back to app</a>
      </div>
    </footer>
  </body>
</html>
`;
