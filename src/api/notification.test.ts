import test from "node:test";
import assert from "node:assert/strict";

import { unreadNotificationCount } from "./notification";

test("reads the API's { count }, which arrives as a string", () => {
  assert.equal(unreadNotificationCount({ count: "3" }), 3);
  assert.equal(unreadNotificationCount({ count: 2 }), 2);
  assert.equal(unreadNotificationCount({ data: { count: "1" } }), 1);
});

test("still honours unread, and anything unusable is zero", () => {
  assert.equal(unreadNotificationCount({ unread: 4 }), 4);
  assert.equal(unreadNotificationCount({ count: "0" }), 0);
  assert.equal(unreadNotificationCount({}), 0);
  assert.equal(unreadNotificationCount(null), 0);
  assert.equal(unreadNotificationCount({ count: "abc" }), 0);
});
