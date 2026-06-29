import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./InvitationPage.jsx", import.meta.url), "utf8");

const extractFunction = (name) => {
  const start = source.indexOf(`const ${name} = async (event) => {`);
  assert.notEqual(start, -1, `${name} should exist`);

  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`Could not parse ${name}`);
};

test("invite sign-in authenticates without accepting the invite", () => {
  const signInSubmit = extractFunction("handleSignInSubmit");

  assert.match(signInSubmit, /persistSession\(data, \{ email: trimmedEmail \}\)/);
  assert.match(signInSubmit, /setPhase\("preview"\)/);
  assert.doesNotMatch(
    signInSubmit,
    /await\s+(acceptInvite|quickAcceptInvite|acceptInviteAfterExplicitJoin|completeJoin)\b/,
  );
  assert.doesNotMatch(signInSubmit, /\bcompleteJoin\(/);
});

test("invite sign-up authenticates without accepting the invite", () => {
  const signUpSubmit = extractFunction("handleSignUpSubmit");

  assert.match(signUpSubmit, /persistSession\(authPayload, fallbackDetails\)/);
  assert.match(signUpSubmit, /setPhase\("preview"\)/);
  assert.doesNotMatch(
    signUpSubmit,
    /await\s+(acceptInvite|quickAcceptInvite|acceptInviteAfterExplicitJoin|completeJoin)\b/,
  );
  assert.doesNotMatch(signUpSubmit, /\bcompleteJoin\(/);
});

test("invite auth copy no longer promises to join during authentication", () => {
  assert.doesNotMatch(
    source,
    /Sign in & Join|Sign up & Join|Joining match|Sign in to join|secure your spot|lock in this invite/,
  );
  assert.match(source, /Sign in to view the full invite/);
  assert.match(source, /review the match details/);
  assert.match(source, /Signing in\.\.\./);
  assert.match(source, /: "Sign in"/);
  assert.match(source, /: "Sign up"/);
});
