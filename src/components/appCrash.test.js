import test from "node:test";
import assert from "node:assert/strict";
import { crashComponents, crashDetails, crashEventProps, routePattern } from "./appCrash.js";

const stack = `
    at UpcomingCard (http://localhost/src/pages/HomePage.tsx:120:9)
    at div
    at HomePage (http://localhost/src/pages/HomePage.tsx:40:3)
    at ProtectedRoute (http://localhost/src/App.jsx:90:3)`;

test("routes keep their shape but lose ids and tokens", () => {
  assert.equal(routePattern("#/matches/477/invite"), "/matches/:id/invite");
  assert.equal(routePattern("#/reset-password/abcdefghijklmnopqrstuvwxyz123"), "/reset-password/:id");
  assert.equal(routePattern("#/pay/abcdefghijklmnopqrstuvwxyzabcdef?x=1"), "/pay/:id");
  assert.equal(routePattern("#/"), "/");
  assert.equal(routePattern(""), "/");
  assert.equal(routePattern("#/my-coaches"), "/my-coaches");
});

test("the component stack is read as component names, innermost first", () => {
  assert.deepEqual(crashComponents(stack), ["UpcomingCard", "HomePage", "ProtectedRoute"]);
  assert.deepEqual(crashComponents(""), []);
});

test("the report carries the error, the route pattern and the components, nothing else", () => {
  const error = new TypeError("Cannot read properties of undefined (reading 'map')");
  assert.deepEqual(crashEventProps({ error, componentStack: stack, hash: "#/matches/477" }), {
    message: "TypeError: Cannot read properties of undefined (reading 'map')",
    route: "/matches/:id",
    components: "UpcomingCard < HomePage < ProtectedRoute",
  });
  assert.equal(crashEventProps({ error: new Error("x".repeat(500)), componentStack: "", hash: "" }).message.length, 301);
});

test("the details on screen say what, where and when", () => {
  const details = crashDetails({
    error: new TypeError("boom"),
    componentStack: stack,
    hash: "#/",
    at: new Date("2026-11-01T20:00:00Z"),
    userAgent: "Safari",
  });
  assert.equal(
    details,
    ["TypeError: boom", "Page: /", "In: UpcomingCard < HomePage < ProtectedRoute", "When: 2026-11-01T20:00:00.000Z", "Browser: Safari"].join("\n"),
  );
});
