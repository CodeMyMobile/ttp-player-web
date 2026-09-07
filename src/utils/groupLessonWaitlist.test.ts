import test from "node:test";
import assert from "node:assert/strict";
import { getGroupLessonWaitlistState, runGroupLessonWaitlistAction } from "./groupLessonWaitlist";

test("only full upcoming type-3 lessons offer joining", () => {
  for (const [lessonTypeId, full, cancelled, upcoming, canJoin] of [
    [3, true, false, true, true], [4, true, false, true, false],
    [3, false, false, true, false], [3, true, true, true, false],
    [3, true, false, false, false],
  ] as const) {
    assert.equal(getGroupLessonWaitlistState({ lessonTypeId, cancelled }, full, upcoming).canJoin, canJoin);
  }
});

test("own position, status, and leaving survive capacity opening or cancellation while booking remains available when open", () => {
  for (const [full, cancelled] of [[true, false], [false, false], [false, true], [true, true]]) {
    const state = getGroupLessonWaitlistState({ lessonTypeId: 3, waitlistPosition: 2, cancelled }, full, true);
    assert.equal(state.isWaitlisted, true);
    assert.equal(state.shouldShowStatus, true);
    assert.equal(state.canLeave, true);
    assert.equal(state.canBook, !full && !cancelled);
    assert.equal(state.canJoin, false);
  }
});

for (const action of ["join", "leave"] as const) {
  test(`${action} applies success even when its refresh fails`, async () => {
    const applied: unknown[] = [];
    const response = action === "join" ? { waitlist_position: 2, waitlist_count: 3 } : undefined;
    const result = await runGroupLessonWaitlistAction({
      mutate: async () => response,
      applySuccess: value => applied.push(value),
      refresh: async () => { throw new Error("Offline"); },
    });
    assert.deepEqual(applied, [response]);
    assert.equal(result.refreshFailed, true);
  });
}

test("a failed waitlist mutation does not apply success or refresh", async () => {
  let touched = false;
  await assert.rejects(runGroupLessonWaitlistAction({
    mutate: async () => { throw new Error("already_waitlisted"); },
    applySuccess: () => { touched = true; }, refresh: async () => { touched = true; },
  }), /already_waitlisted/);
  assert.equal(touched, false);
});
