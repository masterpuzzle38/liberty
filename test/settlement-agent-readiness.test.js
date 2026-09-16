"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AGENT,
  AGENTS,
  SETTLEMENT,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://liberty-amber.vercel.app";

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

test("agents.json lists only the existing Settlement agent", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/agents.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, AGENTS);

  assert.equal(AGENTS.service, "liberty-agent-settlement");
  assert.equal(AGENTS.kind, "liberty-agent-settlement-agents");
  assert.equal(AGENTS.mode, "demo");
  assert.equal(AGENTS.money, false);
  assert.equal(AGENTS.persistence, false);
  assert.equal(AGENTS.origin, ORIGIN);
  assert.equal(AGENTS.well_known, "/.well-known/agents.json");
  assert.equal(AGENTS.path, "/.well-known/agents.json");
  assert.equal(AGENTS.alias, "/api/agents.json");
  assert.equal(AGENTS.card, "/.well-known/agent.json");
  assert.deepEqual(AGENTS.not, ["a2a-agent-card", "openai-ai-plugin", "mcp-server"]);
  assert.equal(AGENTS.agents.length, 1);
  assert.equal(AGENTS.agents[0].id, "liberty-agent-settlement");
  assert.equal(AGENTS.agents[0].card, "/.well-known/agent.json");
  assert.equal(AGENTS.agents[0].money, false);
  assert.equal(AGENTS.scoreboard.external_users, 0);
  assert.equal(AGENTS.scoreboard.paid_pilots, 0);
  assert.equal(AGENTS.scoreboard.revenue_usd, 0);
  assert.equal(AGENTS.discovery.llms_full, "/llms-full.txt");
  assert.equal(AGENTS.discovery.security, "/.well-known/security.txt");
  const postPaths = AGENTS.endpoints.filter((row) => row.method === "POST").map((row) => row.path);
  assert.deepEqual(postPaths, [
    "/api/v0/validate",
    "/api/v0/quote",
    "/api/v0/transition",
    "/api/v0/simulate",
    "/api/v0/verify",
  ]);
  assert.equal(AGENTS.workflows.length, 1);
  assert.equal(AGENTS.workflows[0].path, "/api/quickstart.json");
  assert.match(AGENTS.note, /does not invent/i);
  assert.doesNotMatch(JSON.stringify(AGENTS), /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.doesNotMatch(JSON.stringify(AGENTS), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);

  const staticList = JSON.parse(fs.readFileSync(path.join(ROOT, ".well-known", "agents.json"), "utf8"));
  assert.deepEqual(staticList, AGENTS);
});

test("GET /.well-known/agents.json and /api/agents.json serve the list wrapper", async () => {
  for (const url of [
    "/api/agent.json?doc=agents",
    "/api/agents.json",
    "/.well-known/agents.json",
  ]) {
    const get = await invoke({ method: "GET", url });
    assert.equal(get.statusCode, 200);
    assert.deepEqual(get.body, AGENTS);
    assert.equal(get.body.money, false);
    assert.equal(get.body.agents.length, 1);
    assert.equal(get.headers["Access-Control-Allow-Origin"], "*");
    assert.equal(get.headers["Content-Type"], protocolHeaders()["Content-Type"]);
  }

  const options = await invoke({ method: "OPTIONS", url: "/api/agents.json" });
  assert.equal(options.statusCode, 204);
  assert.equal(options.ended, true);

  const post = await invoke({ method: "POST", url: "/api/agents.json" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.body.money, false);
  assert.equal(post.body.error, "method_not_allowed");

  const card = await invoke({ method: "GET", url: "/api/agent.json" });
  assert.deepEqual(card.body, AGENT);
  assert.equal(card.body.kind, "liberty-agent-settlement-discovery");
});

test("llms-full.txt is a fuller honest Settlement brief", () => {
  const full = fs.readFileSync(path.join(ROOT, "llms-full.txt"), "utf8");
  assert.match(full, /^# Liberty/m);
  assert.match(full, /Demo only\. Not real money/);
  assert.match(full, /money:\s*false/);
  assert.match(full, /external_users.*0/);
  assert.match(full, /\/api\/v0\/validate/);
  assert.match(full, /\/api\/v0\/quote/);
  assert.match(full, /\/api\/v0\/transition/);
  assert.match(full, /\/api\/v0\/simulate/);
  assert.match(full, /\/api\/v0\/verify/);
  assert.match(full, /\/api\/schemas\/transition\.json/);
  assert.match(full, /\/api\/schemas\/quote\.json/);
  assert.match(full, /\/api\/schemas\/simulate\.json/);
  assert.match(full, /\/api\/schemas\/verify\.json/);
  assert.match(full, /\/api\/tools\.json/);
  assert.match(full, /\/api\/quickstart\.json/);
  assert.match(full, /\/#integrate/);
  assert.match(full, /\/\.well-known\/agents\.json/);
  assert.match(full, /\/security\.txt/);
  assert.doesNotMatch(full, /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.match(full, /No SOC 2/);
  assert.doesNotMatch(full, /SOC\s*2 certified/i);

  const short = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(full.length > short.length);
  assert.ok(short.includes("/llms-full.txt"));
  assert.ok(short.includes("/.well-known/agents.json"));
  assert.ok(short.includes("/security.txt"));
});

test("security.txt is RFC 9116 style and honest about the demo", () => {
  const root = fs.readFileSync(path.join(ROOT, "security.txt"), "utf8");
  const wellKnown = fs.readFileSync(path.join(ROOT, ".well-known", "security.txt"), "utf8");
  assert.equal(root, wellKnown);
  assert.match(root, /^Contact:\s+https:\/\/github\.com\/masterpuzzle38\/liberty\/issues$/m);
  assert.match(root, /^Expires:\s+\d{4}-\d{2}-\d{2}T/m);
  assert.match(root, /^Preferred-Languages:\s+en$/m);
  assert.match(root, new RegExp(`^Canonical:\\s+${ORIGIN}/\\.well-known/security\\.txt$`, "m"));
  assert.match(root, /^Policy:\s+https:\/\/github\.com\/masterpuzzle38\/liberty$/m);
  assert.match(root, /demo/i);
  assert.match(root, /not real money/i);
  assert.match(root, /no SOC 2/i);
  assert.doesNotMatch(root, /soc\s*2 certified/i);
});

test("discovery, docs, and vercel wire the readiness pack", () => {
  assert.equal(AGENT.surfaces.agents, "/.well-known/agents.json");
  assert.equal(AGENT.surfaces.llms_full, "/llms-full.txt");
  assert.equal(AGENT.surfaces.security, "/.well-known/security.txt");
  assert.equal(SETTLEMENT.surfaces.agents, "/.well-known/agents.json");
  assert.equal(SETTLEMENT.surfaces.llms_full, "/llms-full.txt");
  assert.equal(SETTLEMENT.surfaces.security, "/.well-known/security.txt");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/.well-known/agents.json")));

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) => row.source === "/.well-known/agents.json" && row.destination === "/api/agent.json?doc=agents",
    ),
  );
  assert.ok(
    vercel.rewrites.some(
      (row) => row.source === "/api/agents.json" && row.destination === "/api/agent.json?doc=agents",
    ),
  );
  assert.ok(
    vercel.rewrites.some(
      (row) => row.source === "/.well-known/security.txt" && row.destination === "/security.txt",
    ),
  );
  assert.ok(vercel.headers.some((row) => row.source === "/llms-full.txt"));
  assert.ok(vercel.headers.some((row) => row.source === "/security.txt"));
  assert.ok(vercel.headers.some((row) => row.source === "/.well-known/agents.json"));

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('href="/.well-known/agents.json"'));
  assert.ok(homepage.includes('href="/llms-full.txt"'));
  assert.ok(homepage.includes('href="/security.txt"'));
  assert.ok(homepage.includes('property="og:title"'));
  assert.ok(homepage.includes('application/ld+json'));
  assert.ok(homepage.includes('"@graph"'));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/.well-known/agents.json"));
  assert.ok(markdown.includes("/llms-full.txt"));
  assert.ok(markdown.includes("/security.txt"));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes("/.well-known/agents.json"));
  assert.ok(readme.includes("/llms-full.txt"));
  assert.ok(readme.includes("/security.txt"));

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/.well-known/agents.json"].get);
  assert.ok(openapi.paths["/api/agents.json"].get);
  assert.equal(openapi.paths["/.well-known/agents.json"].get.operationId, "getAgentsListWellKnown");
  assert.equal(openapi.components.schemas.AgentsList.properties.money.const, false);
  assert.equal(openapi.components.schemas.AgentsList.properties.agents.maxItems, 1);
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.llms_full.const,
    "/llms-full.txt",
  );
});
