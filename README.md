# Matchplay Player Web

## Find Coaches page

The `/find-coaches` route renders the pixel-faithful **Find Coaches** experience. It reuses the existing navigation, so selecting **Find Coaches** from the dashboard nav loads this page.

- **Design tokens** live in [`src/lib/theme.ts`](src/lib/theme.ts). They expose the extracted colors, typography, radius, and shadows used throughout the new UI. Components read these tokens through CSS custom properties, enabling quick tweaks without touching markup.
- **Mock data** for the listing sits in [`src/data/mockCoaches.ts`](src/data/mockCoaches.ts). Update or expand this file to adjust the sample coaches. The UI reads from this module only—no network calls are made.
- **UI components** specific to the page live under [`src/components/coaches`](src/components/coaches). The page composition itself is in [`src/pages/FindCoaches.tsx`](src/pages/FindCoaches.tsx).

## Credits functionality

The `/credits` route now ships a dedicated **Lesson credits** experience that lets players browse their saved packages, review balances, and explore eligible lesson types for each coach.

- **Credits page** lives in [`src/pages/CreditsPage.tsx`](src/pages/CreditsPage.tsx) with its styles in [`src/pages/CreditsPage.css`](src/pages/CreditsPage.css).
- **Credits data** is sourced through the package credits APIs defined in [`src/api/playerPackages.ts`](src/api/playerPackages.ts).
- **Navigation entry** for Credits is configured in [`src/components/MainLayout.tsx`](src/components/MainLayout.tsx).

### Local development

```bash
npm install
npm run dev
```

Navigate to `http://localhost:5173/ttp-player-web/find-coaches` (or click **Find Coaches** in the in-app navigation) to view the page. Enter `error` or `empty` in the search field to preview the simulated error or empty states.
