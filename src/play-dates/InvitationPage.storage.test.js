import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./InvitationPage.jsx", import.meta.url), "utf8");

test("invite auth persists shared app session payload", () => {
  assert.match(source, /localStorage\.setItem\("authLoginResponse", JSON\.stringify\(data\)\)/);
  assert.match(source, /localStorage\.setItem\("playerPersonalDetails", JSON\.stringify\(/);
});
