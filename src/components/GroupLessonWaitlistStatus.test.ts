import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupLessonWaitlistStatus } from "./GroupLessonWaitlistStatus";

test("waitlist membership renders an enabled Leave without any capacity or cancellation dependency", () => {
  const html = renderToStaticMarkup(React.createElement(GroupLessonWaitlistStatus, {
    lesson: { waitlistPosition: 2, waitlistCount: 4 }, pending: false, onLeave() {},
  }));
  assert.match(html, /#2 on waitlist/);
  assert.match(html, /4 waiting/);
  assert.match(html, /Leave waitlist/);
  assert.doesNotMatch(html, /disabled/);
});

test("leaving hides membership immediately after mutation success", () => {
  const html = renderToStaticMarkup(React.createElement(GroupLessonWaitlistStatus, {
    lesson: { waitlistPosition: undefined, waitlistCount: 3 }, pending: false, onLeave() {},
  }));
  assert.equal(html, "");
});
