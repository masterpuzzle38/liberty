"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { receiptFromJob } = require("../receipt-export");
const {
  CSV_COLUMNS,
  FILENAME,
  exportReceiptsCsv,
  summarizeLedger,
} = require("../settlement-ledger");

const NOW = "2026-09-15T12:00:00.000Z";

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

function fixtureReceipt(overrides) {
  const parsed = receiptFromJob(releasedJob(overrides));
  assert.equal(parsed.ok, true);
  return parsed.receipt;
}

test("empty ledger totals stay honest zeros and money: false", () => {
  const empty = summarizeLedger();
  assert.equal(empty.money, false);
  assert.equal(empty.mode, "demo");
  assert.equal(empty.feesPaid, 0);
  assert.equal(empty.agentPayouts, 0);
  assert.equal(empty.disputedReturns, 0);
  assert.equal(empty.releasedCount, 0);
  assert.equal(empty.disputedCount, 0);
  assert.equal(empty.receiptCount, 0);
  assert.equal(empty.jobCount, 0);
  assert.equal(empty.payerCredits, 0);
  assert.equal(empty.agentCredits, 0);

  const fromEmptyLists = summarizeLedger({
    receipts: [],
    jobs: [],
    payerCredits: 0,
    agentCredits: 0,
  });
  assert.deepEqual(fromEmptyLists, empty);
});

test("ledger totals sum fixture receipts and current client-held balances", () => {
  const released = fixtureReceipt();
  const otherReleased = fixtureReceipt({
    id: "as_aaaaaaaaaa",
    title: "Code review",
    amount: 40,
    fee: 2,
    agentPayout: 38,
    releaseNote: "Looks good.",
  });
  const disputed = fixtureReceipt({
    id: "as_bbbbbbbbbb",
    title: "Data extract",
    status: "disputed",
    amount: 50,
    fee: 0,
    agentPayout: 0,
    disputeReason: "Missing rows.",
  });

  const totals = summarizeLedger({
    receipts: [released, otherReleased, disputed, { status: "open" }],
    jobs: [releasedJob(), releasedJob({ id: "as_cccccccccc", status: "funded", fee: 0, agentPayout: 0 })],
    payerCredits: 25,
    agentCredits: 133,
  });

  assert.equal(totals.money, false);
  assert.equal(totals.mode, "demo");
  assert.equal(totals.feesPaid, 7);
  assert.equal(totals.agentPayouts, 133);
  assert.equal(totals.disputedReturns, 50);
  assert.equal(totals.releasedCount, 2);
  assert.equal(totals.disputedCount, 1);
  assert.equal(totals.receiptCount, 3);
  assert.equal(totals.jobCount, 2);
  assert.equal(totals.payerCredits, 25);
  assert.equal(totals.agentCredits, 133);
});

test("released agent_credits_delta and disputed amount aliases feed the same totals", () => {
  const released = fixtureReceipt();
  const viaDelta = {
    ...released,
    job_id: "as_dddddddddd",
    title: "Delta alias",
    agent_payout: undefined,
    agent_credits_delta: 95,
  };
  delete viaDelta.agent_payout;
  const disputedAlias = {
    job_id: "as_eeeeeeeeee",
    title: "Dispute alias",
    status: "disputed",
    amount: 20,
    release_fee: 0,
    success_criteria: "Done",
    proof: "",
    created: NOW,
    funded: NOW,
    submitted: NOW,
    resolved: NOW,
  };

  const totals = summarizeLedger({
    receipts: [viaDelta, disputedAlias],
    payer_credits: 8,
    agent_credits: 95,
  });
  assert.equal(totals.feesPaid, 5);
  assert.equal(totals.agentPayouts, 95);
  assert.equal(totals.disputedReturns, 20);
  assert.equal(totals.releasedCount, 1);
  assert.equal(totals.disputedCount, 1);
  assert.equal(totals.payerCredits, 8);
  assert.equal(totals.agentCredits, 95);
});

test("CSV export has a header row and receipt money fields", () => {
  assert.equal(FILENAME, "liberty-ledger-receipts.csv");
  assert.deepEqual(CSV_COLUMNS, [
    "job_id",
    "title",
    "status",
    "amount",
    "release_fee",
    "agent_payout",
    "returned_to_payer",
    "created",
    "funded",
    "submitted",
    "resolved",
    "client_ref",
    "callback_url",
    "proof_note",
    "release_note",
    "dispute_reason",
    "key_id",
  ]);

  const empty = exportReceiptsCsv([]);
  assert.equal(empty.ok, true);
  assert.equal(empty.filename, FILENAME);
  assert.equal(empty.money, false);
  assert.equal(empty.mode, "demo");
  assert.equal(empty.receiptCount, 0);
  assert.equal(empty.text, `${CSV_COLUMNS.join(",")}\n`);

  const released = fixtureReceipt({
    clientRef: "agent-job-42",
    callbackUrl: "https://your-adapter.example/notify",
    proofNote: "Three-bullet brief attached.",
    releaseNote: "Proof matches, see \"notes\".",
  });
  const disputed = fixtureReceipt({
    id: "as_ffffffffff",
    title: "Filing, summary",
    status: "disputed",
    fee: 0,
    agentPayout: 0,
    disputeReason: "Not done.",
  });
  const csv = exportReceiptsCsv([released, disputed, { status: "open" }]);
  assert.equal(csv.ok, true);
  assert.equal(csv.receiptCount, 2);
  const lines = csv.text.trimEnd().split("\n");
  assert.equal(lines[0], CSV_COLUMNS.join(","));
  assert.equal(lines.length, 3);

  const releasedRow = lines[1];
  assert.match(releasedRow, /^as_0123456789,/);
  assert.match(releasedRow, /,released,/);
  assert.match(releasedRow, /,100,5,95,0,/);
  assert.match(releasedRow, /,agent-job-42,/);
  assert.match(releasedRow, /,"Proof matches, see ""notes""\.",,/);

  const disputedRow = lines[2];
  assert.match(disputedRow, /^as_ffffffffff,/);
  assert.match(disputedRow, /,"Filing, summary",disputed,100,0,0,100,/);
  assert.match(disputedRow, /,Not done.,$/);
});
