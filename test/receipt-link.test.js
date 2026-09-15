"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PREFIX,
  buildReceiptHref,
  decodeReceipt,
  decodeReceiptInput,
  encodeReceipt,
  extractReceiptToken,
  readLocationReceipt,
} = require("../receipt-export");
const { receiptFromJob: engineReceipt, verify } = require("../api/_lib/settlement-transition");

const NOW = "2026-09-15T03:00:00.000Z";

function releasedJob(overrides) {
  return {
    id: "as_0123456789",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    proofUrl: "https://example.com/proof",
    status: "released",
    createdAt: NOW,
    fundedAt: NOW,
    submittedAt: NOW,
    resolvedAt: NOW,
    fee: 5,
    agentPayout: 95,
    ...overrides,
  };
}

function sampleReceipt(overrides) {
  return {
    ...engineReceipt(releasedJob()),
    ...overrides,
  };
}

test("encode/decode round-trips a terminal receipt", () => {
  const receipt = sampleReceipt();
  const encoded = encodeReceipt(receipt);
  assert.equal(encoded.ok, true);
  assert.equal(encoded.token.startsWith(PREFIX), true);
  assert.equal(encoded.token.includes("+"), false);
  assert.equal(encoded.token.includes("/"), false);
  assert.deepEqual(encoded.receipt, receipt);

  const decoded = decodeReceipt(encoded.token);
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.receipt, receipt);
});

test("receipt-link compact payload keeps optional client_ref", () => {
  const encoded = encodeReceipt(sampleReceipt({ client_ref: "agent-job-42" }));
  assert.equal(encoded.ok, true);
  assert.equal(encoded.receipt.client_ref, "agent-job-42");
  const raw = Buffer.from(encoded.token.slice(PREFIX.length), "base64url").toString("utf8");
  const payload = JSON.parse(raw);
  assert.equal(payload.receipt.cr, "agent-job-42");
  assert.equal(payload.receipt.client_ref, undefined);
  assert.equal(decodeReceipt(encoded.token).receipt.client_ref, "agent-job-42");
});

test("receipt-link compact payload keeps optional callback_url", () => {
  const encoded = encodeReceipt(sampleReceipt({ callback_url: "https://your-adapter.example/notify" }));
  assert.equal(encoded.ok, true);
  assert.equal(encoded.receipt.callback_url, "https://your-adapter.example/notify");
  const raw = Buffer.from(encoded.token.slice(PREFIX.length), "base64url").toString("utf8");
  const payload = JSON.parse(raw);
  assert.equal(payload.receipt.cb, "https://your-adapter.example/notify");
  assert.equal(payload.receipt.callback_url, undefined);
  assert.equal(decodeReceipt(encoded.token).receipt.callback_url, "https://your-adapter.example/notify");
});

test("receipt-link compact payload keeps optional notes", () => {
  const withProof = encodeReceipt(sampleReceipt({ proof_note: "Three-bullet brief attached." }));
  assert.equal(withProof.ok, true);
  assert.equal(withProof.receipt.proof_note, "Three-bullet brief attached.");
  const proofRaw = Buffer.from(withProof.token.slice(PREFIX.length), "base64url").toString("utf8");
  const proofPayload = JSON.parse(proofRaw);
  assert.equal(proofPayload.receipt.pn, "Three-bullet brief attached.");
  assert.equal(proofPayload.receipt.proof_note, undefined);
  assert.equal(decodeReceipt(withProof.token).receipt.proof_note, "Three-bullet brief attached.");

  const encoded = encodeReceipt(sampleReceipt({ release_note: "Looks good." }));
  assert.equal(encoded.ok, true);
  assert.equal(encoded.receipt.release_note, "Looks good.");
  const raw = Buffer.from(encoded.token.slice(PREFIX.length), "base64url").toString("utf8");
  const payload = JSON.parse(raw);
  assert.equal(payload.receipt.rn, "Looks good.");
  assert.equal(payload.receipt.release_note, undefined);
  assert.equal(decodeReceipt(encoded.token).receipt.release_note, "Looks good.");

  const disputed = encodeReceipt(sampleReceipt({
    status: "disputed",
    release_fee: 0,
    agent_payout: 0,
    returned_to_payer: 100,
    dispute_reason: "Not done.",
  }));
  assert.equal(decodeReceipt(disputed.token).receipt.dispute_reason, "Not done.");
});

test("receipt-link payload is compact and does not include credits or API keys", () => {
  const encoded = encodeReceipt(sampleReceipt({ key_id: "k_deadbeef0000" }));
  const raw = Buffer.from(encoded.token.slice(PREFIX.length), "base64url").toString("utf8");
  assert.equal(raw.includes("credits"), false);
  assert.equal(raw.includes("lib_demo_"), false);
  assert.equal(raw.includes("Authorization"), false);
  assert.equal(raw.includes("success_criteria"), false);
  assert.equal(raw.includes("release_fee"), false);
  const payload = JSON.parse(raw);
  assert.equal(payload.v, 1);
  assert.equal(payload.receipt.s, "released");
  assert.equal(payload.receipt.t, "Summarize filings");
  assert.equal(payload.receipt.a, 100);
  assert.equal(payload.receipt.f, 5);
  assert.equal(payload.receipt.ap, 95);
  assert.equal(payload.receipt.k, "k_deadbeef0000");
});

test("encode accepts a job, camelCase, and optional key_id extras", () => {
  const fromJob = encodeReceipt(releasedJob());
  assert.equal(fromJob.ok, true);
  assert.equal(fromJob.receipt.status, "released");
  assert.equal(fromJob.receipt.release_fee, 5);

  const disputed = encodeReceipt(releasedJob({ status: "disputed", fee: 0, agentPayout: 0 }));
  assert.equal(disputed.receipt.status, "disputed");
  assert.equal(disputed.receipt.returned_to_payer, 100);
  assert.deepEqual(decodeReceipt(disputed.token).receipt, disputed.receipt);

  const camel = encodeReceipt({
    jobId: "as_abcdef0123",
    title: "Camel",
    status: "disputed",
    amount: 20,
    releaseFee: 0,
    agentPayout: 0,
    returnedToPayer: 20,
    successCriteria: "Done",
    proofUrl: "",
    createdAt: NOW,
    fundedAt: NOW,
    submittedAt: NOW,
    resolvedAt: NOW,
    keyId: "k_bbbbbbbbbbbb",
  });
  assert.equal(camel.ok, true);
  assert.equal(camel.receipt.job_id, "as_abcdef0123");
  assert.equal(camel.receipt.key_id, "k_bbbbbbbbbbbb");
  assert.equal(decodeReceipt(camel.token).receipt.returned_to_payer, 20);
});

test("rejects invalid tokens and non-terminal receipts", () => {
  assert.equal(encodeReceipt(null).ok, false);
  assert.equal(encodeReceipt({ ...sampleReceipt(), job_id: "nope" }).error, "invalid_receipt");
  assert.equal(encodeReceipt(releasedJob({ status: "submitted" })).ok, false);
  assert.equal(decodeReceipt("not-a-token").error, "invalid_receipt_link");
  assert.equal(decodeReceipt("r1.").error, "invalid_receipt_link");
  assert.equal(decodeReceipt("r1.@@@").error, "invalid_receipt_link");
  const badVersion = PREFIX + Buffer.from(JSON.stringify({ v: 99, receipt: sampleReceipt() })).toString("base64url");
  assert.equal(decodeReceipt(badVersion).error, "invalid_receipt_link");
});

test("extracts a token from hash URLs, query URLs, and raw codes", () => {
  const token = encodeReceipt(sampleReceipt()).token;
  const href = `https://liberty-amber.vercel.app/#receipt/${token}`;
  const query = `https://liberty-amber.vercel.app/?receipt=${token}`;
  assert.equal(extractReceiptToken(href), token);
  assert.equal(extractReceiptToken(query), token);
  assert.equal(extractReceiptToken(`#receipt/${token}`), token);
  assert.equal(extractReceiptToken(token), token);
  assert.equal(extractReceiptToken("  "), "");
  assert.equal(decodeReceiptInput(href).ok, true);
  assert.equal(decodeReceiptInput(query).receipt.job_id, "as_0123456789");
  assert.equal(buildReceiptHref(sampleReceipt(), "https://liberty-amber.vercel.app/").href, href);
  assert.equal(readLocationReceipt({ hash: `#receipt/${token}`, search: "" }), token);
  assert.equal(readLocationReceipt({ hash: "", search: `?receipt=${token}` }), token);
  assert.equal(readLocationReceipt({ hash: "#handoff/h1.abc", search: "" }), "");
  assert.equal(readLocationReceipt({ hash: "#job/as_0123456789", search: "" }), "");
});

test("a decoded receipt still verifies against the fee engine", () => {
  const encoded = encodeReceipt(sampleReceipt());
  const decoded = decodeReceipt(encoded.token);
  const checked = verify({ receipt: decoded.receipt });
  assert.equal(checked.status, 200);
  assert.equal(checked.body.ok, true);
  assert.equal(checked.body.valid, true);
  assert.equal(checked.body.money, false);
  assert.equal(checked.body.expected.fee, 5);
  assert.equal(checked.body.expected.agent_payout, 95);
});

test("protocol files describe client-held receipt links and stay valid JSON", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..");
  const settlement = JSON.parse(fs.readFileSync(path.join(root, "api/_lib/settlement.json"), "utf8"));
  const openapi = JSON.parse(fs.readFileSync(path.join(root, "settlement.openapi.json"), "utf8"));
  assert.equal(settlement.money, false);
  assert.equal(settlement.receipt_link.persistence, false);
  assert.equal(settlement.receipt_link.money, false);
  assert.equal(settlement.receipt_link.prefix, "r1.");
  assert.equal(settlement.receipt_link.hash, "#receipt/<token>");
  assert.ok(settlement.adapter_notes.some((note) => note.includes("#receipt/")));
  assert.ok(openapi.components.schemas.ReceiptLink);
  assert.equal(openapi.components.schemas.ReceiptLink.properties.v.const, 1);
});
