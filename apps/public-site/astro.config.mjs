import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://thetennisplan.com",
  output: "static",
  integrations: [sitemap()],
});
