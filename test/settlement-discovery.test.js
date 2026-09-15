"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AGENT,
  SETTLEMENT,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const { handleHttp } = require("../api/_lib/settlement-transition");

const ROOT = path.join(__dirname, "..");

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

async function invoke(req) {
  const handler = require("../api/agent.json.js");
  const res = mockRes();
  await handler(req, res);
  return res;
}

test("agent discovery card stays demo-only and points at the real surfaces", () => {
  assert.equal(AGENT.service, "liberty-agent-settlement");
  assert.equal(AGENT.kind, "liberty-agent-settlement-discovery");
  assert.equal(AGENT.mode, "demo");
  assert.equal(AGENT.money, false);
  assert.equal(AGENT.persistence, false);
  assert.equal(AGENT.origin, "https://liberty-amber.vercel.app");
  assert.equal(AGENT.human, "/");
  assert.equal(AGENT.well_known, "/.well-known/agent.json");
  assert.equal(AGENT.path, "/api/agent.json");
  assert.deepEqual(AGENT.not, ["a2a-agent-card", "openai-ai-plugin"]);
  assert.equal(AGENT.surfaces.ui, "/");
  assert.equal(AGENT.surfaces.health, "/api/health.json");
  assert.equal(AGENT.surfaces.protocol, "/api/settlement.json");
  assert.equal(AGENT.surfaces.examples, "/api/examples.json");
  assert.equal(AGENT.surfaces.templates, "/api/templates.json");
  assert.equal(AGENT.surfaces.changelog, "/api/changelog.json");
  assert.equal(AGENT.surfaces.scoreboard, "/api/scoreboard.json");
  assert.equal(AGENT.surfaces.fees, "/api/fees.json");
  assert.equal(AGENT.surfaces.tools, "/api/tools.json");
  assert.equal(AGENT.surfaces.quickstart, "/api/quickstart.json");
  assert.equal(AGENT.surfaces.transition_schema, "/api/schemas/transition.json");
  assert.equal(AGENT.surfaces.openapi, "/settlement.openapi.json");
  assert.deepEqual(AGENT.surfaces.openapi_aliases, ["/openapi.json", "/api/openapi.json"]);
  assert.equal(AGENT.surfaces.llms, "/llms.txt");
  assert.equal(AGENT.surfaces.quote, "/api/v0/quote");
  assert.equal(AGENT.surfaces.transition, "/api/v0/transition");
  assert.equal(AGENT.surfaces.simulate, "/api/v0/simulate");
  assert.equal(AGENT.surfaces.verify, "/api/v0/verify");
  assert.equal(AGENT.surfaces.validate, "/api/v0/validate");
  assert.match(AGENT.note, /not an a2a agent card/i);
  assert.match(AGENT.note, /not a chatgpt plugin/i);
  assert.match(AGENT.note, /no payments/i);
  assert.match(AGENT.note, /changelog/i);
  assert.match(AGENT.note, /scoreboard/i);
  assert.match(AGENT.note, /fees/i);
  assert.doesNotMatch(JSON.stringify(AGENT), /\b\d[\d,]*\s+(users?|customers?)\b/i);
});

test("GET /api/agent.json serves the discovery card", async () => {
  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.body, AGENT);
  assert.equal(get.body.money, false);
  assert.equal(get.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(get.headers["Content-Type"], protocolHeaders()["Content-Type"]);

  const options = await invoke({ method: "OPTIONS" });
  assert.equal(options.statusCode, 204);
  assert.equal(options.ended, true);

  const post = await invoke({ method: "POST" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.body.money, false);
  assert.equal(post.body.error, "method_not_allowed");
});

test("GET settlement engines point at the well-known discovery card", () => {
  for (const req of [
    { method: "GET", body: null },
    { method: "GET", body: null, dryRun: true },
    { method: "GET", body: null, simulate: true },
    { method: "GET", body: null, verify: true },
    { method: "GET", body: null, validate: true },
  ]) {
    const get = handleHttp(req);
    assert.equal(get.status, 200);
    assert.equal(get.body.discovery, "/.well-known/agent.json");
    assert.equal(get.body.money, false);
  }
});

test("docs and vercel rewrite wire the discovery card", () => {
  assert.equal(SETTLEMENT.surfaces.discovery, "/.well-known/agent.json");
  assert.equal(SETTLEMENT.surfaces.agent, "/api/agent.json");
  assert.equal(SETTLEMENT.discovery.path, "/.well-known/agent.json");
  assert.equal(SETTLEMENT.discovery.alias, "/api/agent.json");
  assert.equal(SETTLEMENT.discovery.money, false);
  assert.deepEqual(SETTLEMENT.discovery.not, ["a2a-agent-card", "openai-ai-plugin"]);
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/.well-known/agent.json")));

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) => row.source === "/.well-known/agent.json" && row.destination === "/api/agent.json",
    ),
  );
  const staticCard = JSON.parse(
    fs.readFileSync(path.join(ROOT, ".well-known", "agent.json"), "utf8"),
  );
  assert.deepEqual(staticCard, AGENT);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/.well-known/agent.json"].get);
  assert.ok(openapi.paths["/api/agent.json"].get);
  assert.equal(openapi.paths["/.well-known/agent.json"].get.operationId, "getAgentDiscoveryWellKnown");
  assert.equal(openapi.paths["/api/agent.json"].get.operationId, "getAgentDiscovery");
  assert.ok(openapi.info.description.includes("/.well-known/agent.json"));
  assert.equal(openapi.components.schemas.AgentDiscovery.properties.money.const, false);

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('href="/.well-known/agent.json"'));
  assert.ok(homepage.includes('href="/api/agent.json"'));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/.well-known/agent.json"));
  assert.ok(markdown.includes("/api/agent.json"));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/.well-known/agent.json"));
  assert.ok(llms.includes("/api/agent.json"));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes("/.well-known/agent.json"));
  assert.ok(readme.includes("curl https://liberty-amber.vercel.app/.well-known/agent.json"));
});
