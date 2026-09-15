"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CHANGELOG,
  SETTLEMENT,
  AGENT,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");

const ROOT = path.join(__dirname, "..");
const LOG_DIR = path.join(ROOT, "log");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEADING_RE = /^# (\d{4}-\d{2}-\d{2}) — (.+)$/m;

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
  const handler = require("../api/changelog.json.js");
  const res = mockRes();
  await handler(req, res);
  return res;
}

test("changelog JSON stays demo-only, newest-first, and matches shipped log titles", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/changelog.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, CHANGELOG);

  assert.equal(CHANGELOG.service, "liberty-agent-settlement");
  assert.equal(CHANGELOG.kind, "liberty-agent-settlement-changelog");
  assert.equal(CHANGELOG.mode, "demo");
  assert.equal(CHANGELOG.money, false);
  assert.equal(CHANGELOG.path, "/api/changelog.json");
  assert.equal(CHANGELOG.human, "/#whats-new");
  assert.equal(CHANGELOG.origin, "https://liberty-amber.vercel.app");
  assert.match(CHANGELOG.note, /newest first/i);
  assert.match(CHANGELOG.note, /no user counts/i);
  assert.match(CHANGELOG.description, /no revenue/i);
  assert.doesNotMatch(JSON.stringify(CHANGELOG), /\b\d[\d,]*\s+(users?|customers?)\b/i);
  assert.doesNotMatch(JSON.stringify(CHANGELOG), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue)\b/i);

  const entries = CHANGELOG.entries;
  assert.ok(Array.isArray(entries));
  assert.ok(entries.length >= 8 && entries.length <= 12);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    assert.match(entry.date, DATE_RE);
    assert.equal(typeof entry.id, "string");
    assert.ok(entry.id.length > 0);
    assert.equal(typeof entry.title, "string");
    assert.ok(entry.title.length > 0);
    assert.equal(typeof entry.href, "string");
    assert.ok(entry.href.startsWith("/"));
    if (i > 0) {
      assert.ok(
        entry.date <= entries[i - 1].date,
        `entries must be newest first: ${entry.date} after ${entries[i - 1].date}`,
      );
    }

    const logPath = path.join(LOG_DIR, `${entry.date}-${entry.id}.md`);
    assert.ok(fs.existsSync(logPath), `missing log for ${entry.id}: ${logPath}`);
    const heading = fs.readFileSync(logPath, "utf8").match(HEADING_RE);
    assert.ok(heading, `log heading for ${entry.id}`);
    assert.equal(heading[1], entry.date);
    assert.equal(heading[2], entry.title);
  }
});

test("GET /api/changelog.json serves the changelog", async () => {
  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.body, CHANGELOG);
  assert.equal(get.body.money, false);
  assert.equal(get.body.entries[0].date, CHANGELOG.entries[0].date);
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

test("discovery, protocol, and docs point at the changelog", () => {
  assert.equal(SETTLEMENT.surfaces.changelog, "/api/changelog.json");
  assert.equal(SETTLEMENT.changelog.path, "/api/changelog.json");
  assert.equal(SETTLEMENT.changelog.money, false);
  assert.equal(SETTLEMENT.changelog.human_path, "/#whats-new");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/changelog.json")));

  assert.equal(AGENT.surfaces.changelog, "/api/changelog.json");
  assert.match(AGENT.note, /changelog/i);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/api/changelog.json"].get);
  assert.equal(openapi.paths["/api/changelog.json"].get.operationId, "getChangelog");
  assert.ok(openapi.info.description.includes("/api/changelog.json"));
  assert.equal(openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.changelog.const, "/api/changelog.json");
  assert.equal(openapi.components.schemas.Changelog.properties.money.const, false);

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('id="whats-new"'));
  assert.ok(homepage.includes('href="/api/changelog.json"'));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/api/changelog.json"));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/api/changelog.json"));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes("/api/changelog.json"));
});
