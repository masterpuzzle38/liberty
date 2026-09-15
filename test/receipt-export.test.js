"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  STORAGE_KEY,
  exportAllJson,
  exportAllNdjson,
  exportOneJson,
  filenameForOne,
  readReceipt,
  readReceiptList,
  receiptFromJob,
  upsertReceipt,
} = require("../receipt-export");
const { receiptFromJob: engineReceipt } = require("../api/_lib/settlement-transition");

const NOW = "2026-09-15T00:40:00.000Z";

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

test("receiptFromJob matches the transition engine and rejects non-terminal jobs", () => {
  const job = releasedJob();
  const parsed = receiptFromJob(job);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.receipt, engineReceipt(job));
  assert.equal(parsed.receipt.release_fee, 5);
  assert.equal(parsed.receipt.agent_payout, 95);
  assert.equal(parsed.receipt.returned_to_payer, 0);

  const disputed = receiptFromJob(releasedJob({ status: "disputed", fee: 0, agentPayout: 0 }));
  assert.equal(disputed.ok, true);
  assert.equal(disputed.receipt.release_fee, 0);
  assert.equal(disputed.receipt.agent_payout, 0);
  assert.equal(disputed.receipt.returned_to_payer, 100);

  assert.equal(receiptFromJob(releasedJob({ status: "submitted" })).ok, false);
  assert.equal(STORAGE_KEY, "liberty.agent-settlement.receipts.v0");
});

test("optional client_ref survives export parse", () => {
  const fromJob = receiptFromJob(releasedJob({ clientRef: "agent-job-42" }));
  assert.equal(fromJob.ok, true);
  assert.equal(fromJob.receipt.client_ref, "agent-job-42");
  assert.equal(fromJob.receipt.client_ref, engineReceipt(releasedJob({ clientRef: "agent-job-42" })).client_ref);

  const parsed = readReceipt({
    ...engineReceipt(releasedJob()),
    client_ref: "from-the-api",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.receipt.client_ref, "from-the-api");
});

test("optional callback_url survives export parse", () => {
  const fromJob = receiptFromJob(releasedJob({ callbackUrl: "https://your-adapter.example/notify" }));
  assert.equal(fromJob.ok, true);
  assert.equal(fromJob.receipt.callback_url, "https://your-adapter.example/notify");
  assert.equal(
    fromJob.receipt.callback_url,
    engineReceipt(releasedJob({ callbackUrl: "https://your-adapter.example/notify" })).callback_url,
  );

  const parsed = readReceipt({
    ...engineReceipt(releasedJob()),
    callback_url: "https://from-the-api.example/cb",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.receipt.callback_url, "https://from-the-api.example/cb");
});

test("optional proof_note survives export parse", () => {
  const released = receiptFromJob(releasedJob({ proofNote: "Three-bullet brief attached." }));
  assert.equal(released.ok, true);
  assert.equal(released.receipt.proof_note, "Three-bullet brief attached.");
  assert.equal(
    released.receipt.proof_note,
    engineReceipt(releasedJob({ proofNote: "Three-bullet brief attached." })).proof_note,
  );

  const parsed = readReceipt({
    ...engineReceipt(releasedJob()),
    proof_note: "From the API.",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.receipt.proof_note, "From the API.");
});

test("optional release_note and dispute_reason survive export parse", () => {
  const released = receiptFromJob(releasedJob({ releaseNote: "Looks good." }));
  assert.equal(released.ok, true);
  assert.equal(released.receipt.release_note, "Looks good.");
  assert.equal(released.receipt.release_note, engineReceipt(releasedJob({ releaseNote: "Looks good." })).release_note);

  const parsed = readReceipt({
    ...engineReceipt(releasedJob()),
    release_note: "From the API.",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.receipt.release_note, "From the API.");

  const disputed = readReceipt({
    ...engineReceipt(releasedJob({ status: "disputed", fee: 0, agentPayout: 0 })),
    dispute_reason: "Not done.",
  });
  assert.equal(disputed.ok, true);
  assert.equal(disputed.receipt.dispute_reason, "Not done.");
});

test("readReceipt accepts API receipts, camelCase, and optional key_id", () => {
  const api = engineReceipt(releasedJob());
  const parsed = readReceipt(api);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.receipt, api);

  const keyed = readReceipt(api, { key_id: "k_aaaaaaaaaaaa" });
  assert.equal(keyed.receipt.key_id, "k_aaaaaaaaaaaa");

  const camel = readReceipt({
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
  assert.equal(camel.receipt.returned_to_payer, 20);
  assert.equal(camel.receipt.key_id, "k_bbbbbbbbbbbb");

  assert.equal(readReceipt({ ...api, job_id: "nope" }).ok, false);
  assert.equal(readReceipt({ ...api, key_id: "lib_demo_secret" }).ok, false);
});

test("upsert and list parse keep one receipt per job_id, newest first", () => {
  const first = readReceipt(engineReceipt(releasedJob())).receipt;
  const second = readReceipt(engineReceipt(releasedJob({
    id: "as_aaaaaaaaaa",
    title: "Other",
    amount: 40,
    fee: 2,
    agentPayout: 38,
  }))).receipt;
  const list = [];
  upsertReceipt(list, first);
  upsertReceipt(list, second);
  assert.equal(list[0].job_id, "as_aaaaaaaaaa");
  assert.equal(list.length, 2);

  const updated = { ...first, title: "Updated brief" };
  upsertReceipt(list, updated);
  assert.equal(list.length, 2);
  assert.equal(list.find((item) => item.job_id === first.job_id).title, "Updated brief");

  const loaded = readReceiptList(JSON.stringify({ receipts: [first, { status: "open" }, second] }));
  assert.equal(loaded.length, 2);
  assert.equal(readReceiptList("not-json").length, 0);
});

test("JSON and NDJSON exports are adapter-shaped, not a server ledger", () => {
  const receipt = readReceipt(engineReceipt(releasedJob())).receipt;
  const one = exportOneJson(receipt);
  assert.equal(one.ok, true);
  assert.equal(one.filename, filenameForOne(receipt));
  assert.equal(one.filename, "liberty-receipt-as_0123456789.json");
  const parsedOne = JSON.parse(one.text);
  assert.equal(parsedOne.job_id, "as_0123456789");
  assert.equal(parsedOne.money, undefined);
  assert.equal(parsedOne.release_fee, 5);

  const all = exportAllJson([receipt]);
  assert.equal(all.filename, "liberty-receipts.json");
  assert.deepEqual(JSON.parse(all.text), [receipt]);

  const ndjson = exportAllNdjson([receipt, receipt]);
  assert.equal(ndjson.filename, "liberty-receipts.ndjson");
  const lines = ndjson.text.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), receipt);
});
