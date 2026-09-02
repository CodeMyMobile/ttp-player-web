import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AVAILABILITY_SENTENCE,
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

test("the message fills every placeholder", () => {
  const message = buildContactMessage({
    recipientName: "Alex Gerszten",
    senderName: "Paul Cochrane",
    leagueName: "Men's 4.0 Fall Flex 2026",
  });
  assert.equal(
    message,
    "Hi Alex — Paul here from the Men's 4.0 Fall Flex 2026.\nWant to get our match in?",
  );
  assert.ok(!message.includes("{"), "no placeholder may survive");
});

test("availability is appended only when there is some", () => {
  const base = { recipientName: "Alex", senderName: "Paul", leagueName: "L" };
  assert.ok(!buildContactMessage(base).includes(AVAILABILITY_SENTENCE.slice(0, 10)));
  assert.ok(!buildContactMessage({ ...base, availability: "   " }).endsWith("."));
  assert.ok(buildContactMessage({ ...base, availability: "weekday evenings" })
    .endsWith("I'm usually free weekday evenings."));
});

test("a missing name degrades to something sendable", () => {
  const message = buildContactMessage({ recipientName: "", senderName: "", leagueName: "" });
  assert.ok(message.includes("there"));
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
  levelLabel: "4.0",
  ...over,
});

test("the vCard name keeps the league context", () => {
  assert.equal(vCardDisplayName(player()), "Alex Gerszten (4.0 flex)");
  assert.equal(vCardDisplayName(player({ levelLabel: null })), "Alex Gerszten");
});

test("a vCard block is well formed", () => {
  const card = buildVCard(player());
  assert.ok(card);
  assert.ok(card.startsWith("BEGIN:VCARD\r\nVERSION:3.0"));
  assert.ok(card.includes("FN:Alex Gerszten (4.0 flex)"));
  assert.ok(card.includes("TEL;TYPE=CELL:+13105550148"));
  assert.ok(card.endsWith("END:VCARD"));
});

test("structural characters in a name are escaped", () => {
  // An unescaped semicolon silently truncates the field on import.
  const card = buildVCard(player({ name: "Smith; Jones, Jr." }));
  assert.ok(card?.includes("\\;"));
  assert.ok(card?.includes("\\,"));
});

test("the file contains only opted-in players", () => {
  const file = buildVCardFile([
    player(),
    player({ playerId: "2", name: "No Consent", shareContact: false }),
    player({ playerId: "3", name: "Bea Ito", phone: "3105550199" }),
  ]);
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
  assert.equal(vCardFileName("Men's 4.0 Fall Flex 2026"), "mens-4-0-fall-flex-2026-contacts.vcf");
  assert.equal(vCardFileName(""), "league-contacts.vcf");
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
