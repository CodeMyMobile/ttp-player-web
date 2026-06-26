import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
} from "./authValidation.js";

test("validateEmail", () => {
  assert.equal(validateEmail("you@example.com"), "");
  assert.equal(validateEmail(""), "Email is required.");
  assert.equal(validateEmail("nope"), "Enter a valid email address.");
  assert.equal(validateEmail("a@b"), "Enter a valid email address.");
});

test("validatePhone is optional by default", () => {
  assert.equal(validatePhone(""), "");
  assert.equal(validatePhone("(310) 555-0123"), "");
  assert.equal(validatePhone("310555012"), "Enter a 10-digit US phone number.");
  assert.equal(validatePhone("", { required: true }), "Phone number is required.");
});

test("validatePassword enforces length only on signup", () => {
  assert.equal(validatePassword(""), "Password is required.");
  assert.equal(validatePassword("short"), "");
  assert.equal(
    validatePassword("short", { isSignup: true }),
    "Password must be at least 8 characters.",
  );
  assert.equal(validatePassword("longenough", { isSignup: true }), "");
});

test("validateName", () => {
  assert.equal(validateName("Paul", "First name"), "");
  assert.equal(validateName("  ", "First name"), "First name is required.");
});
