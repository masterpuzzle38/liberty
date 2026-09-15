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
  assert.equal(SETTLEMENT.surfaces.simulate, "/api/v0/simulate");
  assert.equal(SETTLEMENT.surfaces.discovery, "/.well-known/agent.json");
  assert.equal(SETTLEMENT.surfaces.agent, "/api/agent.json");
  assert.equal(SETTLEMENT.discovery.path, "/.well-known/agent.json");
  assert.equal(SETTLEMENT.discovery.alias, "/api/agent.json");
  assert.equal(SETTLEMENT.discovery.money, false);
  assert.equal(SETTLEMENT.surfaces.examples, "/api/examples.json");
  assert.equal(SETTLEMENT.examples.path, "/api/examples.json");
  assert.equal(SETTLEMENT.examples.money, false);
  assert.equal(SETTLEMENT.surfaces.templates, "/api/templates.json");
  assert.equal(SETTLEMENT.templates.path, "/api/templates.json");
  assert.equal(SETTLEMENT.templates.money, false);
  assert.equal(SETTLEMENT.surfaces.changelog, "/api/changelog.json");
  assert.equal(SETTLEMENT.changelog.path, "/api/changelog.json");
  assert.equal(SETTLEMENT.changelog.money, false);
  assert.equal(SETTLEMENT.changelog.human_path, "/#whats-new");
  assert.equal(SETTLEMENT.surfaces.scoreboard, "/api/scoreboard.json");
  assert.equal(SETTLEMENT.scoreboard.path, "/api/scoreboard.json");
  assert.equal(SETTLEMENT.scoreboard.money, false);
  assert.equal(SETTLEMENT.scoreboard.human_path, "/#scoreboard");
  assert.equal(SETTLEMENT.surfaces.fees, "/api/fees.json");
  assert.equal(SETTLEMENT.fees.path, "/api/fees.json");
  assert.equal(SETTLEMENT.fees.money, false);
  assert.equal(SETTLEMENT.fees.human_path, "/#fees");
  assert.equal(SETTLEMENT.templates.auto_create, false);
  assert.equal(SETTLEMENT.templates.auto_fund, false);
  assert.equal(SETTLEMENT.simulate_api.path, "/api/v0/simulate");
  assert.equal(SETTLEMENT.simulate_api.money, false);
  assert.equal(SETTLEMENT.simulate_api.persistence, false);
  assert.equal(SETTLEMENT.simulate_api.engine, "/api/v0/transition");
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
  assert.deepEqual(SETTLEMENT.handoff.excludes, ["credits", "agent_credits", "demo_api_key", "receipts"]);
  assert.equal(SETTLEMENT.agent_wallet.persistence, false);
  assert.equal(SETTLEMENT.agent_wallet.money, false);
  assert.equal(SETTLEMENT.agent_wallet.mode, "client");
  assert.equal(SETTLEMENT.agent_wallet.storage_key, "liberty.agent-settlement.agent-credits.v0");
  assert.equal(SETTLEMENT.agent_wallet.delta_field, "agent_credits_delta");
  assert.equal(SETTLEMENT.human_path.agent_credits_storage_key, "liberty.agent-settlement.agent-credits.v0");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("agent_credits_delta")));
  assert.equal(SETTLEMENT.demo_pack.persistence, false);
  assert.equal(SETTLEMENT.demo_pack.money, false);
  assert.equal(SETTLEMENT.demo_pack.mode, "client");
  assert.equal(SETTLEMENT.demo_pack.import, "replace");
  assert.equal(SETTLEMENT.demo_pack.reset, "confirm_clear_known_keys");
  assert.equal(SETTLEMENT.demo_pack.human_path, "/#demo-pack");
  assert.equal(SETTLEMENT.surfaces.demo_pack, "/#demo-pack");
  assert.ok(SETTLEMENT.demo_pack.storage_keys.includes("liberty.agent-settlement.v0"));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/#demo-pack")));
  assert.equal(SETTLEMENT.ledger.persistence, false);
  assert.equal(SETTLEMENT.ledger.money, false);
  assert.equal(SETTLEMENT.ledger.mode, "client");
  assert.equal(SETTLEMENT.ledger.human_path, "/#ledger");
  assert.equal(SETTLEMENT.surfaces.ledger, "/#ledger");
  assert.ok(SETTLEMENT.ledger.storage_keys.includes("liberty.agent-settlement.receipts.v0"));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/#ledger")));
  assert.equal(SETTLEMENT.receipt_export.persistence, false);
  assert.equal(SETTLEMENT.receipt_export.money, false);
  assert.equal(SETTLEMENT.receipt_export.mode, "client");
  assert.equal(SETTLEMENT.receipt_export.storage_key, "liberty.agent-settlement.receipts.v0");
  assert.equal(SETTLEMENT.receipt_link.persistence, false);
  assert.equal(SETTLEMENT.receipt_link.money, false);
  assert.equal(SETTLEMENT.receipt_link.prefix, "r1.");
  assert.deepEqual(SETTLEMENT.receipt_link.excludes, ["credits", "agent_credits", "demo_api_key", "jobs"]);
  assert.equal(SETTLEMENT.receipt_link.hash, "#receipt/<token>");
  assert.equal(SETTLEMENT.surfaces.receipt_link, "/#receipt/<token>");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("receipt")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("key_optional")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("handoff")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("#receipt/")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/v0/quote")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/v0/verify")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/v0/simulate")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/.well-known/agent.json")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/examples.json")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/templates.json")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/changelog.json")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/scoreboard.json")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("Idempotency-Key")));
  assert.match(SETTLEMENT.job.callback_url.note, /never HTTP-fetches/i);
  assert.match(SETTLEMENT.transition_api.note, /never HTTP-fetches/i);
  assert.equal(SETTLEMENT.transition_api.idempotency.replay, false);
  assert.equal(SETTLEMENT.quote_api.idempotency.replay, false);
  assert.equal(SETTLEMENT.simulate_api.idempotency.replay, false);
});

test("receipt fields match the engine receipt plus optional notes and key_id", () => {
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
  assert.deepEqual(
    SETTLEMENT.receipt_fields.filter((field) => !field.optional).map((field) => field.id),
    Object.keys(receiptFromJob(job)),
  );
  assert.deepEqual(
    SETTLEMENT.receipt_fields.filter((field) => field.optional).map((field) => field.id),
    ["client_ref", "callback_url", "proof_note", "release_note", "dispute_reason", "key_id"],
  );
  const noted = receiptFromJob({ ...job, releaseNote: "Looks good." });
  assert.equal(noted.release_note, "Looks good.");
  const proofNoted = receiptFromJob({ ...job, proofNote: "Three-bullet brief attached." });
  assert.equal(proofNoted.proof_note, "Three-bullet brief attached.");
  const withCallback = receiptFromJob({ ...job, callbackUrl: "https://your-adapter.example/notify" });
  assert.equal(withCallback.callback_url, "https://your-adapter.example/notify");
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
