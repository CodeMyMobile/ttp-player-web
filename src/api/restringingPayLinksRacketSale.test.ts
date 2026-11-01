import assert from "node:assert/strict";
import test from "node:test";

import { getItemSpecs, isRacketSale, payLinkItemDetail, payLinkItemTitle } from "./restringingPayLinks";

const racket = { id: 1, item_type: "racket" as const, label: "Solinco Whiteout 305 (grip 4 3/8)", grip_size: "4 3/8", unit_price_cents: 24900 };
const stringJob = {
  id: 2,
  item_type: "restring" as const,
  racket_make_model: "Solinco Whiteout 305",
  service_tier_name: "Premium polyester",
  string_description: "Shop's choice",
  advice_requested: true,
  labor_waived: true,
};

test("a new racket on the pay link is named, with no string specs", () => {
  assert.equal(isRacketSale([racket, stringJob]), true);
  assert.equal(isRacketSale([stringJob]), false);
  assert.equal(payLinkItemTitle(racket), "Solinco Whiteout 305 (grip 4 3/8)");
  assert.equal(payLinkItemDetail(racket), "New racket, picked up at the shop");
  assert.deepEqual(getItemSpecs(racket), []);
});

test("its string job is set by the stringer, not at a drop-off", () => {
  assert.equal(payLinkItemTitle(stringJob), "Premium polyester");
  assert.equal(payLinkItemDetail(stringJob), "Solinco Whiteout 305 · Shop's choice");
  assert.deepEqual(getItemSpecs(stringJob), [{ label: "Specs", value: "TBD", sublabel: "set by the stringer", pending: true }]);
  assert.equal(getItemSpecs({ ...stringJob, labor_waived: false })[0].sublabel, "at drop-off");
});
