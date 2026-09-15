"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CORS_ALLOW_HEADERS,
  handleHttp,
  quote,
  transition,
} = require("../api/_lib/settlement-transition");

const NOW = "2026-09-14T23:50:00.000Z";
const OPTIONS = { now: () => NOW, makeId: () => "as_0123456789" };

function commit(input) {
  return transition(input, OPTIONS);
}

function preview(input) {
  return quote(input, OPTIONS);
}

function withoutQuoteOnly(body) {
  const next = { ...body };
  delete next.quoted;
  delete next.payer_credits_after;
  return next;
}

function createOpen() {
  return commit({
    action: "create",
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
  }).body.job;
}

test("create quote validates fields but does not assign a durable id", () => {
  const quoted = preview({
    action: "create",
    title: "  Summarize filings ",
    amount: 100,
    criteria: " Three-bullet brief matching the last three filings. ",
  });
  const committed = commit({
    action: "create",
    title: "  Summarize filings ",
    amount: 100,
    criteria: " Three-bullet brief matching the last three filings. ",
  });

  assert.equal(quoted.status, 200);
  assert.equal(quoted.body.ok, true);
  assert.equal(quoted.body.mode, "demo");
  assert.equal(quoted.body.money, false);
  assert.equal(quoted.body.quoted, true);
  assert.equal(quoted.body.job.id, undefined);
  assert.equal(quoted.body.job.status, "open");
  assert.equal(quoted.body.job.title, committed.body.job.title);
  assert.equal(quoted.body.job.amount, committed.body.job.amount);
  assert.equal(quoted.body.job.criteria, committed.body.job.criteria);
  assert.equal(quoted.body.job.createdAt, NOW);
  assert.equal(committed.body.job.id, "as_0123456789");
  assert.equal(committed.body.quoted, undefined);

  const skippedId = quote(
    { action: "create", title: "No id", amount: 2, criteria: "C" },
    {
      now: () => NOW,
      makeId: () => {
        throw new Error("create quote must not assign an id");
      },
    },
  );
  assert.equal(skippedId.status, 200);
  assert.equal(skippedId.body.job.id, undefined);
});

test("quote and transition share fee, payout, and credit math on happy paths", () => {
  const open = createOpen();

  const fundInput = { action: "fund", job: open, payer_credits: 150 };
  const fundQuote = preview(fundInput);
  const funded = commit(fundInput);
  assert.deepEqual(withoutQuoteOnly(fundQuote.body), funded.body);
  assert.equal(fundQuote.body.payer_credits_after, 50);
  assert.equal(fundQuote.body.job.status, "funded");
  assert.equal(funded.body.quoted, undefined);

  const submitInput = {
    action: "submit",
    job: funded.body.job,
    proof_url: "https://example.com/proof",
  };
  const submitQuote = preview(submitInput);
  const submitted = commit(submitInput);
  assert.deepEqual(withoutQuoteOnly(submitQuote.body), submitted.body);

  const releaseInput = { action: "release", job: submitted.body.job };
  const releaseQuote = preview(releaseInput);
  const released = commit(releaseInput);
  assert.deepEqual(withoutQuoteOnly(releaseQuote.body), released.body);
  assert.equal(releaseQuote.body.fee, 5);
  assert.equal(releaseQuote.body.agent_payout, 95);
  assert.equal(releaseQuote.body.job.status, "released");

  const disputeInput = { action: "dispute", job: submitted.body.job, payer_credits: 0 };
  const disputeQuote = preview(disputeInput);
  const disputed = commit(disputeInput);
  assert.deepEqual(withoutQuoteOnly(disputeQuote.body), disputed.body);
  assert.equal(disputeQuote.body.returned_to_payer, 100);
  assert.equal(disputeQuote.body.payer_credits_after, 100);
  assert.equal(disputeQuote.body.fee, 0);
});

test("illegal quote matches illegal transition and does not invent a next job", () => {
  const open = createOpen();
  const funded = commit({ action: "fund", job: open, payer_credits: 100 }).body.job;
  const input = { action: "release", job: funded };
  const quoted = preview(input);
  const committed = commit(input);
  assert.equal(quoted.status, 409);
  assert.equal(committed.status, 409);
  assert.deepEqual(quoted.body, committed.body);
  assert.equal(quoted.body.error, "illegal_transition");
  assert.equal(quoted.body.money, false);
  assert.equal(quoted.body.mode, "demo");
  assert.equal(quoted.body.from, "funded");
  assert.equal(quoted.body.expected, "submitted");
  assert.equal(quoted.body.job, undefined);
});

test("quote HTTP wrapper: OPTIONS, GET discovery, POST dry-run, and 405", () => {
  const options = handleHttp({ method: "OPTIONS", body: null, dryRun: true });
  assert.equal(options.status, 204);
  assert.equal(options.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(options.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(options.body, null);

  const get = handleHttp({ method: "GET", body: null, dryRun: true });
  assert.equal(get.status, 200);
  assert.equal(get.body.path, "/api/v0/quote");
  assert.equal(get.body.dry_run, true);
  assert.equal(get.body.money, false);
  assert.equal(get.body.persistence, false);
  assert.equal(get.body.commit, "/api/v0/transition");

  const posted = handleHttp({
    method: "POST",
    dryRun: true,
    body: { action: "create", title: "T", amount: 2, criteria: "C" },
  });
  assert.equal(posted.status, 200);
  assert.equal(posted.body.quoted, true);
  assert.equal(posted.body.money, false);
  assert.equal(posted.body.job.id, undefined);
  assert.equal(posted.body.job.status, "open");
  assert.equal(posted.body.key_optional, true);

  const put = handleHttp({ method: "PUT", body: {}, dryRun: true });
  assert.equal(put.status, 405);
  assert.equal(put.body.money, false);
});

test("quote Vercel handler uses the same engine and never assigns a create id", async () => {
  const handler = require("../api/v0/quote");
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
  assert.equal(res.body.quoted, true);
  assert.equal(res.body.money, false);
  assert.equal(res.body.job.status, "open");
  assert.equal(res.body.job.id, undefined);
  assert.equal(res.body.key_optional, true);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(res.headers["Access-Control-Allow-Headers"], CORS_ALLOW_HEADERS);
});

test("protocol files describe quote next to transition", () => {
  const root = path.join(__dirname, "..");
  const settlement = JSON.parse(fs.readFileSync(path.join(root, "api/_lib/settlement.json"), "utf8"));
  const openapi = JSON.parse(fs.readFileSync(path.join(root, "settlement.openapi.json"), "utf8"));
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

  assert.equal(settlement.quote_api.path, "/api/v0/quote");
  assert.equal(settlement.quote_api.dry_run, true);
  assert.equal(settlement.quote_api.money, false);
  assert.equal(settlement.quote_api.engine, "/api/v0/transition");
  assert.ok(settlement.surfaces.quote);
  assert.ok(settlement.adapter_notes.some((note) => note.includes("/api/v0/quote")));
  assert.equal(settlement.receipt_export.persistence, false);
  assert.equal(settlement.receipt_export.money, false);
  assert.ok(openapi.paths["/api/v0/quote"].post);
  assert.equal(openapi.paths["/api/v0/quote"].post.operationId, "postQuote");

  const quoteHeaders = vercel.headers.find((row) => row.source === "/api/v0/quote");
  assert.equal(
    quoteHeaders.headers.find((h) => h.key === "Access-Control-Allow-Headers").value,
    CORS_ALLOW_HEADERS,
  );
});
