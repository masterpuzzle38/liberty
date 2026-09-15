"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  EXAMPLES,
  SETTLEMENT,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const {
  quote,
  simulate,
  transition,
  verify,
} = require("../api/_lib/settlement-transition");

const ROOT = path.join(__dirname, "..");
const NOW = "2026-09-15T00:00:00.000Z";
const OPTIONS = { now: () => NOW, makeId: () => "as_0123456789" };

function example(id) {
  return EXAMPLES.examples.find((row) => row.id === id);
}

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
  const handler = require("../api/examples.json.js");
  const res = mockRes();
  await handler(req, res);
  return res;
}

test("examples.json stays demo-only and lists the four adapter POSTs", () => {
  assert.equal(EXAMPLES.service, "liberty-agent-settlement");
  assert.equal(EXAMPLES.mode, "demo");
  assert.equal(EXAMPLES.money, false);
  assert.equal(EXAMPLES.origin, "https://liberty-amber.vercel.app");
  assert.equal(EXAMPLES.human_path, "/#adapters");
  assert.equal(EXAMPLES.auth.required, false);
  assert.ok(EXAMPLES.auth.headers.includes("Authorization: Bearer <key>"));
  assert.ok(EXAMPLES.auth.headers.includes("X-Liberty-Key"));
  assert.deepEqual(
    EXAMPLES.examples.map((row) => row.id),
    ["quote", "transition", "simulate", "verify"],
  );
  assert.equal(example("quote").path, "/api/v0/quote");
  assert.equal(example("transition").path, "/api/v0/transition");
  assert.equal(example("simulate").path, "/api/v0/simulate");
  assert.equal(example("verify").path, "/api/v0/verify");
  assert.ok(example("transition").note.includes("agent_credits_delta"));
  assert.ok(example("simulate").note.includes("agent_credits_delta"));
  assert.deepEqual(
    example("transition").steps.map((step) => step.action),
    ["create", "fund", "submit", "release"],
  );
});

test("example request bodies work against the shared fee engine", () => {
  const quoted = quote(example("quote").body, OPTIONS);
  assert.equal(quoted.status, 200);
  assert.equal(quoted.body.quoted, true);
  assert.equal(quoted.body.money, false);
  assert.equal(quoted.body.job.status, "open");
  assert.equal(quoted.body.job.id, undefined);

  const created = transition(example("transition").steps[0].body, OPTIONS);
  assert.equal(created.status, 200);
  assert.equal(created.body.job.status, "open");
  assert.equal(created.body.job.id, "as_0123456789");

  const funded = transition(example("transition").steps[1].body, OPTIONS);
  assert.equal(funded.status, 200);
  assert.equal(funded.body.job.status, "funded");
  assert.equal(funded.body.payer_credits, 0);

  const submitted = transition(example("transition").steps[2].body, OPTIONS);
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.job.status, "submitted");

  const released = transition(example("transition").steps[3].body, OPTIONS);
  assert.equal(released.status, 200);
  assert.equal(released.body.job.status, "released");
  assert.equal(released.body.agent_credits_delta, 95);
  assert.equal(released.body.agent_payout, 95);
  assert.equal(released.body.money, false);

  const walked = simulate(example("simulate").body, OPTIONS);
  assert.equal(walked.status, 200);
  assert.equal(walked.body.ok, true);
  assert.equal(walked.body.job.status, "released");
  assert.equal(walked.body.agent_credits_delta, 95);
  assert.equal(walked.body.money, false);

  const checked = verify(example("verify").body, OPTIONS);
  assert.equal(checked.status, 200);
  assert.equal(checked.body.valid, true);
  assert.equal(checked.body.verified, true);
  assert.equal(checked.body.money, false);
});

test("GET /api/examples.json serves the examples document", async () => {
  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.body, EXAMPLES);
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

test("discovery docs point at examples.json and the homepage panel", () => {
  assert.equal(SETTLEMENT.surfaces.examples, "/api/examples.json");
  assert.equal(SETTLEMENT.examples.path, "/api/examples.json");
  assert.equal(SETTLEMENT.examples.money, false);
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/examples.json")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("#adapters")));

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/api/examples.json"].get);
  assert.equal(openapi.paths["/api/examples.json"].get.operationId, "getAdapterExamples");
  assert.ok(openapi.info.description.includes("/api/examples.json"));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/api/examples.json"));
  assert.ok(markdown.includes("/#adapters"));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/api/examples.json"));
  assert.ok(llms.includes("/#adapters"));

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes("id=\"adapters\""));
  assert.ok(homepage.includes("Try as an adapter"));
  assert.ok(homepage.includes("https://liberty-amber.vercel.app/api/v0/quote"));
  assert.ok(homepage.includes("https://liberty-amber.vercel.app/api/v0/transition"));
  assert.ok(homepage.includes("https://liberty-amber.vercel.app/api/v0/simulate"));
  assert.ok(homepage.includes("https://liberty-amber.vercel.app/api/v0/verify"));
  assert.ok(homepage.includes("agent_credits_delta"));
  assert.ok(homepage.includes("Authorization: Bearer"));
  assert.ok(homepage.includes("X-Liberty-Key"));
  assert.ok(homepage.includes("Idempotency-Key"));
});
