import assert from "node:assert/strict";
import test from "node:test";
import {
  nextGameQuestion,
  ratingBody,
  ratingCards,
  setupLine,
  setupName,
  startingAnswers,
} from "./stringFeedback.js";

const hybrid = {
  order_item_id: 101,
  racket_make_model: "Pure Aero",
  string: { id: 11, brand: "Babolat", name: "RPM Blast" },
  crosses_string: { id: 12, brand: "Wilson", name: "NXT" },
  gauge: "17",
  tension_lbs_mains: 52,
  tension_lbs_crosses: 50,
  picked_up_at: "2026-11-07T18:00:00Z",
  can_rate: true,
  to_rate: true,
  feedback: null,
};

test("a setup is named by its strings, and described like an order line", () => {
  assert.equal(setupName(hybrid), "Babolat RPM Blast / Wilson NXT");
  assert.equal(setupName({ ...hybrid, crosses_string: null }), "Babolat RPM Blast");
  assert.equal(setupName({ string: null, own_string_text: "Luxilon Alu 16L" }), "Own string: Luxilon Alu 16L");
  const line = setupLine(hybrid);
  assert.equal(line.title, "Pure Aero");
  assert.match(line.detail, /^Babolat RPM Blast mains \/ Wilson NXT crosses · 17g · 52/);
  assert.match(line.when, /^Picked up /);
});

test("cards are the rackets the API says to ask about", () => {
  assert.deepEqual(ratingCards([hybrid, { ...hybrid, order_item_id: 2, to_rate: false }]).map((row) => row.order_item_id), [101]);
  assert.deepEqual(ratingCards(null), []);
});

test("a text rating starts the form at its stars", () => {
  assert.equal(startingAnswers({ feedback: { overall: 4, answered_via: "sms" } }).overall, 4);
  assert.deepEqual(startingAnswers(hybrid), {
    overall: 0, again: null, feel: null, spin: null, control: null, comfort: null, arm_discomfort: null, comment: "",
  });
});

test("the API gets overall, what was answered, and consent the first time", () => {
  const answers = { ...startingAnswers(hybrid), overall: 5, feel: "right", spin: 3, arm_discomfort: false, comment: "  Lovely  " };
  assert.deepEqual(ratingBody(answers, { consented: false }), {
    overall: 5, feel: "right", spin: 3, arm_discomfort: false, comment: "Lovely", consent: true,
  });
  assert.deepEqual(ratingBody({ ...startingAnswers(hybrid), overall: 2 }, { consented: true }), { overall: 2 });
});

test("one game question at a time, only those not answered", () => {
  assert.equal(nextGameQuestion(null).key, "swing");
  assert.equal(nextGameQuestion({ swing: "full" }).key, "play_style");
  assert.equal(nextGameQuestion({ swing: "full", play_style: "net" }), null);
});
