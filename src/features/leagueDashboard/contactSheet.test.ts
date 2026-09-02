import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildContactLinks,
  buildContactMessage,
  buildVCard,
  buildVCardFile,
  canSaveAllContacts,
  canShowContact,
  contactablePlayers,
  firstName,
  formatPhoneDisplay,
  toE164,
  toWhatsAppNumber,
  ratingSuffix,
  sharedContactCount,
  vCardDisplayName,
  vCardFileName,
} from "./contactSheet";

/* consent */

test("consent is opt-in — an absent flag is not a yes", () => {
  // The backend has not shipped share_contact yet. Until it does, every player
  // must read as withheld; the opposite default would publish numbers.
  assert.equal(canShowContact({ phone: "+13105550148" }), false);
  assert.equal(canShowContact({ phone: "+13105550148", shareContact: false }), false);
  assert.equal(canShowContact({ phone: "+13105550148", shareContact: true }), true);
});

test("consent without a usable number still shows nothing", () => {
  assert.equal(canShowContact({ phone: null, shareContact: true }), false);
  assert.equal(canShowContact({ phone: "not a phone", shareContact: true }), false);
});

/* phone normalisation */

test("ten digits are assumed US and gain a country code", () => {
  assert.equal(toE164("3105550148"), "+13105550148");
  assert.equal(toE164("(310) 555-0148"), "+13105550148");
  assert.equal(toE164("310.555.0148"), "+13105550148");
  assert.equal(toE164("310-555-0148"), "+13105550148");
});

test("an existing country code is preserved", () => {
  assert.equal(toE164("+1 (310) 555-0148"), "+13105550148");
  assert.equal(toE164("13105550148"), "+13105550148");
  assert.equal(toE164("+44 20 7946 0958"), "+442079460958");
});

test("anything not dialable is null, never a partial number", () => {
  // A truncated number in a tel: link dials someone else.
  for (const bad of ["", null, undefined, "abc", "555-0148", "12345"]) {
    assert.equal(toE164(bad), null, `${String(bad)} should not produce a number`);
  }
});

test("display format is the brief's, and non-US falls back to E.164", () => {
  assert.equal(formatPhoneDisplay("3105550148"), "+1 (310) 555-0148");
  assert.equal(formatPhoneDisplay("+442079460958"), "+442079460958");
  assert.equal(formatPhoneDisplay("nonsense"), "");
});

test("whatsapp takes digits only", () => {
  assert.equal(toWhatsAppNumber("+1 (310) 555-0148"), "13105550148");
  assert.ok(!toWhatsAppNumber("+13105550148").includes("+"));
});

/* the message */

test("the message fills every placeholder and is one line", () => {
  const message = buildContactMessage({
    recipientName: "Alex Gerszten",
    senderName: "Paul Cochrane",
    leagueName: "Men's 4.0 fall flex league",
  });
  assert.equal(
    message,
    "Hi Alex — Paul here from Men's 4.0 fall flex league. Want to get our match in?",
  );
  assert.ok(!message.includes("{"), "no placeholder may survive");
  assert.ok(!message.includes("\n"), "the body is a single line");
});

test("a missing name degrades to something sendable", () => {
  const message = buildContactMessage({ recipientName: "", senderName: "", leagueName: "" });
  assert.ok(message.includes("there"));
  assert.ok(message.includes("the league"));
  assert.ok(!message.includes("{"));
});

/* deeplinks */

test("all three links carry the same encoded body", () => {
  const body = "Hi Alex — Paul here.\nWant to play?";
  const links = buildContactLinks("3105550148", body);
  assert.ok(links);
  const encoded = encodeURIComponent(body);
  assert.equal(links.sms, `sms:+13105550148?body=${encoded}`);
  assert.equal(links.tel, "tel:+13105550148");
  assert.equal(links.whatsapp, `https://wa.me/13105550148?text=${encoded}`);
});

test("sms uses ?body= — the & form breaks Android", () => {
  const links = buildContactLinks("3105550148", "hi");
  assert.ok(links?.sms.includes("?body="));
  assert.ok(!links?.sms.includes("&body="));
});

test("the body is encoded exactly once", () => {
  const links = buildContactLinks("3105550148", "a b & c");
  // Double encoding would turn %20 into %2520 and the recipient would read escapes.
  assert.ok(links?.sms.includes("a%20b%20%26%20c"));
  assert.ok(!links?.sms.includes("%2520"));
});

test("no number means no links at all", () => {
  assert.equal(buildContactLinks(null, "hi"), null);
  assert.equal(buildContactLinks("nope", "hi"), null);
});

/* vCard */

const player = (over = {}) => ({
  playerId: "1",
  name: "Alex Gerszten",
  phone: "3105550148",
  shareContact: true,
  rating: 6.7,
  ntrp: "4.00",
  utr: "8.4",
  ...over,
});

test("the vCard name carries the player's own ratings", () => {
  assert.equal(ratingSuffix(player()), "TPR 6.7 · NTRP 4.00 · UTR 8.4");
  assert.equal(vCardDisplayName(player()), "Alex Gerszten (TPR 6.7 · NTRP 4.00 · UTR 8.4)");
});

test("unrated values are omitted rather than printed as blanks", () => {
  assert.equal(vCardDisplayName(player({ rating: null, utr: null })), "Alex Gerszten (NTRP 4.00)");
  // Nothing to say means no parenthetical at all.
  assert.equal(
    vCardDisplayName(player({ rating: null, ntrp: null, utr: null })),
    "Alex Gerszten",
  );
});

test("a vCard block is well formed and carries the league in NOTE", () => {
  const card = buildVCard(player(), "Men's 4.0 fall flex league");
  assert.ok(card);
  assert.ok(card.startsWith("BEGIN:VCARD\r\nVERSION:3.0"));
  assert.ok(card.includes("FN:Alex Gerszten (TPR 6.7 · NTRP 4.00 · UTR 8.4)"));
  assert.ok(card.includes("TEL;TYPE=CELL:+13105550148"));
  assert.ok(card.includes("NOTE:Men's 4.0 fall flex league"));
  assert.ok(card.endsWith("END:VCARD"));
});

test("N sorts by the real name, not by the rating string in FN", () => {
  const card = buildVCard(player(), "L");
  assert.ok(card?.includes("N:Gerszten;Alex;;;"));
});

test("a single-word name still produces a valid N line", () => {
  assert.ok(buildVCard(player({ name: "Bass" }), "L")?.includes("N:;Bass;;;"));
});

test("structural characters in a name are escaped", () => {
  // An unescaped semicolon silently truncates the field on import.
  const card = buildVCard(player({ name: "Smith; Jones, Jr." }), "L");
  assert.ok(card?.includes("\\;"));
  assert.ok(card?.includes("\\,"));
});

test("the file contains only opted-in players", () => {
  const file = buildVCardFile([
    player(),
    player({ playerId: "2", name: "No Consent", shareContact: false }),
    player({ playerId: "3", name: "Bea Ito", phone: "3105550199" }),
  ], "Men's 4.0 fall flex league");
  assert.ok(file);
  assert.ok(file.includes("Alex Gerszten"));
  assert.ok(file.includes("Bea Ito"));
  assert.ok(!file.includes("No Consent"), "a player who opted out must not be exported");
  assert.equal(file.match(/BEGIN:VCARD/g)?.length, 2);
});

test("no contactable players produces no file rather than an empty one", () => {
  assert.equal(buildVCardFile([]), null);
  assert.equal(buildVCardFile([player({ shareContact: false })]), null);
});

test("the filename is slugified from the league name", () => {
  assert.equal(vCardFileName("Men's 4.0 Fall Flex 2026"), "mens-4-0-fall-flex-2026.vcf");
  assert.equal(vCardFileName(""), "league.vcf");
  assert.ok(vCardFileName("A / B \\ C").endsWith(".vcf"));
});

/* the bulk action gate */

test("save all hides below two opted-in players", () => {
  assert.equal(canSaveAllContacts([]), false);
  assert.equal(canSaveAllContacts([player()]), false);
  assert.equal(canSaveAllContacts([player(), player({ playerId: "2" })]), true);
  // Opted-out players do not count toward the threshold.
  assert.equal(canSaveAllContacts([player(), player({ playerId: "2", shareContact: false })]), false);
});

test("contactablePlayers is the single filter both the list and the export use", () => {
  const all = [player(), player({ playerId: "2", shareContact: false }), player({ playerId: "3", phone: null })];
  assert.deepEqual(contactablePlayers(all).map((p) => p.playerId), ["1"]);
});

/* naming */

test("firstName takes the leading token", () => {
  assert.equal(firstName("Alex Gerszten"), "Alex");
  assert.equal(firstName("  Bea   Ito "), "Bea");
  assert.equal(firstName(""), "");
  assert.equal(firstName(null), "");
});

test("the shared count drives the footnote", () => {
  const all = [player(), player({ playerId: "2", shareContact: false }), player({ playerId: "3" })];
  assert.equal(sharedContactCount(all), 2);
});
