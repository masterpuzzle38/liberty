(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root) {
    root.LibertySettlementLedger = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FILENAME = "liberty-ledger-receipts.csv";
  const CSV_COLUMNS = [
    "job_id",
    "title",
    "status",
    "amount",
    "release_fee",
    "agent_payout",
    "returned_to_payer",
    "created",
    "funded",
    "submitted",
    "resolved",
    "client_ref",
    "callback_url",
    "proof_note",
    "release_note",
    "dispute_reason",
    "key_id",
  ];

  function helpers() {
    const g = typeof globalThis !== "undefined" ? globalThis : {};
    let receipts = g.LibertyReceiptExport;
    if (typeof require === "function" && !receipts) {
      receipts = require("./receipt-export");
    }
    return { receipts };
  }

  function asCredits(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }

  function firstDefined(...values) {
    for (const value of values) {
      if (value !== undefined) return value;
    }
    return undefined;
  }

  function aliasReceipt(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const next = { ...raw };
    if (!Number.isInteger(next.agent_payout) && Number.isInteger(next.agentPayout)) {
      next.agent_payout = next.agentPayout;
    }
    if (!Number.isInteger(next.agent_payout) && Number.isInteger(next.agent_credits_delta)) {
      next.agent_payout = next.agent_credits_delta;
    }
    if (!Number.isInteger(next.returned_to_payer) && Number.isInteger(next.returnedToPayer)) {
      next.returned_to_payer = next.returnedToPayer;
    }
    const status = typeof next.status === "string" ? next.status : "";
    if (!Number.isInteger(next.returned_to_payer) && status === "disputed" && Number.isInteger(next.amount)) {
      next.returned_to_payer = next.amount;
    }
    if (!Number.isInteger(next.agent_payout) && status === "disputed") {
      next.agent_payout = 0;
    }
    if (!Number.isInteger(next.release_fee) && !Number.isInteger(next.releaseFee) && status === "disputed") {
      next.release_fee = 0;
    }
    return next;
  }

  function parseReceiptItems(items) {
    const { receipts } = helpers();
    if (!receipts || !receipts.readReceipt || !Array.isArray(items)) return [];
    const list = [];
    for (const item of items) {
      const parsed = receipts.readReceipt(aliasReceipt(item));
      if (parsed.ok) list.push(parsed.receipt);
    }
    return list;
  }

  function readReceipts(raw) {
    const { receipts } = helpers();
    if (!receipts || !receipts.readReceipt) return [];
    if (raw == null) return [];
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (Array.isArray(raw)) return parseReceiptItems(raw);
    if (raw && Array.isArray(raw.receipts)) return parseReceiptItems(raw.receipts);
    return [];
  }

  function readJobs(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.jobs)) return raw.jobs;
    return [];
  }

  function payoutFromReceipt(receipt) {
    if (Number.isInteger(receipt.agent_payout)) return asCredits(receipt.agent_payout);
    if (Number.isInteger(receipt.agent_credits_delta)) return asCredits(receipt.agent_credits_delta);
    return 0;
  }

  function returnedFromReceipt(receipt) {
    if (Number.isInteger(receipt.returned_to_payer)) return asCredits(receipt.returned_to_payer);
    if (receipt.status === "disputed" && Number.isInteger(receipt.amount)) return asCredits(receipt.amount);
    return 0;
  }

  function emptyTotals() {
    return {
      money: false,
      mode: "demo",
      feesPaid: 0,
      agentPayouts: 0,
      disputedReturns: 0,
      releasedCount: 0,
      disputedCount: 0,
      receiptCount: 0,
      jobCount: 0,
      payerCredits: 0,
      agentCredits: 0,
    };
  }

  function summarizeLedger(source) {
    const src = source && typeof source === "object" ? source : {};
    const receipts = readReceipts(firstDefined(src.receipts, src.receiptList));
    const jobs = readJobs(firstDefined(src.jobs, src.payer && src.payer.jobs));
    const totals = emptyTotals();
    totals.jobCount = jobs.length;
    totals.payerCredits = asCredits(firstDefined(
      src.payerCredits,
      src.payer_credits,
      src.payer && src.payer.credits,
      0,
    ));
    totals.agentCredits = asCredits(firstDefined(
      src.agentCredits,
      src.agent_credits,
      src.agent && src.agent.credits,
      0,
    ));

    for (const receipt of receipts) {
      totals.receiptCount += 1;
      totals.feesPaid += asCredits(receipt.release_fee);
      if (receipt.status === "released") {
        totals.releasedCount += 1;
        totals.agentPayouts += payoutFromReceipt(receipt);
      } else if (receipt.status === "disputed") {
        totals.disputedCount += 1;
        totals.disputedReturns += returnedFromReceipt(receipt);
      }
    }

    return totals;
  }

  function csvCell(value) {
    if (value == null) return "";
    const text = String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function exportReceiptsCsv(receipts) {
    const list = readReceipts(receipts);
    const lines = [CSV_COLUMNS.join(",")];
    for (const receipt of list) {
      lines.push(CSV_COLUMNS.map((key) => csvCell(receipt[key])).join(","));
    }
    return {
      ok: true,
      text: `${lines.join("\n")}\n`,
      filename: FILENAME,
      receiptCount: list.length,
      money: false,
      mode: "demo",
    };
  }

  return {
    CSV_COLUMNS,
    FILENAME,
    exportReceiptsCsv,
    summarizeLedger,
  };
});
