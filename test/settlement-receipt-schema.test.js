"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  RECEIPT_SCHEMA,
  TOOLS,
  SETTLEMENT,
  AGENT,
  EXAMPLES,
  QUICKSTART,
  ERRORS,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const { receiptFromJob, handleHttp } = require("../api/_lib/settlement-transition");
const { encodeReceipt, decodeReceipt } = require("../receipt-export");

const ROOT = path.join(__dirname, "..");
const SCHEMA_PATH = "/api/schemas/receipt.json";
const SCHEMA_ID = "https://liberty-amber.vercel.app/api/schemas/receipt.json";
const CANONICAL_FIELDS = [
  "job_id",
  "title",
  "status",
  "amount",
  "release_fee",
  "agent_payout",
  "returned_to_payer",
  "success_criteria",
  "proof",
  "created",
  "funded",
  "submitted",
  "resolved",
];
const OPTIONAL_FIELDS = [
  "key_id",
  "client_ref",
  "callback_url",
  "proof_note",
  "release_note",
  "dispute_reason",
];
const COMPACT_KEYS = {
  job_id: "j",
  title: "t",
  status: "s",
  amount: "a",
  release_fee: "f",
  agent_payout: "ap",
  returned_to_payer: "rp",
  success_criteria: "c",
  proof: "p",
  created: "ca",
  funded: "fa",
  submitted: "sa",
  resolved: "ra",
  key_id: "k",
  client_ref: "cr",
  callback_url: "cb",
  proof_note: "pn",
  release_note: "rn",
  dispute_reason: "dr",
};

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
  return RECEIPT_SCHEMA.$defs[name];
}

function hasField(schema, field) {
  return Boolean(schema && schema.properties && schema.properties[field]);
}

const NOW = "2026-09-15T00:00:00.000Z";

function sampleReceipt(overrides) {
  return {
    job_id: "as_0123456789",
    title: "Summarize filings",
    status: "released",
    amount: 100,
    release_fee: 5,
    agent_payout: 95,
    returned_to_payer: 0,
    success_criteria: "Three-bullet brief",
    proof: "https://example.com/proof",
    created: NOW,
    funded: NOW,
    submitted: NOW,
    resolved: NOW,
    ...overrides,
  };
}

test("receipt JSON Schema stays aligned with live export and verify", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/receipt.schema.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, RECEIPT_SCHEMA);

  assert.equal(RECEIPT_SCHEMA.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(RECEIPT_SCHEMA.$id, SCHEMA_ID);
  assert.equal(RECEIPT_SCHEMA.type, "object");
  assert.equal(RECEIPT_SCHEMA.$ref, "#/$defs/Receipt");
  assert.match(RECEIPT_SCHEMA.title, /receipt/i);
  assert.match(RECEIPT_SCHEMA.description, /client-held demo/i);
  assert.match(RECEIPT_SCHEMA.description, /does not .* move real money/i);
  assert.match(RECEIPT_SCHEMA.description, /not proof of payment/i);
  assert.doesNotMatch(JSON.stringify(RECEIPT_SCHEMA), /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.doesNotMatch(JSON.stringify(RECEIPT_SCHEMA), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);

  const receipt = def("Receipt");
  assert.deepEqual(receipt.required, CANONICAL_FIELDS);
  assert.deepEqual(def("Status").enum, ["released", "disputed"]);
  assert.equal(def("JobId").pattern, "^as_[0-9a-f]{10}$");
  assert.equal(def("KeyId").pattern, "^k_[0-9a-f]{12}$");
  assert.equal(def("Title").maxLength, 80);
  assert.equal(def("Amount").minimum, 1);
  assert.equal(def("Credits").minimum, 0);
  assert.equal(def("ClientRef").maxLength, 128);
  assert.equal(def("CallbackUrl").maxLength, 512);
  assert.equal(def("CallbackUrl").pattern, "^https://");
  assert.equal(def("Note").maxLength, 400);
  assert.ok(!hasField(receipt, "expiresAt"));
  assert.ok(!hasField(receipt, "agent_credits_delta"));
  assert.ok(!hasField(receipt, "payer_credits"));
  assert.ok(!hasField(receipt, "wallet"));

  for (const field of CANONICAL_FIELDS.concat(OPTIONAL_FIELDS)) {
    assert.ok(hasField(receipt, field), `missing canonical field ${field}`);
  }
  assert.ok(hasField(receipt, "jobId"));
  assert.ok(hasField(receipt, "notify_url"));
  assert.ok(hasField(receipt, "fee"));

  const compact = def("CompactReceipt").properties;
  for (const [from, to] of Object.entries(COMPACT_KEYS)) {
    assert.ok(compact[to], `missing compact key ${to} for ${from}`);
  }
  assert.equal(def("ReceiptLinkPayload").properties.v.const, 1);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.deepEqual(openapi.components.schemas.Receipt.required, CANONICAL_FIELDS);
  assert.deepEqual(
    SETTLEMENT.receipt_fields.map((row) => row.id),
    CANONICAL_FIELDS.concat(OPTIONAL_FIELDS.filter((field) => field !== "key_id")).concat(["key_id"]),
  );
});

test("adapter verify example and a live engine receipt satisfy the schema required fields", () => {
  const example = EXAMPLES.examples.find((row) => row.id === "verify");
  assert.ok(example && example.body && example.body.receipt);
  for (const field of def("Receipt").required) {
    assert.notEqual(example.body.receipt[field], undefined, `example missing ${field}`);
  }
  assert.equal(example.body.receipt.status, "released");

  const engineReceipt = receiptFromJob({
    id: "as_0123456789",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief",
    proofUrl: "https://example.com/proof",
    status: "released",
    createdAt: NOW,
    fundedAt: NOW,
    submittedAt: NOW,
    resolvedAt: NOW,
    fee: 5,
    agentPayout: 95,
  });
  for (const field of def("Receipt").required) {
    assert.notEqual(engineReceipt[field], undefined, `engine receipt missing ${field}`);
  }

  const encoded = encodeReceipt(sampleReceipt({
    client_ref: "agent-job-42",
    callback_url: "https://your-adapter.example/notify",
    proof_note: "Three-bullet brief attached.",
    release_note: "Looks good.",
  }));
  assert.equal(encoded.ok, true);
  const decoded = decodeReceipt(encoded.token);
  assert.equal(decoded.ok, true);
  for (const field of def("Receipt").required) {
    assert.notEqual(decoded.receipt[field], undefined, `decoded receipt missing ${field}`);
  }
});

test("GET /api/schemas/receipt.json serves the JSON Schema", async () => {
  for (const url of [
    SCHEMA_PATH,
    "/api/agent.json?doc=receipt-schema",
    "/api/schemas/receipt.json?cache=0",
  ]) {
    const get = await invoke(url, { method: "GET" });
    assert.equal(get.statusCode, 200, url);
    assert.deepEqual(get.body, RECEIPT_SCHEMA, url);
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

test("discovery, protocol, and docs point at the receipt schema", () => {
  assert.equal(TOOLS.tools.find((tool) => tool.id === "verify").schema, SCHEMA_PATH);
  assert.equal(TOOLS.discovery.find((row) => row.id === "receipt_schema").path, SCHEMA_PATH);

  assert.equal(SETTLEMENT.surfaces.receipt_schema, SCHEMA_PATH);
  assert.equal(SETTLEMENT.receipt_schema.path, SCHEMA_PATH);
  assert.equal(SETTLEMENT.receipt_schema.money, false);
  assert.equal(SETTLEMENT.verify_api.schema, SCHEMA_PATH);
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes(SCHEMA_PATH)));

  assert.equal(AGENT.surfaces.receipt_schema, SCHEMA_PATH);
  assert.match(AGENT.note, /schemas\/receipt\.json/);

  assert.equal(QUICKSTART.related.find((row) => row.id === "receipt_schema").path, SCHEMA_PATH);
  assert.match(ERRORS.note, /schemas\/receipt\.json/);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths[SCHEMA_PATH].get);
  assert.equal(openapi.paths[SCHEMA_PATH].get.operationId, "getReceiptSchema");
  assert.ok(openapi.info.description.includes(SCHEMA_PATH));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.receipt_schema.const,
    SCHEMA_PATH,
  );
  assert.equal(
    openapi.components.schemas.ReceiptSchemaDocument.properties.$id.const,
    SCHEMA_ID,
  );
  assert.match(openapi.components.schemas.Receipt.description, /schemas\/receipt\.json/);
  assert.equal(openapi.components.schemas.VerifyDiscovery.properties.schema.const, SCHEMA_PATH);

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) =>
        row.source === SCHEMA_PATH && row.destination === "/api/agent.json?doc=receipt-schema",
    ),
  );

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes(`href="${SCHEMA_PATH}"`));
  assert.ok(homepage.includes('id="integrate"'));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes(SCHEMA_PATH));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes(SCHEMA_PATH));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes(SCHEMA_PATH));
  assert.ok(readme.includes(`curl https://liberty-amber.vercel.app${SCHEMA_PATH}`));

  const verifyDiscovery = handleHttp({ method: "GET", body: null, verify: true });
  assert.equal(verifyDiscovery.status, 200);
  assert.equal(verifyDiscovery.body.schema, SCHEMA_PATH);
});
