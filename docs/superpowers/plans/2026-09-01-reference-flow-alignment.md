# Reference restring flow alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tier-first restring navigation with the supplied reference's string-first flow while retaining production checkout.

**Architecture:** One explicit selection object (`mode`, exact string, family request, or own string) drives every screen. Public APIs provide stock/recommendation data; authentication begins only at Order here and existing checkout remains behind it.

**Tech Stack:** React, React Router, Vite, Node test runner, existing API client.

**Spec:** `docs/superpowers/specs/2026-09-01-reference-flow-alignment.md`

## Global Constraints

- Discovery/questions are public; order/payment are authenticated.
- Remove generic tier-first entry navigation.
- Preserve existing Stripe checkout and order tracking.
- Render mobile/desktop reference hierarchy from one state model.

---

### Task 1: Model the reference selection state

**Files:**
- Modify: `src/restringing/playerFlow.js`
- Modify: `src/restringing/playerFlow.test.js`

**Interfaces:**
- Produces `createSelection(input)` and `nextScreenForVendor(selection)`.

- [ ] **Step 1: Write the failing selection test**

```js
assert.equal(nextScreenForVendor({ mode: "own" }), "rackets");
assert.equal(nextScreenForVendor({ mode: "supplied", stringId: 9 }), "setup");
```

- [ ] **Step 2: Run the failing test**

Run: `node --test src/restringing/playerFlow.test.js`

- [ ] **Step 3: Implement the pure transitions**

```js
export const nextScreenForVendor = selection => selection.mode === "own" ? "rackets" : "setup";
```

- [ ] **Step 4: Run tests and commit**

Run: `node --test src/restringing/playerFlow.test.js`

```bash
git add src/restringing/playerFlow.js src/restringing/playerFlow.test.js
git commit -m "refactor(restringing): model reference flow state"
```

### Task 2: Replace discovery screens

**Files:**
- Modify: `src/restringing/RestringingPlayerFlow.jsx`
- Modify: `src/restringing/restringingService.js`
- Modify: `src/restringing/playerFlow.js`
- Test: `src/restringing/playerFlow.test.js`

**Interfaces:**
- Consumes catalog/recommendation APIs and Task 1 selection.
- Produces exact-string, family request, or own-string selection for vendors.

- [ ] **Step 1: Write the failing family-request test**

```js
assert.deepEqual(createSelection({ mode: "family", family: "std_multi", requestedText: "Lynx Tour" }).stringId, null);
```

- [ ] **Step 2: Run the failing test**

Run: `node --test src/restringing/playerFlow.test.js`

- [ ] **Step 3: Implement the screens**

Render Home, Whose string, preloaded/filterable stock search, no-match request/family/own fallbacks, family cards, four guided questions, and match results with stock/alternate/restart actions.

- [ ] **Step 4: Run tests, build, and commit**

Run: `node --test src/restringing/playerFlow.test.js && npm run build`

```bash
git add src/restringing/RestringingPlayerFlow.jsx src/restringing/restringingService.js src/restringing/playerFlow.js src/restringing/playerFlow.test.js
git commit -m "feat(restringing): align discovery with reference flow"
```

### Task 3: Align ordering handoff and verify

**Files:**
- Modify: `src/restringing/RestringingPlayerFlow.jsx`
- Test: `src/restringing/playerFlow.test.js`

**Interfaces:**
- Consumes selection mode and preserves it through vendor/profile/auth/setup/rackets/review.

- [ ] **Step 1: Write the failing own-string transition test**

```js
assert.equal(nextScreenForVendor({ mode: "own", ownStringText: "Hyper-G" }), "rackets");
```

- [ ] **Step 2: Run the failing test**

Run: `node --test src/restringing/playerFlow.test.js`

- [ ] **Step 3: Implement vendor/profile availability copy and guest login resume**

Exact strings show confirmed stock; family requests state drop-off confirmation and substitution; Order here resumes setup or racks after authentication.

- [ ] **Step 4: Run all verification and commit**

Run: `node --test src/restringing/playerFlow.test.js && npm run build && git diff --check`

```bash
git add src/restringing/RestringingPlayerFlow.jsx src/restringing/playerFlow.js src/restringing/playerFlow.test.js
git commit -m "feat(restringing): preserve selections through ordering"
```
