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

  return {
    JOB_ID_PATTERN,
    KEY_ID_PATTERN,
    STORAGE_KEY,
    TERMINAL,
    exportAllJson,
    exportAllNdjson,
    exportOneJson,
    filenameForOne,
    readReceipt,
    readReceiptList,
    receiptFromJob,
    upsertReceipt,
  };
});
