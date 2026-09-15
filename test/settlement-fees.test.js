"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { FEE_RATE } = require("../api/_lib/settlement-transition");
const {
  FEES,
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
  const handler = require("../api/fees.json.js");
  const res = mockRes();
  await handler(req, res);
  return res;
}

test("fees JSON stays demo-only and matches the existing fee engine", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/fees.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, FEES);

  assert.equal(FEES.service, "liberty-agent-settlement");
  assert.equal(FEES.kind, "liberty-agent-settlement-fees");
  assert.equal(FEES.mode, "demo");
  assert.equal(FEES.money, false);
  assert.equal(FEES.path, "/api/fees.json");
  assert.equal(FEES.human, "/#fees");
  assert.equal(FEES.origin, "https://liberty-amber.vercel.app");
  assert.equal(FEES.unit, "credits");
  assert.equal(FEES.integer_only, true);
  assert.deepEqual(FEES.release, SETTLEMENT.fee_schedule.release);
  assert.deepEqual(FEES.dispute, SETTLEMENT.fee_schedule.dispute);
  assert.deepEqual(FEES.top_up, SETTLEMENT.fee_schedule.top_up);
  assert.deepEqual(FEES.fund, SETTLEMENT.fee_schedule.fund);
  assert.equal(FEES.release.rate, FEE_RATE);
  assert.equal(FEES.release.rounding, "nearest_credit");
  assert.equal(FEES.release.formula, `Math.round(amount * ${FEE_RATE})`);
  assert.equal(FEES.release.agent_payout, "amount - fee");
  assert.equal(FEES.dispute.release_fee, 0);
  assert.equal(FEES.top_up.fee, 0);
  assert.equal(FEES.fund.fee, 0);
  assert.match(FEES.note, /demo rates/i);
  assert.match(FEES.note, /SETTLEMENT\.md/);
  assert.doesNotMatch(JSON.stringify(FEES), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue|users?|customers?|pilots?)\b/i);
});

test("GET /api/fees.json serves the fee schedule", async () => {
  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.body, FEES);
  assert.equal(get.body.money, false);
  assert.equal(get.body.mode, "demo");
  assert.equal(get.body.release.formula, "Math.round(amount * 0.05)");
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

test("discovery, protocol, and docs point at the fee schedule", () => {
  assert.equal(SETTLEMENT.surfaces.fees, "/api/fees.json");
  assert.equal(SETTLEMENT.fees.path, "/api/fees.json");
  assert.equal(SETTLEMENT.fees.money, false);
  assert.equal(SETTLEMENT.fees.human_path, "/#fees");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/fees.json")));

  assert.equal(AGENT.surfaces.fees, "/api/fees.json");
  assert.match(AGENT.note, /fees/i);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/api/fees.json"].get);
  assert.equal(openapi.paths["/api/fees.json"].get.operationId, "getFeeSchedule");
  assert.ok(openapi.info.description.includes("/api/fees.json"));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.fees.const,
    "/api/fees.json",
  );
  assert.equal(openapi.components.schemas.Fees.properties.money.const, false);
  assert.equal(openapi.components.schemas.Fees.properties.mode.const, "demo");
  assert.equal(openapi.components.schemas.Fees.properties.release.properties.formula.const, "Math.round(amount * 0.05)");

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('id="fees"'));
  assert.ok(homepage.includes('href="/api/fees.json"'));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/api/fees.json"));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/api/fees.json"));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes("/api/fees.json"));
  assert.ok(readme.includes("curl https://liberty-amber.vercel.app/api/fees.json"));
});
