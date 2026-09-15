"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  quote,
  simulate,
  transition,
  validate,
} = require("../api/_lib/settlement-transition");

const NOW = "2026-09-15T19:50:00.000Z";
const LATER = "2026-09-15T20:51:00.000Z";
const OPTIONS = { now: () => NOW, makeId: () => "as_0123456789" };

function createOpen() {
  return transition({
    action: "create",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
  }, OPTIONS).body.job;
}

function submitWithExpiry(extra) {
  const funded = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    ...extra,
  }, OPTIONS);
  assert.equal(funded.status, 200, funded.body && funded.body.message);
  const submitted = transition({
    action: "submit",
    job: funded.body.job,
    proof_url: "https://example.com/proof",
  }, OPTIONS);
  assert.equal(submitted.status, 200);
  return { funded, submitted: submitted.body.job };
}

test("fund stamps expiresAt from ttl_seconds", () => {
  const funded = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 150,
    ttl_seconds: 3600,
  }, OPTIONS);
  assert.equal(funded.status, 200);
  assert.equal(funded.body.money, false);
  assert.equal(funded.body.job.status, "funded");
  assert.equal(funded.body.job.fundedAt, NOW);
  assert.equal(funded.body.job.expiresAt, "2026-09-15T20:50:00.000Z");

  const camel = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    ttlSeconds: 60,
  }, OPTIONS);
  assert.equal(camel.body.job.expiresAt, "2026-09-15T19:51:00.000Z");

  const omitted = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
  }, OPTIONS);
  assert.equal(omitted.body.job.expiresAt, undefined);
});

test("fund stamps expiresAt from expires_at and rejects both fields together", () => {
  const stamped = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    expires_at: "2026-09-16T00:00:00Z",
  }, OPTIONS);
  assert.equal(stamped.status, 200);
  assert.equal(stamped.body.job.expiresAt, "2026-09-16T00:00:00.000Z");

  const conflict = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    expires_at: "2026-09-16T00:00:00.000Z",
    ttl_seconds: 3600,
  }, OPTIONS);
  assert.equal(conflict.status, 400);
  assert.equal(conflict.body.error, "invalid_field");
  assert.equal(conflict.body.field, "expires_at");
  assert.match(conflict.body.message, /not both/i);
  assert.equal(conflict.body.money, false);
});

test("fund rejects past, unparseable, and non-positive expiry inputs", () => {
  const past = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    expires_at: "2026-09-15T19:49:59.000Z",
  }, OPTIONS);
  assert.equal(past.status, 400);
  assert.equal(past.body.field, "expires_at");
  assert.match(past.body.message, /future/i);

  const sameInstant = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    expires_at: NOW,
  }, OPTIONS);
  assert.equal(sameInstant.status, 400);
  assert.equal(sameInstant.body.field, "expires_at");

  const junk = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    expires_at: "tomorrow",
  }, OPTIONS);
  assert.equal(junk.status, 400);
  assert.equal(junk.body.field, "expires_at");
  assert.match(junk.body.message, /ISO-8601/i);

  const dateOnly = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    expires_at: "2026-09-16",
  }, OPTIONS);
  assert.equal(dateOnly.status, 400);
  assert.equal(dateOnly.body.field, "expires_at");

  const zero = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    ttl_seconds: 0,
  }, OPTIONS);
  assert.equal(zero.status, 400);
  assert.equal(zero.body.field, "ttl_seconds");

  const negative = transition({
    action: "fund",
    job: createOpen(),
    payer_credits: 100,
    ttl_seconds: -30,
  }, OPTIONS);
  assert.equal(negative.status, 400);
  assert.equal(negative.body.field, "ttl_seconds");

  const late = transition({
    action: "create",
    title: "x",
    amount: 1,
    criteria: "done",
    ttl_seconds: 60,
  }, OPTIONS);
  assert.equal(late.status, 400);
  assert.equal(late.body.field, "ttl_seconds");
});

test("release after expiry fails; dispute after expiry still refunds", () => {
  const { submitted } = submitWithExpiry({ ttl_seconds: 3600 });
  assert.equal(submitted.expiresAt, "2026-09-15T20:50:00.000Z");

  const released = transition({ action: "release", job: submitted }, { now: () => LATER });
  assert.equal(released.status, 409);
  assert.equal(released.body.error, "hold_expired");
  assert.equal(released.body.field, "expiresAt");
  assert.equal(released.body.expiresAt, "2026-09-15T20:50:00.000Z");
  assert.equal(released.body.job, undefined);
  assert.equal(released.body.money, false);
  assert.match(released.body.message, /dispute remains allowed/i);

  const disputed = transition({
    action: "dispute",
    job: submitted,
    payer_credits: 0,
  }, { now: () => LATER });
  assert.equal(disputed.status, 200);
  assert.equal(disputed.body.job.status, "disputed");
  assert.equal(disputed.body.returned_to_payer, 100);
  assert.equal(disputed.body.job.expiresAt, "2026-09-15T20:50:00.000Z");
  assert.equal(disputed.body.fee, 0);
});

test("quote and validate agree with transition on expired release", () => {
  const { submitted } = submitWithExpiry({ ttl_seconds: 3600 });
  const later = { now: () => LATER };
  const releaseInput = { action: "release", job: submitted };
  const quoted = quote(releaseInput, later);
  const checked = validate(releaseInput, later);
  const committed = transition(releaseInput, later);

  assert.equal(quoted.status, 409);
  assert.equal(checked.status, 409);
  assert.equal(committed.status, 409);
  assert.equal(quoted.body.error, "hold_expired");
  assert.equal(checked.body.error, "hold_expired");
  assert.equal(committed.body.error, "hold_expired");
  assert.equal(quoted.body.field, "expiresAt");
  assert.equal(checked.body.field, "expiresAt");
  assert.equal(checked.body.validated, false);
  assert.equal(checked.body.kind, "state");
  assert.equal(quoted.body.quoted, undefined);
  assert.equal(checked.body.job, undefined);

  const disputeInput = { action: "dispute", job: submitted, payer_credits: 0 };
  const disputeQuote = quote(disputeInput, later);
  const disputeCheck = validate(disputeInput, later);
  assert.equal(disputeQuote.status, 200);
  assert.equal(disputeQuote.body.quoted, true);
  assert.equal(disputeQuote.body.job.status, "disputed");
  assert.equal(disputeCheck.status, 200);
  assert.equal(disputeCheck.body.validated, true);
});

test("simulate stamps expiresAt from ttl_seconds and blocks a late release", () => {
  const stamped = simulate({
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    payer_credits: 150,
    proof_url: "https://example.com/proof",
    ttl_seconds: 3600,
  }, OPTIONS);
  assert.equal(stamped.status, 200);
  assert.equal(stamped.body.job.expiresAt, "2026-09-15T20:50:00.000Z");
  assert.equal(stamped.body.steps[1].job.expiresAt, "2026-09-15T20:50:00.000Z");
  assert.equal(stamped.body.job.status, "released");

  const times = [NOW, NOW, NOW, LATER];
  let i = 0;
  const late = simulate({
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    payer_credits: 150,
    proof_url: "https://example.com/proof",
    ttl_seconds: 3600,
  }, { now: () => times[i++] || LATER, makeId: () => "as_0123456789" });
  assert.equal(late.status, 409);
  assert.equal(late.body.error, "hold_expired");
  assert.equal(late.body.field, "expiresAt");
  assert.equal(late.body.money, false);
});
