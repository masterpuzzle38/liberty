"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  QUICKSTART,
  SETTLEMENT,
  AGENT,
  TOOLS,
  SCOREBOARD,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const { quote, simulate, transition } = require("../api/_lib/settlement-transition");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://liberty-amber.vercel.app";
const NOW = "2026-09-15T00:00:00.000Z";
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

async function invoke(req) {
  const handler = require("../api/agent.json.js");
  const res = mockRes();
  await handler({ url: "/api/agent.json?doc=quickstart", ...req }, res);
  return res;
}

function step(id) {
  return QUICKSTART.steps.find((row) => row.id === id);
}

test("quickstart JSON stays demo-only and lists an ordered escrow walk", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/quickstart.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, QUICKSTART);

  assert.equal(QUICKSTART.service, "liberty-agent-settlement");
  assert.equal(QUICKSTART.kind, "liberty-agent-settlement-quickstart");
  assert.equal(QUICKSTART.mode, "demo");
  assert.equal(QUICKSTART.money, false);
  assert.equal(QUICKSTART.persistence, false);
  assert.equal(QUICKSTART.path, "/api/quickstart.json");
  assert.equal(QUICKSTART.human, "/#integrate");
  assert.equal(QUICKSTART.origin, ORIGIN);
  assert.match(QUICKSTART.description, /does not persist/i);
  assert.match(QUICKSTART.description, /does not.*move real money/i);
  assert.match(QUICKSTART.note, /client-held|clients hold/i);
  assert.match(QUICKSTART.note, /does not move real money/i);
  assert.match(QUICKSTART.note, /scoreboard zeros are honest/i);
  assert.equal(QUICKSTART.auth.required, false);
  assert.ok(QUICKSTART.auth.headers.includes("Authorization: Bearer <key>"));
  assert.ok(QUICKSTART.auth.headers.includes("X-Liberty-Key"));
  assert.equal(QUICKSTART.auth.placeholder, "lib_demo_…");
  assert.equal(QUICKSTART.idempotency.header, "Idempotency-Key");
  assert.equal(QUICKSTART.idempotency.example, "retry-create-1");
  assert.equal(QUICKSTART.idempotency.replay, false);
  assert.doesNotMatch(JSON.stringify(QUICKSTART), /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.doesNotMatch(JSON.stringify(QUICKSTART), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);

  assert.deepEqual(
    QUICKSTART.steps.map((row) => row.id),
    ["health", "discovery", "quote", "create", "fund", "prove", "release", "dispute"],
  );
  QUICKSTART.steps.forEach((row, index) => {
    assert.equal(row.n, index + 1);
    assert.equal(typeof row.curl, "string");
    assert.ok(row.curl.includes(ORIGIN));
    assert.ok(row.url.startsWith(ORIGIN));
    assert.ok(row.path.startsWith("/"));
  });
  assert.equal(step("health").method, "GET");
  assert.equal(step("discovery").method, "GET");
  assert.equal(step("quote").method, "POST");
  assert.equal(step("quote").applicable, true);
  assert.equal(step("fund").action, "fund");
  assert.equal(step("prove").action, "submit");
  assert.equal(step("release").action, "release");
  assert.equal(step("dispute").optional, true);
  assert.equal(step("dispute").branch, true);
  assert.equal(step("dispute").instead_of, "release");

  assert.deepEqual(
    QUICKSTART.related.map((row) => row.id),
    ["validate", "openapi", "examples", "templates", "tools", "transition_schema", "quote_schema", "simulate_schema", "verify_schema", "receipt_schema", "handoff_schema", "errors", "scoreboard"],
  );
  for (const row of QUICKSTART.related) {
    assert.ok(row.method === "GET" || (row.id === "validate" && row.method === "POST"));
    assert.ok(row.url.startsWith(ORIGIN));
  }
  assert.equal(QUICKSTART.related.find((row) => row.id === "validate").path, "/api/v0/validate");
  assert.equal(QUICKSTART.related.find((row) => row.id === "openapi").path, "/openapi.json");
  assert.match(QUICKSTART.related.find((row) => row.id === "scoreboard").note, /zeros are honest/i);

  assert.equal(QUICKSTART.shortcut.id, "simulate");
  assert.equal(QUICKSTART.shortcut.path, "/api/v0/simulate");
  assert.ok(QUICKSTART.shortcut.curl.includes(ORIGIN));
});

test("quickstart POST bodies run against the shared fee engine", () => {
  const quoted = quote(step("quote").body, OPTIONS);
  assert.equal(quoted.status, 200);
  assert.equal(quoted.body.quoted, true);
  assert.equal(quoted.body.money, false);
  assert.equal(quoted.body.job.status, "open");
  assert.equal(quoted.body.job.id, undefined);

  const created = transition(step("create").body, OPTIONS);
  assert.equal(created.status, 200);
  assert.equal(created.body.job.status, "open");
  assert.equal(created.body.job.id, "as_0123456789");
  assert.equal(created.body.job.clientRef, "agent-job-42");

  const funded = transition(step("fund").body, OPTIONS);
  assert.equal(funded.status, 200);
  assert.equal(funded.body.job.status, "funded");
  assert.equal(funded.body.payer_credits, 0);
  assert.equal(funded.body.money, false);

  const submitted = transition(step("prove").body, OPTIONS);
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.job.status, "submitted");

  const released = transition(step("release").body, OPTIONS);
  assert.equal(released.status, 200);
  assert.equal(released.body.job.status, "released");
  assert.equal(released.body.agent_credits_delta, 95);
  assert.equal(released.body.money, false);

  const disputed = transition(step("dispute").body, OPTIONS);
  assert.equal(disputed.status, 200);
  assert.equal(disputed.body.job.status, "disputed");
  assert.equal(disputed.body.agent_credits_delta, 0);
  assert.equal(disputed.body.returned_to_payer, 100);

  const walked = simulate(QUICKSTART.shortcut.body, OPTIONS);
  assert.equal(walked.status, 200);
  assert.equal(walked.body.ok, true);
  assert.equal(walked.body.job.status, "released");
  assert.equal(walked.body.money, false);
});

test("GET /api/quickstart.json serves the ordered walk", async () => {
  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.body, QUICKSTART);
  assert.equal(get.body.money, false);
  assert.equal(get.body.mode, "demo");
  assert.equal(get.body.persistence, false);
  assert.equal(get.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(get.headers["Content-Type"], protocolHeaders()["Content-Type"]);

  const byPath = mockRes();
  const handler = require("../api/agent.json.js");
  await handler({ url: "/api/quickstart.json", method: "GET" }, byPath);
  assert.equal(byPath.statusCode, 200);
  assert.deepEqual(byPath.body, QUICKSTART);

  const options = await invoke({ method: "OPTIONS" });
  assert.equal(options.statusCode, 204);
  assert.equal(options.ended, true);

  const head = await invoke({ method: "HEAD" });
  assert.equal(head.statusCode, 200);
  assert.equal(head.ended, true);

  const post = await invoke({ method: "POST" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.body.money, false);
  assert.equal(post.body.error, "method_not_allowed");
});

test("discovery, protocol, and docs point at the quickstart", () => {
  assert.equal(SETTLEMENT.surfaces.quickstart, "/api/quickstart.json");
  assert.equal(SETTLEMENT.quickstart.path, "/api/quickstart.json");
  assert.equal(SETTLEMENT.quickstart.money, false);
  assert.equal(SETTLEMENT.quickstart.persistence, false);
  assert.equal(SETTLEMENT.quickstart.human_path, "/#integrate");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/quickstart.json")));

  assert.equal(AGENT.surfaces.quickstart, "/api/quickstart.json");
  assert.match(AGENT.note, /quickstart\.json/i);

  assert.equal(TOOLS.discovery.find((row) => row.id === "quickstart").path, "/api/quickstart.json");

  assert.equal(SCOREBOARD.external_users, 0);
  assert.equal(SCOREBOARD.paid_pilots, 0);
  assert.equal(SCOREBOARD.revenue_usd, 0);
  assert.equal(SCOREBOARD.money, false);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/api/quickstart.json"].get);
  assert.equal(openapi.paths["/api/quickstart.json"].get.operationId, "getSettlementQuickstart");
  assert.ok(openapi.info.description.includes("/api/quickstart.json"));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.quickstart.const,
    "/api/quickstart.json",
  );
  assert.equal(openapi.components.schemas.Quickstart.properties.money.const, false);
  assert.equal(openapi.components.schemas.Quickstart.properties.mode.const, "demo");
  assert.equal(openapi.components.schemas.Quickstart.properties.persistence.const, false);
  assert.equal(openapi.components.schemas.Quickstart.properties.path.const, "/api/quickstart.json");
  assert.equal(openapi.components.schemas.Quickstart.properties.human.const, "/#integrate");

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) =>
        row.source === "/api/quickstart.json" && row.destination === "/api/agent.json?doc=quickstart",
    ),
  );

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('href="/api/quickstart.json"'));
  assert.ok(homepage.includes('id="integrate"'));
  assert.ok(homepage.includes('href="#integrate"'));
  assert.ok(homepage.includes("Honest zeros"));

  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  assert.ok(app.includes('"/api/quickstart.json"'));
  assert.ok(app.includes("loadIntegrate"));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/api/quickstart.json"));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/api/quickstart.json"));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes("/api/quickstart.json"));
  assert.ok(readme.includes("curl https://liberty-amber.vercel.app/api/quickstart.json"));
});
