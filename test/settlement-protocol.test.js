"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ACTIONS,
  FEE_RATE,
  JOB_ID_PATTERN,
  STATUSES,
  receiptFromJob,
} = require("../api/_lib/settlement-transition");
const {
  HEALTH,
  SETTLEMENT,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");

function mockRes() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    ended: false,
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

async function invoke(handlerPath, req) {
  const handler = require(handlerPath);
  const res = mockRes();
  await handler(req, res);
  return res;
}

test("health and settlement documents stay demo-only and match the engine", () => {
  assert.equal(HEALTH.service, "liberty-agent-settlement");
  assert.equal(HEALTH.mode, "demo");
  assert.equal(HEALTH.money, false);

  assert.equal(SETTLEMENT.money, false);
  assert.equal(SETTLEMENT.mode, "demo");
  assert.equal(SETTLEMENT.transition_api.money, false);
  assert.equal(SETTLEMENT.transition_api.persistence, false);
  assert.equal(SETTLEMENT.transition_api.auth, "optional");
  assert.equal(SETTLEMENT.quote_api.dry_run, true);
  assert.equal(SETTLEMENT.quote_api.money, false);
  assert.equal(SETTLEMENT.quote_api.engine, "/api/v0/transition");
  assert.equal(SETTLEMENT.surfaces.quote, "/api/v0/quote");
  assert.equal(SETTLEMENT.surfaces.verify, "/api/v0/verify");
  assert.equal(SETTLEMENT.verify_api.path, "/api/v0/verify");
  assert.equal(SETTLEMENT.verify_api.money, false);
  assert.equal(SETTLEMENT.verify_api.persistence, false);
  assert.equal(SETTLEMENT.verify_api.engine, "/api/v0/transition");
  assert.deepEqual(SETTLEMENT.states, STATUSES);
  assert.deepEqual(
    SETTLEMENT.actions.map((action) => action.id),
    ACTIONS,
  );
  assert.deepEqual(SETTLEMENT.job.status.enum, STATUSES);
  assert.equal(SETTLEMENT.job.id.pattern, JOB_ID_PATTERN.source);
  assert.equal(SETTLEMENT.fee_schedule.release.rate, FEE_RATE);
  assert.equal(SETTLEMENT.fee_schedule.release.formula, `Math.round(amount * ${FEE_RATE})`);
  assert.equal(SETTLEMENT.handoff.persistence, false);
  assert.equal(SETTLEMENT.handoff.money, false);
  assert.equal(SETTLEMENT.handoff.prefix, "h1.");
  assert.deepEqual(SETTLEMENT.handoff.excludes, ["credits", "demo_api_key", "receipts"]);
  assert.equal(SETTLEMENT.receipt_export.persistence, false);
  assert.equal(SETTLEMENT.receipt_export.money, false);
  assert.equal(SETTLEMENT.receipt_export.mode, "client");
  assert.equal(SETTLEMENT.receipt_export.storage_key, "liberty.agent-settlement.receipts.v0");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("receipt")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("key_optional")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("handoff")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/v0/quote")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/v0/verify")));
});

test("receipt fields match the engine receipt plus optional key_id", () => {
  const job = {
    id: "as_0123456789",
    title: "Receipt check",
    amount: 20,
    criteria: "Done",
    proofUrl: "https://example.com/proof",
    status: "released",
    createdAt: "2026-09-14T19:50:00.000Z",
    fundedAt: "2026-09-14T19:50:00.000Z",
    submittedAt: "2026-09-14T19:50:00.000Z",
    resolvedAt: "2026-09-14T19:50:00.000Z",
    fee: 1,
    agentPayout: 19,
  };
  const receiptIds = SETTLEMENT.receipt_fields.map((field) => field.id);
  assert.deepEqual(receiptIds, [...Object.keys(receiptFromJob(job)), "key_id"]);
  assert.equal(SETTLEMENT.receipt_fields.at(-1).optional, true);
});

test("GET /api/health.json and /api/settlement.json handlers serve the protocol docs", async () => {
  const health = await invoke("../api/health.json.js", { method: "GET" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.body, HEALTH);
  assert.equal(health.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(health.headers["Content-Type"], protocolHeaders()["Content-Type"]);

  const settlement = await invoke("../api/settlement.json.js", { method: "GET" });
  assert.equal(settlement.statusCode, 200);
  assert.deepEqual(settlement.body, SETTLEMENT);
  assert.equal(settlement.body.money, false);
  assert.equal(settlement.body.handoff.mode, "client");

  const options = await invoke("../api/health.json.js", { method: "OPTIONS" });
  assert.equal(options.statusCode, 204);
  assert.equal(options.body, undefined);
  assert.equal(options.ended, true);

  const post = await invoke("../api/settlement.json.js", { method: "POST" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.body.money, false);
  assert.equal(post.body.error, "method_not_allowed");
});
