(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root) {
    root.LibertyReceiptExport = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "liberty.agent-settlement.receipts.v0";
  const JOB_ID_PATTERN = /^as_[0-9a-f]{10}$/;
  const KEY_ID_PATTERN = /^k_[0-9a-f]{12}$/;
  const TERMINAL = ["released", "disputed"];
  const NOTE_MAX_LENGTH = 400;
  const CLIENT_REF_MAX_LENGTH = 128;
  const VERSION = 1;
  const PREFIX = "r1.";
  const HASH_RE = /^#receipt\/(.+)$/i;

  const RECEIPT_KEYS = [
    ["job_id", "j"],
    ["title", "t"],
    ["status", "s"],
    ["amount", "a"],
    ["release_fee", "f"],
    ["agent_payout", "ap"],
    ["returned_to_payer", "rp"],
    ["success_criteria", "c"],
    ["proof", "p"],
    ["created", "ca"],
    ["funded", "fa"],
    ["submitted", "sa"],
    ["resolved", "ra"],
    ["key_id", "k"],
    ["client_ref", "cr"],
    ["release_note", "rn"],
    ["dispute_reason", "dr"],
  ];

  function fail(error, message) {
    return { ok: false, error, message };
  }

  function firstDefined(...values) {
    for (const value of values) {
      if (value !== undefined) return value;
    }
    return undefined;
  }

  function readText(value, field, { required, allowEmpty } = {}) {
    if (value == null) {
      if (required) return fail("invalid_receipt", `${field} is required.`);
      return { ok: true, value: "" };
    }
    if (typeof value !== "string") {
      return fail("invalid_receipt", `${field} must be a string.`);
    }
    const text = value.trim();
    if (!text && required && !allowEmpty) {
      return fail("invalid_receipt", `${field} is required.`);
    }
    return { ok: true, value: allowEmpty ? value : text };
  }

  function readInteger(value, field, { min }) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
      return fail("invalid_receipt", `${field} must be an integer >= ${min}.`);
    }
    return { ok: true, value };
  }

  function readStamp(value, field, { required } = {}) {
    if (value == null || value === "") {
      if (required) return fail("invalid_receipt", `${field} is required.`);
      return { ok: true, value: null };
    }
    if (typeof value !== "string") {
      return fail("invalid_receipt", `${field} must be a string or null.`);
    }
    const text = value.trim();
    if (!text) {
      if (required) return fail("invalid_receipt", `${field} is required.`);
      return { ok: true, value: null };
    }
    return { ok: true, value: text };
  }

  function looksLikeJob(raw) {
    return raw
      && typeof raw === "object"
      && typeof raw.job_id !== "string"
      && typeof raw.id === "string"
      && typeof raw.status === "string";
  }

  function receiptFromJob(job, extras) {
    if (!job || typeof job !== "object") {
      return fail("invalid_receipt", "Need a job or receipt object.");
    }
    const released = job.status === "released";
    const disputed = job.status === "disputed";
    const receipt = {
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
      funded: job.fundedAt == null ? null : job.fundedAt,
      submitted: job.submittedAt == null ? null : job.submittedAt,
      resolved: job.resolvedAt == null ? null : job.resolvedAt,
    };
    const keyId = extras && extras.key_id ? extras.key_id : job.receiptKeyId;
    if (keyId) receipt.key_id = keyId;
    const clientRef = firstDefined(job.clientRef, job.client_ref);
    if (typeof clientRef === "string" && clientRef.trim()) {
      receipt.client_ref = clientRef.trim();
    }
    const releaseNote = firstDefined(job.releaseNote, job.release_note);
    const disputeReason = firstDefined(job.disputeReason, job.dispute_reason);
    if (released && typeof releaseNote === "string" && releaseNote.trim()) {
      receipt.release_note = releaseNote.trim();
    }
    if (disputed && typeof disputeReason === "string" && disputeReason.trim()) {
      receipt.dispute_reason = disputeReason.trim();
    }
    return readReceipt(receipt);
  }

  function readReceipt(raw, extras) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return fail("invalid_receipt", "Receipt must be a JSON object.");
    }
    if (looksLikeJob(raw)) return receiptFromJob(raw, extras);

    const jobId = readText(firstDefined(raw.job_id, raw.jobId), "job_id", { required: true });
    if (!jobId.ok) return jobId;
    if (!JOB_ID_PATTERN.test(jobId.value)) {
      return fail("invalid_receipt", "job_id must match as_ plus 10 hex characters.");
    }

    const title = readText(raw.title, "title", { required: true });
    if (!title.ok) return title;

    const status = readText(raw.status, "status", { required: true });
    if (!status.ok) return status;
    if (!TERMINAL.includes(status.value)) {
      return fail("invalid_receipt", "Receipt status must be released or disputed.");
    }

    const amount = readInteger(raw.amount, "amount", { min: 1 });
    if (!amount.ok) return amount;

    const fee = readInteger(firstDefined(raw.release_fee, raw.releaseFee), "release_fee", { min: 0 });
    if (!fee.ok) return fee;
    const payout = readInteger(firstDefined(raw.agent_payout, raw.agentPayout), "agent_payout", { min: 0 });
    if (!payout.ok) return payout;
    const returned = readInteger(
      firstDefined(raw.returned_to_payer, raw.returnedToPayer),
      "returned_to_payer",
      { min: 0 },
    );
    if (!returned.ok) return returned;

    const criteria = readText(
      firstDefined(raw.success_criteria, raw.successCriteria, raw.criteria),
      "success_criteria",
      { required: true },
    );
    if (!criteria.ok) return criteria;

    const proofRaw = firstDefined(raw.proof, raw.proofUrl, raw.proof_url, "");
    if (typeof proofRaw !== "string") {
      return fail("invalid_receipt", "proof must be a string.");
    }

    const created = readStamp(firstDefined(raw.created, raw.createdAt, raw.created_at), "created", {
      required: true,
    });
    if (!created.ok) return created;
    const funded = readStamp(firstDefined(raw.funded, raw.fundedAt, raw.funded_at), "funded");
    if (!funded.ok) return funded;
    const submitted = readStamp(firstDefined(raw.submitted, raw.submittedAt, raw.submitted_at), "submitted");
    if (!submitted.ok) return submitted;
    const resolved = readStamp(firstDefined(raw.resolved, raw.resolvedAt, raw.resolved_at), "resolved");
    if (!resolved.ok) return resolved;

    const receipt = {
      job_id: jobId.value,
      title: title.value,
      status: status.value,
      amount: amount.value,
      release_fee: fee.value,
      agent_payout: payout.value,
      returned_to_payer: returned.value,
      success_criteria: criteria.value,
      proof: proofRaw,
      created: created.value,
      funded: funded.value,
      submitted: submitted.value,
      resolved: resolved.value,
    };

    const keyId = firstDefined(
      extras && extras.key_id,
      raw.key_id,
      raw.keyId,
    );
    if (keyId !== undefined && keyId !== null && keyId !== "") {
      if (typeof keyId !== "string" || !KEY_ID_PATTERN.test(keyId)) {
        return fail("invalid_receipt", "key_id must match k_ plus 12 hex characters.");
      }
      receipt.key_id = keyId;
    }

    const clientRef = readText(
      firstDefined(raw.client_ref, raw.clientRef),
      "client_ref",
    );
    if (!clientRef.ok) return clientRef;
    if (clientRef.value) {
      if (clientRef.value.length > CLIENT_REF_MAX_LENGTH) {
        return fail("invalid_receipt", `client_ref must be at most ${CLIENT_REF_MAX_LENGTH} characters.`);
      }
      receipt.client_ref = clientRef.value;
    }

    const releaseNote = readText(
      firstDefined(raw.release_note, raw.releaseNote),
      "release_note",
    );
    if (!releaseNote.ok) return releaseNote;
    if (releaseNote.value) {
      if (releaseNote.value.length > NOTE_MAX_LENGTH) {
        return fail("invalid_receipt", `release_note must be at most ${NOTE_MAX_LENGTH} characters.`);
      }
      if (status.value === "released") receipt.release_note = releaseNote.value;
    }

    const disputeReason = readText(
      firstDefined(raw.dispute_reason, raw.disputeReason),
      "dispute_reason",
    );
    if (!disputeReason.ok) return disputeReason;
    if (disputeReason.value) {
      if (disputeReason.value.length > NOTE_MAX_LENGTH) {
        return fail("invalid_receipt", `dispute_reason must be at most ${NOTE_MAX_LENGTH} characters.`);
      }
      if (status.value === "disputed") receipt.dispute_reason = disputeReason.value;
    }

    return { ok: true, receipt };
  }

  function readReceiptList(raw) {
    if (raw == null || raw === "") return [];
    let data = raw;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    const items = Array.isArray(data)
      ? data
      : (data && Array.isArray(data.receipts) ? data.receipts : []);
    const list = [];
    for (const item of items) {
      const parsed = readReceipt(item);
      if (parsed.ok) upsertReceipt(list, parsed.receipt);
    }
    return list;
  }

  function upsertReceipt(list, receipt) {
    const parsed = readReceipt(receipt);
    if (!parsed.ok) return list;
    const next = parsed.receipt;
    const idx = list.findIndex((item) => item.job_id === next.job_id);
    if (idx === -1) list.unshift(next);
    else list[idx] = next;
    return list;
  }

  function exportOneJson(receipt) {
    const parsed = readReceipt(receipt);
    if (!parsed.ok) return parsed;
    return { ok: true, text: `${JSON.stringify(parsed.receipt, null, 2)}\n`, filename: filenameForOne(parsed.receipt) };
  }

  function exportAllJson(receipts) {
    const list = Array.isArray(receipts) ? receipts.map((item) => readReceipt(item)).filter((item) => item.ok).map((item) => item.receipt) : [];
    return {
      ok: true,
      text: `${JSON.stringify(list, null, 2)}\n`,
      filename: "liberty-receipts.json",
    };
  }

  function exportAllNdjson(receipts) {
    const list = Array.isArray(receipts) ? receipts.map((item) => readReceipt(item)).filter((item) => item.ok).map((item) => item.receipt) : [];
    const text = list.length ? `${list.map((item) => JSON.stringify(item)).join("\n")}\n` : "";
    return {
      ok: true,
      text,
      filename: "liberty-receipts.ndjson",
    };
  }

  function filenameForOne(receipt) {
    const id = receipt && receipt.job_id ? receipt.job_id : "receipt";
    return `liberty-receipt-${id}.json`;
  }

  function compactReceipt(receipt) {
    const packed = {};
    for (const [from, to] of RECEIPT_KEYS) {
      if (receipt[from] !== undefined) packed[to] = receipt[from];
    }
    return packed;
  }

  function expandReceipt(packed) {
    if (!packed || typeof packed !== "object") return packed;
    const receipt = {};
    for (const [from, to] of RECEIPT_KEYS) {
      if (packed[from] !== undefined) receipt[from] = packed[from];
      else if (packed[to] !== undefined) receipt[from] = packed[to];
    }
    return receipt;
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

  function encodeReceipt(source, extras) {
    const parsed = readReceipt(source, extras);
    if (!parsed.ok) return parsed;
    const payload = {
      v: VERSION,
      receipt: compactReceipt(parsed.receipt),
    };
    const token = PREFIX + bytesToBase64Url(utf8ToBytes(JSON.stringify(payload)));
    return { ok: true, token, receipt: parsed.receipt };
  }

  function decodeTokenBytes(raw) {
    const text = String(raw || "").trim();
    if (!text.startsWith(PREFIX)) {
      return fail("invalid_receipt_link", "Receipt code must start with r1.");
    }
    const body = text.slice(PREFIX.length);
    if (!body) return fail("invalid_receipt_link", "Receipt code is empty.");
    try {
      return { ok: true, text: bytesToUtf8(base64UrlToBytes(body)) };
    } catch {
      return fail("invalid_receipt_link", "Receipt code is not valid base64url.");
    }
  }

  function decodeReceipt(raw) {
    const decoded = decodeTokenBytes(raw);
    if (!decoded.ok) return decoded;
    let payload;
    try {
      payload = JSON.parse(decoded.text);
    } catch {
      return fail("invalid_receipt_link", "Receipt payload is not JSON.");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return fail("invalid_receipt_link", "Receipt payload must be a JSON object.");
    }
    if (payload.v !== VERSION) {
      return fail("invalid_receipt_link", "Unsupported receipt-link version.");
    }
    return readReceipt(expandReceipt(payload.receipt));
  }

  function extractReceiptToken(input) {
    const text = String(input || "").trim();
    if (!text) return "";

    try {
      const url = new URL(text);
      const hash = url.hash.match(HASH_RE);
      if (hash) return decodeURIComponent(hash[1]);
      const query = url.searchParams.get("receipt");
      if (query) return query.trim();
    } catch {
      /* not an absolute URL */
    }

    const hashOnly = text.match(HASH_RE) || text.match(/#receipt\/([^\s#]+)/i);
    if (hashOnly) {
      try {
        return decodeURIComponent(hashOnly[1]);
      } catch {
        return hashOnly[1];
      }
    }

    const queryOnly = text.match(/[?&]receipt=([^&\s#]+)/i);
    if (queryOnly) {
      try {
        return decodeURIComponent(queryOnly[1]);
      } catch {
        return queryOnly[1];
      }
    }

    return text;
  }

  function decodeReceiptInput(input) {
    const token = extractReceiptToken(input);
    if (!token) return fail("invalid_receipt_link", "Paste a receipt link or r1. code.");
    return decodeReceipt(token);
  }

  function buildReceiptHref(source, baseUrl, extras) {
    const encoded = encodeReceipt(source, extras);
    if (!encoded.ok) return encoded;
    let url;
    try {
      url = new URL(baseUrl);
    } catch {
      return fail("invalid_receipt_link", "Need an absolute URL to build a receipt link.");
    }
    url.search = "";
    url.hash = `receipt/${encoded.token}`;
    return {
      ok: true,
      href: url.toString(),
      token: encoded.token,
      receipt: encoded.receipt,
    };
  }

  function readLocationReceipt(locationLike) {
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
      return new URLSearchParams(search).get("receipt") || "";
    } catch {
      return "";
    }
  }

  return {
    CLIENT_REF_MAX_LENGTH,
    JOB_ID_PATTERN,
    KEY_ID_PATTERN,
    NOTE_MAX_LENGTH,
    PREFIX,
    STORAGE_KEY,
    TERMINAL,
    VERSION,
    buildReceiptHref,
    decodeReceipt,
    decodeReceiptInput,
    encodeReceipt,
    exportAllJson,
    exportAllNdjson,
    exportOneJson,
    extractReceiptToken,
    filenameForOne,
    readLocationReceipt,
    readReceipt,
    readReceiptList,
    receiptFromJob,
    upsertReceipt,
  };
});
