import assert from "node:assert/strict";
import test from "node:test";

import {
  getLeagueDetail,
  getLeagueMatchNeeds,
  getLeagueRules,
  listLeagues,
  listMyLeagues,
} from "./leagues";
import {
  getPlayerPersonalDetails,
  patchPlayerPersonalDetails,
} from "./playerProfile";

test("getLeagueMatchNeeds sends scope=all query", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ league: { id: 10, name: "Flex" }, needs: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await getLeagueMatchNeeds({ leagueId: 10, token: "abc", scope: "all" });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.match(requestedUrl, /\/leagues\/10\/match-needs\?scope=all$/);
});

test("league API exports stable browse path helpers", async () => {
  const leaguesApi = await import("./leagues");

  assert.equal(leaguesApi.buildLeagueListPath?.("available"), "/leagues?segment=available");
  assert.equal(leaguesApi.buildLeagueRulesPath?.(12), "/leagues/12/rules");
});

test("listLeagues requests a segmented browse response", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      leagues: [{ id: 10, name: "Penmar 3.5 Flex", status: "active" }],
      sections: {
        mine: [],
        available: [{ id: 10, name: "Penmar 3.5 Flex", status: "active" }],
        archived: [],
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const response = await listLeagues({ segment: "available", token: "abc" });
    assert.equal(response.sections.available[0]?.id, 10);
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.match(requestedUrl, /\/leagues\?segment=available$/);
});

test("listMyLeagues remains a compatibility wrapper over the mine segment", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      leagues: [{ id: 22, name: "Current Mine", membership_status: "active" }],
      sections: {
        mine: [{ id: 22, name: "Current Mine", membership_status: "active" }],
        available: [],
        archived: [],
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const response = await listMyLeagues({ token: "abc" });
    assert.equal(response.leagues[0]?.id, 22);
    assert.equal(response.sections.mine[0]?.id, 22);
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.match(requestedUrl, /\/leagues\?segment=mine$/);
});

test("getLeagueDetail reads the split league detail response", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      league: { id: 10, name: "Penmar 3.5 Flex", current_rules_version: "2026-summer-v1" },
      metadata: { spots_filled: 12, spots_remaining: 4, is_full: false },
      membership_state: { status: "active", joined_via: "claim", paid: true },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const response = await getLeagueDetail({ leagueId: 10, token: "abc" });
    assert.equal(response.league.id, 10);
    assert.equal(response.metadata.spots_remaining, 4);
    assert.equal(response.membership_state?.paid, true);
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.match(requestedUrl, /\/leagues\/10$/);
});

test("getLeagueRules reads the current league rules response", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      league: { id: 10, name: "Penmar 3.5 Flex", current_rules_version: "2026-summer-v1" },
      rule: {
        id: 31,
        league_id: 10,
        version: "2026-summer-v1",
        content: "Arrive on time.",
        published_at: "2026-07-09T00:00:00.000Z",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const response = await getLeagueRules({ leagueId: 10 });
    assert.equal(response.league.id, 10);
    assert.equal(response.rule?.version, "2026-summer-v1");
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.match(requestedUrl, /\/leagues\/10\/rules$/);
});

test("getPlayerPersonalDetails reads the authenticated personal details resource", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      id: 1103,
      user_id: 1001,
      gender: "other",
      date_of_birth: "1990-05-10",
      usta_rating: 3.5,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const response = await getPlayerPersonalDetails({ token: "abc" });
    assert.equal(response.user_id, 1001);
    assert.equal(response.gender, "other");
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.match(requestedUrl, /\/player\/personal_details$/);
});

test("patchPlayerPersonalDetails sends only supplied personal detail fields", async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestMethod = "";
  let requestBody = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    requestMethod = init?.method ?? "GET";
    requestBody = String(init?.body ?? "");
    return new Response(JSON.stringify({
      user_id: 1001,
      gender: "other",
      date_of_birth: "1990-05-10",
      usta_rating: 3.5,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const response = await patchPlayerPersonalDetails({
      token: "abc",
      body: {
        gender: "other",
        date_of_birth: "1990-05-10",
        usta_rating: 3.5,
        about_me: undefined,
      },
    });
    assert.equal(response.gender, "other");
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(requestMethod, "PATCH");
  assert.match(requestedUrl, /\/player\/personal_details$/);
  assert.deepEqual(JSON.parse(requestBody), {
    gender: "other",
    date_of_birth: "1990-05-10",
    usta_rating: 3.5,
  });
});
