"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CORS_ALLOW_HEADERS,
  JOB_ID_PATTERN,
  handleHttp,
  keyIdFromSecret,
  releaseFee,
  simulate,
  transition,
} = require("../api/_lib/settlement-transition");

const NOW = "2026-09-15T02:10:00.000Z";
const OPTIONS = { now: () => NOW, makeId: () => "as_0123456789" };

function walk(extra) {
  return simulate(
    {
      title: "Summarize filings",
      amount: 100,
      criteria: "Three-bullet brief matching the last three filings.",
      payer_credits: 150,
      proof_url: "https://example.com/proof",
      ...extra,
    },
    OPTIONS,
  );
}

function commit(input) {
  return transition(input, OPTIONS);
}

test("simulate release walks create-fund-submit-release with a real id and shared fee math", () => {
  const result = walk();
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.mode, "demo");
  assert.equal(result.body.money, false);
  assert.equal(result.body.terminal, "release");
  assert.equal(result.body.job.status, "released");
  assert.match(result.body.job.id, JOB_ID_PATTERN);
  assert.equal(result.body.job.id, "as_0123456789");
  assert.equal(result.body.fee, releaseFee(100));
  assert.equal(result.body.agent_payout, 100 - releaseFee(100));
  assert.equal(result.body.fee, 5);
  assert.equal(result.body.agent_payout, 95);
  assert.equal(result.body.agent_credits_delta, 95);
  assert.equal(result.body.payer_credits, 50);
  assert.equal(result.body.receipt.status, "released");
  assert.equal(result.body.receipt.release_fee, 5);
  assert.equal(result.body.receipt.agent_payout, 95);
  assert.equal(result.body.receipt.returned_to_payer, 0);
  assert.deepEqual(
    result.body.steps.map((step) => step.action),
    ["create", "fund", "submit", "release"],
  );
  assert.equal(result.body.steps[0].job.status, "open");
  assert.equal(result.body.steps[0].job.id, "as_0123456789");
  assert.equal(result.body.steps[1].payer_credits, 50);
  assert.equal(result.body.steps[2].job.status, "submitted");
  assert.equal(result.body.steps[3].fee, 5);
  assert.equal(result.body.steps[3].agent_credits_delta, 95);
  assert.equal(result.body.steps[3].receipt.job_id, "as_0123456789");

  const open = commit({
    action: "create",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
  }).body.job;
  const funded = commit({ action: "fund", job: open, payer_credits: 150 });
  const submitted = commit({
    action: "submit",
    job: funded.body.job,
    proof_url: "https://example.com/proof",
  });
  const released = commit({ action: "release", job: submitted.body.job });
  assert.deepEqual(result.body.job, released.body.job);
  assert.equal(result.body.fee, released.body.fee);
  assert.equal(result.body.agent_payout, released.body.agent_payout);
  assert.deepEqual(result.body.receipt, released.body.receipt);
  assert.equal(result.body.payer_credits, funded.body.payer_credits);
});

test("simulate dispute refunds escrow with the same math as transition", () => {
  const result = walk({ terminal: "dispute" });
  assert.equal(result.status, 200);
  assert.equal(result.body.money, false);
  assert.equal(result.body.terminal, "dispute");
  assert.equal(result.body.job.status, "disputed");
  assert.equal(result.body.fee, 0);
  assert.equal(result.body.agent_payout, 0);
  assert.equal(result.body.agent_credits_delta, 0);
  assert.equal(result.body.returned_to_payer, 100);
  assert.equal(result.body.payer_credits, 150);
  assert.equal(result.body.receipt.returned_to_payer, 100);
  assert.equal(result.body.receipt.release_fee, 0);
  assert.deepEqual(
    result.body.steps.map((step) => step.action),
    ["create", "fund", "submit", "dispute"],
  );

  const open = commit({
    action: "create",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
  }).body.job;
  const funded = commit({ action: "fund", job: open, payer_credits: 150 });
  const submitted = commit({
    action: "submit",
    job: funded.body.job,
    proof_url: "https://example.com/proof",
  });
  const disputed = commit({
    action: "dispute",
    job: submitted.body.job,
    payer_credits: funded.body.payer_credits,
  });
  assert.deepEqual(result.body.job, disputed.body.job);
  assert.equal(result.body.returned_to_payer, disputed.body.returned_to_payer);
  assert.equal(result.body.payer_credits, disputed.body.payer_credits);
  assert.deepEqual(result.body.receipt, disputed.body.receipt);
});

test("simulate forwards optional release_note and dispute_reason to the terminal receipt", () => {
  const released = walk({ release_note: "Proof matches the three-bullet brief." });
  assert.equal(released.status, 200);
  assert.equal(released.body.receipt.release_note, "Proof matches the three-bullet brief.");
  assert.equal(released.body.job.releaseNote, "Proof matches the three-bullet brief.");
  assert.equal(released.body.steps[3].receipt.release_note, "Proof matches the three-bullet brief.");
  assert.equal(released.body.fee, 5);

  const disputed = walk({
    terminal: "dispute",
    dispute_reason: "Proof does not match the criteria.",
  });
  assert.equal(disputed.status, 200);
  assert.equal(disputed.body.receipt.dispute_reason, "Proof does not match the criteria.");
  assert.equal(disputed.body.job.disputeReason, "Proof does not match the criteria.");
  assert.equal(disputed.body.returned_to_payer, 100);

  const wrong = walk({ terminal: "dispute", release_note: "Wrong field." });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.field, "release_note");
});

test("simulate defaults terminal to release and accepts aliases", () => {
  const omitted = walk({ terminal: undefined });
  assert.equal(omitted.body.terminal, "release");
  assert.equal(omitted.body.job.status, "released");

  const aliased = simulate(
    {
      title: "Summarize filings",
      amount: 20,
      criteria: "Done",
      payerCredits: 40,
      proofUrl: "note: proof",
      terminal: "release",
    },
    OPTIONS,
  );
  assert.equal(aliased.status, 200);
  assert.equal(aliased.body.payer_credits, 20);
  assert.equal(aliased.body.job.proofUrl, "note: proof");
  assert.equal(aliased.body.fee, releaseFee(20));
});

test("simulate rejects bad input with the same 4xx style as transition", () => {
  assert.equal(simulate(null).status, 400);
  assert.equal(simulate(null).body.error, "invalid_json");
  assert.equal(simulate(null).body.money, false);

  const missing = simulate({ title: "x", amount: 10, criteria: "done" });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, "missing_field");
  assert.equal(missing.body.field, "payer_credits");
  assert.equal(missing.body.money, false);

  const noProof = walk({ proof_url: undefined });
  assert.equal(noProof.status, 400);
  assert.equal(noProof.body.error, "missing_field");
  assert.equal(noProof.body.field, "proof_url");

  const badTerminal = walk({ terminal: "explode" });
  assert.equal(badTerminal.status, 400);
  assert.equal(badTerminal.body.error, "invalid_field");
  assert.equal(badTerminal.body.field, "terminal");

  const short = walk({ payer_credits: 99 });
  assert.equal(short.status, 409);
  assert.equal(short.body.error, "insufficient_credits");
  assert.equal(short.body.money, false);
  assert.equal(short.body.needed, 100);

  assert.equal(walk({ amount: 0 }).body.error, "invalid_field");
  assert.equal(walk({ title: "x".repeat(81) }).body.error, "invalid_field");
});

test("simulate HTTP wrapper: OPTIONS, GET discovery, POST, optional key, and 405", () => {
  const options = handleHttp({ method: "OPTIONS", body: null, simulate: true });
  assert.equal(options.status, 204);
  assert.equal(options.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(options.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(options.headers["Access-Control-Allow-Headers"], CORS_ALLOW_HEADERS);
  assert.equal(options.body, null);

  const get = handleHttp({ method: "GET", body: null, simulate: true });
  assert.equal(get.status, 200);
  assert.equal(get.body.path, "/api/v0/simulate");
  assert.equal(get.body.money, false);
  assert.equal(get.body.persistence, false);
  assert.equal(get.body.dry_run, false);
  assert.deepEqual(get.body.actions, ["create", "fund", "submit", "release", "dispute"]);
  assert.deepEqual(get.body.terminals, ["release", "dispute"]);
  assert.equal(get.body.commit, "/api/v0/transition");
  assert.equal(get.body.quote, "/api/v0/quote");
  assert.equal(get.body.verify, "/api/v0/verify");

  const posted = handleHttp({
    method: "POST",
    simulate: true,
    body: {
      title: "T",
      amount: 20,
      criteria: "C",
      payer_credits: 20,
      proof_url: "https://example.com/proof",
    },
  });
  assert.equal(posted.status, 200);
  assert.equal(posted.body.money, false);
  assert.equal(posted.body.job.status, "released");
  assert.match(posted.body.job.id, JOB_ID_PATTERN);
  assert.equal(posted.body.steps.length, 4);
  assert.equal(posted.body.receipt.release_fee, releaseFee(20));
  assert.equal(posted.body.agent_credits_delta, 20 - releaseFee(20));
  assert.equal(posted.body.key_optional, true);
  assert.equal(posted.body.auth.status, "key_optional");

  const secret = "lib_demo_simulatekey000000000000001";
  const keyed = handleHttp({
    method: "POST",
    simulate: true,
    headers: { Authorization: `Bearer ${secret}` },
    body: {
      title: "T",
      amount: 20,
      criteria: "C",
      payer_credits: 20,
      proof_url: "https://example.com/proof",
    },
  });
  assert.equal(keyed.body.key_id, keyIdFromSecret(secret));
  assert.equal(keyed.body.receipt.key_id, keyIdFromSecret(secret));
  assert.equal(keyed.body.steps[3].receipt.key_id, keyIdFromSecret(secret));
  assert.equal(keyed.body.auth.status, "accepted");
  assert.equal(JSON.stringify(keyed.body).includes(secret), false);

  const put = handleHttp({ method: "PUT", body: {}, simulate: true });
  assert.equal(put.status, 405);
  assert.equal(put.body.money, false);
});

test("simulate Vercel handler uses the shared engine and keeps money false", async () => {
  const handler = require("../api/v0/simulate");
  const res = {
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
  await handler(
    {
      method: "POST",
      body: {
        title: "Handler",
        amount: 8,
        criteria: "Works",
        payer_credits: 8,
        proof_url: "https://example.com/proof",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.money, false);
  assert.equal(res.body.job.status, "released");
  assert.match(res.body.job.id, JOB_ID_PATTERN);
  assert.equal(res.body.fee, releaseFee(8));
  assert.equal(res.body.key_optional, true);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(res.headers["Access-Control-Allow-Headers"], CORS_ALLOW_HEADERS);
});

test("protocol files describe simulate next to quote, transition, and verify", () => {
  const root = path.join(__dirname, "..");
  const settlement = JSON.parse(fs.readFileSync(path.join(root, "api/_lib/settlement.json"), "utf8"));
  const openapi = JSON.parse(fs.readFileSync(path.join(root, "settlement.openapi.json"), "utf8"));
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

  assert.equal(settlement.simulate_api.path, "/api/v0/simulate");
  assert.equal(settlement.simulate_api.money, false);
  assert.equal(settlement.simulate_api.persistence, false);
  assert.equal(settlement.simulate_api.engine, "/api/v0/transition");
  assert.equal(settlement.simulate_api.default_terminal, "release");
  assert.ok(settlement.surfaces.simulate);
  assert.ok(settlement.adapter_notes.some((note) => note.includes("/api/v0/simulate")));
  assert.ok(openapi.paths["/api/v0/simulate"].post);
  assert.equal(openapi.paths["/api/v0/simulate"].post.operationId, "postSimulate");

  const simulateHeaders = vercel.headers.find((row) => row.source === "/api/v0/simulate");
  assert.equal(
    simulateHeaders.headers.find((h) => h.key === "Access-Control-Allow-Headers").value,
    CORS_ALLOW_HEADERS,
  );
});
