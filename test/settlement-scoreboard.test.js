"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SCOREBOARD,
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
  const handler = require("../api/scoreboard.json.js");
  const res = mockRes();
  await handler(req, res);
  return res;
}

test("scoreboard JSON stays demo-only with honest zeros", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/scoreboard.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, SCOREBOARD);

  assert.equal(SCOREBOARD.service, "liberty-agent-settlement");
  assert.equal(SCOREBOARD.kind, "liberty-agent-settlement-scoreboard");
  assert.equal(SCOREBOARD.mode, "demo");
  assert.equal(SCOREBOARD.money, false);
  assert.equal(SCOREBOARD.path, "/api/scoreboard.json");
  assert.equal(SCOREBOARD.human, "/#scoreboard");
  assert.equal(SCOREBOARD.origin, "https://liberty-amber.vercel.app");
  assert.equal(SCOREBOARD.external_users, 0);
  assert.equal(SCOREBOARD.paid_pilots, 0);
  assert.equal(SCOREBOARD.revenue_usd, 0);
  assert.equal(typeof SCOREBOARD.external_users, "number");
  assert.equal(typeof SCOREBOARD.paid_pilots, "number");
  assert.equal(typeof SCOREBOARD.revenue_usd, "number");
  assert.match(SCOREBOARD.note, /listings\s*≠\s*users/i);
  assert.match(SCOREBOARD.note, /demo only/i);
  assert.match(SCOREBOARD.directory_listings.note, /not listings and not users/i);
  assert.equal(SCOREBOARD.directory_listings.urls, undefined);
  assert.equal(SCOREBOARD.directory_listings.count, undefined);
  assert.equal(SCOREBOARD.live.ui, "https://liberty-amber.vercel.app");
  assert.equal(SCOREBOARD.live.discovery, "https://liberty-amber.vercel.app/.well-known/agent.json");
  assert.equal(SCOREBOARD.live.changelog, "https://liberty-amber.vercel.app/api/changelog.json");
  assert.doesNotMatch(JSON.stringify(SCOREBOARD), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue|users?|customers?|pilots?)\b/i);
});

test("GET /api/scoreboard.json serves the scoreboard", async () => {
  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.body, SCOREBOARD);
  assert.equal(get.body.money, false);
  assert.equal(get.body.external_users, 0);
  assert.equal(get.body.paid_pilots, 0);
  assert.equal(get.body.revenue_usd, 0);
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

test("discovery, protocol, and docs point at the scoreboard", () => {
  assert.equal(SETTLEMENT.surfaces.scoreboard, "/api/scoreboard.json");
  assert.equal(SETTLEMENT.scoreboard.path, "/api/scoreboard.json");
  assert.equal(SETTLEMENT.scoreboard.money, false);
  assert.equal(SETTLEMENT.scoreboard.human_path, "/#scoreboard");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/scoreboard.json")));

  assert.equal(AGENT.surfaces.scoreboard, "/api/scoreboard.json");
  assert.match(AGENT.note, /scoreboard/i);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/api/scoreboard.json"].get);
  assert.equal(openapi.paths["/api/scoreboard.json"].get.operationId, "getScoreboard");
  assert.ok(openapi.info.description.includes("/api/scoreboard.json"));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.scoreboard.const,
    "/api/scoreboard.json",
  );
  assert.equal(openapi.components.schemas.Scoreboard.properties.money.const, false);
  assert.equal(openapi.components.schemas.Scoreboard.properties.external_users.const, 0);
  assert.equal(openapi.components.schemas.Scoreboard.properties.paid_pilots.const, 0);
  assert.equal(openapi.components.schemas.Scoreboard.properties.revenue_usd.const, 0);

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('id="scoreboard"'));
  assert.ok(homepage.includes('href="/api/scoreboard.json"'));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/api/scoreboard.json"));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/api/scoreboard.json"));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes("/api/scoreboard.json"));
  assert.ok(readme.includes("curl https://liberty-amber.vercel.app/api/scoreboard.json"));
});
