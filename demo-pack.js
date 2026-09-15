(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root) {
    root.LibertyDemoPack = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const KIND = "liberty-agent-settlement-demo-pack";
  const PAYER_KEY = "liberty.agent-settlement.v0";
  const AGENT_KEY = "liberty.agent-settlement.agent-credits.v0";
  const RECEIPTS_KEY = "liberty.agent-settlement.receipts.v0";
  const DEMO_KEY = "liberty.agent-settlement.demo-key.v0";
  const STORAGE_KEYS = [PAYER_KEY, AGENT_KEY, RECEIPTS_KEY, DEMO_KEY];
  const REQUIRED_KEYS = [PAYER_KEY, AGENT_KEY, RECEIPTS_KEY];
  const KEY_PATTERN = /^lib_demo_[0-9a-f]{32}$/;
  const KEY_ID_PATTERN = /^k_[0-9a-f]{12}$/;
  const FILENAME = "liberty-demo-pack.json";

  function helpers() {
    const g = typeof globalThis !== "undefined" ? globalThis : {};
    let handoff = g.LibertyJobHandoff;
    let receipts = g.LibertyReceiptExport;
    let wallet = g.LibertyAgentWallet;
    if (typeof require === "function") {
      if (!handoff) handoff = require("./job-handoff");
      if (!receipts) receipts = require("./receipt-export");
      if (!wallet) wallet = require("./agent-wallet");
    }
    return { handoff, receipts, wallet };
  }

  function fail(error, message) {
    return { ok: false, error, message };
  }

  function parseJson(raw) {
    if (raw && typeof raw === "object") return { ok: true, value: raw };
    if (typeof raw !== "string") {
      return fail("invalid_pack", "Demo pack must be a JSON object.");
    }
    const text = raw.trim();
    if (!text) return fail("invalid_pack", "Demo pack is empty.");
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return fail("invalid_pack", "Demo pack is not valid JSON.");
    }
  }

  function readCredits(value, field) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return fail("invalid_pack", `${field} must be an integer >= 0.`);
    }
    return { ok: true, value: Math.floor(value) };
  }

  function readPackJob(raw) {
    const { handoff } = helpers();
    if (!handoff || !handoff.readJob) {
      return fail("invalid_pack", "Job helper failed to load.");
    }
    const parsed = handoff.readJob(raw);
    if (!parsed.ok) {
      return fail("invalid_pack", parsed.message || "Pack job is not valid.");
    }
    const job = { ...parsed.job };
    const keyId = raw && (raw.receiptKeyId || raw.receipt_key_id);
    if (keyId != null && keyId !== "") {
      if (typeof keyId !== "string" || !KEY_ID_PATTERN.test(keyId)) {
        return fail("invalid_pack", "job.receiptKeyId must match k_ plus 12 hex characters.");
      }
      job.receiptKeyId = keyId;
    }
    return { ok: true, job };
  }

  function readJobs(raw) {
    if (!Array.isArray(raw)) {
      return fail("invalid_pack", "Payer jobs must be an array.");
    }
    const jobs = [];
    for (let i = 0; i < raw.length; i += 1) {
      const parsed = readPackJob(raw[i]);
      if (!parsed.ok) {
        return fail("invalid_pack", `jobs[${i}]: ${parsed.message}`);
      }
      jobs.push(parsed.job);
    }
    return { ok: true, jobs };
  }

  function readPayer(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return fail("invalid_pack", "Payer store must be a JSON object.");
    }
    const credits = readCredits(raw.credits, "payer credits");
    if (!credits.ok) return credits;
    const jobs = readJobs(raw.jobs);
    if (!jobs.ok) return jobs;
    return { ok: true, payer: { credits: credits.value, jobs: jobs.jobs } };
  }

  function readAgentCredits(raw) {
    if (raw == null) return fail("invalid_pack", "Agent credits are required.");
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return fail("invalid_pack", "Agent credits are not valid JSON.");
      }
    }
    if (typeof raw === "number") {
      const credits = readCredits(raw, "agent credits");
      if (!credits.ok) return credits;
      return { ok: true, credits: credits.value };
    }
    if (typeof raw === "object" && !Array.isArray(raw) && typeof raw.credits === "number") {
      const credits = readCredits(raw.credits, "agent credits");
      if (!credits.ok) return credits;
      return { ok: true, credits: credits.value };
    }
    return fail("invalid_pack", "Agent credits must be an integer >= 0.");
  }

  function readReceipts(raw) {
    const { receipts } = helpers();
    if (!receipts || !receipts.readReceiptList || !receipts.readReceipt) {
      return fail("invalid_pack", "Receipt helper failed to load.");
    }
    if (raw == null) return fail("invalid_pack", "Receipts are required.");
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return fail("invalid_pack", "Receipts are not valid JSON.");
      }
    }
    const items = Array.isArray(raw)
      ? raw
      : (raw && Array.isArray(raw.receipts) ? raw.receipts : null);
    if (!items) return fail("invalid_pack", "Receipts must be a JSON array.");
    const list = [];
    for (let i = 0; i < items.length; i += 1) {
      const parsed = receipts.readReceipt(items[i]);
      if (!parsed.ok) {
        return fail("invalid_pack", `receipts[${i}]: ${parsed.message}`);
      }
      receipts.upsertReceipt(list, parsed.receipt);
    }
    return { ok: true, receipts: list };
  }

  function readDemoKey(raw) {
    if (raw == null || raw === "") return { ok: true, demoKey: null };
    if (typeof raw === "string") {
      const key = raw.trim();
      if (!key) return { ok: true, demoKey: null };
      if (!KEY_PATTERN.test(key)) {
        return fail("invalid_pack", "Demo key must match lib_demo_ plus 32 hex characters.");
      }
      return { ok: true, demoKey: { key } };
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
      return fail("invalid_pack", "Demo key must be an object or omitted.");
    }
    if (raw.key == null || raw.key === "") return { ok: true, demoKey: null };
    if (typeof raw.key !== "string") {
      return fail("invalid_pack", "Demo key must be a string.");
    }
    const key = raw.key.trim();
    if (!KEY_PATTERN.test(key)) {
      return fail("invalid_pack", "Demo key must match lib_demo_ plus 32 hex characters.");
    }
    const demoKey = { key };
    if (typeof raw.mintedAt === "string" && raw.mintedAt.trim()) {
      demoKey.mintedAt = raw.mintedAt.trim();
    }
    return { ok: true, demoKey };
  }

  function readKeysObject(raw) {
    if (raw == null) return { ok: true, keys: null };
    if (typeof raw !== "object" || Array.isArray(raw)) {
      return fail("invalid_pack", "Pack keys must be a JSON object.");
    }
    const unknown = Object.keys(raw).filter((key) => !STORAGE_KEYS.includes(key));
    if (unknown.length) {
      return fail("invalid_pack", `Unknown storage key: ${unknown[0]}.`);
    }
    return { ok: true, keys: raw };
  }

  function snapshotFromKeys(keys) {
    const missing = REQUIRED_KEYS.filter((key) => keys[key] == null);
    if (missing.length) {
      return fail("invalid_pack", `Pack is missing ${missing[0]}.`);
    }
    const payer = readPayer(keys[PAYER_KEY]);
    if (!payer.ok) return payer;
    const agent = readAgentCredits(keys[AGENT_KEY]);
    if (!agent.ok) return agent;
    const receipts = readReceipts(keys[RECEIPTS_KEY]);
    if (!receipts.ok) return receipts;
    const demoKey = Object.prototype.hasOwnProperty.call(keys, DEMO_KEY)
      ? readDemoKey(keys[DEMO_KEY])
      : { ok: true, demoKey: null };
    if (!demoKey.ok) return demoKey;
    return {
      ok: true,
      payer: payer.payer,
      agentCredits: agent.credits,
      receipts: receipts.receipts,
      demoKey: demoKey.demoKey,
    };
  }

  function snapshotFromFields(raw) {
    const payerRaw = raw.payer || raw[PAYER_KEY];
    if (!payerRaw) return fail("invalid_pack", "Pack must include payer credits and jobs.");
    const payer = readPayer(payerRaw);
    if (!payer.ok) return payer;
    const agentRaw = firstDefined(raw.agent_credits, raw.agentCredits, raw.agent, raw[AGENT_KEY]);
    const agent = readAgentCredits(agentRaw);
    if (!agent.ok) return agent;
    const receiptsRaw = firstDefined(raw.receipts, raw[RECEIPTS_KEY]);
    const receipts = readReceipts(receiptsRaw);
    if (!receipts.ok) return receipts;
    const demoRaw = firstDefined(raw.demo_key, raw.demoKey, raw[DEMO_KEY]);
    const demoKey = readDemoKey(demoRaw);
    if (!demoKey.ok) return demoKey;
    return {
      ok: true,
      payer: payer.payer,
      agentCredits: agent.credits,
      receipts: receipts.receipts,
      demoKey: demoKey.demoKey,
    };
  }

  function firstDefined(...values) {
    for (const value of values) {
      if (value !== undefined) return value;
    }
    return undefined;
  }

  function buildKeys(payer, agentCredits, receipts, demoKey) {
    const keys = {
      [PAYER_KEY]: payer,
      [AGENT_KEY]: { credits: agentCredits },
      [RECEIPTS_KEY]: receipts,
    };
    if (demoKey) keys[DEMO_KEY] = demoKey;
    return keys;
  }

  function normalizePack(source, exportedAt) {
    const keys = buildKeys(source.payer, source.agentCredits, source.receipts, source.demoKey);
    return {
      kind: KIND,
      version: VERSION,
      money: false,
      mode: "demo",
      exportedAt,
      payer: source.payer,
      agent_credits: source.agentCredits,
      receipts: source.receipts,
      demo_key: source.demoKey,
      keys,
    };
  }

  function readPack(raw) {
    const parsed = parseJson(raw);
    if (!parsed.ok) return parsed;
    const data = parsed.value;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return fail("invalid_pack", "Demo pack must be a JSON object.");
    }
    if (data.kind !== KIND) {
      return fail("invalid_pack", "Not a Liberty Settlement demo pack.");
    }
    if (data.version !== VERSION) {
      return fail("invalid_pack", "Unsupported demo pack version.");
    }
    if (data.money !== false) {
      return fail("invalid_pack", "Demo pack must set money: false.");
    }

    const keysRead = readKeysObject(data.keys);
    if (!keysRead.ok) return keysRead;
    const source = keysRead.keys
      ? snapshotFromKeys(keysRead.keys)
      : snapshotFromFields(data);
    if (!source.ok) return source;

    let exportedAt = null;
    if (data.exportedAt != null && data.exportedAt !== "") {
      if (typeof data.exportedAt !== "string" || !data.exportedAt.trim()) {
        return fail("invalid_pack", "exportedAt must be a string.");
      }
      exportedAt = data.exportedAt.trim();
    }

    const pack = normalizePack(source, exportedAt);
    return {
      ok: true,
      pack,
      containsDemoKey: Boolean(source.demoKey),
      summary: summarizePack(pack),
    };
  }

  function encodePack(source, options) {
    const opts = options || {};
    let snapshot;
    if (source && source.keys) {
      snapshot = snapshotFromKeys(source.keys);
    } else if (source && source.kind === KIND) {
      snapshot = snapshotFromFields(source);
    } else if (source && (source.payer || source[PAYER_KEY])) {
      snapshot = snapshotFromFields(source);
    } else {
      return fail("invalid_pack", "Need payer credits, jobs, agent credits, and receipts.");
    }
    if (!snapshot.ok) return snapshot;

    const exportedAt = typeof opts.exportedAt === "string" && opts.exportedAt.trim()
      ? opts.exportedAt.trim()
      : new Date().toISOString();
    const pack = normalizePack(snapshot, exportedAt);
    return {
      ok: true,
      pack,
      text: `${JSON.stringify(pack, null, 2)}\n`,
      filename: FILENAME,
      containsDemoKey: Boolean(snapshot.demoKey),
      summary: summarizePack(pack),
    };
  }

  function summarizePack(pack) {
    const payer = pack && pack.payer ? pack.payer : { credits: 0, jobs: [] };
    const jobs = Array.isArray(payer.jobs) ? payer.jobs : [];
    const receipts = Array.isArray(pack.receipts) ? pack.receipts : [];
    return {
      payerCredits: payer.credits || 0,
      jobCount: jobs.length,
      agentCredits: pack.agent_credits || 0,
      receiptCount: receipts.length,
      containsDemoKey: Boolean(pack.demo_key),
      exportedAt: pack.exportedAt || null,
    };
  }

  function confirmMessage(pack) {
    const parsed = pack && pack.ok ? pack : (pack && pack.kind === KIND ? { ok: true, pack, summary: summarizePack(pack) } : readPack(pack));
    if (!parsed.ok) return parsed;
    const s = parsed.summary;
    const keyLine = s.containsDemoKey
      ? "Demo API key: included (raw key in the file)."
      : "Demo API key: not in this pack — this browser’s stored key will be cleared.";
    const message = [
      "Replace this browser’s Settlement demo with this pack?",
      `Payer credits: ${s.payerCredits}. Jobs: ${s.jobCount}. Agent credits: ${s.agentCredits}. Receipts: ${s.receiptCount}.`,
      keyLine,
      "This replaces the current localStorage state. It does not merge. Liberty does not receive the file. Demo only — not real money.",
    ].join(" ");
    return { ok: true, message, pack: parsed.pack, summary: s, containsDemoKey: s.containsDemoKey };
  }

  function storageWrites(raw) {
    const parsed = raw && raw.kind === KIND && raw.keys ? readPack(raw) : readPack(raw);
    if (!parsed.ok) return parsed;
    const pack = parsed.pack;
    const writes = {
      [PAYER_KEY]: JSON.stringify(pack.payer),
      [AGENT_KEY]: JSON.stringify({ credits: pack.agent_credits }),
      [RECEIPTS_KEY]: JSON.stringify(pack.receipts),
    };
    const removes = [];
    if (pack.demo_key) writes[DEMO_KEY] = JSON.stringify(pack.demo_key);
    else removes.push(DEMO_KEY);
    return {
      ok: true,
      pack,
      writes,
      removes,
      containsDemoKey: Boolean(pack.demo_key),
      summary: parsed.summary,
    };
  }

  return {
    AGENT_KEY,
    DEMO_KEY,
    FILENAME,
    KIND,
    PAYER_KEY,
    RECEIPTS_KEY,
    REQUIRED_KEYS,
    STORAGE_KEYS,
    VERSION,
    confirmMessage,
    encodePack,
    readPack,
    storageWrites,
    summarizePack,
  };
});
