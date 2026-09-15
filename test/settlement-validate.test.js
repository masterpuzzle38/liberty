"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CORS_ALLOW_HEADERS,
  handleHttp,
  quote,
  transition,
  validate,
} = require("../api/_lib/settlement-transition");

const ROOT = path.join(__dirname, "..");
const NOW = "2026-09-15T18:20:00.000Z";
const OPTIONS = { now: () => NOW, makeId: () => {
  throw new Error("validate must not mint a job id");
} };

function createOpen() {
  return transition({
    action: "create",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
  }, { now: () => NOW, makeId: () => "as_0123456789" }).body.job;
}

function mockRes() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
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
      return this;
    },
  };
}

test("valid create body returns ok without minting a job or next state", () => {
  const checked = validate({
    action: "create",
    title: "  Summarize filings ",
    amount: 100,
    criteria: " Three-bullet brief matching the last three filings. ",
  }, OPTIONS);

  assert.equal(checked.status, 200);
  assert.equal(checked.body.ok, true);
  assert.equal(checked.body.mode, "demo");
  assert.equal(checked.body.money, false);
  assert.equal(checked.body.validated, true);
  assert.equal(checked.body.persistence, false);
  assert.equal(checked.body.schema, "/api/schemas/transition.json");
  assert.equal(checked.body.action, "create");
  assert.equal(checked.body.job, undefined);
  assert.equal(checked.body.quoted, undefined);
  assert.equal(checked.body.fee, undefined);
  assert.equal(checked.body.receipt, undefined);
});

test("invalid create body returns structured schema errors", () => {
  const missing = validate({
    action: "create",
    title: "Summarize filings",
    amount: 100,
  }, OPTIONS);
  assert.equal(missing.status, 400);
  assert.equal(missing.body.ok, false);
  assert.equal(missing.body.money, false);
  assert.equal(missing.body.validated, false);
  assert.equal(missing.body.kind, "schema");
  assert.equal(missing.body.error, "missing_field");
  assert.equal(missing.body.field, "criteria");

  const invalid = validate({
    action: "create",
    title: "Summarize filings",
    amount: 0,
    criteria: "Three-bullet brief.",
  }, OPTIONS);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.kind, "schema");
  assert.equal(invalid.body.error, "invalid_field");
  assert.equal(invalid.body.field, "amount");
});

test("validate shares the transition engine and does not apply later actions", () => {
  const open = createOpen();
  const fundInput = { action: "fund", job: open, payer_credits: 150 };
  const checked = validate(fundInput, OPTIONS);
  const quoted = quote(fundInput, { now: () => NOW });
  const committed = transition(fundInput, { now: () => NOW });

  assert.equal(checked.status, 200);
  assert.equal(checked.body.ok, true);
  assert.equal(checked.body.validated, true);
  assert.equal(checked.body.job, undefined);
  assert.equal(checked.body.payer_credits, undefined);
  assert.equal(open.status, "open");
  assert.equal(quoted.body.job.status, "funded");
  assert.equal(committed.body.job.status, "funded");

  const illegal = validate({ action: "release", job: open }, OPTIONS);
  assert.equal(illegal.status, 409);
  assert.equal(illegal.body.kind, "state");
  assert.equal(illegal.body.error, "illegal_transition");
  assert.equal(illegal.body.from, "open");
  assert.equal(illegal.body.expected, "submitted");
  assert.equal(illegal.body.job, undefined);
});

test("non-create validate requires the client-held job the same way transition does", () => {
  const missingJob = validate({ action: "fund", payer_credits: 100 }, OPTIONS);
  assert.equal(missingJob.status, 400);
  assert.equal(missingJob.body.kind, "schema");
  assert.equal(missingJob.body.error, "missing_field");
  assert.equal(missingJob.body.field, "job");
});

test("validate HTTP wrapper: OPTIONS, GET discovery, POST dry-check, and 405", () => {
  const options = handleHttp({ method: "OPTIONS", body: null, validate: true });
  assert.equal(options.status, 204);
  assert.equal(options.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(options.body, null);

  const get = handleHttp({ method: "GET", body: null, validate: true });
  assert.equal(get.status, 200);
  assert.equal(get.body.path, "/api/v0/validate");
  assert.equal(get.body.dry_run, true);
  assert.equal(get.body.money, false);
  assert.equal(get.body.persistence, false);
  assert.equal(get.body.validate, "/api/v0/validate");
  assert.equal(get.body.schema, "/api/schemas/transition.json");
  assert.match(get.body.note, /does not apply/i);
  assert.match(get.body.note, /client-held job/i);
  assert.match(get.body.note, /does not.*move real money/i);

  const posted = handleHttp({
    method: "POST",
    validate: true,
    body: { action: "create", title: "T", amount: 2, criteria: "C" },
  });
  assert.equal(posted.status, 200);
  assert.equal(posted.body.ok, true);
  assert.equal(posted.body.validated, true);
  assert.equal(posted.body.money, false);
  assert.equal(posted.body.job, undefined);
  assert.equal(posted.body.key_optional, true);

  const put = handleHttp({ method: "PUT", body: {}, validate: true });
  assert.equal(put.status, 405);
  assert.equal(put.body.money, false);
});

test("quote Vercel handler serves validate when rewritten with ?validate=1", async () => {
  const handler = require("../api/v0/quote");
  const res = mockRes();
  await handler(
    {
      method: "POST",
      url: "/api/v0/quote?validate=1",
      body: { action: "create", title: "Handler", amount: 8, criteria: "Works" },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.validated, true);
  assert.equal(res.body.quoted, undefined);
  assert.equal(res.body.job, undefined);
  assert.equal(res.body.money, false);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(res.headers["Access-Control-Allow-Headers"], CORS_ALLOW_HEADERS);
});

test("protocol files describe validate next to quote and transition", () => {
  const settlement = JSON.parse(fs.readFileSync(path.join(ROOT, "api/_lib/settlement.json"), "utf8"));
  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

  assert.equal(settlement.validate_api.path, "/api/v0/validate");
  assert.equal(settlement.validate_api.dry_run, true);
  assert.equal(settlement.validate_api.money, false);
  assert.equal(settlement.validate_api.engine, "/api/v0/transition");
  assert.equal(settlement.validate_api.schema, "/api/schemas/transition.json");
  assert.equal(settlement.surfaces.validate, "/api/v0/validate");
  assert.ok(settlement.adapter_notes.some((note) => note.includes("/api/v0/validate")));
  assert.ok(openapi.paths["/api/v0/validate"].post);
  assert.equal(openapi.paths["/api/v0/validate"].post.operationId, "postValidate");

  const rewrite = vercel.rewrites.find((row) => row.source === "/api/v0/validate");
  assert.equal(rewrite.destination, "/api/v0/quote?validate=1");
  const headers = vercel.headers.find((row) => row.source === "/api/v0/validate");
  assert.equal(
    headers.headers.find((h) => h.key === "Access-Control-Allow-Headers").value,
    CORS_ALLOW_HEADERS,
  );
});
