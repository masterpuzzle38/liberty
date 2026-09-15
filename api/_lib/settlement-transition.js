"use strict";

const crypto = require("crypto");

const FEE_RATE = 0.05;
const JOB_ID_PATTERN = /^as_[0-9a-f]{10}$/;
const ACTIONS = ["create", "fund", "submit", "release", "dispute"];
const VERIFY_ACTIONS = ["release", "dispute"];
const SIMULATE_TERMINALS = ["release", "dispute"];
const STATUSES = ["open", "funded", "submitted", "released", "disputed"];
const TERMINAL = ["released", "disputed"];
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
    if (Array.isArray(body.steps)) {
      next.steps = body.steps.map((step) => {
        if (!step || typeof step !== "object" || !step.receipt || typeof step.receipt !== "object") {
          return step;
        }
        return { ...step, receipt: { ...step.receipt, key_id: auth.key_id } };
      });
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

function moneyFromReceipt(receipt) {
  return {
    fee: receipt.release_fee,
    agent_payout: receipt.agent_payout,
    returned_to_payer: receipt.returned_to_payer,
  };
}

function looksLikeReceipt(raw) {
  return Boolean(
    raw
    && typeof raw === "object"
    && !Array.isArray(raw)
    && (typeof raw.job_id === "string" || typeof raw.jobId === "string"),
  );
}

function asSubmittedJob(job) {
  return {
    ...job,
    status: "submitted",
    resolvedAt: null,
    fee: 0,
    agentPayout: 0,
  };
}

function jobShapeFromReceipt(raw) {
  return {
    id: firstDefined(raw.job_id, raw.jobId, raw.id),
    title: raw.title,
    amount: raw.amount,
    criteria: firstDefined(raw.success_criteria, raw.successCriteria, raw.criteria),
    proofUrl: firstDefined(raw.proof, raw.proofUrl, raw.proof_url, ""),
    status: raw.status,
    createdAt: firstDefined(raw.created, raw.createdAt, raw.created_at),
    fundedAt: firstDefined(raw.funded, raw.fundedAt, raw.funded_at, null),
    submittedAt: firstDefined(raw.submitted, raw.submittedAt, raw.submitted_at, null),
    resolvedAt: firstDefined(raw.resolved, raw.resolvedAt, raw.resolved_at, null),
    fee: firstDefined(raw.release_fee, raw.releaseFee, raw.fee, 0),
    agentPayout: firstDefined(raw.agent_payout, raw.agentPayout, 0),
  };
}

function readClaimedMoney(source, { required } = {}) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return required
      ? { error: fail(400, "missing_field", "Send claimed fee fields on the receipt or job.", { field: "fee" }) }
      : { value: {} };
  }

  const rawFee = firstDefined(source.fee, source.release_fee, source.releaseFee);
  const rawPayout = firstDefined(source.agent_payout, source.agentPayout);
  const rawReturned = firstDefined(source.returned_to_payer, source.returnedToPayer);
  const claimed = {};

  const fee = readCredits(rawFee, "fee", Boolean(required));
  if (fee.error) return fee;
  if (fee.value !== undefined) claimed.fee = fee.value;

  const payout = readCredits(rawPayout, "agent_payout", Boolean(required));
  if (payout.error) return payout;
  if (payout.value !== undefined) claimed.agent_payout = payout.value;

  const returned = readCredits(rawReturned, "returned_to_payer", Boolean(required));
  if (returned.error) return returned;
  if (returned.value !== undefined) claimed.returned_to_payer = returned.value;

  if (required && (claimed.fee === undefined || claimed.agent_payout === undefined || claimed.returned_to_payer === undefined)) {
    return {
      error: fail(400, "missing_field", "Receipt must include fee, agent_payout, and returned_to_payer.", {
        field: "receipt",
      }),
    };
  }

  return { value: claimed };
}

function mergeClaimed(base, extra) {
  return { ...base, ...extra };
}

function moneyMismatches(expected, claimed) {
  const received = {};
  const mismatches = [];
  for (const field of ["fee", "agent_payout", "returned_to_payer"]) {
    if (!Object.prototype.hasOwnProperty.call(claimed, field)) continue;
    received[field] = claimed[field];
    if (claimed[field] !== expected[field]) {
      mismatches.push(`${field}: received ${claimed[field]}, expected ${expected[field]}`);
    }
  }
  return { received, mismatches };
}

function expectedFromAction(job, action, options) {
  const inputJob = job.status === "submitted" ? job : asSubmittedJob(job);
  return transition({ action, job: inputJob }, { ...(options || {}), dryRun: true });
}

function verifySuccess(expected, claimed, extra) {
  const compared = moneyMismatches(expected, claimed);
  return ok({
    valid: compared.mismatches.length === 0,
    verified: true,
    expected,
    received: compared.received,
    mismatches: compared.mismatches,
    ...(extra || {}),
  });
}

function parseReceiptInput(raw) {
  if (Array.isArray(raw)) {
    return {
      error: fail(400, "invalid_field", "receipt must be a single object, not an array.", { field: "receipt" }),
    };
  }
  if (!raw || typeof raw !== "object") {
    return {
      error: fail(400, "missing_field", "Send a receipt object.", { field: "receipt" }),
    };
  }

  const source = looksLikeReceipt(raw) ? raw : jobShapeFromReceipt(raw);
  const parsedJob = readJob(jobShapeFromReceipt(source));
  if (parsedJob.error) return parsedJob;
  if (!TERMINAL.includes(parsedJob.value.status)) {
    return {
      error: fail(400, "invalid_field", "receipt.status must be released or disputed.", {
        field: "receipt.status",
      }),
    };
  }

  const inferred = parsedJob.value.status === "disputed"
    ? { returned_to_payer: parsedJob.value.amount }
    : { returned_to_payer: 0 };
  const claimed = readClaimedMoney({ ...inferred, ...source }, { required: true });
  if (claimed.error) return claimed;

  return {
    value: {
      job: parsedJob.value,
      action: parsedJob.value.status === "released" ? "release" : "dispute",
      claimed: claimed.value,
    },
  };
}

function parseVerifyJobInput(input) {
  const rawJob = input.job !== undefined ? input.job : input;
  const parsedJob = readJob(rawJob);
  if (parsedJob.error) return parsedJob;
  const job = parsedJob.value;

  const rawAction = input.action;
  let action;
  if (rawAction !== undefined) {
    if (typeof rawAction !== "string" || !VERIFY_ACTIONS.includes(rawAction)) {
      return {
        error: fail(400, "invalid_action", "action must be release or dispute when verifying a job.", {
          actions: VERIFY_ACTIONS,
        }),
      };
    }
    action = rawAction;
    if (TERMINAL.includes(job.status) && action !== (job.status === "released" ? "release" : "dispute")) {
      return {
        error: fail(
          409,
          "illegal_transition",
          `Terminal job status ${job.status} does not match action ${action}.`,
          { action, from: job.status, expected: job.status === "released" ? "release" : "dispute" },
        ),
      };
    }
    if (job.status !== "submitted" && !TERMINAL.includes(job.status)) {
      return {
        error: fail(
          409,
          "illegal_transition",
          `Cannot verify ${action} from status ${job.status}. Send a submitted job plus action, or a terminal job.`,
          { action, from: job.status, expected: "submitted" },
        ),
      };
    }
  } else if (TERMINAL.includes(job.status)) {
    action = job.status === "released" ? "release" : "dispute";
  } else if (job.status === "submitted") {
    return {
      error: fail(400, "missing_field", "Submitted jobs need action release or dispute.", { field: "action" }),
    };
  } else {
    return {
      error: fail(
        409,
        "illegal_transition",
        `Cannot verify a job in status ${job.status}. Send a terminal receipt, a terminal job, or a submitted job plus action.`,
        { from: job.status, expected: "submitted" },
      ),
    };
  }

  const fromInput = readClaimedMoney(input, { required: false });
  if (fromInput.error) return fromInput;

  let claimed = fromInput.value;
  if (TERMINAL.includes(job.status)) {
    const fromJob = readClaimedMoney(rawJob, { required: false });
    if (fromJob.error) return fromJob;
    claimed = mergeClaimed(fromJob.value, fromInput.value);
    if (claimed.returned_to_payer === undefined) {
      claimed = {
        ...claimed,
        returned_to_payer: job.status === "disputed" && typeof rawJob.amount === "number"
          ? rawJob.amount
          : 0,
      };
    }
  }

  return { value: { job, action, claimed } };
}

function verify(input, options) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail(400, "invalid_json", "Body must be a JSON object.");
  }

  const hasReceipt = input.receipt !== undefined || looksLikeReceipt(input);
  const hasJob = input.job !== undefined
    || (typeof input.id === "string" && typeof input.status === "string" && !looksLikeReceipt(input));

  let parsed;
  if (hasReceipt) {
    parsed = parseReceiptInput(input.receipt !== undefined ? input.receipt : input);
  } else if (hasJob) {
    parsed = parseVerifyJobInput(input);
  } else {
    return fail(400, "missing_field", "Send a receipt object or a job to recompute.", { field: "receipt" });
  }
  if (parsed.error) return parsed.error;

  const expectedResult = expectedFromAction(parsed.value.job, parsed.value.action, options);
  if (expectedResult.status !== 200) return expectedResult;

  const receipt = expectedResult.body.receipt;
  const expected = moneyFromReceipt(receipt);
  return verifySuccess(expected, parsed.value.claimed, {
    action: parsed.value.action,
    job_id: parsed.value.job.id,
  });
}

function discovery(kind) {
  const quote = kind === "quote";
  const verifyMode = kind === "verify";
  const simulateMode = kind === "simulate";
  const path = verifyMode
    ? "/api/v0/verify"
    : simulateMode
      ? "/api/v0/simulate"
      : quote
        ? "/api/v0/quote"
        : "/api/v0/transition";
  return {
    service: "liberty-agent-settlement",
    mode: "demo",
    money: false,
    path,
    methods: ["POST", "OPTIONS"],
    auth: {
      required: false,
      mode: "demo",
      headers: ["Authorization: Bearer <key>", "X-Liberty-Key"],
      key_id: "sha256 hex prefix (k_ + 12 chars). Raw key is never stored.",
      missing: "key_optional",
    },
    persistence: false,
    dry_run: quote || verifyMode,
    actions: verifyMode ? VERIFY_ACTIONS : ACTIONS,
    note: verifyMode
      ? "Stateless receipt / settlement verify. Same fee engine as quote/transition. Send a terminal receipt, or a job (terminal, or submitted plus release/dispute) and optional claimed fee / agent_payout / returned_to_payer. Liberty recomputes expected money fields and lists mismatches. Does not store receipts. Not live escrow custody. Optional demo API key identifies the adapter; omit it and the route still works (key_optional). Not production auth."
      : simulateMode
        ? "One-shot demo lifecycle. Runs create → fund → submit → release|dispute through the same engine as POST /api/v0/transition. Create assigns a real as_… id. Returns ordered steps, final job, payer_credits, agent_credits_delta, and the terminal receipt. Does not persist jobs or receipts. Not live escrow custody. Optional demo API key identifies the adapter; omit it and the route still works (key_optional). Not production auth."
        : quote
          ? "Dry-run of the same engine as POST /api/v0/transition. Computes the next status and fee math without mutating state. Create quote returns validated open job fields without a durable id. Not live escrow custody. Optional demo API key identifies the adapter; omit it and the route still works (key_optional). Not production auth."
          : "Stateless demo engine. Client holds the job and credits. Liberty returns the next state and fee math. Not live escrow custody. Optional demo API key identifies the adapter; omit it and the route still works (key_optional). Not production auth.",
    protocol: "/api/settlement.json",
    quote: "/api/v0/quote",
    commit: "/api/v0/transition",
    verify: "/api/v0/verify",
    simulate: "/api/v0/simulate",
    ...(simulateMode ? { terminals: SIMULATE_TERMINALS } : {}),
  };
}

function decorateQuote(result) {
  if (result.status !== 200) return result;
  const body = { ...result.body, quoted: true };
  if (Number.isInteger(body.payer_credits)) {
    body.payer_credits_after = body.payer_credits;
  }
  return { status: result.status, body };
}

function transition(input, options) {
  const opts = options || {};
  const dryRun = Boolean(opts.dryRun);
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
    if (!dryRun) job.id = idFactory();
    const created = ok({ action, job });
    return dryRun ? decorateQuote(created) : created;
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
    const funded = ok({
      action,
      job,
      payer_credits: credits.value - job.amount,
    });
    return dryRun ? decorateQuote(funded) : funded;
  }

  if (action === "submit") {
    const proof = readText(firstDefined(input.proof_url, input.proofUrl, job.proofUrl), "proof_url", {
      required: true,
    });
    if (proof.error) return proof.error;
    job.proofUrl = proof.value;
    job.status = "submitted";
    job.submittedAt = stamp;
    const submitted = ok({ action, job });
    return dryRun ? decorateQuote(submitted) : submitted;
  }

  if (action === "release") {
    job.fee = releaseFee(job.amount);
    job.agentPayout = job.amount - job.fee;
    job.status = "released";
    job.resolvedAt = stamp;
    const released = ok({
      action,
      job,
      fee: job.fee,
      agent_payout: job.agentPayout,
      agent_credits_delta: job.agentPayout,
      receipt: receiptFromJob(job),
    });
    return dryRun ? decorateQuote(released) : released;
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
    agent_credits_delta: 0,
    returned_to_payer: job.amount,
    receipt: receiptFromJob(job),
  };
  if (credits.value !== undefined) {
    body.payer_credits = credits.value + job.amount;
  }
  const disputed = ok(body);
  return dryRun ? decorateQuote(disputed) : disputed;
}

function quote(input, options) {
  return transition(input, { ...(options || {}), dryRun: true });
}

function stepFromResult(result) {
  const body = result.body || {};
  const step = { action: body.action, job: body.job };
  if (Number.isInteger(body.payer_credits)) step.payer_credits = body.payer_credits;
  if (Number.isInteger(body.fee)) step.fee = body.fee;
  if (Number.isInteger(body.agent_payout)) step.agent_payout = body.agent_payout;
  if (Number.isInteger(body.agent_credits_delta)) step.agent_credits_delta = body.agent_credits_delta;
  if (Number.isInteger(body.returned_to_payer)) step.returned_to_payer = body.returned_to_payer;
  if (body.receipt && typeof body.receipt === "object") step.receipt = body.receipt;
  return step;
}

function simulate(input, options) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail(400, "invalid_json", "Body must be a JSON object.");
  }

  const title = readText(input.title, "title", { maxLength: 80, required: true });
  if (title.error) return title.error;
  const amount = readInteger(input.amount, "amount", { min: 1 });
  if (amount.error) return amount.error;
  const criteria = readText(input.criteria, "criteria", { required: true });
  if (criteria.error) return criteria.error;
  const credits = readCredits(
    firstDefined(input.payer_credits, input.payerCredits),
    "payer_credits",
    true,
  );
  if (credits.error) return credits.error;
  const proof = readText(firstDefined(input.proof_url, input.proofUrl), "proof_url", {
    required: true,
  });
  if (proof.error) return proof.error;

  const rawTerminal = firstDefined(input.terminal, "release");
  if (typeof rawTerminal !== "string" || !SIMULATE_TERMINALS.includes(rawTerminal)) {
    return fail(400, "invalid_field", "terminal must be release or dispute.", {
      field: "terminal",
      terminals: SIMULATE_TERMINALS,
    });
  }
  const terminal = rawTerminal;

  const created = transition({
    action: "create",
    title: title.value,
    amount: amount.value,
    criteria: criteria.value,
  }, options);
  if (created.status !== 200) return created;

  const steps = [stepFromResult(created)];

  const funded = transition({
    action: "fund",
    job: created.body.job,
    payer_credits: credits.value,
  }, options);
  if (funded.status !== 200) return funded;
  steps.push(stepFromResult(funded));

  const submitted = transition({
    action: "submit",
    job: funded.body.job,
    proof_url: proof.value,
  }, options);
  if (submitted.status !== 200) return submitted;
  steps.push(stepFromResult(submitted));

  const finished = transition(
    terminal === "release"
      ? { action: "release", job: submitted.body.job }
      : { action: "dispute", job: submitted.body.job, payer_credits: funded.body.payer_credits },
    options,
  );
  if (finished.status !== 200) return finished;
  steps.push(stepFromResult(finished));

  const payerCredits = Number.isInteger(finished.body.payer_credits)
    ? finished.body.payer_credits
    : funded.body.payer_credits;

  return ok({
    terminal,
    job: finished.body.job,
    payer_credits: payerCredits,
    fee: finished.body.fee,
    agent_payout: finished.body.agent_payout,
    agent_credits_delta: Number.isInteger(finished.body.agent_credits_delta)
      ? finished.body.agent_credits_delta
      : 0,
    ...(Number.isInteger(finished.body.returned_to_payer)
      ? { returned_to_payer: finished.body.returned_to_payer }
      : {}),
    receipt: finished.body.receipt,
    steps,
  });
}

function parseBody(raw) {
  if (raw == null || raw === "") return {};
  if (Buffer.isBuffer(raw)) {
    const text = raw.toString("utf8").trim();
    if (!text) return {};
    return JSON.parse(text);
  }
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return {};
    return JSON.parse(text);
  }
  if (typeof raw === "object") return raw;
  const error = new Error("Body must be JSON.");
  error.code = "invalid_json";
  throw error;
}

function createVercelHandler({ dryRun, verify: verifyMode, simulate: simulateMode } = {}) {
  return async function handler(req, res) {
    let body;
    try {
      body = parseBody(req.body);
    } catch {
      const headers = corsHeaders();
      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
      }
      return res.status(400).json(applyDemoAuth({
        ok: false,
        mode: "demo",
        money: false,
        error: "invalid_json",
        message: "Body must be JSON.",
      }, req.headers));
    }

    const result = handleHttp({
      method: req.method,
      body,
      headers: req.headers,
      dryRun: Boolean(dryRun),
      verify: Boolean(verifyMode),
      simulate: Boolean(simulateMode),
    });
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
    if (result.body == null) return res.status(result.status).end();
    return res.status(result.status).json(result.body);
  };
}

function handleHttp({ method, body, headers, dryRun, verify: verifyMode, simulate: simulateMode }) {
  const cors = corsHeaders();
  const verb = (method || "").toUpperCase();
  const quoteMode = Boolean(dryRun);
  const checking = Boolean(verifyMode);
  const walking = Boolean(simulateMode);

  if (verb === "OPTIONS") {
    return { status: 204, headers: cors, body: null };
  }

  if (verb === "GET") {
    return {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: discovery(checking ? "verify" : walking ? "simulate" : quoteMode ? "quote" : "transition"),
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

  const result = checking
    ? verify(body)
    : walking
      ? simulate(body)
      : transition(body, { dryRun: quoteMode });
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
  SIMULATE_TERMINALS,
  STATUSES,
  TERMINAL,
  VERIFY_ACTIONS,
  applyDemoAuth,
  corsHeaders,
  createVercelHandler,
  discovery,
  handleHttp,
  keyIdFromSecret,
  parseBody,
  quote,
  readDemoAuth,
  receiptFromJob,
  releaseFee,
  simulate,
  transition,
  verify,
};
