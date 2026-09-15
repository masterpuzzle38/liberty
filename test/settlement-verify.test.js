"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CORS_ALLOW_HEADERS,
  handleHttp,
  keyIdFromSecret,
  receiptFromJob,
  transition,
  verify,
} = require("../api/_lib/settlement-transition");

const NOW = "2026-09-15T01:20:00.000Z";
const OPTIONS = { now: () => NOW, makeId: () => "as_0123456789" };

function commit(input) {
  return transition(input, OPTIONS);
}

function submittedJob() {
  const open = commit({
    action: "create",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
  }).body.job;
  const funded = commit({ action: "fund", job: open, payer_credits: 100 }).body.job;
  return commit({
    action: "submit",
    job: funded,
    proof_url: "https://example.com/proof",
  }).body.job;
}

function releasedReceipt() {
  return commit({ action: "release", job: submittedJob() }).body.receipt;
}

test("valid release receipt matches the shared fee engine", () => {
  const receipt = releasedReceipt();
  const result = verify({ receipt }, OPTIONS);
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.mode, "demo");
  assert.equal(result.body.money, false);
  assert.equal(result.body.valid, true);
  assert.equal(result.body.verified, true);
  assert.deepEqual(result.body.expected, {
    fee: 5,
    agent_payout: 95,
    returned_to_payer: 0,
  });
  assert.deepEqual(result.body.received, {
    fee: 5,
    agent_payout: 95,
    returned_to_payer: 0,
  });
  assert.deepEqual(result.body.mismatches, []);
  assert.equal(result.body.action, "release");
  assert.equal(result.body.job_id, "as_0123456789");
  assert.equal(receipt.release_fee, receiptFromJob({
    id: receipt.job_id,
    title: receipt.title,
    amount: receipt.amount,
    criteria: receipt.success_criteria,
    proofUrl: receipt.proof,
    status: "released",
    createdAt: receipt.created,
    fundedAt: receipt.funded,
    submittedAt: receipt.submitted,
    resolvedAt: receipt.resolved,
    fee: 5,
    agentPayout: 95,
  }).release_fee);
});

test("wrong fee on a receipt is a mismatch, not a 4xx", () => {
  const receipt = { ...releasedReceipt(), release_fee: 10, agent_payout: 90 };
  const result = verify({ receipt }, OPTIONS);
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.money, false);
  assert.equal(result.body.valid, false);
  assert.equal(result.body.verified, true);
  assert.equal(result.body.expected.fee, 5);
  assert.equal(result.body.received.fee, 10);
  assert.ok(result.body.mismatches.some((row) => row.includes("fee: received 10, expected 5")));
  assert.ok(result.body.mismatches.some((row) => row.includes("agent_payout: received 90, expected 95")));
});

test("bad input returns 4xx JSON like quote/transition", () => {
  assert.equal(verify(null).status, 400);
  assert.equal(verify(null).body.error, "invalid_json");
  assert.equal(verify(null).body.money, false);

  const missing = verify({});
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, "missing_field");
  assert.equal(missing.body.field, "receipt");
  assert.equal(missing.body.money, false);

  const array = verify({ receipt: [] });
  assert.equal(array.status, 400);
  assert.equal(array.body.error, "invalid_field");

  const badId = verify({
    receipt: { ...releasedReceipt(), job_id: "nope" },
  });
  assert.equal(badId.status, 400);
  assert.equal(badId.body.error, "invalid_field");

  const open = commit({
    action: "create",
    title: "Open",
    amount: 20,
    criteria: "C",
  }).body.job;
  const early = verify({ job: open, action: "release" }, OPTIONS);
  assert.equal(early.status, 409);
  assert.equal(early.body.error, "illegal_transition");
  assert.equal(early.body.money, false);

  const fund = verify({ job: submittedJob(), action: "fund" }, OPTIONS);
  assert.equal(fund.status, 400);
  assert.equal(fund.body.error, "invalid_action");
});

test("submitted job plus action recomputes proposed release or dispute", () => {
  const job = submittedJob();
  const preview = verify({ action: "release", job }, OPTIONS);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.valid, true);
  assert.deepEqual(preview.body.expected, {
    fee: 5,
    agent_payout: 95,
    returned_to_payer: 0,
  });
  assert.deepEqual(preview.body.received, {});

  const claimedWrong = verify({
    action: "release",
    job,
    fee: 1,
    agent_payout: 99,
    returned_to_payer: 0,
  }, OPTIONS);
  assert.equal(claimedWrong.body.valid, false);
  assert.equal(claimedWrong.body.received.fee, 1);

  const disputed = verify({ action: "dispute", job, returned_to_payer: 100 }, OPTIONS);
  assert.equal(disputed.status, 200);
  assert.equal(disputed.body.valid, true);
  assert.deepEqual(disputed.body.expected, {
    fee: 0,
    agent_payout: 0,
    returned_to_payer: 100,
  });
});

test("top-level receipt object and terminal job both verify", () => {
  const receipt = releasedReceipt();
  const bare = verify(receipt, OPTIONS);
  assert.equal(bare.status, 200);
  assert.equal(bare.body.valid, true);

  const released = commit({ action: "release", job: submittedJob() }).body.job;
  const fromJob = verify({ job: released }, OPTIONS);
  assert.equal(fromJob.status, 200);
  assert.equal(fromJob.body.valid, true);
  assert.equal(fromJob.body.expected.fee, 5);
  assert.equal(fromJob.body.received.fee, 5);
});

test("verify HTTP wrapper: OPTIONS, GET discovery, POST, optional key, and 405", () => {
  const options = handleHttp({ method: "OPTIONS", body: null, verify: true });
  assert.equal(options.status, 204);
  assert.equal(options.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(options.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(options.headers["Access-Control-Allow-Headers"], CORS_ALLOW_HEADERS);
  assert.equal(options.body, null);

  const get = handleHttp({ method: "GET", body: null, verify: true });
  assert.equal(get.status, 200);
  assert.equal(get.body.path, "/api/v0/verify");
  assert.equal(get.body.money, false);
  assert.equal(get.body.persistence, false);
  assert.equal(get.body.dry_run, true);
  assert.deepEqual(get.body.actions, ["release", "dispute"]);
  assert.equal(get.body.quote, "/api/v0/quote");
  assert.equal(get.body.commit, "/api/v0/transition");

  const posted = handleHttp({
    method: "POST",
    verify: true,
    body: { receipt: releasedReceipt() },
  });
  assert.equal(posted.status, 200);
  assert.equal(posted.body.valid, true);
  assert.equal(posted.body.verified, true);
  assert.equal(posted.body.money, false);
  assert.equal(posted.body.key_optional, true);
  assert.equal(posted.body.auth.status, "key_optional");

  const secret = "lib_demo_verifykey000000000000000001";
  const keyed = handleHttp({
    method: "POST",
    verify: true,
    headers: { Authorization: `Bearer ${secret}` },
    body: { receipt: releasedReceipt() },
  });
  assert.equal(keyed.body.key_id, keyIdFromSecret(secret));
  assert.equal(keyed.body.auth.status, "accepted");
  assert.equal(JSON.stringify(keyed.body).includes(secret), false);

  const put = handleHttp({ method: "PUT", body: {}, verify: true });
  assert.equal(put.status, 405);
  assert.equal(put.body.money, false);
});

test("verify Vercel handler uses the same engine and keeps money false", async () => {
  const handler = require("../api/v0/verify");
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
      body: { receipt: releasedReceipt() },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.valid, true);
  assert.equal(res.body.verified, true);
  assert.equal(res.body.money, false);
  assert.equal(res.body.key_optional, true);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(res.headers["Access-Control-Allow-Headers"], CORS_ALLOW_HEADERS);
});

test("protocol files describe verify next to quote and transition", () => {
  const root = path.join(__dirname, "..");
  const settlement = JSON.parse(fs.readFileSync(path.join(root, "api/_lib/settlement.json"), "utf8"));
  const openapi = JSON.parse(fs.readFileSync(path.join(root, "settlement.openapi.json"), "utf8"));
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

  assert.equal(settlement.verify_api.path, "/api/v0/verify");
  assert.equal(settlement.verify_api.money, false);
  assert.equal(settlement.verify_api.persistence, false);
  assert.equal(settlement.verify_api.engine, "/api/v0/transition");
  assert.ok(settlement.surfaces.verify);
  assert.ok(settlement.adapter_notes.some((note) => note.includes("/api/v0/verify")));
  assert.ok(openapi.paths["/api/v0/verify"].post);
  assert.equal(openapi.paths["/api/v0/verify"].post.operationId, "postVerify");

  const verifyHeaders = vercel.headers.find((row) => row.source === "/api/v0/verify");
  assert.equal(
    verifyHeaders.headers.find((h) => h.key === "Access-Control-Allow-Headers").value,
    CORS_ALLOW_HEADERS,
  );
});
