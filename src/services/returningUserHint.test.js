import assert from "node:assert/strict";
import test from "node:test";

import { clearReturningUserHint, setReturningUserHint } from "./returningUserHint.js";

const withDocument = async (run) => {
  const previousDocument = globalThis.document;
  const writes = [];
  globalThis.document = {
    set cookie(value) {
      writes.push(value);
    },
  };

  try {
    await run(writes);
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }
};

test("setReturningUserHint writes only a shared boolean cookie", async () => {
  await withDocument(async (writes) => {
    setReturningUserHint();

    assert.deepEqual(writes, [
      "tp_returning=1; Domain=.thetennisplan.com; Path=/; Max-Age=7776000; SameSite=Lax; Secure",
    ]);
  });
});

test("clearReturningUserHint expires the shared boolean cookie", async () => {
  await withDocument(async (writes) => {
    clearReturningUserHint();

    assert.deepEqual(writes, [
      "tp_returning=; Domain=.thetennisplan.com; Path=/; Max-Age=0; SameSite=Lax; Secure",
    ]);
  });
});
