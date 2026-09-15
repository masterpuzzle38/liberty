"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SIMULATE_SCHEMA,
  TOOLS,
  SETTLEMENT,
  AGENT,
  EXAMPLES,
  QUICKSTART,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const { handleHttp, simulate } = require("../api/_lib/settlement-transition");

const ROOT = path.join(__dirname, "..");
const SCHEMA_PATH = "/api/schemas/simulate.json";
const SCHEMA_ID = "https://liberty-amber.vercel.app/api/schemas/simulate.json";
const REQUIRED = ["title", "amount", "criteria", "payer_credits", "proof_url"];
const OPTIONAL = [
  "terminal",
  "client_ref",
  "callback_url",
  "notify_url",
  "expires_at",
  "ttl_seconds",
  "proof_note",
  "release_note",
  "dispute_reason",
  "idempotency_key",
];

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
  return SIMULATE_SCHEMA.$defs[name];
}

function hasField(schema, field) {
  return Boolean(schema && schema.properties && schema.properties[field]);
}

function validBody(extra = {}) {
  return {
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief",
    payer_credits: 100,
    proof_url: "https://example.com/proof",
    ...extra,
  };
}

test("simulate JSON Schema stays aligned with the live request shape", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/simulate.schema.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, SIMULATE_SCHEMA);

  assert.equal(SIMULATE_SCHEMA.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(SIMULATE_SCHEMA.$id, SCHEMA_ID);
  assert.equal(SIMULATE_SCHEMA.type, "object");
  assert.equal(SIMULATE_SCHEMA.$ref, "#/$defs/SimulateRequest");
  assert.match(SIMULATE_SCHEMA.title, /simulate request/i);
  assert.match(SIMULATE_SCHEMA.description, /one-shot create/i);
  assert.match(SIMULATE_SCHEMA.description, /does not .* move real money/i);
  assert.match(SIMULATE_SCHEMA.description, /money is always false/i);
  assert.doesNotMatch(JSON.stringify(SIMULATE_SCHEMA), /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.doesNotMatch(JSON.stringify(SIMULATE_SCHEMA), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);
  assert.doesNotMatch(JSON.stringify(SIMULATE_SCHEMA), /stripe/i);

  const request = def("SimulateRequest");
  assert.deepEqual(request.required, REQUIRED);
  assert.ok(!JSON.stringify(SIMULATE_SCHEMA).includes('"prove"'));
  assert.ok(!hasField(request, "wallet"));
  assert.ok(!hasField(request, "action"));
  assert.ok(!hasField(request, "job"));
  assert.ok(!hasField(request, "agent_credits_delta"));

  for (const field of REQUIRED) {
    assert.ok(hasField(request, field), `missing required ${field}`);
  }
  for (const field of OPTIONAL) {
    assert.ok(hasField(request, field), `missing optional ${field}`);
  }
  assert.ok(hasField(request, "payerCredits"));
  assert.ok(hasField(request, "proofUrl"));
  assert.ok(hasField(request, "clientRef"));
  assert.ok(hasField(request, "callbackUrl"));
  assert.ok(hasField(request, "notifyUrl"));
  assert.ok(hasField(request, "expiresAt"));
  assert.ok(hasField(request, "ttlSeconds"));
  assert.ok(hasField(request, "proofNote"));
  assert.ok(hasField(request, "releaseNote"));
  assert.ok(hasField(request, "disputeReason"));
  assert.ok(hasField(request, "idempotencyKey"));

  assert.equal(def("ClientRef").maxLength, 128);
  assert.equal(def("Note").maxLength, 400);
  assert.equal(def("CallbackUrl").maxLength, 512);
  assert.equal(def("CallbackUrl").pattern, "^https://");
  assert.equal(def("Credits").minimum, 0);
  assert.equal(def("TtlSeconds").minimum, 1);
  assert.equal(request.properties.amount.minimum, 1);
  assert.equal(request.properties.title.maxLength, 80);
  assert.deepEqual(def("Terminal").enum, ["release", "dispute"]);
  assert.equal(def("Terminal").default, "release");

  const success = def("SimulateSuccess");
  assert.deepEqual(success.required, ["ok", "mode", "money", "steps", "job", "payer_credits"]);
  assert.equal(success.properties.ok.const, true);
  assert.equal(success.properties.mode.const, "demo");
  assert.equal(success.properties.money.const, false);
  assert.ok(!hasField(success, "wallet"));
  assert.match(success.description, /does not persist/i);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.deepEqual(openapi.components.schemas.SimulateRequest.required, REQUIRED);
  assert.deepEqual(openapi.components.schemas.SimulateRequest.properties.terminal.enum, [
    "release",
    "dispute",
  ]);
  assert.equal(openapi.components.schemas.SimulateSuccess.properties.money.const, false);
});

test("adapter simulate example satisfies the schema required fields", () => {
  const example = EXAMPLES.examples.find((row) => row.id === "simulate");
  assert.ok(example && example.body);
  const schema = def("SimulateRequest");
  for (const field of schema.required) {
    assert.notEqual(example.body[field], undefined, `simulate example missing ${field}`);
  }
  assert.ok(["release", "dispute"].includes(example.body.terminal));
  assert.match(example.note, /schemas\/simulate\.json/);
});

test("schema required/optional fields stay aligned with the live simulate handler", () => {
  const accepted = simulate(validBody());
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.money, false);
  assert.equal(accepted.body.terminal, "release");

  const aliased = simulate(
    validBody({
      payer_credits: undefined,
      proof_url: undefined,
      payerCredits: 100,
      proofUrl: "https://example.com/proof",
      terminal: "dispute",
      clientRef: "agent-job-42",
      notifyUrl: "https://your-adapter.example/notify",
      ttlSeconds: 60,
      proofNote: "Attached.",
      disputeReason: "Criteria not met.",
    }),
  );
  assert.equal(aliased.status, 200, aliased.body && aliased.body.message);
  assert.equal(aliased.body.terminal, "dispute");
  assert.equal(aliased.body.job.clientRef, "agent-job-42");

  const missing = simulate({ title: "x", amount: 10, criteria: "done" });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, "missing_field");
  assert.equal(missing.body.money, false);

  const garbage = simulate({
    title: "x",
    amount: 10,
    criteria: "done",
    payer_credits: 10,
    proof_url: "https://example.com/proof",
    terminal: "prove",
  });
  assert.equal(garbage.status, 400);
  assert.equal(garbage.body.error, "invalid_field");
  assert.equal(garbage.body.field, "terminal");
  assert.ok(!def("Terminal").enum.includes("prove"));

  const notAnObject = simulate(null);
  assert.equal(notAnObject.status, 400);
  assert.equal(notAnObject.body.error, "invalid_json");
});

test("GET /api/schemas/simulate.json serves the JSON Schema", async () => {
  for (const url of [
    SCHEMA_PATH,
    "/api/agent.json?doc=simulate-schema",
    "/api/schemas/simulate.json?cache=0",
  ]) {
    const get = await invoke(url, { method: "GET" });
    assert.equal(get.statusCode, 200, url);
    assert.deepEqual(get.body, SIMULATE_SCHEMA, url);
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

test("discovery, protocol, and docs point at the simulate schema", () => {
  assert.equal(TOOLS.tools.find((tool) => tool.id === "simulate").schema, SCHEMA_PATH);
  assert.equal(TOOLS.discovery.find((row) => row.id === "simulate_schema").path, SCHEMA_PATH);

  assert.equal(SETTLEMENT.surfaces.simulate_schema, SCHEMA_PATH);
  assert.equal(SETTLEMENT.simulate_schema.path, SCHEMA_PATH);
  assert.equal(SETTLEMENT.simulate_schema.money, false);
  assert.equal(SETTLEMENT.simulate_api.schema, SCHEMA_PATH);
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes(SCHEMA_PATH)));

  assert.equal(AGENT.surfaces.simulate_schema, SCHEMA_PATH);
  assert.match(AGENT.note, /schemas\/simulate\.json/);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths[SCHEMA_PATH].get);
  assert.equal(openapi.paths[SCHEMA_PATH].get.operationId, "getSimulateRequestSchema");
  assert.ok(openapi.info.description.includes(SCHEMA_PATH));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.simulate_schema.const,
    SCHEMA_PATH,
  );
  assert.equal(
    openapi.components.schemas.SimulateRequestSchemaDocument.properties.$id.const,
    SCHEMA_ID,
  );
  assert.equal(
    openapi.components.schemas.SimulateDiscovery.properties.schema.const,
    SCHEMA_PATH,
  );
  assert.match(openapi.components.schemas.SimulateRequest.description, /schemas\/simulate\.json/);

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) =>
        row.source === SCHEMA_PATH && row.destination === "/api/agent.json?doc=simulate-schema",
    ),
  );

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes(`href="${SCHEMA_PATH}"`));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes(SCHEMA_PATH));
  assert.equal(
    QUICKSTART.related.find((row) => row.id === "simulate_schema").path,
    SCHEMA_PATH,
  );

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes(SCHEMA_PATH));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes(SCHEMA_PATH));
  assert.ok(readme.includes(`curl https://liberty-amber.vercel.app${SCHEMA_PATH}`));

  const simulateDiscovery = handleHttp({ method: "GET", body: null, simulate: true });
  assert.equal(simulateDiscovery.status, 200);
  assert.equal(simulateDiscovery.body.schema, SCHEMA_PATH);
  assert.equal(simulateDiscovery.body.money, false);
});
