"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ERRORS,
  TOOLS,
  SETTLEMENT,
  AGENT,
  QUICKSTART,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const {
  SCHEMA_ERROR_CODES,
  STATE_ERROR_CODES,
  errorKind,
} = require("../api/_lib/settlement-transition");

const ROOT = path.join(__dirname, "..");
const ERRORS_PATH = "/api/errors.json";
const KNOWN_CODES = [
  "invalid_json",
  "invalid_action",
  "missing_field",
  "invalid_field",
  "illegal_transition",
  "insufficient_credits",
  "hold_expired",
  "method_not_allowed",
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

function byCode(code) {
  return ERRORS.errors.find((row) => row.code === code);
}

test("errors JSON stays demo-only and lists live engine codes", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/errors.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, ERRORS);

  assert.equal(ERRORS.service, "liberty-agent-settlement");
  assert.equal(ERRORS.kind, "liberty-agent-settlement-errors");
  assert.equal(ERRORS.mode, "demo");
  assert.equal(ERRORS.money, false);
  assert.equal(ERRORS.persistence, false);
  assert.equal(ERRORS.path, ERRORS_PATH);
  assert.equal(ERRORS.human, "/#integrate");
  assert.equal(ERRORS.origin, "https://liberty-amber.vercel.app");
  assert.match(ERRORS.description, /client-held demo/i);
  assert.match(ERRORS.description, /does not.*move real money/i);
  assert.match(ERRORS.description, /no auth failure/i);
  assert.equal(ERRORS.honesty.money, false);
  assert.equal(ERRORS.honesty.auth_error, false);
  assert.doesNotMatch(JSON.stringify(ERRORS), /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.doesNotMatch(JSON.stringify(ERRORS), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);

  const codes = ERRORS.errors.map((row) => row.code);
  assert.deepEqual(codes, KNOWN_CODES);
  assert.ok(codes.includes("hold_expired"));
  assert.ok(codes.includes("missing_field"));
  assert.ok(codes.includes("illegal_transition"));
  assert.ok(codes.includes("invalid_field"));

  for (const code of SCHEMA_ERROR_CODES) {
    assert.equal(byCode(code).kind, "schema");
    assert.equal(byCode(code).status, 400);
    assert.equal(errorKind(code), "schema");
  }
  for (const code of STATE_ERROR_CODES) {
    assert.equal(byCode(code).kind, "state");
    assert.equal(byCode(code).status, 409);
    assert.equal(errorKind(code), "state");
  }
  assert.equal(byCode("method_not_allowed").kind, "http");
  assert.equal(byCode("method_not_allowed").status, 405);
  assert.equal(errorKind("method_not_allowed"), undefined);

  const expiry = byCode("invalid_field").cases.find((row) => /not both/i.test(row.message));
  assert.ok(expiry);
  assert.ok(expiry.fields.includes("expires_at"));
  assert.ok(expiry.fields.includes("ttl_seconds"));

  const expired = byCode("hold_expired");
  assert.match(expired.message, /expiresAt/);
  assert.match(expired.when, /dispute/i);
  assert.ok(expired.fields.includes("expiresAt"));
});

test("GET /api/errors.json serves the catalog via the agent rewrite", async () => {
  for (const url of [
    ERRORS_PATH,
    "/api/agent.json?doc=errors",
    "/api/errors.json?cache=0",
  ]) {
    const get = await invoke(url, { method: "GET" });
    assert.equal(get.statusCode, 200, url);
    assert.deepEqual(get.body, ERRORS, url);
    assert.equal(get.body.money, false, url);
    assert.ok(get.body.errors.some((row) => row.code === "hold_expired"), url);
    assert.equal(get.headers["Access-Control-Allow-Origin"], "*");
    assert.equal(get.headers["Content-Type"], protocolHeaders()["Content-Type"]);
  }

  const options = await invoke(ERRORS_PATH, { method: "OPTIONS" });
  assert.equal(options.statusCode, 204);
  assert.equal(options.ended, true);

  const head = await invoke(ERRORS_PATH, { method: "HEAD" });
  assert.equal(head.statusCode, 200);
  assert.equal(head.ended, true);

  const post = await invoke(ERRORS_PATH, { method: "POST" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.body.money, false);
  assert.equal(post.body.error, "method_not_allowed");
});

test("discovery, protocol, and docs point at the error catalog", () => {
  assert.equal(TOOLS.discovery.find((row) => row.id === "errors").path, ERRORS_PATH);

  assert.equal(SETTLEMENT.surfaces.errors, ERRORS_PATH);
  assert.equal(SETTLEMENT.errors.path, ERRORS_PATH);
  assert.equal(SETTLEMENT.errors.money, false);
  assert.equal(SETTLEMENT.errors.human_path, "/#integrate");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes(ERRORS_PATH)));

  assert.equal(AGENT.surfaces.errors, ERRORS_PATH);
  assert.match(AGENT.note, /errors\.json/);

  assert.equal(QUICKSTART.related.find((row) => row.id === "errors").path, ERRORS_PATH);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths[ERRORS_PATH].get);
  assert.equal(openapi.paths[ERRORS_PATH].get.operationId, "getSettlementErrors");
  assert.ok(openapi.info.description.includes(ERRORS_PATH));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.errors.const,
    ERRORS_PATH,
  );
  assert.equal(openapi.components.schemas.Errors.properties.money.const, false);
  assert.equal(openapi.components.schemas.Errors.properties.path.const, ERRORS_PATH);
  assert.ok(openapi.components.schemas.TransitionError.properties.error.enum.includes("hold_expired"));

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) => row.source === ERRORS_PATH && row.destination === "/api/agent.json?doc=errors",
    ),
  );
  assert.equal(
    fs.readdirSync(path.join(ROOT, "api")).filter((name) => name.endsWith(".js")).length
      + fs.readdirSync(path.join(ROOT, "api", "v0")).filter((name) => name.endsWith(".js")).length,
    12,
  );

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes(`href="${ERRORS_PATH}"`));
  assert.ok(homepage.includes('id="integrate"'));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes(ERRORS_PATH));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes(ERRORS_PATH));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes(ERRORS_PATH));
  assert.ok(readme.includes(`curl https://liberty-amber.vercel.app${ERRORS_PATH}`));
});
