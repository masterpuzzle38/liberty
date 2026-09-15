"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CLIENT_REF_MAX_LENGTH,
  CORS_ALLOW_HEADERS,
  JOB_ID_PATTERN,
  NOTE_MAX_LENGTH,
  handleHttp,
  keyIdFromSecret,
  releaseFee,
  transition,
} = require("../api/_lib/settlement-transition");

const NOW = "2026-09-14T19:50:00.000Z";

function createJob(overrides) {
  return transition(
    {
      action: "create",
      title: "Summarize filings",
      amount: 100,
      criteria: "Three-bullet brief matching the last three filings.",
    },
    { now: () => NOW, makeId: () => "as_0123456789" },
  ).body.job;
}

function step(action, extra) {
  return transition({ action, ...extra }, { now: () => NOW, makeId: () => "as_0123456789" });
}

test("release fee matches Math.round(amount * 0.05)", () => {
  assert.equal(releaseFee(1), 0);
  assert.equal(releaseFee(10), 1);
  assert.equal(releaseFee(11), 1);
  assert.equal(releaseFee(15), 1);
  assert.equal(releaseFee(100), 5);
});

test("create returns an open job with as_ + 10 hex id", () => {
  const result = step("create", {
    title: "  Summarize filings ",
    amount: 100,
    criteria: " Three-bullet brief ",
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.money, false);
  assert.equal(result.body.mode, "demo");
  assert.match(result.body.job.id, JOB_ID_PATTERN);
  assert.equal(result.body.job.status, "open");
  assert.equal(result.body.job.title, "Summarize filings");
  assert.equal(result.body.job.amount, 100);
  assert.equal(result.body.job.proofUrl, "");
  assert.equal(result.body.job.fee, 0);
  assert.equal(result.body.job.agentPayout, 0);
  assert.equal(result.body.job.createdAt, NOW);
  assert.equal(result.body.job.fundedAt, null);
});

test("create rejects missing and invalid fields", () => {
  assert.equal(step("create", { amount: 10, criteria: "done" }).status, 400);
  assert.equal(step("create", { title: "x", amount: 0, criteria: "done" }).body.error, "invalid_field");
  assert.equal(step("create", { title: "x", amount: 1.5, criteria: "done" }).body.error, "invalid_field");
  assert.equal(step("create", { title: "x".repeat(81), amount: 10, criteria: "done" }).body.error, "invalid_field");
  assert.equal(transition(null).body.error, "invalid_json");
  assert.equal(transition({ action: "explode" }).body.error, "invalid_action");
});

test("fund deducts credits and rejects shorts or illegal states", () => {
  const job = createJob();
  const funded = step("fund", { job, payer_credits: 150 });
  assert.equal(funded.status, 200);
  assert.equal(funded.body.job.status, "funded");
  assert.equal(funded.body.payer_credits, 50);
  assert.equal(funded.body.job.fundedAt, NOW);
  assert.equal(funded.body.money, false);

  const short = step("fund", { job, payer_credits: 99 });
  assert.equal(short.status, 409);
  assert.equal(short.body.error, "insufficient_credits");

  const again = step("fund", { job: funded.body.job, payer_credits: 200 });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, "illegal_transition");
  assert.equal(again.body.from, "funded");
  assert.equal(again.body.expected, "open");
});

test("submit attaches proof; release and dispute are terminal with protocol math", () => {
  const open = createJob();
  const funded = step("fund", { job: open, payer_credits: 100 }).body.job;
  const submitted = step("submit", { job: funded, proof_url: "https://example.com/proof" }).body.job;
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.proofUrl, "https://example.com/proof");

  const released = step("release", { job: submitted });
  assert.equal(released.status, 200);
  assert.equal(released.body.job.status, "released");
  assert.equal(released.body.fee, 5);
  assert.equal(released.body.agent_payout, 95);
  assert.equal(released.body.agent_credits_delta, 95);
  assert.equal(released.body.job.fee, 5);
  assert.equal(released.body.job.agentPayout, 95);
  assert.deepEqual(released.body.receipt, {
    job_id: "as_0123456789",
    title: "Summarize filings",
    status: "released",
    amount: 100,
    release_fee: 5,
    agent_payout: 95,
    returned_to_payer: 0,
    success_criteria: "Three-bullet brief matching the last three filings.",
    proof: "https://example.com/proof",
    created: NOW,
    funded: NOW,
    submitted: NOW,
    resolved: NOW,
  });

  const disputed = step("dispute", { job: submitted, payer_credits: 0 });
  assert.equal(disputed.status, 200);
  assert.equal(disputed.body.job.status, "disputed");
  assert.equal(disputed.body.fee, 0);
  assert.equal(disputed.body.agent_payout, 0);
  assert.equal(disputed.body.agent_credits_delta, 0);
  assert.equal(disputed.body.returned_to_payer, 100);
  assert.equal(disputed.body.payer_credits, 100);
  assert.equal(disputed.body.receipt.release_fee, 0);
  assert.equal(disputed.body.receipt.returned_to_payer, 100);

  assert.equal(step("release", { job: released.body.job }).body.error, "illegal_transition");
  assert.equal(step("dispute", { job: disputed.body.job }).body.error, "illegal_transition");
});

test("accepts snake_case job fields and payerCredits alias", () => {
  const result = step("fund", {
    payerCredits: 40,
    job: {
      id: "as_abcdef0123",
      title: "Snake",
      amount: 20,
      criteria: "Done",
      proof_url: "",
      status: "open",
      created_at: NOW,
      funded_at: null,
      submitted_at: null,
      resolved_at: null,
      agent_payout: 0,
      fee: 0,
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.job.status, "funded");
  assert.equal(result.body.payer_credits, 20);
  assert.equal(result.body.job.createdAt, NOW);
});

test("Vercel handler uses Node req/res and keeps money false", async () => {
  const handler = require("../api/v0/transition");
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
      body: { action: "create", title: "Handler", amount: 8, criteria: "Works" },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.money, false);
  assert.equal(res.body.job.status, "open");
  assert.equal(res.body.key_optional, true);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(res.headers["Access-Control-Allow-Headers"], CORS_ALLOW_HEADERS);
});

test("HTTP wrapper: OPTIONS, GET discovery, POST, and 405", () => {
  const options = handleHttp({ method: "OPTIONS", body: null });
  assert.equal(options.status, 204);
  assert.equal(options.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(options.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(options.headers["Access-Control-Allow-Headers"], CORS_ALLOW_HEADERS);
  assert.equal(options.body, null);

  const get = handleHttp({ method: "GET", body: null });
  assert.equal(get.status, 200);
  assert.equal(get.body.money, false);
  assert.equal(get.body.persistence, false);
  assert.equal(get.body.auth.required, false);
  assert.equal(get.body.auth.mode, "demo");
  assert.equal(get.body.auth.missing, "key_optional");
  assert.deepEqual(get.body.actions, ["create", "fund", "submit", "release", "dispute"]);

  const posted = handleHttp({
    method: "POST",
    body: { action: "create", title: "T", amount: 2, criteria: "C" },
  });
  assert.equal(posted.status, 200);
  assert.equal(posted.body.job.status, "open");
  assert.equal(posted.body.key_optional, true);
  assert.equal(posted.body.auth.status, "key_optional");
  assert.equal(posted.body.money, false);
  assert.equal(posted.headers["Access-Control-Allow-Origin"], "*");

  const put = handleHttp({ method: "PUT", body: {} });
  assert.equal(put.status, 405);
  assert.equal(put.body.money, false);
  assert.equal(put.body.key_optional, true);
});

test("optional demo key echoes key_id hash prefix and never the raw secret", () => {
  const secret = "lib_demo_aaaabbbbccccddddeeeeffff00001111";
  const expected = keyIdFromSecret(secret);
  assert.match(expected, /^k_[0-9a-f]{12}$/);
  assert.equal(keyIdFromSecret(secret), expected);

  const bearer = handleHttp({
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    body: { action: "create", title: "Keyed", amount: 3, criteria: "C" },
  });
  assert.equal(bearer.status, 200);
  assert.equal(bearer.body.money, false);
  assert.equal(bearer.body.key_id, expected);
  assert.equal(bearer.body.auth.status, "accepted");
  assert.equal(bearer.body.auth.key_id, expected);
  assert.equal(bearer.body.key_optional, undefined);
  assert.equal(JSON.stringify(bearer.body).includes(secret), false);

  const header = handleHttp({
    method: "POST",
    headers: { "X-Liberty-Key": secret },
    body: { action: "create", title: "Keyed", amount: 3, criteria: "C" },
  });
  assert.equal(header.body.key_id, expected);

  const both = handleHttp({
    method: "POST",
    headers: {
      authorization: "Bearer other-demo-key",
      "x-liberty-key": secret,
    },
    body: { action: "create", title: "Keyed", amount: 3, criteria: "C" },
  });
  assert.equal(both.body.key_id, expected);
  assert.notEqual(both.body.key_id, keyIdFromSecret("other-demo-key"));

  const open = createJob();
  const funded = step("fund", { job: open, payer_credits: 100 }).body.job;
  const submitted = step("submit", { job: funded, proof_url: "https://example.com/proof" }).body.job;
  const released = handleHttp({
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    body: { action: "release", job: submitted },
  });
  assert.equal(released.body.receipt.key_id, expected);
  assert.equal(released.body.key_id, expected);
  assert.equal(JSON.stringify(released.body).includes(secret), false);

  const missing = handleHttp({
    method: "POST",
    headers: { authorization: "Basic not-a-demo-key" },
    body: { action: "create", title: "No key", amount: 2, criteria: "C" },
  });
  assert.equal(missing.body.key_optional, true);
  assert.equal(missing.body.key_id, undefined);
});

test("protocol files describe optional demo keys and stay valid JSON", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..");
  const settlement = JSON.parse(fs.readFileSync(path.join(root, "api/_lib/settlement.json"), "utf8"));
  const openapi = JSON.parse(fs.readFileSync(path.join(root, "settlement.openapi.json"), "utf8"));
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  assert.equal(settlement.money, false);
  assert.equal(settlement.transition_api.auth, "optional");
  assert.ok(settlement.adapter_notes.some((note) => note.includes("key_optional")));
  assert.ok(openapi.components.securitySchemes.bearerDemo);
  assert.ok(openapi.components.securitySchemes.libertyKey);
  const transitionHeaders = vercel.headers.find((row) => row.source === "/api/v0/transition");
  assert.equal(
    transitionHeaders.headers.find((h) => h.key === "Access-Control-Allow-Headers").value,
    CORS_ALLOW_HEADERS,
  );
  const quoteHeaders = vercel.headers.find((row) => row.source === "/api/v0/quote");
  assert.equal(
    quoteHeaders.headers.find((h) => h.key === "Access-Control-Allow-Headers").value,
    CORS_ALLOW_HEADERS,
  );
  const verifyHeaders = vercel.headers.find((row) => row.source === "/api/v0/verify");
  assert.equal(
    verifyHeaders.headers.find((h) => h.key === "Access-Control-Allow-Headers").value,
    CORS_ALLOW_HEADERS,
  );
  const simulateHeaders = vercel.headers.find((row) => row.source === "/api/v0/simulate");
  assert.equal(
    simulateHeaders.headers.find((h) => h.key === "Access-Control-Allow-Headers").value,
    CORS_ALLOW_HEADERS,
  );
});

test("optional client_ref lands on the job, survives later actions, and echoes on the receipt", () => {
  const created = step("create", {
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    client_ref: "  agent-job-42  ",
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.job.clientRef, "agent-job-42");
  assert.equal(created.body.job.client_ref, undefined);

  const funded = step("fund", { job: created.body.job, payer_credits: 100 });
  assert.equal(funded.body.job.clientRef, "agent-job-42");
  const submitted = step("submit", {
    job: funded.body.job,
    proof_url: "https://example.com/proof",
  });
  assert.equal(submitted.body.job.clientRef, "agent-job-42");

  const released = step("release", { job: submitted.body.job });
  assert.equal(released.status, 200);
  assert.equal(released.body.job.clientRef, "agent-job-42");
  assert.equal(released.body.receipt.client_ref, "agent-job-42");
  assert.equal(released.body.fee, 5);

  const camel = step("create", {
    title: "x",
    amount: 1,
    criteria: "done",
    clientRef: "camel-ref",
  });
  assert.equal(camel.body.job.clientRef, "camel-ref");

  const omitted = step("create", {
    title: "x",
    amount: 1,
    criteria: "done",
  });
  assert.equal(omitted.body.job.clientRef, undefined);
});

test("client_ref stays optional, bounded, and create-only", () => {
  const empty = step("create", {
    title: "x",
    amount: 1,
    criteria: "done",
    client_ref: "   ",
  });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error, "invalid_field");
  assert.equal(empty.body.field, "client_ref");
  assert.equal(empty.body.money, false);

  const tooLong = step("create", {
    title: "x",
    amount: 1,
    criteria: "done",
    client_ref: "x".repeat(CLIENT_REF_MAX_LENGTH + 1),
  });
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.field, "client_ref");

  const notString = step("create", {
    title: "x",
    amount: 1,
    criteria: "done",
    client_ref: 12,
  });
  assert.equal(notString.status, 400);
  assert.equal(notString.body.field, "client_ref");

  const open = createJob();
  const onFund = step("fund", { job: open, payer_credits: 100, client_ref: "late" });
  assert.equal(onFund.status, 400);
  assert.equal(onFund.body.field, "client_ref");
});

test("optional proof_note lands on the submitted job and later receipt", () => {
  const open = createJob();
  const funded = step("fund", { job: open, payer_credits: 100 }).body.job;
  const submitted = step("submit", {
    job: funded,
    proof_url: "https://example.com/proof",
    proof_note: "  Three-bullet brief attached.  ",
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.job.proofNote, "Three-bullet brief attached.");
  assert.equal(submitted.body.job.proofUrl, "https://example.com/proof");

  const camel = step("submit", {
    job: funded,
    proof_url: "https://example.com/proof",
    proofNote: "Camel proof note",
  });
  assert.equal(camel.body.job.proofNote, "Camel proof note");

  const released = step("release", { job: submitted.body.job });
  assert.equal(released.status, 200);
  assert.equal(released.body.job.proofNote, "Three-bullet brief attached.");
  assert.equal(released.body.receipt.proof_note, "Three-bullet brief attached.");
  assert.equal(released.body.receipt.release_note, undefined);
  assert.equal(released.body.fee, 5);
  assert.equal(released.body.agent_credits_delta, 95);

  const disputed = step("dispute", {
    job: submitted.body.job,
    payer_credits: 0,
  });
  assert.equal(disputed.body.receipt.proof_note, "Three-bullet brief attached.");
  assert.equal(disputed.body.job.proofNote, "Three-bullet brief attached.");
});

test("proof_note stays optional, bounded, and submit-only", () => {
  const open = createJob();
  const funded = step("fund", { job: open, payer_credits: 100 }).body.job;

  const omitted = step("submit", { job: funded, proof_url: "https://example.com/proof" });
  assert.equal(omitted.body.job.proofNote, undefined);

  const blank = step("submit", {
    job: funded,
    proof_url: "https://example.com/proof",
    proof_note: "   ",
  });
  assert.equal(blank.status, 200);
  assert.equal(blank.body.job.proofNote, undefined);

  const tooLong = step("submit", {
    job: funded,
    proof_url: "https://example.com/proof",
    proof_note: "x".repeat(NOTE_MAX_LENGTH + 1),
  });
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.error, "invalid_field");
  assert.equal(tooLong.body.field, "proof_note");

  const submitted = omitted.body.job;
  const wrongField = step("release", { job: submitted, proof_note: "Not for release." });
  assert.equal(wrongField.status, 400);
  assert.equal(wrongField.body.error, "invalid_field");
  assert.equal(wrongField.body.field, "proof_note");

  const onCreate = step("create", {
    title: "x",
    amount: 1,
    criteria: "done",
    proof_note: "No.",
  });
  assert.equal(onCreate.status, 400);
  assert.equal(onCreate.body.field, "proof_note");

  const notString = step("submit", {
    job: funded,
    proof_url: "https://example.com/proof",
    proof_note: 12,
  });
  assert.equal(notString.status, 400);
  assert.equal(notString.body.field, "proof_note");
});

test("optional release_note and dispute_reason land on the job and receipt", () => {
  const open = createJob();
  const funded = step("fund", { job: open, payer_credits: 100 }).body.job;
  const submitted = step("submit", { job: funded, proof_url: "https://example.com/proof" }).body.job;

  const released = step("release", {
    job: submitted,
    release_note: "  Proof matches the three-bullet brief.  ",
  });
  assert.equal(released.status, 200);
  assert.equal(released.body.job.releaseNote, "Proof matches the three-bullet brief.");
  assert.equal(released.body.receipt.release_note, "Proof matches the three-bullet brief.");
  assert.equal(released.body.receipt.dispute_reason, undefined);
  assert.equal(released.body.fee, 5);
  assert.equal(released.body.agent_credits_delta, 95);

  const camel = step("release", {
    job: submitted,
    releaseNote: "Camel note",
  });
  assert.equal(camel.body.receipt.release_note, "Camel note");

  const disputed = step("dispute", {
    job: submitted,
    payer_credits: 0,
    dispute_reason: "Proof does not match the criteria.",
  });
  assert.equal(disputed.status, 200);
  assert.equal(disputed.body.job.disputeReason, "Proof does not match the criteria.");
  assert.equal(disputed.body.receipt.dispute_reason, "Proof does not match the criteria.");
  assert.equal(disputed.body.receipt.release_note, undefined);
  assert.equal(disputed.body.fee, 0);
  assert.equal(disputed.body.returned_to_payer, 100);
});

test("terminal notes stay optional, bounded, and action-specific", () => {
  const open = createJob();
  const funded = step("fund", { job: open, payer_credits: 100 }).body.job;
  const submitted = step("submit", { job: funded, proof_url: "https://example.com/proof" }).body.job;

  const omitted = step("release", { job: submitted });
  assert.equal(omitted.body.job.releaseNote, undefined);
  assert.equal(omitted.body.receipt.release_note, undefined);

  const blank = step("release", { job: submitted, release_note: "   " });
  assert.equal(blank.status, 200);
  assert.equal(blank.body.receipt.release_note, undefined);

  const tooLong = step("release", { job: submitted, release_note: "x".repeat(NOTE_MAX_LENGTH + 1) });
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.error, "invalid_field");
  assert.equal(tooLong.body.field, "release_note");

  const wrongField = step("release", { job: submitted, dispute_reason: "Not for release." });
  assert.equal(wrongField.status, 400);
  assert.equal(wrongField.body.error, "invalid_field");
  assert.equal(wrongField.body.field, "dispute_reason");

  const onCreate = step("create", {
    title: "x",
    amount: 1,
    criteria: "done",
    release_note: "No.",
  });
  assert.equal(onCreate.status, 400);
  assert.equal(onCreate.body.field, "release_note");

  const notString = step("dispute", { job: submitted, dispute_reason: 12 });
  assert.equal(notString.status, 400);
  assert.equal(notString.body.field, "dispute_reason");
});
