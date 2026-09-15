"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  TOOLS,
  SETTLEMENT,
  AGENT,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");

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
  await handler({ url: "/api/agent.json?doc=tools", ...req }, res);
  return res;
}

test("tools JSON stays demo-only and lists callable Settlement surfaces", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/tools.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, TOOLS);

  assert.equal(TOOLS.service, "liberty-agent-settlement");
  assert.equal(TOOLS.kind, "liberty-agent-settlement-tools");
  assert.equal(TOOLS.mode, "demo");
  assert.equal(TOOLS.money, false);
  assert.equal(TOOLS.persistence, false);
  assert.equal(TOOLS.path, "/api/tools.json");
  assert.equal(TOOLS.human, "/#adapters");
  assert.equal(TOOLS.origin, "https://liberty-amber.vercel.app");
  assert.deepEqual(TOOLS.not, ["mcp-server", "a2a-agent-card", "openai-ai-plugin"]);
  assert.match(TOOLS.description, /not an mcp server/i);
  assert.match(TOOLS.note, /capability list/i);
  assert.match(TOOLS.note, /does not persist/i);
  assert.doesNotMatch(JSON.stringify(TOOLS), /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);
  assert.doesNotMatch(JSON.stringify(TOOLS), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);

  const toolIds = TOOLS.tools.map((tool) => tool.id);
  assert.deepEqual(toolIds, ["validate", "quote", "transition", "simulate", "verify"]);
  assert.equal(
    TOOLS.tools.find((tool) => tool.id === "transition").schema,
    "/api/schemas/transition.json",
  );
  assert.equal(
    TOOLS.tools.find((tool) => tool.id === "validate").schema,
    "/api/schemas/transition.json",
  );
  for (const tool of TOOLS.tools) {
    assert.equal(tool.method, "POST");
    assert.equal(typeof tool.path, "string");
    assert.ok(tool.path.startsWith("/api/v0/"));
    assert.equal(typeof tool.purpose, "string");
    assert.ok(tool.purpose.length > 0);
  }

  assert.deepEqual(
    TOOLS.tools.find((tool) => tool.id === "validate").actions,
    SETTLEMENT.validate_api.requests,
  );
  assert.deepEqual(
    TOOLS.tools.find((tool) => tool.id === "quote").actions,
    SETTLEMENT.quote_api.requests,
  );
  assert.deepEqual(
    TOOLS.tools.find((tool) => tool.id === "transition").actions,
    SETTLEMENT.transition_api.requests,
  );
  assert.deepEqual(
    TOOLS.tools.find((tool) => tool.id === "simulate").body,
    SETTLEMENT.simulate_api.requests[0].body,
  );
  assert.deepEqual(
    TOOLS.tools.find((tool) => tool.id === "simulate").optional,
    SETTLEMENT.simulate_api.requests[0].optional,
  );
  assert.deepEqual(
    TOOLS.tools.find((tool) => tool.id === "verify").bodies,
    SETTLEMENT.verify_api.requests,
  );

  const discoveryIds = TOOLS.discovery.map((row) => row.id);
  assert.deepEqual(discoveryIds, [
    "quickstart",
    "health",
    "settlement",
    "fees",
    "scoreboard",
    "changelog",
    "examples",
    "templates",
    "agent",
    "openapi",
    "transition_schema",
    "receipt_schema",
    "handoff_schema",
    "errors",
  ]);
  for (const row of TOOLS.discovery) {
    assert.equal(row.method, "GET");
    assert.equal(typeof row.path, "string");
    assert.ok(row.path.startsWith("/"));
    assert.equal(typeof row.purpose, "string");
  }
  assert.equal(TOOLS.discovery.find((row) => row.id === "agent").alias, "/.well-known/agent.json");
  assert.equal(TOOLS.discovery.find((row) => row.id === "openapi").path, "/settlement.openapi.json");
  assert.deepEqual(TOOLS.discovery.find((row) => row.id === "openapi").aliases, [
    "/openapi.json",
    "/api/openapi.json",
  ]);
  assert.equal(
    TOOLS.discovery.find((row) => row.id === "transition_schema").path,
    "/api/schemas/transition.json",
  );
  assert.equal(
    TOOLS.tools.find((tool) => tool.id === "verify").schema,
    "/api/schemas/receipt.json",
  );
  assert.equal(
    TOOLS.discovery.find((row) => row.id === "receipt_schema").path,
    "/api/schemas/receipt.json",
  );
  assert.equal(
    TOOLS.discovery.find((row) => row.id === "handoff_schema").path,
    "/api/schemas/handoff.json",
  );
});

test("GET /api/tools.json serves the capability list", async () => {
  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.body, TOOLS);
  assert.equal(get.body.money, false);
  assert.equal(get.body.mode, "demo");
  assert.equal(get.body.persistence, false);
  assert.equal(get.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(get.headers["Content-Type"], protocolHeaders()["Content-Type"]);

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

test("discovery, protocol, and docs point at the tools list", () => {
  assert.equal(SETTLEMENT.surfaces.tools, "/api/tools.json");
  assert.equal(SETTLEMENT.tools.path, "/api/tools.json");
  assert.equal(SETTLEMENT.tools.money, false);
  assert.equal(SETTLEMENT.tools.persistence, false);
  assert.equal(SETTLEMENT.tools.human_path, "/#adapters");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/tools.json")));

  assert.equal(AGENT.surfaces.tools, "/api/tools.json");
  assert.match(AGENT.note, /tools\.json/i);
  assert.match(AGENT.note, /not an mcp server/i);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/api/tools.json"].get);
  assert.equal(openapi.paths["/api/tools.json"].get.operationId, "getAdapterTools");
  assert.ok(openapi.info.description.includes("/api/tools.json"));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.tools.const,
    "/api/tools.json",
  );
  assert.equal(openapi.components.schemas.Tools.properties.money.const, false);
  assert.equal(openapi.components.schemas.Tools.properties.mode.const, "demo");
  assert.equal(openapi.components.schemas.Tools.properties.persistence.const, false);
  assert.equal(openapi.components.schemas.Tools.properties.path.const, "/api/tools.json");

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) => row.source === "/api/tools.json" && row.destination === "/api/agent.json?doc=tools",
    ),
  );

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('href="/api/tools.json"'));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/api/tools.json"));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/api/tools.json"));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes("/api/tools.json"));
  assert.ok(readme.includes("curl https://liberty-amber.vercel.app/api/tools.json"));
});
