# Vendor Profile Share URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players open and share a vendor profile directly with a readable slug URL such as `/#/thetennisgarage`.

**Architecture:** Add small route helpers for vendor-name slugging and share-path construction, then wire React Router to pass an optional slug into `RestringingPlayerFlow`. The flow will resolve the slug after vendors load, open the existing profile screen, and update profile links to the slug route.

**Tech Stack:** React 19, Vite, React Router HashRouter, Node test runner.

## Global Constraints

- Keep current HashRouter behavior; `/#/thetennisgarage` is the primary share URL.
- Support `/thetennisgarage` as a direct browser path only via lightweight redirect bridge when app host serves SPA.
- Do not require backend schema changes.
- Follow existing JSX style in `RestringingPlayerFlow.jsx`.

---

### Task 1: Route Helpers

**Files:**
- Create: `src/restringing/vendorProfileRoutes.js`
- Test: `src/restringing/vendorProfileRoutes.test.js`

**Interfaces:**
- Produces: `vendorSlug(value: string): string`
- Produces: `findVendorBySlug(vendors: Array<object>, slug: string): object | null`
- Produces: `vendorProfilePath(vendor: object): string`

- [x] Write failing tests for `The Tennis Garage -> thetennisgarage`, matching vendor by name slug, and path `"/thetennisgarage"`.
- [x] Run `npm test -- src/restringing/vendorProfileRoutes.test.js`; expect module-not-found failure.
- [x] Implement helper module.
- [x] Rerun same test; expect pass.

### Task 2: Router + Flow

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/restringing/RestringingPlayerFlow.jsx`

**Interfaces:**
- Consumes: `vendorSlug?: string` prop on `RestringingPlayerFlow`
- Consumes: route `/:vendorSlug` for public vendor profile slugs

- [x] Add route `/:vendorSlug` that renders `RestringingPlayerFlow`.
- [x] In `RestringingPlayerFlow`, resolve `vendorSlug` after vendors load and open profile directly.
- [x] Replace “View full profile” button navigation with `Link` to `vendorProfilePath(vendor)`.
- [x] When opening profile imperatively, update hash URL with `navigate(vendorProfilePath(vendor))`.
- [x] Run `npm test -- src/restringing/vendorProfileRoutes.test.js`.
- [x] Run `npm run build`.
