(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root) {
    root.LibertyAgentWallet = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "liberty.agent-settlement.agent-credits.v0";

  function asCredits(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }

  function readCredits(raw) {
    if (raw == null || raw === "") return 0;
    if (typeof raw === "number") return asCredits(raw);
    if (typeof raw === "string") {
      try {
        return readCredits(JSON.parse(raw));
      } catch {
        return 0;
      }
    }
    if (typeof raw === "object") {
      return asCredits(raw.credits);
    }
    return 0;
  }

  function writeCredits(credits) {
    return JSON.stringify({ credits: asCredits(credits) });
  }

  function creditDeltaFromEngine(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return 0;
    if (Number.isInteger(data.agent_credits_delta)) {
      return asCredits(data.agent_credits_delta);
    }

    const status = data.job && data.job.status;
    const terminal = data.terminal;
    const released = status === "released" || terminal === "release" || data.action === "release";
    if (!released) return 0;
    if (status === "disputed" || terminal === "dispute" || data.action === "dispute") return 0;

    if (Number.isInteger(data.agent_payout)) return asCredits(data.agent_payout);
    if (data.receipt && Number.isInteger(data.receipt.agent_payout)) {
      return asCredits(data.receipt.agent_payout);
    }
    if (data.job && Number.isInteger(data.job.agentPayout)) {
      return asCredits(data.job.agentPayout);
    }
    return 0;
  }

  function applyDelta(balance, delta) {
    return asCredits(balance) + asCredits(delta);
  }

  function applyEngineResult(balance, data) {
    return applyDelta(balance, creditDeltaFromEngine(data));
  }

  return {
    STORAGE_KEY,
    applyDelta,
    applyEngineResult,
    creditDeltaFromEngine,
    readCredits,
    writeCredits,
  };
});
