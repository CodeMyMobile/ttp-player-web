import assert from "node:assert/strict";
import { test } from "node:test";
import { readDirectPage } from "./directPage.js";

test("pay links render the invoice with or without the hash HashRouter adds", () => {
  assert.deepEqual(readDirectPage({ pathname: "/pay/6r4fk5a8", hash: "" }), { payToken: "6r4fk5a8" });
  assert.deepEqual(readDirectPage({ pathname: "/pay/6r4fk5a8", hash: "#/" }), { payToken: "6r4fk5a8" });
});

test("vendor slugs render the vendor page", () => {
  assert.deepEqual(readDirectPage({ pathname: "/tennis-garage/", hash: "#/" }), { vendorSlug: "tennis-garage" });
});

test("a real hash route wins over the direct path", () => {
  assert.equal(readDirectPage({ pathname: "/pay/6r4fk5a8", hash: "#/my-coaches" }), null);
  assert.equal(readDirectPage({ pathname: "/tennis-garage", hash: "#/coaches/1810" }), null);
});

test("the app root is not a direct page", () => {
  assert.equal(readDirectPage({ pathname: "/", hash: "#/" }), null);
  assert.equal(readDirectPage({ pathname: "/pay", hash: "" }), null);
});
