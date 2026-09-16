"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  HINT,
  MODES,
  UNITS,
  formHtml,
  holdExpired,
  readExpiryFields,
  readFromRoot,
  withExpiryDetail,
} = require("../settlement-hold-expiry");

const ROOT = path.join(__dirname, "..");
const NOW = "2026-09-16T01:00:00.000Z";
const LATER = "2026-09-16T02:00:00.000Z";

function fakeRoot(values) {
  return {
    querySelector(sel) {
      if (sel.includes("-mode]:checked") || /name="[^"]+-mode"\]:checked/.test(sel)) {
        return { value: values.mode };
      }
      if (sel.endsWith("-ttl")) return { value: values.ttl };
      if (sel.endsWith("-unit")) return { value: values.unit };
      if (sel.endsWith("-at")) return { value: values.expires_at };
      return null;
    },
  };
}

test("hold-expiry helper stays demo-only and maps one of TTL or UTC", () => {
  assert.deepEqual(MODES, ["none", "ttl", "utc"]);
  assert.equal(UNITS.seconds, 1);
  assert.equal(UNITS.minutes, 60);
  assert.match(HINT, /not both/i);
  assert.match(HINT, /release fails/i);
  assert.match(HINT, /dispute still refunds/i);
  assert.match(HINT, /not real money/i);

  const omitted = readExpiryFields({});
  assert.equal(omitted.ok, true);
  assert.deepEqual(omitted.fields, {});
  assert.equal(omitted.money, false);

  const none = readExpiryFields({ mode: "none", ttl: "60", expires_at: LATER });
  assert.equal(none.ok, true);
  assert.deepEqual(none.fields, {});

  const seconds = readExpiryFields({ mode: "ttl", ttl: 60, unit: "seconds" });
  assert.equal(seconds.ok, true);
  assert.deepEqual(seconds.fields, { ttl_seconds: 60 });

  const minutes = readExpiryFields({ mode: "ttl", ttl: "2", unit: "minutes" });
  assert.equal(minutes.ok, true);
  assert.deepEqual(minutes.fields, { ttl_seconds: 120 });

  const utc = readExpiryFields({ mode: "utc", expires_at: "2026-09-16T02:00:00Z", now: NOW });
  assert.equal(utc.ok, true);
  assert.deepEqual(utc.fields, { expires_at: LATER });
});

test("hold-expiry helper rejects bad TTL, past UTC, and junk dates", () => {
  const zero = readExpiryFields({ mode: "ttl", ttl: 0 });
  assert.equal(zero.ok, false);
  assert.equal(zero.field, "ttl_seconds");
  assert.match(zero.message, /integer/i);

  const hours = readExpiryFields({ mode: "ttl", ttl: 1, unit: "hours" });
  assert.equal(hours.ok, false);
  assert.match(hours.message, /seconds or minutes/i);

  const past = readExpiryFields({ mode: "utc", expires_at: NOW, now: NOW });
  assert.equal(past.ok, false);
  assert.equal(past.field, "expires_at");
  assert.match(past.message, /future/i);

  const junk = readExpiryFields({ mode: "utc", expires_at: "tomorrow" });
  assert.equal(junk.ok, false);
  assert.match(junk.message, /ISO-8601/i);

  const dateOnly = readExpiryFields({ mode: "utc", expires_at: "2026-09-17" });
  assert.equal(dateOnly.ok, false);
  assert.equal(dateOnly.field, "expires_at");

  const weird = readExpiryFields({ mode: "both" });
  assert.equal(weird.ok, false);
  assert.equal(weird.field, "mode");
});

test("readFromRoot and formHtml stay in sync for fund and simulate prefixes", () => {
  const html = formHtml("simulate-hold");
  assert.match(html, /<fieldset class="hold-expiry"/);
  assert.match(html, /name="simulate-hold-mode"/);
  assert.match(html, /id="simulate-hold-ttl"/);
  assert.match(html, /id="simulate-hold-unit"/);
  assert.match(html, /id="simulate-hold-at"/);
  assert.match(html, /value="seconds"/);
  assert.match(html, /value="minutes"/);
  assert.ok(html.includes(HINT));

  const fundHtml = formHtml("fund-hold");
  assert.match(fundHtml, /name="fund-hold-mode"/);
  assert.match(fundHtml, /id="fund-hold-at"/);

  const fromRoot = readFromRoot(fakeRoot({
    mode: "ttl",
    ttl: "5",
    unit: "minutes",
    expires_at: LATER,
  }), "fund-hold");
  assert.equal(fromRoot.ok, true);
  assert.deepEqual(fromRoot.fields, { ttl_seconds: 300 });

  const missing = readFromRoot(null, "fund-hold");
  assert.equal(missing.ok, false);
});

test("activity detail and expired check stay honest", () => {
  assert.equal(withExpiryDetail({ expiresAt: LATER }, "release"), `release · hold expires ${LATER}`);
  assert.equal(withExpiryDetail({ expiresAt: LATER }), `hold expires ${LATER}`);
  assert.equal(withExpiryDetail({ id: "as_0123456789" }, "fund"), "fund");
  assert.equal(holdExpired({ expiresAt: NOW }, LATER), true);
  assert.equal(holdExpired({ expiresAt: LATER }, NOW), false);
  assert.equal(holdExpired({}, NOW), false);
});

test("human UI wires optional hold expiry into fund and simulate", () => {
  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const settlement = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");

  assert.ok(homepage.includes('id="simulate-hold-expiry"'));
  assert.ok(homepage.includes('src="settlement-hold-expiry.js"'));
  assert.match(homepage, /optional hold expiry/i);
  assert.ok(homepage.includes("ttl_seconds"));
  assert.ok(homepage.includes("expires_at"));
  assert.ok(!homepage.includes("This demo fund button does not send an expiry."));

  assert.ok(app.includes("LibertyHoldExpiry"));
  assert.ok(app.includes("readFromRoot"));
  assert.ok(app.includes("expiry.fields"));
  assert.ok(app.includes("simulate-hold"));
  assert.ok(app.includes("fund-hold"));
  assert.ok(app.includes("withExpiryDetail"));
  assert.ok(!app.includes("This demo fund button does not send an expiry."));

  assert.match(settlement, /human UI/i);
  assert.match(settlement, /ttl_seconds/);
  assert.match(settlement, /expires_at/);
  assert.match(settlement, /one-click simulate walk/i);
});
