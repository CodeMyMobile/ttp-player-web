import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { readFile, readdir, writeFile } from "node:fs/promises";

const omitNoindexProfilesFromSitemap = () => ({
  name: "omit-noindex-profiles-from-sitemap",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const coachDir = new URL("coaches/", dir);
      const entries = await readdir(coachDir, { withFileTypes: true }).catch(() => []);
      const excluded = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
        const html = await readFile(new URL(`${entry.name}/index.html`, coachDir), "utf8");
        return /name="robots" content="noindex, follow"/.test(html) ? entry.name : null;
      }));
      if (!excluded.some(Boolean)) return;
      const sitemapFile = new URL("sitemap-0.xml", dir);
      const xml = await readFile(sitemapFile, "utf8");
      const next = excluded.filter(Boolean).reduce((result, slug) => result.replace(`<url><loc>https://thetennisplan.com/coaches/${slug}/</loc></url>`, ""), xml);
      await writeFile(sitemapFile, next);
    },
  },
});

export default defineConfig({
  site: "https://thetennisplan.com",
  output: "static",
  integrations: [sitemap(), omitNoindexProfilesFromSitemap()],
});
