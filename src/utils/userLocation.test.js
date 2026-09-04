import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_POSITION,
  DEFAULT_RADIUS_MILES,
  getSearchLocation,
  hasLocationDraftChanged,
  initialLocationState,
  locationNameFromReverseGeocode,
  shouldPromptForLocationAfterLogin,
} from "./userLocation";

const EARTH_MILES = 3958.8;
const toRad = (deg) => (deg * Math.PI) / 180;

const milesBetween = (a, b) => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.sqrt(h));
};

// The areas the product actually serves, as drawn in docs/home-states.
const SERVED = {
  "Penmar Recreation Center": { latitude: 33.9975, longitude: -118.4637 },
  "Mar Vista": { latitude: 34.0028, longitude: -118.431 },
  "Santa Monica": { latitude: 34.0195, longitude: -118.4912 },
  Westwood: { latitude: 34.0635, longitude: -118.4455 },
  "Culver City": { latitude: 34.0211, longitude: -118.3965 },
  Brentwood: { latitude: 34.052, longitude: -118.476 },
  "Playa Vista": { latitude: 33.9764, longitude: -118.425 },
};

test("the default location puts every served area inside the default radius", () => {
  // The regression this guards: the default was Downtown LA, which left all of
  // these outside the radius, so a player who had not set a location saw an
  // empty feed with no explanation.
  for (const [name, coords] of Object.entries(SERVED)) {
    const miles = milesBetween(DEFAULT_POSITION, coords);
    assert.ok(
      miles <= DEFAULT_RADIUS_MILES,
      `${name} is ${miles.toFixed(1)}mi from the default, outside the ${DEFAULT_RADIUS_MILES}mi radius`,
    );
  }
});

test("the default sits in West LA, not somewhere a coordinate typo could land", () => {
  assert.ok(DEFAULT_POSITION.latitude > 33.9 && DEFAULT_POSITION.latitude < 34.2);
  assert.ok(DEFAULT_POSITION.longitude > -118.6 && DEFAULT_POSITION.longitude < -118.3);
});

test("search location prefers a saved player location over the default", () => {
  const previousLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      return key === "player:web:user-location"
        ? JSON.stringify({ latitude: 34.1, longitude: -118.3 })
        : null;
    },
  };

  try {
    assert.deepEqual(getSearchLocation(), { latitude: 34.1, longitude: -118.3 });
  } finally {
    globalThis.localStorage = previousLocalStorage;
  }
});

test("search location falls back when the player has not saved a location", () => {
  const previousLocalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null };

  try {
    assert.deepEqual(getSearchLocation(), DEFAULT_POSITION);
  } finally {
    globalThis.localStorage = previousLocalStorage;
  }
});

test("reverse geocoding supplies the navbar's city and full location label", () => {
  assert.deepEqual(
    locationNameFromReverseGeocode({
      address: { city: "Santa Monica", state: "California", country_code: "us" },
    }),
    { area: "Santa Monica", label: "Santa Monica, California, US" },
  );
});

test("login prompts for location whenever no location is saved, including already-granted permission", () => {
  assert.equal(shouldPromptForLocationAfterLogin({ hasSavedLocation: true, permission: "denied" }), false);
  assert.equal(shouldPromptForLocationAfterLogin({ hasSavedLocation: false, permission: "granted" }), true);
  assert.equal(shouldPromptForLocationAfterLogin({ hasSavedLocation: false, permission: "prompt" }), true);
  assert.equal(shouldPromptForLocationAfterLogin({ hasSavedLocation: false, permission: "denied" }), true);
});

test("initial picker state reflects browser availability and permission", () => {
  assert.equal(initialLocationState({ geolocationAvailable: false, permission: "granted" }), "unavailable");
  assert.equal(initialLocationState({ geolocationAvailable: true, permission: "prompt" }), "prompt");
  assert.equal(initialLocationState({ geolocationAvailable: true, permission: "granted" }), "granted");
  assert.equal(initialLocationState({ geolocationAvailable: true, permission: "denied" }), "denied");
});

test("a filter draft changes only when its location or radius differs from what is committed", () => {
  const committed = {
    location: { latitude: 34.0028, longitude: -118.431 },
    radiusMiles: 10,
  };

  assert.equal(hasLocationDraftChanged({ committed, draft: committed }), false);
  assert.equal(
    hasLocationDraftChanged({
      committed,
      draft: { ...committed, radiusMiles: 15 },
    }),
    true,
  );
  assert.equal(
    hasLocationDraftChanged({
      committed,
      draft: { ...committed, location: { latitude: 34.0195, longitude: -118.4912 } },
    }),
    true,
  );
});
