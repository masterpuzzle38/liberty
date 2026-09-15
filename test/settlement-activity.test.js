"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ACTIONS,
  MAX_EVENTS,
  STORAGE_KEY,
  appendEvent,
  clearEvents,
  confirmClearMessage,
  readEvents,
  writeEvents,
} = require("../settlement-activity");

const NOW = "2026-09-15T14:00:00.000Z";
const JOB_ID = "as_0123456789";

function sampleInput(overrides) {
  return {
    at: NOW,
    action: "create",
    job_id: JOB_ID,
    client_ref: "agent-job-42",
    ...overrides,
  };
}

test("activity helpers stay demo-only and cap newest-first", () => {
  assert.equal(STORAGE_KEY, "liberty.agent-settlement.activity.v0");
  assert.equal(MAX_EVENTS, 80);
  assert.ok(ACTIONS.includes("create"));
  assert.ok(ACTIONS.includes("simulate"));
  assert.ok(ACTIONS.includes("verify"));
  assert.ok(ACTIONS.includes("import"));
  assert.ok(ACTIONS.includes("export"));
  assert.ok(ACTIONS.includes("reset"));

  const empty = readEvents(null);
  assert.deepEqual(empty, []);
  assert.deepEqual(readEvents("not-json"), []);
  assert.deepEqual(readEvents({ events: [] }), []);

  const first = appendEvent([], sampleInput());
  assert.equal(first.ok, true);
  assert.equal(first.money, false);
  assert.equal(first.mode, "demo");
  assert.equal(first.event.money, false);
  assert.equal(first.event.action, "create");
  assert.equal(first.event.job_id, JOB_ID);
  assert.equal(first.event.client_ref, "agent-job-42");
  assert.equal(first.event.detail, `${JOB_ID} · agent-job-42`);
  assert.equal(first.events.length, 1);

  const second = appendEvent(first.events, {
    at: "2026-09-15T14:01:00.000Z",
    action: "simulate",
    jobId: "as_aaaaaaaaaa",
    detail: "release",
  });
  assert.equal(second.ok, true);
  assert.equal(second.events[0].action, "simulate");
  assert.equal(second.events[0].job_id, "as_aaaaaaaaaa");
  assert.equal(second.events[0].detail, "release");
  assert.equal(second.events[1].action, "create");

  const bad = appendEvent(second.events, { action: "quote" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "invalid_action");
  assert.equal(second.events.length, 2);
});

test("append caps at MAX_EVENTS and drops the oldest", () => {
  let events = [];
  for (let i = 0; i < MAX_EVENTS; i += 1) {
    const next = appendEvent(events, {
      at: `2026-09-15T14:00:${String(i).padStart(2, "0")}.000Z`,
      action: "verify",
      detail: `n${i}`,
    });
    assert.equal(next.ok, true);
    events = next.events;
  }
  assert.equal(events.length, MAX_EVENTS);
  assert.equal(events[0].detail, `n${MAX_EVENTS - 1}`);
  assert.equal(events[events.length - 1].detail, "n0");

  const overflow = appendEvent(events, {
    at: "2026-09-15T15:00:00.000Z",
    action: "export",
    detail: "demo pack",
  });
  assert.equal(overflow.ok, true);
  assert.equal(overflow.events.length, MAX_EVENTS);
  assert.equal(overflow.events[0].action, "export");
  assert.equal(overflow.events[0].detail, "demo pack");
  assert.equal(overflow.events[overflow.events.length - 1].detail, "n1");
  assert.ok(!overflow.events.some((event) => event.detail === "n0"));
});

test("clear empties the list and confirm copy is activity-only", () => {
  const seeded = appendEvent([], sampleInput());
  const written = writeEvents(seeded.events);
  assert.equal(typeof written, "string");
  assert.equal(readEvents(written).length, 1);

  const cleared = clearEvents();
  assert.equal(cleared.ok, true);
  assert.equal(cleared.money, false);
  assert.deepEqual(cleared.events, []);
  assert.deepEqual(readEvents(writeEvents(cleared.events)), []);

  const prompt = confirmClearMessage();
  assert.equal(prompt.ok, true);
  assert.match(prompt.message, /activity log/i);
  assert.match(prompt.message, /only the activity list/i);
  assert.match(prompt.message, /jobs, wallets, receipts, and the demo API key stay/i);
  assert.doesNotMatch(prompt.message, /will be removed/i);
});
