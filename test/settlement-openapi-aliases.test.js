"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  AGENT,
  SETTLEMENT,
  TOOLS,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");

const ROOT = path.join(__dirname, "..");
const OPENAPI_ALIASES = ["/openapi.json", "/api/openapi.json"];
const CANONICAL = "/settlement.openapi.json";

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

function loadSpec() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
}

test("canonical OpenAPI document stays one source of truth", () => {
  const spec = loadSpec();
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.info.title, "Liberty Agent Settlement");
  assert.match(spec.info.description, /\/openapi\.json/);
  assert.match(spec.info.description, /\/api\/openapi\.json/);
  assert.ok(spec.paths[CANONICAL].get);
  assert.ok(spec.paths["/openapi.json"].get);
  assert.ok(spec.paths["/api/openapi.json"].get);
  assert.equal(spec.paths[CANONICAL].get.operationId, "getOpenApi");
  assert.equal(spec.paths["/openapi.json"].get.operationId, "getOpenApiAlias");
  assert.equal(spec.paths["/api/openapi.json"].get.operationId, "getOpenApiApiAlias");
  assert.deepEqual(
    spec.components.schemas.AgentDiscovery.properties.surfaces.properties.openapi_aliases.const,
    OPENAPI_ALIASES,
  );
});

test("GET aliases resolve to the same OpenAPI document", async () => {
  const spec = loadSpec();
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(typeof spec.info.title, "string");
  assert.ok(spec.info.title.length > 0);

  for (const url of ["/api/openapi.json", "/api/agent.json?doc=openapi", "/openapi.json"]) {
    const get = await invoke(url, { method: "GET" });
    assert.equal(get.statusCode, 200, url);
    assert.equal(get.body.openapi, spec.openapi, url);
    assert.equal(get.body.info.title, spec.info.title, url);
    assert.deepEqual(get.body, spec, url);
    assert.equal(get.headers["Access-Control-Allow-Origin"], "*");
    assert.equal(get.headers["Cache-Control"], "public, max-age=300");
    assert.equal(get.headers["Content-Type"], protocolHeaders()["Content-Type"]);
  }

  const options = await invoke("/api/openapi.json", { method: "OPTIONS" });
  assert.equal(options.statusCode, 204);
  assert.equal(options.ended, true);

  const post = await invoke("/api/openapi.json", { method: "POST" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.body.money, false);
  assert.equal(post.body.error, "method_not_allowed");
});

test("vercel rewrites and headers wire the OpenAPI aliases", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.rewrites.some(
      (row) => row.source === "/openapi.json" && row.destination === CANONICAL,
    ),
    "vercel.json should rewrite /openapi.json to the static spec",
  );
  assert.ok(
    vercel.rewrites.some(
      (row) =>
        row.source === "/api/openapi.json" && row.destination === "/api/agent.json?doc=openapi",
    ),
    "vercel.json should rewrite /api/openapi.json without a 13th function",
  );
  for (const source of [CANONICAL, "/openapi.json", "/api/openapi.json"]) {
    const row = vercel.headers.find((entry) => entry.source === source);
    assert.ok(row, `vercel.json should set headers for ${source}`);
    const keys = Object.fromEntries(row.headers.map((header) => [header.key, header.value]));
    assert.equal(keys["Access-Control-Allow-Origin"], "*");
    assert.equal(keys["Cache-Control"], "public, max-age=300");
  }
});

test("discovery surfaces mention OpenAPI aliases without dropping the canonical path", () => {
  assert.equal(AGENT.surfaces.openapi, CANONICAL);
  assert.deepEqual(AGENT.surfaces.openapi_aliases, OPENAPI_ALIASES);
  assert.match(AGENT.note, /\/openapi\.json/);
  assert.match(AGENT.note, /\/api\/openapi\.json/);

  assert.equal(SETTLEMENT.surfaces.openapi, CANONICAL);
  assert.deepEqual(SETTLEMENT.surfaces.openapi_aliases, OPENAPI_ALIASES);
  assert.match(SETTLEMENT.description, /\/openapi\.json/);
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/openapi.json")));

  const openapiRow = TOOLS.discovery.find((row) => row.id === "openapi");
  assert.equal(openapiRow.path, CANONICAL);
  assert.deepEqual(openapiRow.aliases, OPENAPI_ALIASES);
  assert.match(openapiRow.purpose, /\/openapi\.json/);

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes(`href="${CANONICAL}"`));
  assert.ok(homepage.includes('href="/openapi.json"'));
  assert.ok(homepage.includes('href="/api/openapi.json"'));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes(CANONICAL));
  assert.ok(llms.includes("/openapi.json"));
  assert.ok(llms.includes("/api/openapi.json"));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes(CANONICAL));
  assert.ok(markdown.includes("/openapi.json"));
  assert.ok(markdown.includes("/api/openapi.json"));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes(CANONICAL));
  assert.ok(readme.includes("/openapi.json"));
  assert.ok(readme.includes("/api/openapi.json"));
});
