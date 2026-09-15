"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AGENT_KEY,
  DEMO_KEY,
  FILENAME,
  KIND,
  PAYER_KEY,
  RECEIPTS_KEY,
  STORAGE_KEYS,
  VERSION,
  confirmMessage,
  encodePack,
  readPack,
  storageWrites,
} = require("../demo-pack");
const { receiptFromJob } = require("../receipt-export");

const NOW = "2026-09-15T07:00:00.000Z";
const DEMO_KEY_VALUE = "lib_demo_" + "ab".repeat(16);

function sampleJob(overrides) {
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
  const parsed = receiptFromJob(sampleJob(overrides));
  assert.equal(parsed.ok, true);
  return parsed.receipt;
}

function sampleSource(overrides) {
  return {
    payer: { credits: 40, jobs: [sampleJob()] },
    agent_credits: 95,
    receipts: [sampleReceipt()],
    ...overrides,
  };
}

test("storage keys match the Settlement localStorage names", () => {
  assert.equal(PAYER_KEY, "liberty.agent-settlement.v0");
  assert.equal(AGENT_KEY, "liberty.agent-settlement.agent-credits.v0");
  assert.equal(RECEIPTS_KEY, "liberty.agent-settlement.receipts.v0");
  assert.equal(DEMO_KEY, "liberty.agent-settlement.demo-key.v0");
  assert.deepEqual(STORAGE_KEYS, [PAYER_KEY, AGENT_KEY, RECEIPTS_KEY, DEMO_KEY]);
  assert.equal(VERSION, 1);
  assert.equal(KIND, "liberty-agent-settlement-demo-pack");
  assert.equal(FILENAME, "liberty-demo-pack.json");
});

test("encode/decode round-trips payer, agent, jobs, and receipts without a demo key", () => {
  const encoded = encodePack(sampleSource(), { exportedAt: NOW });
  assert.equal(encoded.ok, true);
  assert.equal(encoded.containsDemoKey, false);
  assert.equal(encoded.pack.money, false);
  assert.equal(encoded.pack.version, 1);
  assert.equal(encoded.pack.kind, KIND);
  assert.equal(encoded.pack.exportedAt, NOW);
  assert.equal(encoded.pack.demo_key, null);
  assert.equal(encoded.pack.keys[DEMO_KEY], undefined);
  assert.deepEqual(encoded.pack.keys[PAYER_KEY].jobs[0].id, "as_0123456789");
  assert.equal(encoded.pack.keys[AGENT_KEY].credits, 95);
  assert.equal(encoded.pack.keys[RECEIPTS_KEY][0].agent_payout, 95);
  assert.match(encoded.text, /"money": false/);

  const decoded = readPack(encoded.text);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.containsDemoKey, false);
  assert.deepEqual(decoded.pack.payer, encoded.pack.payer);
  assert.equal(decoded.pack.agent_credits, 95);
  assert.equal(decoded.pack.receipts.length, 1);
  assert.equal(decoded.pack.receipts[0].job_id, "as_0123456789");
});

test("demo key is included only when already present", () => {
  const without = encodePack(sampleSource());
  assert.equal(without.ok, true);
  assert.equal(without.containsDemoKey, false);

  const withKey = encodePack(sampleSource({
    demo_key: { key: DEMO_KEY_VALUE, mintedAt: NOW },
  }));
  assert.equal(withKey.ok, true);
  assert.equal(withKey.containsDemoKey, true);
  assert.equal(withKey.pack.demo_key.key, DEMO_KEY_VALUE);
  assert.equal(withKey.pack.keys[DEMO_KEY].key, DEMO_KEY_VALUE);

  const decoded = readPack(withKey.pack);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.containsDemoKey, true);
  assert.equal(decoded.pack.demo_key.key, DEMO_KEY_VALUE);
});

test("readPack rejects bad shape, money, and version", () => {
  assert.equal(readPack("").ok, false);
  assert.equal(readPack("{not json").ok, false);
  assert.equal(readPack([]).ok, false);
  assert.equal(readPack({ version: 1, money: false }).ok, false);

  const encoded = encodePack(sampleSource());
  assert.equal(readPack({ ...encoded.pack, kind: "other" }).ok, false);
  assert.equal(readPack({ ...encoded.pack, version: 2 }).ok, false);
  assert.equal(readPack({ ...encoded.pack, money: true }).ok, false);
  assert.equal(readPack({ ...encoded.pack, money: undefined }).ok, false);
});

test("readPack rejects invalid jobs, receipts, credits, and unknown keys", () => {
  const encoded = encodePack(sampleSource());
  const pack = encoded.pack;

  const badJob = structuredClone(pack);
  badJob.keys[PAYER_KEY].jobs[0].id = "nope";
  assert.equal(readPack(badJob).ok, false);

  const badReceipt = structuredClone(pack);
  badReceipt.keys[RECEIPTS_KEY][0].status = "open";
  assert.equal(readPack(badReceipt).ok, false);

  const badCredits = structuredClone(pack);
  badCredits.keys[PAYER_KEY].credits = -4;
  assert.equal(readPack(badCredits).ok, false);

  const unknown = structuredClone(pack);
  unknown.keys["liberty.agent-settlement.secret.v0"] = { nope: true };
  assert.match(readPack(unknown).message, /unknown storage key/i);

  const badKey = encodePack(sampleSource({ demo_key: { key: "not-a-demo-key" } }));
  assert.equal(badKey.ok, false);
});

test("replace writes known keys and clears a missing demo key", () => {
  const without = storageWrites(encodePack(sampleSource(), { exportedAt: NOW }).pack);
  assert.equal(without.ok, true);
  assert.equal(without.containsDemoKey, false);
  assert.deepEqual(JSON.parse(without.writes[PAYER_KEY]).credits, 40);
  assert.deepEqual(JSON.parse(without.writes[AGENT_KEY]), { credits: 95 });
  assert.equal(JSON.parse(without.writes[RECEIPTS_KEY]).length, 1);
  assert.equal(without.writes[DEMO_KEY], undefined);
  assert.deepEqual(without.removes, [DEMO_KEY]);

  const withKey = storageWrites(encodePack(sampleSource({
    demo_key: { key: DEMO_KEY_VALUE, mintedAt: NOW },
  })).pack);
  assert.equal(withKey.ok, true);
  assert.equal(JSON.parse(withKey.writes[DEMO_KEY]).key, DEMO_KEY_VALUE);
  assert.deepEqual(withKey.removes, []);
});

test("confirm message is explicit replace and warns about a raw demo key", () => {
  const withKey = confirmMessage(encodePack(sampleSource({
    demo_key: { key: DEMO_KEY_VALUE },
  })).pack);
  assert.equal(withKey.ok, true);
  assert.match(withKey.message, /replace/i);
  assert.match(withKey.message, /does not merge/i);
  assert.match(withKey.message, /raw key/i);
  assert.match(withKey.message, /does not receive/i);
  assert.equal(withKey.containsDemoKey, true);

  const without = confirmMessage(encodePack(sampleSource()).pack);
  assert.equal(without.ok, true);
  assert.match(without.message, /key will be cleared/i);
  assert.equal(without.containsDemoKey, false);
});

test("optional receiptKeyId survives encode/decode", () => {
  const encoded = encodePack(sampleSource({
    payer: { credits: 0, jobs: [sampleJob({ receiptKeyId: "k_deadbeef0001" })] },
  }));
  assert.equal(encoded.ok, true);
  assert.equal(encoded.pack.payer.jobs[0].receiptKeyId, "k_deadbeef0001");
  const decoded = readPack(encoded.text);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.pack.payer.jobs[0].receiptKeyId, "k_deadbeef0001");
});
