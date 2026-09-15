(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root) {
    root.LibertyJobHandoff = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const PREFIX = "h1.";
  const JOB_ID_PATTERN = /^as_[0-9a-f]{10}$/;
  const STATUSES = ["open", "funded", "submitted", "released", "disputed"];
  const HASH_RE = /^#handoff\/(.+)$/i;

  const JOB_KEYS = [
    ["id", "id"],
    ["title", "t"],
    ["amount", "a"],
    ["criteria", "c"],
    ["proofUrl", "p"],
    ["status", "s"],
    ["createdAt", "ca"],
    ["fundedAt", "fa"],
    ["submittedAt", "sa"],
    ["resolvedAt", "ra"],
    ["fee", "f"],
    ["agentPayout", "ap"],
    ["clientRef", "cr"],
    ["callbackUrl", "cb"],
    ["proofNote", "pn"],
    ["releaseNote", "rn"],
    ["disputeReason", "dr"],
  ];

  function fail(error, message) {
    return { ok: false, error, message };
  }

  function nextActions(status) {
    if (status === "open") return ["fund"];
    if (status === "funded") return ["submit"];
    if (status === "submitted") return ["release", "dispute"];
    return [];
  }

  function firstDefined(...values) {
    for (const value of values) {
      if (value !== undefined) return value;
    }
    return undefined;
  }

  function readText(value) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    return text || null;
  }

  function readStamp(value) {
    if (value == null || value === "") return null;
    if (typeof value !== "string") return undefined;
    const text = value.trim();
    return text || null;
  }

  function readJob(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return fail("invalid_job", "Handoff must include a job object.");
    }

    const id = readText(raw.id);
    if (!id || !JOB_ID_PATTERN.test(id)) {
      return fail("invalid_job", "job.id must match as_ plus 10 hex characters.");
    }

    const title = readText(raw.title);
    if (!title || title.length > 80) {
      return fail("invalid_job", "job.title is required and must be at most 80 characters.");
    }

    const amount = raw.amount;
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1) {
      return fail("invalid_job", "job.amount must be an integer >= 1.");
    }

    const criteria = readText(raw.criteria);
    if (!criteria) {
      return fail("invalid_job", "job.criteria is required.");
    }

    const status = readText(raw.status);
    if (!status || !STATUSES.includes(status)) {
      return fail("invalid_job", "job.status must be a known settlement state.");
    }

    const createdAt = readText(firstDefined(raw.createdAt, raw.created_at));
    if (!createdAt) {
      return fail("invalid_job", "job.createdAt is required.");
    }

    const proofRaw = firstDefined(raw.proofUrl, raw.proof_url, "");
    if (typeof proofRaw !== "string") {
      return fail("invalid_job", "job.proofUrl must be a string.");
    }

    const fundedAt = readStamp(firstDefined(raw.fundedAt, raw.funded_at, null));
    const submittedAt = readStamp(firstDefined(raw.submittedAt, raw.submitted_at, null));
    const resolvedAt = readStamp(firstDefined(raw.resolvedAt, raw.resolved_at, null));
    if (fundedAt === undefined || submittedAt === undefined || resolvedAt === undefined) {
      return fail("invalid_job", "Job timestamps must be strings or null.");
    }

    const feeRaw = firstDefined(raw.fee, 0);
    const payoutRaw = firstDefined(raw.agentPayout, raw.agent_payout, 0);
    if (typeof feeRaw !== "number" || !Number.isInteger(feeRaw) || feeRaw < 0) {
      return fail("invalid_job", "job.fee must be an integer >= 0.");
    }
    if (typeof payoutRaw !== "number" || !Number.isInteger(payoutRaw) || payoutRaw < 0) {
      return fail("invalid_job", "job.agentPayout must be an integer >= 0.");
    }

    const job = {
      id,
      title,
      amount,
      criteria,
      proofUrl: proofRaw,
      status,
      createdAt,
      fundedAt,
      submittedAt,
      resolvedAt,
      fee: feeRaw,
      agentPayout: payoutRaw,
    };

    const clientRef = readText(firstDefined(raw.clientRef, raw.client_ref));
    if (clientRef && clientRef.length > 128) {
      return fail("invalid_job", "job.clientRef must be at most 128 characters.");
    }
    if (clientRef) job.clientRef = clientRef;

    const callbackUrl = readText(firstDefined(raw.callbackUrl, raw.callback_url, raw.notifyUrl, raw.notify_url));
    if (callbackUrl && callbackUrl.length > 512) {
      return fail("invalid_job", "job.callbackUrl must be at most 512 characters.");
    }
    if (callbackUrl) job.callbackUrl = callbackUrl;

    const proofNote = readText(firstDefined(raw.proofNote, raw.proof_note));
    const releaseNote = readText(firstDefined(raw.releaseNote, raw.release_note));
    const disputeReason = readText(firstDefined(raw.disputeReason, raw.dispute_reason));
    if (proofNote && proofNote.length > 400) {
      return fail("invalid_job", "job.proofNote must be at most 400 characters.");
    }
    if (releaseNote && releaseNote.length > 400) {
      return fail("invalid_job", "job.releaseNote must be at most 400 characters.");
    }
    if (disputeReason && disputeReason.length > 400) {
      return fail("invalid_job", "job.disputeReason must be at most 400 characters.");
    }
    if ((status === "submitted" || status === "released" || status === "disputed") && proofNote) {
      job.proofNote = proofNote;
    }
    if (status === "released" && releaseNote) job.releaseNote = releaseNote;
    if (status === "disputed" && disputeReason) job.disputeReason = disputeReason;

    return { ok: true, job };
  }

  function compactJob(job) {
    const packed = {};
    for (const [from, to] of JOB_KEYS) {
      if (job[from] !== undefined) packed[to] = job[from];
    }
    return packed;
  }

  function expandJob(packed) {
    if (!packed || typeof packed !== "object") return packed;
    const job = {};
    for (const [from, to] of JOB_KEYS) {
      if (packed[from] !== undefined) job[from] = packed[from];
      else if (packed[to] !== undefined) job[from] = packed[to];
    }
    if (packed.proof_url !== undefined && job.proofUrl === undefined) job.proofUrl = packed.proof_url;
    if (packed.created_at !== undefined && job.createdAt === undefined) job.createdAt = packed.created_at;
    if (packed.funded_at !== undefined && job.fundedAt === undefined) job.fundedAt = packed.funded_at;
    if (packed.submitted_at !== undefined && job.submittedAt === undefined) job.submittedAt = packed.submitted_at;
    if (packed.resolved_at !== undefined && job.resolvedAt === undefined) job.resolvedAt = packed.resolved_at;
    if (packed.agent_payout !== undefined && job.agentPayout === undefined) job.agentPayout = packed.agent_payout;
    if (packed.client_ref !== undefined && job.clientRef === undefined) job.clientRef = packed.client_ref;
    if (packed.callback_url !== undefined && job.callbackUrl === undefined) job.callbackUrl = packed.callback_url;
    if (packed.notify_url !== undefined && job.callbackUrl === undefined) job.callbackUrl = packed.notify_url;
    if (packed.proof_note !== undefined && job.proofNote === undefined) job.proofNote = packed.proof_note;
    if (packed.release_note !== undefined && job.releaseNote === undefined) job.releaseNote = packed.release_note;
    if (packed.dispute_reason !== undefined && job.disputeReason === undefined) job.disputeReason = packed.dispute_reason;
    return job;
  }

  function bytesToBase64Url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    const base64 = typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(token) {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const base64 = padded + pad;
    if (typeof atob === "function") {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }

  function utf8ToBytes(text) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(text);
    return Uint8Array.from(Buffer.from(text, "utf8"));
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder === "function") return new TextDecoder().decode(bytes);
    return Buffer.from(bytes).toString("utf8");
  }

  function encodeHandoff(job) {
    const parsed = readJob(job);
    if (!parsed.ok) return parsed;
    const payload = {
      v: VERSION,
      job: compactJob(parsed.job),
      next: nextActions(parsed.job.status),
    };
    const token = PREFIX + bytesToBase64Url(utf8ToBytes(JSON.stringify(payload)));
    return { ok: true, token, job: parsed.job, next: payload.next };
  }

  function decodeTokenBytes(raw) {
    const text = String(raw || "").trim();
    if (!text.startsWith(PREFIX)) {
      return fail("invalid_handoff", "Handoff code must start with h1.");
    }
    const body = text.slice(PREFIX.length);
    if (!body) return fail("invalid_handoff", "Handoff code is empty.");
    try {
      return { ok: true, text: bytesToUtf8(base64UrlToBytes(body)) };
    } catch {
      return fail("invalid_handoff", "Handoff code is not valid base64url.");
    }
  }

  function decodeHandoff(raw) {
    const decoded = decodeTokenBytes(raw);
    if (!decoded.ok) return decoded;
    let payload;
    try {
      payload = JSON.parse(decoded.text);
    } catch {
      return fail("invalid_handoff", "Handoff payload is not JSON.");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return fail("invalid_handoff", "Handoff payload must be a JSON object.");
    }
    if (payload.v !== VERSION) {
      return fail("invalid_handoff", "Unsupported handoff version.");
    }
    const parsed = readJob(expandJob(payload.job));
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      job: parsed.job,
      next: Array.isArray(payload.next) ? payload.next : nextActions(parsed.job.status),
    };
  }

  function extractHandoffToken(input) {
    const text = String(input || "").trim();
    if (!text) return "";

    try {
      const url = new URL(text);
      const hash = url.hash.match(HASH_RE);
      if (hash) return decodeURIComponent(hash[1]);
      const query = url.searchParams.get("handoff");
      if (query) return query.trim();
    } catch {
      /* not an absolute URL */
    }

    const hashOnly = text.match(HASH_RE) || text.match(/#handoff\/([^\s#]+)/i);
    if (hashOnly) {
      try {
        return decodeURIComponent(hashOnly[1]);
      } catch {
        return hashOnly[1];
      }
    }

    const queryOnly = text.match(/[?&]handoff=([^&\s#]+)/i);
    if (queryOnly) {
      try {
        return decodeURIComponent(queryOnly[1]);
      } catch {
        return queryOnly[1];
      }
    }

    return text;
  }

  function decodeHandoffInput(input) {
    const token = extractHandoffToken(input);
    if (!token) return fail("invalid_handoff", "Paste a handoff link or h1. code.");
    return decodeHandoff(token);
  }

  function buildHandoffHref(job, baseUrl) {
    const encoded = encodeHandoff(job);
    if (!encoded.ok) return encoded;
    let url;
    try {
      url = new URL(baseUrl);
    } catch {
      return fail("invalid_handoff", "Need an absolute URL to build a handoff link.");
    }
    url.search = "";
    url.hash = `handoff/${encoded.token}`;
    return {
      ok: true,
      href: url.toString(),
      token: encoded.token,
      job: encoded.job,
      next: encoded.next,
    };
  }

  function readLocationHandoff(locationLike) {
    const loc = locationLike || {};
    const hash = String(loc.hash || "");
    const search = String(loc.search || "");
    const hashMatch = hash.match(HASH_RE);
    if (hashMatch) {
      try {
        return decodeURIComponent(hashMatch[1]);
      } catch {
        return hashMatch[1];
      }
    }
    try {
      return new URLSearchParams(search).get("handoff") || "";
    } catch {
      return "";
    }
  }

  return {
    PREFIX,
    VERSION,
    JOB_ID_PATTERN,
    STATUSES,
    buildHandoffHref,
    decodeHandoff,
    decodeHandoffInput,
    encodeHandoff,
    extractHandoffToken,
    nextActions,
    readJob,
    readLocationHandoff,
  };
});
