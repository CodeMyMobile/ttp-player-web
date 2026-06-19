import assert from "node:assert/strict";
import test from "node:test";

import { getScrollResetKey } from "./routerScroll.js";

test("getScrollResetKey resets only when pathname changes", () => {
  assert.equal(
    getScrollResetKey({ pathname: "/matches", search: "?tab=mine", hash: "#top" }),
    "/matches",
  );
  assert.equal(
    getScrollResetKey({ pathname: "/matches/123", search: "", hash: "" }),
    "/matches/123",
  );
});
