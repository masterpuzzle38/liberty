"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PREFIX,
  buildHandoffHref,
  decodeHandoff,
  decodeHandoffInput,
  encodeHandoff,
  extractHandoffToken,
  nextActions,
  readLocationHandoff,
} = require("../job-handoff");
const { transition } = require("../api/_lib/settlement-transition");

const NOW = "2026-09-14T22:00:00.000Z";

function sampleJob(overrides) {
  return {
    id: "as_0123456789",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    proofUrl: "",
    status: "funded",
    createdAt: NOW,
    fundedAt: NOW,
    submittedAt: null,
    resolvedAt: null,
    fee: 0,
    agentPayout: 0,
    ...overrides,
  };
}

test("encode/decode round-trips a job and names the next legal actions", () => {
  const job = sampleJob();
  const encoded = encodeHandoff(job);
  assert.equal(encoded.ok, true);
  assert.equal(encoded.token.startsWith(PREFIX), true);
  assert.equal(encoded.token.includes("+"), false);
  assert.equal(encoded.token.includes("/"), false);
  assert.deepEqual(encoded.next, ["submit"]);
  assert.deepEqual(nextActions("open"), ["fund"]);
  assert.deepEqual(nextActions("submitted"), ["release", "dispute"]);
  assert.deepEqual(nextActions("released"), []);

  const decoded = decodeHandoff(encoded.token);
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.job, job);
  assert.deepEqual(decoded.next, ["submit"]);
});

test("handoff keeps optional terminal notes on a released job", () => {
  const job = sampleJob({
    status: "released",
    proofUrl: "https://example.com/proof",
    submittedAt: NOW,
    resolvedAt: NOW,
    fee: 5,
    agentPayout: 95,
    releaseNote: "Looks good.",
  });
  const encoded = encodeHandoff(job);
  assert.equal(encoded.ok, true);
  const raw = Buffer.from(encoded.token.slice(PREFIX.length), "base64url").toString("utf8");
  const payload = JSON.parse(raw);
  assert.equal(payload.job.rn, "Looks good.");
  assert.equal(payload.job.releaseNote, undefined);
  const decoded = decodeHandoff(encoded.token);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.job.releaseNote, "Looks good.");
});

test("handoff payload is compact and does not include credits or API keys", () => {
  const encoded = encodeHandoff(sampleJob({
    receiptKeyId: "k_deadbeef0000",
    credits: 999,
  }));
  const raw = Buffer.from(encoded.token.slice(PREFIX.length), "base64url").toString("utf8");
  assert.equal(raw.includes("receiptKeyId"), false);
  assert.equal(raw.includes("credits"), false);
  assert.equal(raw.includes("lib_demo_"), false);
  assert.equal(raw.includes("Authorization"), false);
  const payload = JSON.parse(raw);
  assert.equal(payload.v, 1);
  assert.equal(payload.job.s, "funded");
  assert.equal(payload.job.t, "Summarize filings");
  assert.equal(payload.job.a, 100);
});

test("decode accepts full job keys, snake_case, and compact short keys", () => {
  const funded = encodeHandoff(sampleJob());
  assert.equal(decodeHandoff(funded.token).job.status, "funded");

  const snake = encodeHandoff({
    id: "as_abcdef0123",
    title: "Snake",
    amount: 20,
    criteria: "Done",
    proof_url: "https://example.com/proof",
    status: "submitted",
    created_at: NOW,
    funded_at: NOW,
    submitted_at: NOW,
    resolved_at: null,
    fee: 0,
    agent_payout: 0,
  });
  assert.equal(snake.ok, true);
  assert.equal(snake.job.proofUrl, "https://example.com/proof");
  assert.equal(snake.job.agentPayout, 0);
  assert.deepEqual(decodeHandoff(snake.token).next, ["release", "dispute"]);
});

test("released jobs keep fee math so the other browser can show the receipt", () => {
  const released = sampleJob({
    status: "released",
    proofUrl: "https://example.com/proof",
    submittedAt: NOW,
    resolvedAt: NOW,
    fee: 5,
    agentPayout: 95,
  });
  const decoded = decodeHandoff(encodeHandoff(released).token);
  assert.equal(decoded.job.fee, 5);
  assert.equal(decoded.job.agentPayout, 95);
  assert.deepEqual(decoded.next, []);
});

test("rejects invalid tokens and jobs", () => {
  assert.equal(encodeHandoff(null).ok, false);
  assert.equal(encodeHandoff({ ...sampleJob(), id: "nope" }).error, "invalid_job");
  assert.equal(encodeHandoff({ ...sampleJob(), title: "x".repeat(81) }).ok, false);
  assert.equal(encodeHandoff({ ...sampleJob(), amount: 1.5 }).ok, false);
  assert.equal(decodeHandoff("not-a-token").error, "invalid_handoff");
  assert.equal(decodeHandoff("h1.").error, "invalid_handoff");
  assert.equal(decodeHandoff("h1.@@@").error, "invalid_handoff");
  const badVersion = PREFIX + Buffer.from(JSON.stringify({ v: 99, job: sampleJob() })).toString("base64url");
  assert.equal(decodeHandoff(badVersion).error, "invalid_handoff");
});

test("extracts a token from hash URLs, query URLs, and raw codes", () => {
  const token = encodeHandoff(sampleJob()).token;
  const href = `https://liberty-amber.vercel.app/#handoff/${token}`;
  const query = `https://liberty-amber.vercel.app/?handoff=${token}`;
  assert.equal(extractHandoffToken(href), token);
  assert.equal(extractHandoffToken(query), token);
  assert.equal(extractHandoffToken(`#handoff/${token}`), token);
  assert.equal(extractHandoffToken(token), token);
  assert.equal(extractHandoffToken("  "), "");
  assert.equal(decodeHandoffInput(href).ok, true);
  assert.equal(decodeHandoffInput(query).job.id, "as_0123456789");
  assert.equal(buildHandoffHref(sampleJob(), "https://liberty-amber.vercel.app/").href, href);
  assert.equal(readLocationHandoff({ hash: `#handoff/${token}`, search: "" }), token);
  assert.equal(readLocationHandoff({ hash: "", search: `?handoff=${token}` }), token);
  assert.equal(readLocationHandoff({ hash: "#job/as_0123456789", search: "" }), "");
});

test("a handed-off job can still take the next transition", () => {
  const funded = decodeHandoff(encodeHandoff(sampleJob()).token).job;
  const submitted = transition({
    action: "submit",
    job: funded,
    proof_url: "https://example.com/proof",
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.ok, true);
  assert.equal(submitted.body.job.status, "submitted");

  const snapshot = decodeHandoff(encodeHandoff(submitted.body.job).token).job;
  const released = transition({ action: "release", job: snapshot });
  assert.equal(released.status, 200);
  assert.equal(released.body.job.status, "released");
  assert.equal(released.body.fee, 5);
  assert.equal(released.body.money, false);
});

test("protocol files describe client-held handoff and stay valid JSON", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..");
  const settlement = JSON.parse(fs.readFileSync(path.join(root, "api/_lib/settlement.json"), "utf8"));
  const openapi = JSON.parse(fs.readFileSync(path.join(root, "settlement.openapi.json"), "utf8"));
  assert.equal(settlement.money, false);
  assert.equal(settlement.handoff.persistence, false);
  assert.equal(settlement.handoff.money, false);
  assert.equal(settlement.handoff.hash, "#handoff/<token>");
  assert.ok(settlement.adapter_notes.some((note) => note.includes("handoff")));
  assert.ok(openapi.components.schemas.JobHandoff);
  assert.equal(openapi.components.schemas.JobHandoff.properties.v.const, 1);
});
