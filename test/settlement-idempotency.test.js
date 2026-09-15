"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CORS_ALLOW_HEADERS,
  JOB_ID_PATTERN,
  handleHttp,
  idFromIdempotencyKey,
  quote,
  simulate,
  transition,
} = require("../api/_lib/settlement-transition");

const NOW = "2026-09-15T05:36:00.000Z";
const CREATE = {
  action: "create",
  title: "Summarize filings",
  amount: 100,
  criteria: "Three-bullet brief matching the last three filings.",
};

function commit(input, extra) {
  return transition(input, { now: () => NOW, ...(extra || {}) });
}

test("same Idempotency-Key plus same create fields yields the same as_ id", () => {
  const key = "retry-create-1";
  const expected = idFromIdempotencyKey(key, {
    title: CREATE.title,
    amount: CREATE.amount,
    criteria: CREATE.criteria,
  });
  assert.match(expected, JOB_ID_PATTERN);
  assert.equal(expected, "as_" + expected.slice(3));
  assert.equal(expected.length, 13);

  const first = commit({ ...CREATE, idempotency_key: key });
  const second = commit({ ...CREATE, idempotency_key: key });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.job.id, expected);
  assert.equal(second.body.job.id, expected);
  assert.equal(first.body.idempotent, true);
  assert.equal(first.body.idempotency_key, key);
  assert.equal(first.body.money, false);
  assert.equal(first.body.job.status, "open");
});

test("client_ref does not change a deterministic create id", () => {
  const key = "retry-create-1";
  const without = commit({ ...CREATE, idempotency_key: key });
  const withRef = commit({ ...CREATE, idempotency_key: key, client_ref: "agent-job-42" });
  const otherRef = commit({ ...CREATE, idempotency_key: key, client_ref: "other-ref" });
  assert.equal(without.body.job.id, withRef.body.job.id);
  assert.equal(withRef.body.job.id, otherRef.body.job.id);
  assert.equal(withRef.body.job.clientRef, "agent-job-42");
  assert.equal(otherRef.body.job.clientRef, "other-ref");
  assert.equal(without.body.job.clientRef, undefined);
  assert.equal(withRef.body.idempotent, true);
});

test("callback_url does not change a deterministic create id", () => {
  const key = "retry-create-1";
  const without = commit({ ...CREATE, idempotency_key: key });
  const withUrl = commit({
    ...CREATE,
    idempotency_key: key,
    callback_url: "https://your-adapter.example/notify",
  });
  const otherUrl = commit({
    ...CREATE,
    idempotency_key: key,
    notify_url: "https://hooks.example/other",
  });
  assert.equal(without.body.job.id, withUrl.body.job.id);
  assert.equal(withUrl.body.job.id, otherUrl.body.job.id);
  assert.equal(withUrl.body.job.callbackUrl, "https://your-adapter.example/notify");
  assert.equal(otherUrl.body.job.callbackUrl, "https://hooks.example/other");
  assert.equal(without.body.job.callbackUrl, undefined);
  assert.equal(withUrl.body.idempotent, true);
});

test("different keys or create fields yield different ids; missing key stays random as_ + 10 hex", () => {
  const sameFields = commit({ ...CREATE, idempotency_key: "key-a" });
  const otherKey = commit({ ...CREATE, idempotency_key: "key-b" });
  const otherTitle = commit({
    ...CREATE,
    title: "Different title",
    idempotency_key: "key-a",
  });
  assert.notEqual(sameFields.body.job.id, otherKey.body.job.id);
  assert.notEqual(sameFields.body.job.id, otherTitle.body.job.id);
  assert.match(sameFields.body.job.id, JOB_ID_PATTERN);
  assert.match(otherKey.body.job.id, JOB_ID_PATTERN);

  const randomA = commit(CREATE);
  const randomB = commit(CREATE);
  assert.match(randomA.body.job.id, JOB_ID_PATTERN);
  assert.match(randomB.body.job.id, JOB_ID_PATTERN);
  assert.notEqual(randomA.body.job.id, randomB.body.job.id);
  assert.equal(randomA.body.idempotent, undefined);
  assert.equal(randomA.body.idempotency_key, undefined);
});

test("header wins over body alias; fund/submit/release echo the key without changing the job id", () => {
  const headerKey = "from-header";
  const posted = handleHttp({
    method: "POST",
    headers: { "Idempotency-Key": headerKey },
    body: { ...CREATE, idempotency_key: "from-body" },
  });
  const expected = idFromIdempotencyKey(headerKey, {
    title: CREATE.title,
    amount: CREATE.amount,
    criteria: CREATE.criteria,
  });
  assert.equal(posted.status, 200);
  assert.equal(posted.body.job.id, expected);
  assert.equal(posted.body.idempotency_key, headerKey);
  assert.equal(posted.body.idempotent, true);

  const aliased = commit({ ...CREATE, idempotencyKey: "camel-key" });
  assert.equal(
    aliased.body.job.id,
    idFromIdempotencyKey("camel-key", {
      title: CREATE.title,
      amount: CREATE.amount,
      criteria: CREATE.criteria,
    }),
  );
  assert.equal(aliased.body.idempotency_key, "camel-key");

  const funded = commit({
    action: "fund",
    job: posted.body.job,
    payer_credits: 100,
    idempotency_key: "later-step",
  });
  assert.equal(funded.status, 200);
  assert.equal(funded.body.job.id, posted.body.job.id);
  assert.equal(funded.body.idempotency_key, "later-step");
  assert.equal(funded.body.idempotent, undefined);
  assert.equal(funded.body.job.status, "funded");
});

test("quote echoes the key only and still assigns no create id", () => {
  const quoted = quote({ ...CREATE, idempotency_key: "quote-only" }, { now: () => NOW });
  assert.equal(quoted.status, 200);
  assert.equal(quoted.body.quoted, true);
  assert.equal(quoted.body.job.id, undefined);
  assert.equal(quoted.body.idempotency_key, "quote-only");
  assert.equal(quoted.body.idempotent, undefined);
  assert.equal(quoted.body.money, false);

  const httpQuote = handleHttp({
    method: "POST",
    dryRun: true,
    headers: { "idempotency-key": "quote-header" },
    body: CREATE,
  });
  assert.equal(httpQuote.status, 200);
  assert.equal(httpQuote.body.quoted, true);
  assert.equal(httpQuote.body.job.id, undefined);
  assert.equal(httpQuote.body.idempotency_key, "quote-header");
});

test("simulate create uses the same stable id and marks the walk idempotent", () => {
  const key = "sim-retry-1";
  const input = {
    title: CREATE.title,
    amount: CREATE.amount,
    criteria: CREATE.criteria,
    payer_credits: 150,
    proof_url: "https://example.com/proof",
    idempotency_key: key,
  };
  const first = simulate(input, { now: () => NOW });
  const second = simulate(input, { now: () => NOW });
  const expected = idFromIdempotencyKey(key, {
    title: CREATE.title,
    amount: CREATE.amount,
    criteria: CREATE.criteria,
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.job.id, expected);
  assert.equal(second.body.job.id, expected);
  assert.equal(first.body.idempotent, true);
  assert.equal(first.body.idempotency_key, key);
  assert.equal(first.body.steps[0].job.id, expected);
  assert.equal(first.body.steps[0].idempotent, true);
  assert.equal(first.body.money, false);

  const httpSim = handleHttp({
    method: "POST",
    simulate: true,
    headers: { "Idempotency-Key": key },
    body: {
      title: CREATE.title,
      amount: CREATE.amount,
      criteria: CREATE.criteria,
      payer_credits: 150,
      proof_url: "https://example.com/proof",
    },
  });
  assert.equal(httpSim.body.job.id, expected);
  assert.equal(httpSim.body.idempotent, true);
});

test("invalid idempotency_key is 400; discovery and CORS mention the header", () => {
  const bad = commit({ ...CREATE, idempotency_key: 12 });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, "invalid_field");
  assert.equal(bad.body.field, "idempotency_key");
  assert.equal(bad.body.money, false);

  const get = handleHttp({ method: "GET", body: null });
  assert.equal(get.body.idempotency.header, "Idempotency-Key");
  assert.equal(get.body.idempotency.body, "idempotency_key");
  assert.equal(get.body.idempotency.persistence, false);
  assert.equal(get.body.idempotency.replay, false);
  assert.match(get.body.note, /Idempotency-Key/);

  const quoteGet = handleHttp({ method: "GET", body: null, dryRun: true });
  assert.equal(quoteGet.body.idempotency.replay, false);
  assert.match(quoteGet.body.note, /echoed only/i);

  const verifyGet = handleHttp({ method: "GET", body: null, verify: true });
  assert.equal(verifyGet.body.idempotency, undefined);

  const options = handleHttp({ method: "OPTIONS", body: null });
  assert.equal(options.headers["Access-Control-Allow-Headers"], CORS_ALLOW_HEADERS);
  assert.match(CORS_ALLOW_HEADERS, /Idempotency-Key/);
});

test("docs and examples mention Idempotency-Key without claiming persistence or replay", () => {
  const root = path.join(__dirname, "..");
  const examples = JSON.parse(fs.readFileSync(path.join(root, "api/_lib/examples.json"), "utf8"));
  const settlement = JSON.parse(fs.readFileSync(path.join(root, "api/_lib/settlement.json"), "utf8"));
  const openapi = JSON.parse(fs.readFileSync(path.join(root, "settlement.openapi.json"), "utf8"));
  const markdown = fs.readFileSync(path.join(root, "SETTLEMENT.md"), "utf8");
  const llms = fs.readFileSync(path.join(root, "llms.txt"), "utf8");
  const homepage = fs.readFileSync(path.join(root, "index.html"), "utf8");

  assert.equal(examples.idempotency.header, "Idempotency-Key");
  assert.equal(examples.idempotency.replay, false);
  assert.ok(examples.examples.find((row) => row.id === "transition").note.includes("Idempotency-Key"));
  assert.equal(settlement.transition_api.idempotency.persistence, false);
  assert.equal(settlement.transition_api.idempotency.replay, false);
  assert.ok(settlement.adapter_notes.some((note) => note.includes("Idempotency-Key")));
  assert.ok(openapi.paths["/api/v0/transition"].post.parameters.some((p) => p.name === "Idempotency-Key"));
  assert.ok(openapi.paths["/api/v0/quote"].post.parameters.some((p) => p.name === "Idempotency-Key"));
  assert.ok(openapi.paths["/api/v0/simulate"].post.parameters.some((p) => p.name === "Idempotency-Key"));
  assert.ok(markdown.includes("Idempotency-Key"));
  assert.ok(markdown.includes("does **not** replay a stored response"));
  assert.ok(llms.includes("Idempotency-Key"));
  assert.ok(homepage.includes("Idempotency-Key"));
});
