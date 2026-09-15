"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  HANDOFF_SCHEMA,
  TOOLS,
  SETTLEMENT,
  AGENT,
  QUICKSTART,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const {
  encodeHandoff,
  decodeHandoff,
} = require("../job-handoff");

const ROOT = path.join(__dirname, "..");
const SCHEMA_PATH = "/api/schemas/handoff.json";
const SCHEMA_ID = "https://liberty-amber.vercel.app/api/schemas/handoff.json";
const JOB_FIELDS = [
  "id",
  "title",
  "amount",
  "criteria",
  "status",
  "proofUrl",
  "createdAt",
  "fundedAt",
  "submittedAt",
  "resolvedAt",
  "expiresAt",
  "fee",
  "agentPayout",
  "clientRef",
  "callbackUrl",
  "proofNote",
  "releaseNote",
  "disputeReason",
];
const COMPACT_KEYS = {
  id: "id",
  title: "t",
  amount: "a",
  criteria: "c",
  proofUrl: "p",
  status: "s",
  createdAt: "ca",
  fundedAt: "fa",
  submittedAt: "sa",
  resolvedAt: "ra",
  expiresAt: "ea",
  fee: "f",
  agentPayout: "ap",
  clientRef: "cr",
  callbackUrl: "cb",
  proofNote: "pn",
  releaseNote: "rn",
  disputeReason: "dr",
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
  return HANDOFF_SCHEMA.$defs[name];
}

function hasField(schema, field) {
  return Boolean(schema && schema.properties && schema.properties[field]);
}

const NOW = "2026-09-15T00:00:00.000Z";

function sampleJob(overrides) {
  return {
    id: "as_0123456789",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    proofUrl: "",
    status: "funded",
    createdAt: NOW,
    fundedAt: NOW,
    submittedAt: null,
    resolvedAt: null,
    fee: 0,
    agentPayout: 0,
    ...overrides,
  };
}

test("handoff JSON Schema stays aligned with live #handoff encoding", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/handoff.schema.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, HANDOFF_SCHEMA);

  assert.equal(HANDOFF_SCHEMA.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(HANDOFF_SCHEMA.$id, SCHEMA_ID);
  assert.equal(HANDOFF_SCHEMA.type, "object");
  assert.equal(HANDOFF_SCHEMA.$ref, "#/$defs/HandoffPayload");
  assert.match(HANDOFF_SCHEMA.title, /handoff/i);
  assert.match(HANDOFF_SCHEMA.description, /client-held demo/i);
  assert.match(HANDOFF_SCHEMA.description, /does not .* move real money/i);
  assert.match(HANDOFF_SCHEMA.description, /not a custody transfer/i);
  assert.doesNotMatch(JSON.stringify(HANDOFF_SCHEMA), /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.doesNotMatch(JSON.stringify(HANDOFF_SCHEMA), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);

  const job = def("Job");
  assert.deepEqual(job.required, ["id", "title", "amount", "criteria", "status"]);
  assert.deepEqual(
    (job.anyOf || []).flatMap((row) => row.required || []),
    ["createdAt", "created_at"],
  );
  assert.deepEqual(def("Status").enum, ["open", "funded", "submitted", "released", "disputed"]);
  assert.deepEqual(def("NextActions").items.enum, ["fund", "submit", "release", "dispute"]);
  assert.equal(def("JobId").pattern, "^as_[0-9a-f]{10}$");
  assert.equal(def("Title").maxLength, 80);
  assert.equal(def("Amount").minimum, 1);
  assert.equal(def("Credits").minimum, 0);
  assert.equal(def("ClientRef").maxLength, 128);
  assert.equal(def("CallbackUrl").maxLength, 512);
  assert.equal(def("CallbackUrl").pattern, undefined);
  assert.equal(def("Note").maxLength, 400);
  assert.ok(!hasField(job, "credits"));
  assert.ok(!hasField(job, "payer_credits"));
  assert.ok(!hasField(job, "wallet"));
  assert.ok(!hasField(job, "key_id"));
  assert.ok(!hasField(job, "agent_credits_delta"));
  assert.ok(!hasField(job, "receipts"));

  for (const field of JOB_FIELDS) {
    assert.ok(hasField(job, field), `missing job field ${field}`);
  }
  assert.ok(hasField(job, "notify_url"));
  assert.ok(hasField(job, "proof_url"));
  assert.ok(hasField(job, "agent_payout"));

  const compact = def("CompactJob").properties;
  for (const [from, to] of Object.entries(COMPACT_KEYS)) {
    assert.ok(compact[to], `missing compact key ${to} for ${from}`);
  }
  assert.equal(def("HandoffPayload").properties.v.const, 1);
  assert.deepEqual(def("HandoffPayload").required, ["v", "job"]);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.deepEqual(openapi.components.schemas.JobHandoff.required, ["v", "job"]);
  assert.equal(openapi.components.schemas.JobHandoff.properties.v.const, 1);
});

test("a live encoded handoff satisfies the schema required fields after expand", () => {
  const encoded = encodeHandoff(sampleJob({
    clientRef: "agent-job-42",
    callbackUrl: "https://your-adapter.example/notify",
    expiresAt: "2026-09-16T00:00:00.000Z",
  }));
  assert.equal(encoded.ok, true);
  const raw = Buffer.from(encoded.token.slice("h1.".length), "base64url").toString("utf8");
  const payload = JSON.parse(raw);
  assert.equal(payload.v, def("HandoffPayload").properties.v.const);
  assert.ok(payload.job);
  assert.deepEqual(payload.next, ["submit"]);

  const compact = def("CompactJob").properties;
  for (const key of ["id", "t", "a", "c", "p", "s", "ca", "fa", "sa", "ra", "f", "ap", "cr", "cb", "ea"]) {
    assert.notEqual(payload.job[key], undefined, `encoded compact missing ${key}`);
    assert.ok(compact[key], `schema compact missing ${key}`);
  }
  assert.equal(payload.job.credits, undefined);
  assert.equal(payload.job.title, undefined);

  const decoded = decodeHandoff(encoded.token);
  assert.equal(decoded.ok, true);
  for (const field of def("Job").required) {
    assert.notEqual(decoded.job[field], undefined, `decoded job missing ${field}`);
  }
  assert.equal(decoded.job.createdAt, NOW);
  assert.equal(decoded.job.clientRef, "agent-job-42");
  assert.deepEqual(decoded.next, ["submit"]);
});

test("GET /api/schemas/handoff.json serves the JSON Schema", async () => {
  for (const url of [
    SCHEMA_PATH,
    "/api/agent.json?doc=handoff-schema",
    "/api/schemas/handoff.json?cache=0",
  ]) {
    const get = await invoke(url, { method: "GET" });
    assert.equal(get.statusCode, 200, url);
    assert.deepEqual(get.body, HANDOFF_SCHEMA, url);
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

test("discovery, protocol, and docs point at the handoff schema", () => {
  assert.equal(TOOLS.discovery.find((row) => row.id === "handoff_schema").path, SCHEMA_PATH);

  assert.equal(SETTLEMENT.surfaces.handoff_schema, SCHEMA_PATH);
  assert.equal(SETTLEMENT.handoff_schema.path, SCHEMA_PATH);
  assert.equal(SETTLEMENT.handoff_schema.money, false);
  assert.equal(SETTLEMENT.handoff.schema, SCHEMA_PATH);
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes(SCHEMA_PATH)));

  assert.equal(AGENT.surfaces.handoff_schema, SCHEMA_PATH);
  assert.match(AGENT.note, /schemas\/handoff\.json/);

  assert.equal(QUICKSTART.related.find((row) => row.id === "handoff_schema").path, SCHEMA_PATH);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths[SCHEMA_PATH].get);
  assert.equal(openapi.paths[SCHEMA_PATH].get.operationId, "getHandoffSchema");
  assert.ok(openapi.info.description.includes(SCHEMA_PATH));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.handoff_schema.const,
    SCHEMA_PATH,
  );
  assert.equal(
    openapi.components.schemas.HandoffSchemaDocument.properties.$id.const,
    SCHEMA_ID,
  );
  assert.match(openapi.components.schemas.JobHandoff.description, /schemas\/handoff\.json/);
  assert.equal(openapi.components.schemas.HandoffProtocol.properties.schema.const, SCHEMA_PATH);

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) =>
        row.source === SCHEMA_PATH && row.destination === "/api/agent.json?doc=handoff-schema",
    ),
  );

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes(`href="${SCHEMA_PATH}"`));
  assert.ok(homepage.includes('id="integrate"'));
  assert.ok(homepage.includes('id="handoff-form"'));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes(SCHEMA_PATH));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes(SCHEMA_PATH));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes(SCHEMA_PATH));
  assert.ok(readme.includes(`curl https://liberty-amber.vercel.app${SCHEMA_PATH}`));
});
