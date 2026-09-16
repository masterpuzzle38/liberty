"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  VERIFY_SCHEMA,
  TOOLS,
  SETTLEMENT,
  AGENT,
  EXAMPLES,
  QUICKSTART,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const { handleHttp, transition, verify } = require("../api/_lib/settlement-transition");

const ROOT = path.join(__dirname, "..");
const SCHEMA_PATH = "/api/schemas/verify.json";
const SCHEMA_ID = "https://liberty-amber.vercel.app/api/schemas/verify.json";
const NOW = "2026-09-16T00:00:00.000Z";
const OPTIONS = { now: () => NOW, makeId: () => "as_0123456789" };

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

async function invoke(url, req = {}) {
  const handler = require("../api/agent.json.js");
  const res = mockRes();
  await handler({ url, ...req }, res);
  return res;
}

function def(name) {
  return VERIFY_SCHEMA.$defs[name];
}

function hasField(schema, field) {
  return Boolean(schema && schema.properties && schema.properties[field]);
}

function commit(input) {
  return transition(input, OPTIONS);
}

function submittedJob() {
  const open = commit({
    action: "create",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
  }).body.job;
  const funded = commit({ action: "fund", job: open, payer_credits: 100 }).body.job;
  return commit({
    action: "submit",
    job: funded,
    proof_url: "https://example.com/proof",
  }).body.job;
}

function releasedReceipt() {
  return commit({ action: "release", job: submittedJob() }).body.receipt;
}

test("verify JSON Schema stays aligned with the live request shape", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/verify.schema.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, VERIFY_SCHEMA);

  assert.equal(VERIFY_SCHEMA.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(VERIFY_SCHEMA.$id, SCHEMA_ID);
  assert.equal(VERIFY_SCHEMA.type, "object");
  assert.equal(VERIFY_SCHEMA.oneOf.length, 4);
  assert.match(VERIFY_SCHEMA.title, /verify request/i);
  assert.match(VERIFY_SCHEMA.description, /POST \/api\/v0\/verify/i);
  assert.match(VERIFY_SCHEMA.description, /money is always false/i);
  assert.match(VERIFY_SCHEMA.description, /verify is not custody/i);
  assert.match(VERIFY_SCHEMA.description, /does not .* move real money/i);
  assert.doesNotMatch(JSON.stringify(VERIFY_SCHEMA), /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.doesNotMatch(JSON.stringify(VERIFY_SCHEMA), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);
  assert.doesNotMatch(JSON.stringify(VERIFY_SCHEMA), /stripe/i);

  const receiptRequest = def("ReceiptRequest");
  const jobRequest = def("JobRequest");
  const receipt = def("Receipt");
  const job = def("Job");
  assert.deepEqual(receiptRequest.required, ["receipt"]);
  assert.deepEqual(jobRequest.required, ["job"]);
  assert.ok(hasField(receiptRequest, "receipt"));
  assert.ok(hasField(jobRequest, "job"));
  assert.ok(hasField(jobRequest, "action"));
  assert.ok(hasField(jobRequest, "fee"));
  assert.ok(hasField(jobRequest, "release_fee"));
  assert.ok(hasField(jobRequest, "releaseFee"));
  assert.ok(hasField(jobRequest, "agent_payout"));
  assert.ok(hasField(jobRequest, "agentPayout"));
  assert.ok(hasField(jobRequest, "returned_to_payer"));
  assert.ok(hasField(jobRequest, "returnedToPayer"));
  assert.ok(!hasField(jobRequest, "wallet"));
  assert.ok(!hasField(jobRequest, "payer_credits"));
  assert.ok(!hasField(jobRequest, "idempotency_key"));
  assert.ok(!hasField(receipt, "wallet"));
  assert.ok(!JSON.stringify(VERIFY_SCHEMA).includes('"prove"'));

  assert.ok(hasField(receipt, "job_id"));
  assert.ok(hasField(receipt, "jobId"));
  assert.ok(hasField(receipt, "success_criteria"));
  assert.ok(hasField(receipt, "successCriteria"));
  assert.ok(hasField(receipt, "release_fee"));
  assert.ok(hasField(receipt, "releaseFee"));
  assert.ok(hasField(receipt, "agentPayout"));
  assert.ok(hasField(receipt, "returnedToPayer"));
  assert.ok(hasField(receipt, "notifyUrl"));
  assert.ok(hasField(receipt, "proofNote"));
  assert.ok(!hasField(receipt, "release_note"));
  assert.ok(!hasField(receipt, "key_id"));

  assert.deepEqual(job.required, ["id", "title", "amount", "criteria", "status"]);
  assert.ok(hasField(job, "createdAt"));
  assert.ok(hasField(job, "created_at"));
  assert.ok(hasField(job, "expiresAt"));
  assert.ok(hasField(job, "proofUrl"));
  assert.ok(hasField(job, "clientRef"));
  assert.ok(hasField(job, "notify_url"));
  assert.ok(!hasField(job, "release_note"));
  assert.ok(!hasField(job, "dispute_reason"));

  assert.deepEqual(def("Action").enum, ["release", "dispute"]);
  assert.deepEqual(def("ReceiptStatus").enum, ["released", "disputed"]);
  assert.deepEqual(def("JobStatus").enum, ["open", "funded", "submitted", "released", "disputed"]);
  assert.equal(def("ClientRef").maxLength, 128);
  assert.equal(def("Note").maxLength, 400);
  assert.equal(def("CallbackUrl").maxLength, 512);
  assert.equal(def("CallbackUrl").pattern, "^https://");
  assert.equal(def("Credits").minimum, 0);
  assert.equal(receipt.properties.amount.minimum, 1);
  assert.equal(receipt.properties.title.maxLength, 80);

  const success = def("VerifySuccess");
  assert.deepEqual(success.required, [
    "ok",
    "mode",
    "money",
    "valid",
    "verified",
    "expected",
    "received",
    "mismatches",
  ]);
  assert.equal(success.properties.ok.const, true);
  assert.equal(success.properties.mode.const, "demo");
  assert.equal(success.properties.money.const, false);
  assert.equal(success.properties.verified.const, true);
  assert.match(success.description, /not custody/i);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.components.schemas.VerifyRequest.oneOf);
  assert.equal(openapi.components.schemas.VerifySuccess.properties.money.const, false);
  assert.match(openapi.components.schemas.VerifyRequest.description, /schemas\/verify\.json/);
});

test("adapter verify example satisfies the schema required fields", () => {
  const example = EXAMPLES.examples.find((row) => row.id === "verify");
  assert.ok(example && example.body && example.body.receipt);
  const receipt = def("Receipt");
  for (const field of ["title", "amount", "status"]) {
    assert.notEqual(example.body.receipt[field], undefined, `verify example receipt missing ${field}`);
  }
  assert.ok(example.body.receipt.job_id);
  assert.ok(example.body.receipt.release_fee !== undefined);
  assert.ok(example.body.receipt.agent_payout !== undefined);
  assert.ok(["released", "disputed"].includes(example.body.receipt.status));
  assert.match(example.note, /schemas\/verify\.json/);
  assert.ok(hasField(receipt, "job_id"));
});

test("schema required/optional fields stay aligned with the live verify handler", () => {
  const receipt = releasedReceipt();
  const accepted = verify({ receipt }, OPTIONS);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.money, false);
  assert.equal(accepted.body.verified, true);
  assert.equal(accepted.body.valid, true);

  const aliasedReceipt = verify({
    receipt: {
      jobId: receipt.job_id,
      title: receipt.title,
      status: receipt.status,
      amount: receipt.amount,
      releaseFee: receipt.release_fee,
      agentPayout: receipt.agent_payout,
      returnedToPayer: receipt.returned_to_payer,
      successCriteria: receipt.success_criteria,
      proofUrl: receipt.proof,
      createdAt: receipt.created,
      fundedAt: receipt.funded,
      submittedAt: receipt.submitted,
      resolvedAt: receipt.resolved,
    },
  }, OPTIONS);
  assert.equal(aliasedReceipt.status, 200, aliasedReceipt.body && aliasedReceipt.body.message);
  assert.equal(aliasedReceipt.body.valid, true);

  const job = submittedJob();
  const proposed = verify({ action: "release", job }, OPTIONS);
  assert.equal(proposed.status, 200);
  assert.equal(proposed.body.valid, true);

  const claimedAlias = verify({
    action: "release",
    job,
    releaseFee: 1,
    agentPayout: 99,
    returnedToPayer: 0,
  }, OPTIONS);
  assert.equal(claimedAlias.status, 200);
  assert.equal(claimedAlias.body.valid, false);
  assert.equal(claimedAlias.body.received.fee, 1);

  const missing = verify({});
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, "missing_field");
  assert.equal(missing.body.money, false);

  const garbage = verify({ job, action: "prove" }, OPTIONS);
  assert.equal(garbage.status, 400);
  assert.equal(garbage.body.error, "invalid_action");
  assert.ok(!def("Action").enum.includes("prove"));

  const notAnObject = verify(null);
  assert.equal(notAnObject.status, 400);
  assert.equal(notAnObject.body.error, "invalid_json");
});

test("GET /api/schemas/verify.json serves the JSON Schema", async () => {
  for (const url of [
    SCHEMA_PATH,
    "/api/agent.json?doc=verify-schema",
    "/api/schemas/verify.json?cache=0",
  ]) {
    const get = await invoke(url, { method: "GET" });
    assert.equal(get.statusCode, 200, url);
    assert.deepEqual(get.body, VERIFY_SCHEMA, url);
    assert.equal(get.body.$id, SCHEMA_ID, url);
    assert.equal(get.headers["Access-Control-Allow-Origin"], "*");
    assert.equal(get.headers["Content-Type"], protocolHeaders()["Content-Type"]);
  }

  const options = await invoke(SCHEMA_PATH, { method: "OPTIONS" });
  assert.equal(options.statusCode, 204);
  assert.equal(options.ended, true);

  const head = await invoke(SCHEMA_PATH, { method: "HEAD" });
  assert.equal(head.statusCode, 200);
  assert.equal(head.ended, true);

  const post = await invoke(SCHEMA_PATH, { method: "POST" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.body.money, false);
  assert.equal(post.body.error, "method_not_allowed");
});

test("discovery, protocol, and docs point at the verify schema", () => {
  assert.equal(TOOLS.tools.find((tool) => tool.id === "verify").schema, SCHEMA_PATH);
  assert.equal(TOOLS.discovery.find((row) => row.id === "verify_schema").path, SCHEMA_PATH);

  assert.equal(SETTLEMENT.surfaces.verify_schema, SCHEMA_PATH);
  assert.equal(SETTLEMENT.verify_schema.path, SCHEMA_PATH);
  assert.equal(SETTLEMENT.verify_schema.money, false);
  assert.equal(SETTLEMENT.verify_api.schema, SCHEMA_PATH);
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes(SCHEMA_PATH)));

  assert.equal(AGENT.surfaces.verify_schema, SCHEMA_PATH);
  assert.match(AGENT.note, /schemas\/verify\.json/);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths[SCHEMA_PATH].get);
  assert.equal(openapi.paths[SCHEMA_PATH].get.operationId, "getVerifyRequestSchema");
  assert.ok(openapi.info.description.includes(SCHEMA_PATH));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.verify_schema.const,
    SCHEMA_PATH,
  );
  assert.equal(
    openapi.components.schemas.VerifyRequestSchemaDocument.properties.$id.const,
    SCHEMA_ID,
  );
  assert.equal(
    openapi.components.schemas.VerifyDiscovery.properties.schema.const,
    SCHEMA_PATH,
  );
  assert.match(openapi.components.schemas.VerifyRequest.description, /schemas\/verify\.json/);

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) =>
        row.source === SCHEMA_PATH && row.destination === "/api/agent.json?doc=verify-schema",
    ),
  );

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes(`href="${SCHEMA_PATH}"`));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes(SCHEMA_PATH));
  assert.equal(
    QUICKSTART.related.find((row) => row.id === "verify_schema").path,
    SCHEMA_PATH,
  );

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes(SCHEMA_PATH));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes(SCHEMA_PATH));
  assert.ok(readme.includes(`curl https://liberty-amber.vercel.app${SCHEMA_PATH}`));

  const verifyDiscovery = handleHttp({ method: "GET", body: null, verify: true });
  assert.equal(verifyDiscovery.status, 200);
  assert.equal(verifyDiscovery.body.schema, SCHEMA_PATH);
  assert.equal(verifyDiscovery.body.money, false);
});
