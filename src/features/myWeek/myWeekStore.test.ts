import test from "node:test";
import assert from "node:assert/strict";

import { createMyWeekStore } from "./myWeekStore";
import type { MyWeekLoad } from "./loadMyWeek";

const week = (label: string): MyWeekLoad => ({ items: [{ id: label } as never], errors: {} });

const controllable = () => {
  let clock = 1_000_000;
  let calls = 0;
  const pending: Array<(value: MyWeekLoad) => void> = [];
  const store = createMyWeekStore(
    () => {
      calls += 1;
      return new Promise<MyWeekLoad>((resolve) => pending.push(resolve));
    },
    { now: () => clock, staleAfterMs: 60_000 },
  );
  return {
    store,
    calls: () => calls,
    resolveNext: (value: MyWeekLoad) => pending.shift()?.(value),
    advance: (ms: number) => {
      clock += ms;
    },
  };
};

test("two screens asking at once share one load", async () => {
  const t = controllable();
  const a = t.store.ensureFresh();
  const b = t.store.ensureFresh();
  assert.equal(t.calls(), 1);
  assert.equal(t.store.getSnapshot().loading, true);
  t.resolveNext(week("first"));
  await Promise.all([a, b]);
  assert.equal(t.store.getSnapshot().loading, false);
  assert.equal((t.store.getSnapshot().data?.items[0] as { id: string }).id, "first");
});

test("a week under a minute old isn't fetched again; an older one is", async () => {
  const t = controllable();
  const first = t.store.ensureFresh();
  t.resolveNext(week("first"));
  await first;

  t.advance(59_000);
  await t.store.ensureFresh();
  assert.equal(t.calls(), 1);

  t.advance(2_000);
  const second = t.store.ensureFresh();
  assert.equal(t.calls(), 2);
  t.resolveNext(week("second"));
  await second;
  assert.equal((t.store.getSnapshot().data?.items[0] as { id: string }).id, "second");
});

test("a change (accept, booking) reloads straight away, even when fresh", async () => {
  const t = controllable();
  const first = t.store.ensureFresh();
  t.resolveNext(week("first"));
  await first;

  const reloaded = t.store.reload();
  assert.equal(t.calls(), 2);
  t.resolveNext(week("after accept"));
  await reloaded;
  assert.equal((t.store.getSnapshot().data?.items[0] as { id: string }).id, "after accept");
});

test("subscribers hear about loading and the result; sign-out clears the week", async () => {
  const t = controllable();
  let heard = 0;
  const unsubscribe = t.store.subscribe(() => {
    heard += 1;
  });
  const first = t.store.ensureFresh();
  t.resolveNext(week("first"));
  await first;
  assert.equal(heard, 2);

  t.store.clear();
  assert.equal(t.store.getSnapshot().data, undefined);
  unsubscribe();
});

test("a load still running when the player signs out doesn't bring the week back", async () => {
  const t = controllable();
  const running = t.store.ensureFresh();
  t.store.clear();
  t.resolveNext(week("stale"));
  await running;
  assert.equal(t.store.getSnapshot().data, undefined);
});
