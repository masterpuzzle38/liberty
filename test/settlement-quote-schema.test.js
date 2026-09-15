"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  QUOTE_SCHEMA,
  TOOLS,
  SETTLEMENT,
  AGENT,
  EXAMPLES,
  QUICKSTART,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const { handleHttp } = require("../api/_lib/settlement-transition");

const ROOT = path.join(__dirname, "..");
const SCHEMA_PATH = "/api/schemas/quote.json";
const SCHEMA_ID = "https://liberty-amber.vercel.app/api/schemas/quote.json";
const ACTIONS = ["create", "fund", "submit", "release", "dispute"];

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
  return QUOTE_SCHEMA.$defs[name];
}

function requiredOf(name) {
  const schema = def(name);
  const extra = (schema.anyOf || []).flatMap((row) => row.required || []);
  return [...new Set([...(schema.required || []), ...extra])];
}

function hasField(schema, field) {
  return Boolean(schema && schema.properties && schema.properties[field]);
}

test("quote JSON Schema stays aligned with the live request and response shape", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/quote.schema.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, QUOTE_SCHEMA);

  assert.equal(QUOTE_SCHEMA.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(QUOTE_SCHEMA.$id, SCHEMA_ID);
  assert.equal(QUOTE_SCHEMA.type, "object");
  assert.match(QUOTE_SCHEMA.title, /quote request/i);
  assert.match(QUOTE_SCHEMA.description, /dry-run only/i);
  assert.match(QUOTE_SCHEMA.description, /does not move real money/i);
  assert.match(QUOTE_SCHEMA.description, /not an invoice/i);
  assert.match(QUOTE_SCHEMA.description, /not proof of payment/i);
  assert.match(QUOTE_SCHEMA.description, /money is always false/i);
  assert.doesNotMatch(JSON.stringify(QUOTE_SCHEMA), /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.doesNotMatch(JSON.stringify(QUOTE_SCHEMA), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);
  assert.doesNotMatch(JSON.stringify(QUOTE_SCHEMA), /stripe/i);

  const refs = QUOTE_SCHEMA.oneOf.map((row) => String(row.$ref || ""));
  assert.deepEqual(refs, [
    "#/$defs/CreateRequest",
    "#/$defs/FundRequest",
    "#/$defs/SubmitRequest",
    "#/$defs/ReleaseRequest",
    "#/$defs/DisputeRequest",
  ]);
  assert.deepEqual(
    ["CreateRequest", "FundRequest", "SubmitRequest", "ReleaseRequest", "DisputeRequest"].map(
      (name) => def(name).properties.action.const,
    ),
    ACTIONS,
  );
  assert.ok(!JSON.stringify(QUOTE_SCHEMA).includes('"prove"'));
  assert.ok(!hasField(def("CreateRequest"), "wallet"));
  assert.ok(!hasField(def("CreateRequest"), "agent_credits_delta"));

  assert.deepEqual(requiredOf("CreateRequest"), ["action", "title", "amount", "criteria"]);
  assert.ok(requiredOf("FundRequest").includes("payer_credits"));
  assert.ok(hasField(def("FundRequest"), "payerCredits"));
  assert.ok(hasField(def("FundRequest"), "expires_at"));
  assert.ok(hasField(def("FundRequest"), "ttl_seconds"));
  assert.ok(hasField(def("Job"), "expiresAt"));
  assert.equal(def("TtlSeconds").minimum, 1);
  assert.ok(requiredOf("SubmitRequest").includes("proof_url"));
  assert.ok(hasField(def("SubmitRequest"), "proof_note"));
  assert.ok(hasField(def("ReleaseRequest"), "release_note"));
  assert.ok(hasField(def("DisputeRequest"), "dispute_reason"));
  assert.ok(hasField(def("DisputeRequest"), "payer_credits"));
  assert.ok(hasField(def("CreateRequest"), "client_ref"));
  assert.ok(hasField(def("CreateRequest"), "callback_url"));
  assert.ok(hasField(def("CreateRequest"), "notify_url"));
  assert.ok(hasField(def("CreateRequest"), "idempotency_key"));
  assert.equal(def("ClientRef").maxLength, 128);
  assert.equal(def("Note").maxLength, 400);
  assert.equal(def("CallbackUrl").maxLength, 512);
  assert.equal(def("CallbackUrl").pattern, "^https://");
  assert.equal(def("Credits").minimum, 0);
  assert.equal(def("CreateRequest").properties.amount.minimum, 1);
  assert.deepEqual(def("Job").properties.status.enum, SETTLEMENT.states);
  assert.equal(def("Job").properties.id.pattern, "^as_[0-9a-f]{10}$");

  const success = def("QuoteSuccess");
  assert.deepEqual(success.required, ["ok", "mode", "money", "quoted", "action", "job"]);
  assert.equal(success.properties.ok.const, true);
  assert.equal(success.properties.mode.const, "demo");
  assert.equal(success.properties.money.const, false);
  assert.equal(success.properties.quoted.const, true);
  assert.deepEqual(success.properties.action.enum, ACTIONS);
  assert.ok(!hasField(success, "wallet"));
  assert.ok(hasField(def("QuoteJob"), "id"));
  assert.ok(!def("QuoteJob").required.includes("id"));
  assert.match(def("QuoteJob").description, /omit id/i);
  assert.match(success.description, /not an invoice/i);
  assert.match(success.description, /not proof of payment/i);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  const openApiActions = openapi.components.schemas.TransitionRequest.oneOf.map((row) =>
    row.$ref.split("/").pop(),
  );
  assert.deepEqual(openApiActions, [
    "CreateRequest",
    "FundRequest",
    "SubmitRequest",
    "ReleaseRequest",
    "DisputeRequest",
  ]);
  assert.deepEqual(
    openapi.components.schemas.QuoteSuccess.required,
    success.required,
  );
  assert.equal(openapi.components.schemas.QuoteSuccess.properties.money.const, false);
  assert.equal(openapi.components.schemas.QuoteSuccess.properties.quoted.const, true);
});

test("adapter quote example satisfies the schema required fields", () => {
  const example = EXAMPLES.examples.find((row) => row.id === "quote");
  assert.ok(example && example.body);
  const schema = def("CreateRequest");
  assert.equal(example.body.action, schema.properties.action.const);
  for (const field of schema.required) {
    assert.notEqual(example.body[field], undefined, `quote example missing ${field}`);
  }
});

test("GET /api/schemas/quote.json serves the JSON Schema", async () => {
  for (const url of [
    SCHEMA_PATH,
    "/api/agent.json?doc=quote-schema",
    "/api/schemas/quote.json?cache=0",
  ]) {
    const get = await invoke(url, { method: "GET" });
    assert.equal(get.statusCode, 200, url);
    assert.deepEqual(get.body, QUOTE_SCHEMA, url);
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

test("discovery, protocol, and docs point at the quote schema", () => {
  assert.equal(TOOLS.tools.find((tool) => tool.id === "quote").schema, SCHEMA_PATH);
  assert.equal(TOOLS.discovery.find((row) => row.id === "quote_schema").path, SCHEMA_PATH);

  assert.equal(SETTLEMENT.surfaces.quote_schema, SCHEMA_PATH);
  assert.equal(SETTLEMENT.quote_schema.path, SCHEMA_PATH);
  assert.equal(SETTLEMENT.quote_schema.money, false);
  assert.equal(SETTLEMENT.quote_api.schema, SCHEMA_PATH);
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes(SCHEMA_PATH)));

  assert.equal(AGENT.surfaces.quote_schema, SCHEMA_PATH);
  assert.match(AGENT.note, /schemas\/quote\.json/);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths[SCHEMA_PATH].get);
  assert.equal(openapi.paths[SCHEMA_PATH].get.operationId, "getQuoteRequestSchema");
  assert.ok(openapi.info.description.includes(SCHEMA_PATH));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.quote_schema.const,
    SCHEMA_PATH,
  );
  assert.equal(
    openapi.components.schemas.QuoteRequestSchemaDocument.properties.$id.const,
    SCHEMA_ID,
  );
  assert.equal(
    openapi.components.schemas.QuoteDiscovery.properties.schema.const,
    SCHEMA_PATH,
  );

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) =>
        row.source === SCHEMA_PATH && row.destination === "/api/agent.json?doc=quote-schema",
    ),
  );

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes(`href="${SCHEMA_PATH}"`));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes(SCHEMA_PATH));
  assert.equal(
    QUICKSTART.related.find((row) => row.id === "quote_schema").path,
    SCHEMA_PATH,
  );

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes(SCHEMA_PATH));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes(SCHEMA_PATH));
  assert.ok(readme.includes(`curl https://liberty-amber.vercel.app${SCHEMA_PATH}`));

  const quoteDiscovery = handleHttp({ method: "GET", body: null, dryRun: true });
  assert.equal(quoteDiscovery.status, 200);
  assert.equal(quoteDiscovery.body.schema, SCHEMA_PATH);
  assert.equal(quoteDiscovery.body.money, false);
});
