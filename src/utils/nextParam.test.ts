import assert from "node:assert/strict";
import test from "node:test";

import { readNextParam } from "./nextParam.ts";

test("accepts an in-app absolute path", () => {
  assert.equal(readNextParam("?next=/find-coaches"), "/find-coaches");
  assert.equal(readNextParam("?next=/coaches/26"), "/coaches/26");
  assert.equal(readNextParam("?next=%2Ffind-coaches"), "/find-coaches");
  assert.equal(readNextParam("?next=/find-coaches&mode=signup"), "/find-coaches");
});

test("returns null when there is nothing to honour", () => {
  const empty: Array<string | undefined | null> = ["", "?", undefined, null, "?mode=signup", "?next=", "?next=%20%20"];
  for (const search of empty) {
    assert.equal(readNextParam(search), null, `search: ${String(search)}`);
  }
});

/**
 * The redirect fires on a page that has just issued a session, so anything that can leave
 * the origin is the whole risk. Each of these is a documented way past a bare
 * startsWith("/") check.
 */
test("refuses destinations that could leave the app", () => {
  const hostile = [
    "?next=https://evil.example/steal",
    "?next=http://evil.example",
    "?next=//evil.example",
    "?next=%2F%2Fevil.example",
    "?next=/\\evil.example",
    "?next=/\\/evil.example",
    "?next=javascript:alert(1)",
    "?next=data:text/html,x",
    "?next=find-coaches",
    "?next=%20https://evil.example",
  ];
  for (const search of hostile) {
    assert.equal(readNextParam(search), null, `should refuse: ${search}`);
  }
});

test("a malformed escape is refused rather than guessed at", () => {
  assert.equal(readNextParam("?next=%E0%A4%A"), null);
});
