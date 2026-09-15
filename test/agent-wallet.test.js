"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  STORAGE_KEY,
  applyDelta,
  applyEngineResult,
  creditDeltaFromEngine,
  readCredits,
  writeCredits,
} = require("../agent-wallet");
const { simulate, transition } = require("../api/_lib/settlement-transition");

const NOW = "2026-09-15T04:00:00.000Z";
const OPTIONS = { now: () => NOW, makeId: () => "as_0123456789" };

test("agent wallet storage key and integer credits stay local", () => {
  assert.equal(STORAGE_KEY, "liberty.agent-settlement.agent-credits.v0");
  assert.equal(readCredits(null), 0);
  assert.equal(readCredits(""), 0);
  assert.equal(readCredits("{not json"), 0);
  assert.equal(readCredits({ credits: 12.8 }), 12);
  assert.equal(readCredits({ credits: -3 }), 0);
  assert.equal(readCredits(writeCredits(95)), 95);
  assert.equal(applyDelta(10, 95), 105);
  assert.equal(applyDelta("x", -4), 0);
});

test("release engine results credit the agent wallet; dispute does not", () => {
  const open = transition({
    action: "create",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
  }, OPTIONS).body.job;
  const funded = transition({ action: "fund", job: open, payer_credits: 100 }, OPTIONS).body.job;
  const submitted = transition({
    action: "submit",
    job: funded,
    proof_url: "https://example.com/proof",
  }, OPTIONS).body.job;

  const released = transition({ action: "release", job: submitted }, OPTIONS);
  assert.equal(released.body.agent_payout, 95);
  assert.equal(released.body.agent_credits_delta, 95);
  assert.equal(creditDeltaFromEngine(released.body), 95);
  assert.equal(applyEngineResult(5, released.body), 100);

  const disputed = transition({ action: "dispute", job: submitted, payer_credits: 0 }, OPTIONS);
  assert.equal(disputed.body.agent_payout, 0);
  assert.equal(disputed.body.agent_credits_delta, 0);
  assert.equal(disputed.body.returned_to_payer, 100);
  assert.equal(creditDeltaFromEngine(disputed.body), 0);
  assert.equal(applyEngineResult(40, disputed.body), 40);
});

test("simulate release credits the agent; simulate dispute does not", () => {
  const released = simulate({
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    payer_credits: 100,
    proof_url: "https://example.com/proof",
    terminal: "release",
  }, OPTIONS);
  assert.equal(released.body.agent_payout, 95);
  assert.equal(released.body.agent_credits_delta, 95);
  assert.equal(released.body.steps.at(-1).agent_credits_delta, 95);
  assert.equal(applyEngineResult(0, released.body), 95);

  const disputed = simulate({
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    payer_credits: 100,
    proof_url: "https://example.com/proof",
    terminal: "dispute",
  }, OPTIONS);
  assert.equal(disputed.body.agent_payout, 0);
  assert.equal(disputed.body.agent_credits_delta, 0);
  assert.equal(disputed.body.steps.at(-1).agent_credits_delta, 0);
  assert.equal(applyEngineResult(12, disputed.body), 12);
});

test("fallback uses agent_payout on released jobs when delta is omitted", () => {
  assert.equal(creditDeltaFromEngine({
    job: { status: "released", agentPayout: 19 },
    agent_payout: 19,
    receipt: { agent_payout: 19 },
  }), 19);
  assert.equal(creditDeltaFromEngine({
    job: { status: "disputed", agentPayout: 0 },
    agent_payout: 0,
    receipt: { agent_payout: 0 },
  }), 0);
  assert.equal(creditDeltaFromEngine({
    action: "create",
    job: { status: "open" },
  }), 0);
});
