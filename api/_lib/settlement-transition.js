"use strict";

const crypto = require("crypto");

const FEE_RATE = 0.05;
const JOB_ID_PATTERN = /^as_[0-9a-f]{10}$/;
const ACTIONS = ["create", "fund", "submit", "release", "dispute"];
const STATUSES = ["open", "funded", "submitted", "released", "disputed"];
const EXPECTED_FROM = {
  fund: "open",
  submit: "funded",
  release: "submitted",
  dispute: "submitted",
};

function releaseFee(amount) {
  return Math.round(amount * FEE_RATE);
}

function makeId() {
  return `as_${crypto.randomBytes(5).toString("hex")}`;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

const CORS_ALLOW_HEADERS = "Content-Type, Authorization, X-Liberty-Key";
const KEY_ID_HEX_LEN = 12;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  };
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== target) continue;
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === "string" ? raw.trim() : "";
  }
  return "";
}

function readRawDemoKey(headers) {
  const explicit = headerValue(headers, "x-liberty-key");
  if (explicit) return explicit;
  const authorization = headerValue(headers, "authorization");
  const match = authorization.match(/^Bearer\s+(\S+)/i);
  return match ? match[1] : "";
}

function keyIdFromSecret(secret) {
  const digest = crypto.createHash("sha256").update(secret, "utf8").digest("hex");
  return `k_${digest.slice(0, KEY_ID_HEX_LEN)}`;
}

function readDemoAuth(headers) {
  const secret = readRawDemoKey(headers);
  if (!secret) {
    return {
      required: false,
      mode: "demo",
      status: "key_optional",
    };
  }
  return {
    required: false,
    mode: "demo",
    status: "accepted",
    key_id: keyIdFromSecret(secret),
  };
}

function applyDemoAuth(body, headers) {
  if (!body || typeof body !== "object") return body;
  const auth = readDemoAuth(headers);
  const next = { ...body, auth };
  if (auth.key_id) {
    next.key_id = auth.key_id;
    if (body.receipt && typeof body.receipt === "object") {
      next.receipt = { ...body.receipt, key_id: auth.key_id };
    }
  } else {
    next.key_optional = true;
  }
  return next;
}

function fail(status, error, message, extra) {
  return {
    status,
    body: {
      ok: false,
      mode: "demo",
      money: false,
      error,
      message,
      ...(extra || {}),
    },
  };
}

function ok(extra) {
  return {
    status: 200,
    body: {
      ok: true,
      mode: "demo",
      money: false,
      ...(extra || {}),
    },
  };
}

function readInteger(value, field, { min }) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    return {
      error: fail(400, "invalid_field", `${field} must be an integer >= ${min}.`, { field }),
    };
  }
  return { value };
}

function readCredits(value, field, required) {
  if (value === undefined) {
    if (required) {
      return {
        error: fail(400, "missing_field", `${field} is required.`, { field }),
      };
    }
    return { value: undefined };
  }
  return readInteger(value, field, { min: 0 });
}

function readText(value, field, { maxLength, required }) {
  if (typeof value !== "string") {
    return {
      error: fail(
        400,
        required ? "missing_field" : "invalid_field",
        `${field} must be a string.`,
        { field },
      ),
    };
  }
  const text = value.trim();
  if (!text) {
    return {
      error: fail(400, "missing_field", `${field} is required.`, { field }),
    };
  }
  if (maxLength && text.length > maxLength) {
    return {
      error: fail(400, "invalid_field", `${field} must be at most ${maxLength} characters.`, {
        field,
      }),
    };
  }
  return { value: text };
}

function readJob(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      error: fail(400, "missing_field", "Send the current job object.", { field: "job" }),
    };
  }

  if (typeof raw.id !== "string" || !JOB_ID_PATTERN.test(raw.id)) {
    return {
      error: fail(400, "invalid_field", "job.id must match as_ plus 10 hex characters.", {
        field: "job.id",
      }),
    };
  }

  const title = readText(raw.title, "job.title", { maxLength: 80, required: true });
  if (title.error) return title;

  const amount = readInteger(raw.amount, "job.amount", { min: 1 });
  if (amount.error) return amount;

  const criteria = readText(raw.criteria, "job.criteria", { required: true });
  if (criteria.error) return criteria;

  if (typeof raw.status !== "string" || !STATUSES.includes(raw.status)) {
    return {
      error: fail(400, "invalid_field", "job.status must be a known settlement state.", {
        field: "job.status",
      }),
    };
  }

  const createdAt = firstDefined(raw.createdAt, raw.created_at);
  if (typeof createdAt !== "string" || !createdAt.trim()) {
    return {
      error: fail(400, "invalid_field", "job.createdAt is required.", { field: "job.createdAt" }),
    };
  }

  const proofRaw = firstDefined(raw.proofUrl, raw.proof_url, "");
  if (typeof proofRaw !== "string") {
    return {
      error: fail(400, "invalid_field", "job.proofUrl must be a string.", { field: "job.proofUrl" }),
    };
  }

  return {
    value: {
      id: raw.id,
      title: title.value,
      amount: amount.value,
      criteria: criteria.value,
      proofUrl: proofRaw,
      status: raw.status,
      createdAt: createdAt.trim(),
      fundedAt: firstDefined(raw.fundedAt, raw.funded_at, null),
      submittedAt: firstDefined(raw.submittedAt, raw.submitted_at, null),
      resolvedAt: firstDefined(raw.resolvedAt, raw.resolved_at, null),
      fee: 0,
      agentPayout: 0,
    },
  };
}

function requireStatus(job, action) {
  const expected = EXPECTED_FROM[action];
  if (job.status === expected) return null;
  return fail(
    409,
    "illegal_transition",
    `Cannot ${action} a job in status ${job.status}. ${action} requires status ${expected}.`,
    { action, from: job.status, expected },
  );
}

function receiptFromJob(job) {
  const released = job.status === "released";
  const disputed = job.status === "disputed";
  return {
    job_id: job.id,
    title: job.title,
    status: job.status,
    amount: job.amount,
    release_fee: released ? job.fee : 0,
    agent_payout: released ? job.agentPayout : 0,
    returned_to_payer: disputed ? job.amount : 0,
    success_criteria: job.criteria,
    proof: job.proofUrl || "",
    created: job.createdAt,
    funded: job.fundedAt,
    submitted: job.submittedAt,
    resolved: job.resolvedAt,
  };
}

function discovery() {
  return {
    service: "liberty-agent-settlement",
    mode: "demo",
    money: false,
    path: "/api/v0/transition",
    methods: ["POST", "OPTIONS"],
    auth: {
      required: false,
      mode: "demo",
      headers: ["Authorization: Bearer <key>", "X-Liberty-Key"],
      key_id: "sha256 hex prefix (k_ + 12 chars). Raw key is never stored.",
      missing: "key_optional",
    },
    persistence: false,
    actions: ACTIONS,
    note: "Stateless demo engine. Client holds the job and credits. Liberty returns the next state and fee math. Not live escrow custody. Optional demo API key identifies the adapter; omit it and the route still works (key_optional). Not production auth.",
    protocol: "/api/settlement.json",
  };
}

function transition(input, options) {
  const opts = options || {};
  const now = opts.now || (() => new Date().toISOString());
  const idFactory = opts.makeId || makeId;

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail(400, "invalid_json", "Body must be a JSON object.");
  }

  const action = input.action;
  if (typeof action !== "string" || !ACTIONS.includes(action)) {
    return fail(400, "invalid_action", "action must be create, fund, submit, release, or dispute.", {
      actions: ACTIONS,
    });
  }

  const stamp = now();

  if (action === "create") {
    const title = readText(input.title, "title", { maxLength: 80, required: true });
    if (title.error) return title.error;
    const amount = readInteger(input.amount, "amount", { min: 1 });
    if (amount.error) return amount.error;
    const criteria = readText(input.criteria, "criteria", { required: true });
    if (criteria.error) return criteria.error;

    const job = {
      id: idFactory(),
      title: title.value,
      amount: amount.value,
      criteria: criteria.value,
      proofUrl: "",
      status: "open",
      createdAt: stamp,
      fundedAt: null,
      submittedAt: null,
      resolvedAt: null,
      fee: 0,
      agentPayout: 0,
    };
    return ok({ action, job });
  }

  const parsedJob = readJob(input.job);
  if (parsedJob.error) return parsedJob.error;
  const job = parsedJob.value;
  const blocked = requireStatus(job, action);
  if (blocked) return blocked;

  if (action === "fund") {
    const credits = readCredits(firstDefined(input.payer_credits, input.payerCredits), "payer_credits", true);
    if (credits.error) return credits.error;
    if (credits.value < job.amount) {
      return fail(
        409,
        "insufficient_credits",
        `Need ${job.amount} credits to fund. payer_credits is ${credits.value}.`,
        { action, needed: job.amount, payer_credits: credits.value },
      );
    }
    job.status = "funded";
    job.fundedAt = stamp;
    return ok({
      action,
      job,
      payer_credits: credits.value - job.amount,
    });
  }

  if (action === "submit") {
    const proof = readText(firstDefined(input.proof_url, input.proofUrl, job.proofUrl), "proof_url", {
      required: true,
    });
    if (proof.error) return proof.error;
    job.proofUrl = proof.value;
    job.status = "submitted";
    job.submittedAt = stamp;
    return ok({ action, job });
  }

  if (action === "release") {
    job.fee = releaseFee(job.amount);
    job.agentPayout = job.amount - job.fee;
    job.status = "released";
    job.resolvedAt = stamp;
    return ok({
      action,
      job,
      fee: job.fee,
      agent_payout: job.agentPayout,
      receipt: receiptFromJob(job),
    });
  }

  const credits = readCredits(firstDefined(input.payer_credits, input.payerCredits), "payer_credits", false);
  if (credits.error) return credits.error;
  job.fee = 0;
  job.agentPayout = 0;
  job.status = "disputed";
  job.resolvedAt = stamp;
  const body = {
    action,
    job,
    fee: 0,
    agent_payout: 0,
    returned_to_payer: job.amount,
    receipt: receiptFromJob(job),
  };
  if (credits.value !== undefined) {
    body.payer_credits = credits.value + job.amount;
  }
  return ok(body);
}

function handleHttp({ method, body, headers }) {
  const cors = corsHeaders();
  const verb = (method || "").toUpperCase();

  if (verb === "OPTIONS") {
    return { status: 204, headers: cors, body: null };
  }

  if (verb === "GET") {
    return {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: discovery(),
    };
  }

  if (verb !== "POST") {
    return {
      status: 405,
      headers: { ...cors, Allow: "POST, OPTIONS, GET", "Content-Type": "application/json" },
      body: applyDemoAuth(
        fail(
          405,
          "method_not_allowed",
          "POST JSON to this path. GET the protocol at /api/settlement.json.",
        ).body,
        headers,
      ),
    };
  }

  const result = transition(body);
  return {
    status: result.status,
    headers: { ...cors, "Content-Type": "application/json" },
    body: applyDemoAuth(result.body, headers),
  };
}

module.exports = {
  ACTIONS,
  CORS_ALLOW_HEADERS,
  FEE_RATE,
  JOB_ID_PATTERN,
  STATUSES,
  applyDemoAuth,
  corsHeaders,
  discovery,
  handleHttp,
  keyIdFromSecret,
  readDemoAuth,
  receiptFromJob,
  releaseFee,
  transition,
};
