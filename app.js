(() => {
  const STORAGE_KEY = "liberty.agent-settlement.v0";
  const KEY_STORAGE = "liberty.agent-settlement.demo-key.v0";
  const KEY_REVEAL = "liberty.agent-settlement.demo-key.reveal";
  const TRANSITION_URL = "/api/v0/transition";
  const QUOTE_URL = "/api/v0/quote";
  const SIMULATE_URL = "/api/v0/simulate";
  const VERIFY_URL = "/api/v0/verify";
  const CHANGELOG_URL = "/api/changelog.json";
  const CHANGELOG_LIMIT = 12;
  const SCOREBOARD_URL = "/api/scoreboard.json";
  const QUICKSTART_URL = "/api/quickstart.json";
  const SIMULATE_DEFAULTS = {
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    proof_url: "https://example.com/proof",
    proof_note: "Three-bullet brief attached.",
  };
  const STATUSES = ["open", "funded", "submitted", "released", "disputed"];
  const QUOTE_ACTIONS = ["fund", "release", "dispute"];

  const els = {
    balance: document.getElementById("credit-balance"),
    agentBalance: document.getElementById("agent-credit-balance"),
    flash: document.getElementById("flash"),
    topupForm: document.getElementById("topup-form"),
    topupAmount: document.getElementById("topup-amount"),
    agentTopupForm: document.getElementById("agent-topup-form"),
    agentTopupAmount: document.getElementById("agent-topup-amount"),
    createForm: document.getElementById("create-form"),
    jobList: document.getElementById("job-list"),
    jobsEmpty: document.getElementById("jobs-empty"),
    detail: document.getElementById("job-detail"),
    reset: document.getElementById("reset-demo"),
    keyEmpty: document.getElementById("apikey-empty"),
    keyLive: document.getElementById("apikey-live"),
    keyValue: document.getElementById("apikey-value"),
    keyOnce: document.getElementById("apikey-once"),
    keyLabel: document.getElementById("apikey-label"),
    mintKey: document.getElementById("mint-key"),
    copyKey: document.getElementById("copy-key"),
    revokeKey: document.getElementById("revoke-key"),
    handoffForm: document.getElementById("handoff-form"),
    handoffInput: document.getElementById("handoff-input"),
    receiptList: document.getElementById("receipt-list"),
    receiptsEmpty: document.getElementById("receipts-empty"),
    receiptsActions: document.getElementById("receipts-actions"),
    downloadReceipts: document.getElementById("download-receipts"),
    downloadReceiptsNdjson: document.getElementById("download-receipts-ndjson"),
    copyReceipts: document.getElementById("copy-receipts"),
    receiptForm: document.getElementById("receipt-form"),
    receiptInput: document.getElementById("receipt-input"),
    verifyForm: document.getElementById("verify-form"),
    verifyPick: document.getElementById("verify-pick"),
    verifyPickWrap: document.getElementById("verify-pick-wrap"),
    verifyInput: document.getElementById("verify-input"),
    verifyResult: document.getElementById("verify-result"),
    simulateDemo: document.getElementById("simulate-demo"),
    simulateDispute: document.getElementById("simulate-dispute"),
    simulateNote: document.getElementById("simulate-note"),
    simulateResult: document.getElementById("simulate-result"),
    whatsNewList: document.getElementById("whats-new-list"),
    whatsNewEmpty: document.getElementById("whats-new-empty"),
    scoreboardFacts: document.getElementById("scoreboard-facts"),
    scoreboardEmpty: document.getElementById("scoreboard-empty"),
    scoreboardListings: document.getElementById("scoreboard-listings"),
    scoreboardListingsLabel: document.getElementById("scoreboard-listings-label"),
    scoreboardNote: document.getElementById("scoreboard-note"),
    integrateBody: document.getElementById("integrate-body"),
    integrateEmpty: document.getElementById("integrate-empty"),
    exportPack: document.getElementById("export-demo-pack"),
    resetPack: document.getElementById("reset-demo-pack"),
    importPackForm: document.getElementById("import-demo-pack-form"),
    importPackFile: document.getElementById("import-demo-pack-file"),
    importPackInput: document.getElementById("import-demo-pack-input"),
    ledgerFacts: document.getElementById("ledger-facts"),
    ledgerEmpty: document.getElementById("ledger-empty"),
    downloadLedgerCsv: document.getElementById("download-ledger-csv"),
    activityList: document.getElementById("activity-list"),
    activityEmpty: document.getElementById("activity-empty"),
    clearActivity: document.getElementById("clear-activity"),
  };

  const handoff = window.LibertyJobHandoff;
  const receiptsApi = window.LibertyReceiptExport;
  const walletApi = window.LibertyAgentWallet;
  const packApi = window.LibertyDemoPack;
  const ledgerApi = window.LibertySettlementLedger;
  const activityApi = window.LibertySettlementActivity;

  function emptyState() {
    return { credits: 0, jobs: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return emptyState();
      const credits = Number.isFinite(data.credits) ? Math.max(0, Math.floor(data.credits)) : 0;
      const jobs = Array.isArray(data.jobs) ? data.jobs.filter(validJob) : [];
      return { credits, jobs };
    } catch {
      return emptyState();
    }
  }

  function validJob(job) {
    return job
      && typeof job.id === "string"
      && typeof job.title === "string"
      && Number.isFinite(job.amount)
      && STATUSES.includes(job.status);
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadAgentCredits() {
    if (!walletApi) return 0;
    try {
      return walletApi.readCredits(localStorage.getItem(walletApi.STORAGE_KEY));
    } catch {
      return 0;
    }
  }

  function saveAgentCredits() {
    if (!walletApi) return;
    localStorage.setItem(walletApi.STORAGE_KEY, walletApi.writeCredits(agentCredits));
  }

  function loadReceipts() {
    if (!receiptsApi) return [];
    try {
      return receiptsApi.readReceiptList(localStorage.getItem(receiptsApi.STORAGE_KEY));
    } catch {
      return [];
    }
  }

  function saveReceipts() {
    if (!receiptsApi) return;
    localStorage.setItem(receiptsApi.STORAGE_KEY, JSON.stringify(receipts));
  }

  function loadActivity() {
    if (!activityApi) return [];
    try {
      return activityApi.readEvents(localStorage.getItem(activityApi.STORAGE_KEY));
    } catch {
      return [];
    }
  }

  function saveActivity() {
    if (!activityApi) return;
    localStorage.setItem(activityApi.STORAGE_KEY, activityApi.writeEvents(activity));
  }

  function recordActivity(action, source) {
    if (!activityApi) return;
    const src = source && typeof source === "object" ? source : {};
    const job = src.job && typeof src.job === "object" ? src.job : null;
    const receipt = src.receipt && typeof src.receipt === "object" ? src.receipt : null;
    const input = { action };
    const jobId = src.job_id || src.jobId || (job && job.id) || (receipt && receipt.job_id);
    const clientRef = src.client_ref || src.clientRef
      || (job && (job.clientRef || job.client_ref))
      || (receipt && receipt.client_ref);
    if (jobId) input.job_id = jobId;
    if (clientRef) input.client_ref = clientRef;
    if (typeof src.detail === "string" && src.detail.trim()) input.detail = src.detail.trim();
    const next = activityApi.appendEvent(activity, input);
    if (!next.ok) return;
    activity = next.events;
    saveActivity();
  }

  function rememberReceipt(source, extras) {
    if (!receiptsApi) return null;
    const parsed = receiptsApi.readReceipt(source, extras);
    if (!parsed.ok) return null;
    receiptsApi.upsertReceipt(receipts, parsed.receipt);
    saveReceipts();
    return parsed.receipt;
  }

  function syncReceiptsFromJobs() {
    if (!receiptsApi) return;
    for (const job of state.jobs) {
      if (job.status !== "released" && job.status !== "disputed") continue;
      if (receipts.some((item) => item.job_id === job.id)) continue;
      rememberReceipt(job, job.receiptKeyId ? { key_id: job.receiptKeyId } : undefined);
    }
  }

  function downloadText(text, filename, type) {
    const blob = new Blob([text], { type: type || "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function findReceipt(jobId) {
    return receipts.find((item) => item.job_id === jobId) || null;
  }

  function loadDemoKeyRecord() {
    try {
      const raw = localStorage.getItem(KEY_STORAGE);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data.key !== "string" || !data.key.trim()) return null;
      const record = { key: data.key.trim() };
      if (typeof data.mintedAt === "string" && data.mintedAt.trim()) {
        record.mintedAt = data.mintedAt.trim();
      }
      return record;
    } catch {
      return null;
    }
  }

  function loadDemoKey() {
    const record = loadDemoKeyRecord();
    return record ? record.key : "";
  }

  function applyDemoPack(raw) {
    if (!packApi) {
      flash("Demo pack helper failed to load.", true);
      return false;
    }
    const parsed = packApi.readPack(raw);
    if (!parsed.ok) {
      flash(parsed.message || "Could not read that demo pack.", true);
      return false;
    }
    const prompt = packApi.confirmMessage(parsed.pack);
    if (!prompt.ok) {
      flash(prompt.message || "Could not confirm that demo pack.", true);
      return false;
    }
    if (!confirm(prompt.message)) return false;
    const writes = packApi.storageWrites(parsed.pack);
    if (!writes.ok) {
      flash(writes.message || "Could not apply that demo pack.", true);
      return false;
    }
    Object.entries(writes.writes).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    writes.removes.forEach((key) => localStorage.removeItem(key));
    try { sessionStorage.removeItem(KEY_REVEAL); } catch { /* ignore */ }
    state = load();
    receipts = loadReceipts();
    agentCredits = loadAgentCredits();
    pendingQuote = null;
    if (els.importPackInput) els.importPackInput.value = "";
    if (els.importPackFile) els.importPackFile.value = "";
    const keyNote = writes.containsDemoKey ? " Raw demo key restored in this browser." : "";
    const jobLabel = writes.summary.jobCount === 1 ? "1 job" : `${writes.summary.jobCount} jobs`;
    const receiptLabel = writes.summary.receiptCount === 1 ? "1 receipt" : `${writes.summary.receiptCount} receipts`;
    flash(`Imported demo pack. ${jobLabel}, ${receiptLabel}.${keyNote} Liberty did not receive the file. Demo only.`);
    recordActivity("import", { detail: `${jobLabel}, ${receiptLabel}` });
    selectJob(null);
    return true;
  }

  function resetDemo() {
    const prompt = packApi && packApi.resetConfirmMessage
      ? packApi.resetConfirmMessage()
      : {
        ok: true,
        message: "Clear this browser’s Settlement demo? Payer credits, agent credits, jobs, receipts, and the demo API key will be removed. Other localStorage is left alone. Liberty does not receive anything. Demo only — not real money.",
      };
    if (!prompt.ok) return flash(prompt.message || "Could not reset the demo.", true);
    if (!confirm(prompt.message)) return;
    const cleared = packApi && packApi.clearStorage
      ? packApi.clearStorage()
      : { ok: true, removes: [STORAGE_KEY, KEY_STORAGE, "liberty.agent-settlement.receipts.v0", "liberty.agent-settlement.agent-credits.v0"] };
    if (!cleared.ok) return flash(cleared.message || "Could not reset the demo.", true);
    (cleared.removes || []).forEach((key) => localStorage.removeItem(key));
    try { sessionStorage.removeItem(KEY_REVEAL); } catch { /* ignore */ }
    state = emptyState();
    receipts = [];
    agentCredits = 0;
    pendingQuote = null;
    if (els.importPackInput) els.importPackInput.value = "";
    if (els.importPackFile) els.importPackFile.value = "";
    if (els.verifyInput) els.verifyInput.value = "";
    renderSimulateResult(null);
    renderVerifyResult(null);
    flash("Demo reset. Settlement localStorage in this browser is empty. Activity log kept. Other keys were left alone. Liberty did not receive anything.");
    recordActivity("reset", { detail: "demo keys cleared" });
    if (location.hash && /^#job\//i.test(location.hash)) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    render();
  }

  function clearActivityLog() {
    const prompt = activityApi && activityApi.confirmClearMessage
      ? activityApi.confirmClearMessage()
      : {
        ok: true,
        message: "Clear this browser’s activity log? Jobs, wallets, receipts, and the demo API key stay. Only the activity list is removed. Liberty does not receive anything. Demo only.",
      };
    if (!prompt.ok) return flash(prompt.message || "Could not clear activity.", true);
    if (!confirm(prompt.message)) return;
    activity = activityApi && activityApi.clearEvents
      ? activityApi.clearEvents().events
      : [];
    if (activityApi) localStorage.removeItem(activityApi.STORAGE_KEY);
    flash("Activity log cleared. Jobs, wallets, and receipts were left alone. Liberty did not receive anything.");
    render();
  }

  function exportDemoPack() {
    if (!packApi) return flash("Demo pack helper failed to load.", true);
    const source = {
      payer: state,
      agent_credits: agentCredits,
      receipts,
    };
    const record = loadDemoKeyRecord();
    if (record) source.demo_key = record;
    const encoded = packApi.encodePack(source);
    if (!encoded.ok) return flash(encoded.message || "Could not build a demo pack.", true);
    downloadText(encoded.text, encoded.filename, "application/json");
    const keyNote = encoded.containsDemoKey ? " This file includes the raw demo API key." : "";
    flash(`Downloaded demo pack.${keyNote} Client-held only — Liberty did not receive the file. Demo only.`);
    const summary = encoded.summary || {};
    const jobLabel = summary.jobCount === 1 ? "1 job" : `${summary.jobCount || 0} jobs`;
    const receiptLabel = summary.receiptCount === 1 ? "1 receipt" : `${summary.receiptCount || 0} receipts`;
    recordActivity("export", { detail: `${jobLabel}, ${receiptLabel}` });
    renderActivity();
  }

  function saveDemoKey(key) {
    if (!key) {
      localStorage.removeItem(KEY_STORAGE);
      sessionStorage.removeItem(KEY_REVEAL);
      return;
    }
    localStorage.setItem(KEY_STORAGE, JSON.stringify({
      key,
      mintedAt: new Date().toISOString(),
    }));
  }

  function mintDemoKey() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `lib_demo_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }

  function maskKey(key) {
    if (!key || key.length < 16) return "lib_demo_…";
    return `${key.slice(0, 12)}…${key.slice(-4)}`;
  }

  function revealKeyThisVisit() {
    try {
      return sessionStorage.getItem(KEY_REVEAL) === "1";
    } catch {
      return false;
    }
  }

  function setRevealKeyThisVisit(on) {
    try {
      if (on) sessionStorage.setItem(KEY_REVEAL, "1");
      else sessionStorage.removeItem(KEY_REVEAL);
    } catch {
      /* ignore */
    }
  }

  let state = load();
  let receipts = loadReceipts();
  let agentCredits = loadAgentCredits();
  let activity = loadActivity();
  let inflight = false;
  let pendingQuote = null;

  function selectedId() {
    const match = location.hash.match(/^#job\/([a-z0-9_]+)/i);
    return match ? match[1] : null;
  }

  function selectJob(id) {
    if (!pendingQuote || pendingQuote.jobId !== id) pendingQuote = null;
    if (id) location.hash = `#job/${id}`;
    else if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    render();
  }

  function findJob(id) {
    return state.jobs.find((job) => job.id === id) || null;
  }

  function upsertJob(job) {
    const parsed = handoff && handoff.readJob ? handoff.readJob(job) : { ok: false };
    if (!parsed.ok) return null;
    const next = parsed.job;
    const idx = state.jobs.findIndex((item) => item.id === next.id);
    if (idx === -1) state.jobs.unshift(next);
    else {
      const existing = state.jobs[idx];
      state.jobs[idx] = existing.receiptKeyId
        ? { ...next, receiptKeyId: existing.receiptKeyId }
        : next;
    }
    save(state);
    if (next.status === "released" || next.status === "disputed") {
      rememberReceipt(next, next.receiptKeyId ? { key_id: next.receiptKeyId } : undefined);
    }
    return next;
  }

  function handoffHref(job) {
    if (!handoff) return { ok: false, message: "Handoff helper failed to load." };
    return handoff.buildHandoffHref(job, location.origin + location.pathname);
  }

  function receiptHref(source, extras) {
    if (!receiptsApi || !receiptsApi.buildReceiptHref) {
      return { ok: false, message: "Receipt helper failed to load." };
    }
    return receiptsApi.buildReceiptHref(source, location.origin + location.pathname, extras);
  }

  function applyHandoffInput(raw, { fromLink } = {}) {
    if (!handoff) {
      flash("Handoff helper failed to load.", true);
      return null;
    }
    const decoded = handoff.decodeHandoffInput(raw);
    if (!decoded.ok) {
      flash(decoded.message || "Could not read that handoff.", true);
      return null;
    }
    const job = upsertJob(decoded.job);
    if (!job) {
      flash("That handoff job is not valid.", true);
      return null;
    }
    const next = decoded.next && decoded.next.length
      ? ` Next: ${decoded.next.join(" / ")}.`
      : " This job is already terminal.";
    const source = fromLink ? "handoff link" : "handoff";
    flash(`Loaded ${job.id} (${job.status}) from a ${source}.${next} Credits stay in this browser. Demo only.`);
    return job;
  }

  function consumeHandoffFromLocation() {
    if (!handoff) return false;
    const token = handoff.readLocationHandoff(location);
    if (!token) return false;
    const job = applyHandoffInput(token, { fromLink: true });
    if (job) {
      history.replaceState(null, "", `${location.pathname}#job/${job.id}`);
      return true;
    }
    history.replaceState(null, "", location.pathname);
    return true;
  }

  function applyReceiptInput(raw, { fromLink } = {}) {
    if (!receiptsApi || !receiptsApi.decodeReceiptInput) {
      flash("Receipt helper failed to load.", true);
      return null;
    }
    const decoded = receiptsApi.decodeReceiptInput(raw);
    if (!decoded.ok) {
      flash(decoded.message || "Could not read that receipt link.", true);
      return null;
    }
    const receipt = rememberReceipt(decoded.receipt);
    if (!receipt) {
      flash("That receipt is not valid.", true);
      return null;
    }
    const source = fromLink ? "receipt link" : "receipt code";
    flash(`Loaded receipt ${receipt.job_id} (${receipt.status}) from a ${source}. Inspect it or verify with the engine. Liberty did not store it. Demo only.`);
    return receipt;
  }

  function consumeReceiptFromLocation() {
    if (!receiptsApi || !receiptsApi.readLocationReceipt) return false;
    const token = receiptsApi.readLocationReceipt(location);
    if (!token) return false;
    const receipt = applyReceiptInput(token, { fromLink: true });
    history.replaceState(null, "", location.pathname);
    if (receipt) {
      render();
      fillVerifyInput(receipt);
      if (els.verifyInput) els.verifyInput.scrollIntoView({ block: "nearest" });
    }
    return true;
  }

  async function copyReceiptLink(source, extras) {
    const built = receiptHref(source, extras);
    if (!built.ok) {
      flash(built.message || "Could not encode that receipt.", true);
      return false;
    }
    try {
      await navigator.clipboard.writeText(built.href);
      flash("Receipt link copied. Another device can open it to inspect or verify. Demo only.");
      return true;
    } catch {
      if (els.receiptInput) els.receiptInput.value = built.href;
      flash("Could not copy. The receipt link is in Open a receipt link — copy it from there.", true);
      return false;
    }
  }

  function flash(message, isError) {
    if (!els.flash) return;
    if (!message) {
      els.flash.hidden = true;
      els.flash.textContent = "";
      els.flash.classList.remove("error");
      return;
    }
    els.flash.hidden = false;
    els.flash.textContent = message;
    els.flash.classList.toggle("error", Boolean(isError));
  }

  function parseCredits(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 1) return null;
    return Math.floor(amount);
  }

  function formatWhen(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function receiptMarkdown(job) {
    const fee = job.status === "released" ? job.fee : 0;
    const payout = job.status === "released" ? job.agentPayout : 0;
    const refund = job.status === "disputed" ? job.amount : 0;
    const stored = findReceipt(job.id);
    const clientRef = (stored && stored.client_ref) || job.clientRef;
    const callbackUrl = (stored && stored.callback_url) || job.callbackUrl;
    const lines = [
      "# Agent Settlement receipt",
      "",
      "Demo — not real money. Credits were simulated in a browser.",
      "",
      `- Job ID: ${job.id}`,
    ];
    if (clientRef) lines.push(`- Client ref: ${clientRef}`);
    if (callbackUrl) lines.push(`- Callback URL: ${callbackUrl} (Liberty never fetches this)`);
    lines.push(
      `- Title: ${job.title}`,
      `- Status: ${job.status}`,
      `- Amount: ${job.amount} credits`,
      `- Release fee (5%): ${fee} credits`,
      `- Agent payout: ${payout} credits`,
      `- Returned to payer: ${refund} credits`,
      `- Success criteria: ${job.criteria}`,
      `- Proof: ${job.proofUrl || "—"}`,
    );
    const proofNote = (stored && stored.proof_note) || job.proofNote;
    if (proofNote) lines.push(`- Proof note: ${proofNote}`);
    lines.push(
      `- Created: ${job.createdAt}`,
      `- Funded: ${job.fundedAt || "—"}`,
    );
    if (job.expiresAt) lines.push(`- Hold expires: ${job.expiresAt}`);
    lines.push(
      `- Submitted: ${job.submittedAt || "—"}`,
      `- Resolved: ${job.resolvedAt || "—"}`,
    );
    if (job.receiptKeyId) lines.push(`- Demo key_id: ${job.receiptKeyId}`);
    const releaseNote = (stored && stored.release_note) || job.releaseNote;
    const disputeReason = (stored && stored.dispute_reason) || job.disputeReason;
    if (job.status === "released" && releaseNote) lines.push(`- Release note: ${releaseNote}`);
    if (job.status === "disputed" && disputeReason) lines.push(`- Dispute reason: ${disputeReason}`);
    lines.push("");
    return lines.join("\n");
  }

  function applyResult(data) {
    if (data.job) {
      const existing = state.jobs.find((job) => job.id === data.job.id);
      const receiptKeyId = data.key_id || (existing && existing.receiptKeyId);
      const nextJob = receiptKeyId
        ? { ...data.job, receiptKeyId }
        : data.job;
      const idx = state.jobs.findIndex((job) => job.id === nextJob.id);
      if (idx === -1) state.jobs.unshift(nextJob);
      else state.jobs[idx] = nextJob;
    }
    if (Number.isFinite(data.payer_credits)) {
      state.credits = Math.max(0, Math.floor(data.payer_credits));
    }
    if (walletApi) {
      agentCredits = walletApi.applyEngineResult(agentCredits, data);
      saveAgentCredits();
    }
    save(state);
    if (data.receipt) {
      rememberReceipt(data.receipt, { key_id: data.receipt.key_id || data.key_id });
    } else if (data.job && (data.job.status === "released" || data.job.status === "disputed")) {
      rememberReceipt(data.job, { key_id: data.key_id });
    }
  }

  async function postEngine(url, payload, failLabel) {
    if (inflight) return null;
    inflight = true;
    document.body.classList.add("pending");
    try {
      const headers = { "Content-Type": "application/json" };
      const demoKey = loadDemoKey();
      if (demoKey) headers.Authorization = `Bearer ${demoKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        flash("Settlement engine returned an unreadable response.", true);
        return null;
      }
      if (!res.ok || !data || data.ok !== true) {
        flash((data && data.message) || failLabel, true);
        return null;
      }
      return data;
    } catch {
      flash("Could not reach the settlement engine. Try again.", true);
      return null;
    } finally {
      inflight = false;
      document.body.classList.remove("pending");
    }
  }

  function postTransition(payload) {
    return postEngine(TRANSITION_URL, payload, "Transition failed.");
  }

  function postQuote(payload) {
    return postEngine(QUOTE_URL, payload, "Quote failed.");
  }

  function postSimulate(payload) {
    return postEngine(SIMULATE_URL, payload, "Simulate failed.");
  }

  function simulateImpactLine(data) {
    const job = data.job || {};
    const receipt = data.receipt || {};
    if (job.status === "disputed") {
      return `Disputed ${job.id}. Returned to payer ${receipt.returned_to_payer}. Fee 0. Agent wallet unchanged. Payer credits: ${data.payer_credits}.`;
    }
    const delta = Number.isInteger(data.agent_credits_delta) ? data.agent_credits_delta : receipt.agent_payout;
    return `Released ${job.id}. Fee ${receipt.release_fee}. Agent payout ${receipt.agent_payout}. Agent wallet +${delta}. Payer credits: ${data.payer_credits}.`;
  }

  function renderSimulateResult(data) {
    if (!els.simulateResult) return;
    if (!data) {
      els.simulateResult.hidden = true;
      els.simulateResult.replaceChildren();
      return;
    }
    const path = Array.isArray(data.steps)
      ? data.steps.map((step) => step.action).join(" → ")
      : (data.terminal || "release");
    els.simulateResult.hidden = false;
    els.simulateResult.innerHTML = `
      <p class="quote-kicker">Demo — not real money</p>
      <p class="quote-impact"></p>
      <p class="hint"></p>
      ${data.receipt ? `<div class="action-row"><button type="button" class="secondary" data-simulate-action="copy-receipt-link">Copy receipt link</button></div>` : ""}
    `;
    els.simulateResult.querySelector(".quote-impact").textContent = simulateImpactLine(data);
    els.simulateResult.querySelector(".hint").textContent =
      `Full walk: ${path}. Receipt saved in this browser. Copy a receipt link to inspect or verify on another device. Liberty did not store the job.`;
  }

  async function runSimulate(terminal) {
    const amount = SIMULATE_DEFAULTS.amount;
    const starting = state.credits < amount ? state.credits + amount : state.credits;
    const note = els.simulateNote ? els.simulateNote.value.trim() : "";
    const data = await postSimulate({
      title: SIMULATE_DEFAULTS.title,
      amount,
      criteria: SIMULATE_DEFAULTS.criteria,
      payer_credits: starting,
      proof_url: SIMULATE_DEFAULTS.proof_url,
      proof_note: SIMULATE_DEFAULTS.proof_note,
      terminal,
      ...(note
        ? (terminal === "dispute" ? { dispute_reason: note } : { release_note: note })
        : {}),
    });
    if (!data) {
      renderSimulateResult(null);
      return;
    }
    applyResult(data);
    recordActivity("simulate", {
      job: data.job,
      receipt: data.receipt,
      detail: data.terminal || (data.job && data.job.status) || "release",
    });
    renderSimulateResult(data);
    flash(
      data.job && data.job.status === "disputed"
        ? `Full demo walk disputed. ${data.returned_to_payer} credits returned. Fee 0. Agent wallet unchanged. Receipt saved. Demo — not real money.`
        : `Full demo walk released. Agent wallet +${data.agent_payout} credits. Fee ${data.fee} credits. Receipt saved. Demo — not real money.`,
    );
    selectJob(data.job.id);
  }

  async function postVerify(payload) {
    if (inflight) return null;
    inflight = true;
    document.body.classList.add("pending");
    try {
      const headers = { "Content-Type": "application/json" };
      const demoKey = loadDemoKey();
      if (demoKey) headers.Authorization = `Bearer ${demoKey}`;
      const res = await fetch(VERIFY_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        flash("Verify returned an unreadable response.", true);
        return null;
      }
      return data;
    } catch {
      flash("Could not reach the verify engine. Try again.", true);
      return null;
    } finally {
      inflight = false;
      document.body.classList.remove("pending");
    }
  }

  function moneyActionPayload(action, job, note) {
    if (action === "fund") return { action, job, payer_credits: state.credits };
    if (action === "submit") return { action, job };
    if (action === "release") {
      const payload = { action, job };
      if (note) payload.release_note = note;
      return payload;
    }
    if (action === "dispute") {
      const payload = { action, job, payer_credits: state.credits };
      if (note) payload.dispute_reason = note;
      return payload;
    }
    return { action, job };
  }

  function readTerminalNote() {
    const field = els.detail && els.detail.querySelector("#terminal-note");
    return field ? field.value.trim() : "";
  }

  function quoteImpactLine(action, data) {
    if (action === "fund") {
      return `Hold ${data.job.amount} credits. Fee 0. Payer credits after: ${data.payer_credits_after}.`;
    }
    if (action === "release") {
      const delta = Number.isInteger(data.agent_credits_delta) ? data.agent_credits_delta : data.agent_payout;
      return `Fee ${data.fee}. Agent payout ${data.agent_payout}. Agent wallet +${delta}. Payer credits stay ${state.credits}.`;
    }
    if (action === "dispute") {
      const after = Number.isFinite(data.payer_credits_after)
        ? ` Payer credits after: ${data.payer_credits_after}.`
        : "";
      return `Returned to payer: ${data.returned_to_payer}. Fee 0. Agent wallet unchanged.${after}`;
    }
    return `Next status: ${data.job.status}.`;
  }

  function quotePreviewHtml(quote) {
    const data = quote.data;
    const next = data.job && data.job.status ? data.job.status : quote.action;
    const noteField = quote.action === "release" || quote.action === "dispute"
      ? `<label class="field">
          <span>${quote.action === "release" ? "Release note (optional)" : "Dispute reason (optional)"}</span>
          <textarea id="terminal-note" name="terminal-note" rows="2" maxlength="400" placeholder="${quote.action === "release" ? "Why this work is done — appears on the receipt" : "Why this is disputed — appears on the receipt"}">${escapeHtml(quote.note || "")}</textarea>
        </label>`
      : "";
    return `
      <aside class="quote-preview" aria-live="polite">
        <p class="quote-kicker">Demo quote — not real money</p>
        <p class="quote-impact">${escapeHtml(quoteImpactLine(quote.action, data))}</p>
        <p class="hint">Next status: ${escapeHtml(next)}. Nothing is committed until you confirm.</p>
        ${noteField}
      </aside>
      <div class="action-row">
        <button type="button" data-action="confirm-quote"${quote.action === "dispute" ? " class=\"warn\"" : ""}>Confirm ${escapeHtml(quote.action)}</button>
        <button type="button" class="secondary" data-action="cancel-quote">Cancel</button>
      </div>
    `;
  }

  async function requestQuote(action, id) {
    const job = findJob(id);
    if (!job) return;
    const data = await postQuote(moneyActionPayload(action, job));
    if (!data) return;
    pendingQuote = { jobId: id, action, data };
    render();
  }

  async function confirmQuotedAction() {
    if (!pendingQuote) return;
    const { action, jobId } = pendingQuote;
    const note = readTerminalNote();
    pendingQuote = null;
    if (action === "fund") return fundJob(jobId);
    if (action === "release") return releaseJob(jobId, note);
    if (action === "dispute") return disputeJob(jobId, note);
  }

  function cancelQuote() {
    pendingQuote = null;
    flash("");
    render();
  }

  function topUp(amount) {
    state.credits += amount;
    save(state);
    pendingQuote = null;
    flash(`Added ${amount} payer demo credits. Not real money.`);
    render();
  }

  function topUpAgent(amount) {
    agentCredits += amount;
    saveAgentCredits();
    flash(`Added ${amount} agent demo credits. localStorage only — not real money.`);
    render();
  }

  async function createJob({ title, amount, criteria, client_ref, callback_url }) {
    const payload = { action: "create", title, amount, criteria };
    if (client_ref) payload.client_ref = client_ref;
    if (callback_url) payload.callback_url = callback_url;
    const data = await postTransition(payload);
    if (!data) return false;
    applyResult(data);
    recordActivity("create", data);
    flash(`Job ${data.job.id} created. Fund it to hold ${data.job.amount} credits in escrow.`);
    selectJob(data.job.id);
    return true;
  }

  async function fundJob(id) {
    const job = findJob(id);
    if (!job) return;
    const data = await postTransition({
      action: "fund",
      job,
      payer_credits: state.credits,
    });
    if (!data) return;
    applyResult(data);
    recordActivity("fund", data);
    flash(`${data.job.amount} credits held in escrow for ${data.job.id}.`);
    render();
  }

  async function submitProof(id, proofUrl, proofNote) {
    const job = findJob(id);
    if (!job) return;
    const payload = {
      action: "submit",
      job,
      proof_url: proofUrl,
    };
    if (proofNote) payload.proof_note = proofNote;
    const data = await postTransition(payload);
    if (!data) return;
    applyResult(data);
    recordActivity("submit", data);
    flash("Proof submitted. Payer can release or dispute.");
    render();
  }

  async function releaseJob(id, note) {
    const job = findJob(id);
    if (!job) return;
    const data = await postTransition(moneyActionPayload("release", job, note));
    if (!data) return;
    applyResult(data);
    recordActivity("release", data);
    flash(`Released. Agent wallet +${data.job.agentPayout} credits. Fee ${data.job.fee} credits. Receipt saved in this browser. Demo only.`);
    render();
  }

  async function disputeJob(id, note) {
    const job = findJob(id);
    if (!job) return;
    const data = await postTransition(moneyActionPayload("dispute", job, note));
    if (!data) return;
    applyResult(data);
    recordActivity("dispute", data);
    flash(`Disputed. ${data.job.amount} credits returned to the payer. Agent wallet unchanged. Receipt saved in this browser.`);
    render();
  }

  function renderBalance() {
    if (els.balance) els.balance.textContent = String(state.credits);
    if (els.agentBalance) els.agentBalance.textContent = String(agentCredits);
  }

  function renderList() {
    if (!els.jobList || !els.jobsEmpty) return;
    const current = selectedId();
    els.jobsEmpty.hidden = state.jobs.length > 0;
    els.jobList.replaceChildren();
    for (const job of state.jobs) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "job-item";
      button.dataset.jobId = job.id;
      if (job.id === current) button.setAttribute("aria-current", "true");
      button.innerHTML = `<span class="job-item-title"></span><span class="job-item-meta"></span>`;
      button.querySelector(".job-item-title").textContent = job.title;
      button.querySelector(".job-item-meta").textContent = `${job.id} · ${job.amount} cr · ${job.status}`;
      item.appendChild(button);
      els.jobList.appendChild(item);
    }
  }

  function stepsHtml(status) {
    const path = status === "disputed"
      ? ["open", "funded", "submitted", "disputed"]
      : ["open", "funded", "submitted", "released"];
    return `<ol class="steps">${path.map((step) => (
      `<li class="${step === status ? "now" : ""}">${step}</li>`
    )).join("<li aria-hidden=\"true\">→</li>")}</ol>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function feeScheduleLabel(job) {
    if (job.status === "released") return `${job.fee} credits`;
    return "5% of amount, rounded on release";
  }

  function renderDetail() {
    if (!els.detail) return;
    const job = findJob(selectedId());
    if (!job) {
      els.detail.hidden = true;
      els.detail.replaceChildren();
      return;
    }

    const actions = [];
    const showingQuote = pendingQuote && pendingQuote.jobId === job.id && QUOTE_ACTIONS.includes(pendingQuote.action);
    if (showingQuote) {
      actions.push(quotePreviewHtml(pendingQuote));
    } else if (job.status === "open") {
      const canFund = state.credits >= job.amount;
      actions.push(`<button type="button" data-action="fund" ${canFund ? "" : "disabled"}>${canFund ? `Fund ${job.amount} credits` : "Need more credits to fund"}</button>`);
      actions.push(`<p class="hint">Adapters can stamp optional <code>expires_at</code> or <code>ttl_seconds</code> on fund. After that instant, release fails; dispute still refunds. This demo fund button does not send an expiry.</p>`);
    } else if (job.status === "funded") {
      actions.push(`
        <form id="proof-form" class="stack-form">
          <label class="field">
            <span>Proof URL</span>
            <input id="proof-url" name="proof" type="text" inputmode="url" required placeholder="https://… or a note the payer can check" />
          </label>
          <label class="field">
            <span>Proof note (optional)</span>
            <textarea id="proof-note" name="proof-note" rows="2" maxlength="400" placeholder="What the proof shows — appears on the receipt"></textarea>
          </label>
          <button type="submit">Submit proof</button>
        </form>
      `);
    } else if (job.status === "submitted") {
      actions.push(`
        <div class="action-row">
          <button type="button" data-action="release">Release (5% fee)</button>
          <button type="button" class="warn" data-action="dispute">Dispute (return ${job.amount})</button>
        </div>
      `);
    }

    const receipt = (job.status === "released" || job.status === "disputed")
      ? `<div class="receipt">
          <h3>Receipt</h3>
          <pre id="receipt-md"></pre>
          <label class="field">
            <span>Receipt link</span>
            <input id="receipt-link" class="apikey-value" type="text" readonly autocomplete="off" spellcheck="false" />
          </label>
          <div class="action-row">
            <button type="button" data-action="copy">Copy markdown</button>
            <button type="button" class="secondary" data-action="download">Download .md</button>
            <button type="button" class="ghost" data-action="copy-receipt-link">Copy receipt link</button>
            <button type="button" class="ghost" data-action="copy-receipt-code">Copy compact code</button>
            <button type="button" class="ghost" data-action="download-json">Download JSON</button>
            <button type="button" class="ghost" data-action="copy-json">Copy JSON</button>
            <button type="button" class="ghost" data-action="verify">Verify with engine</button>
          </div>
        </div>`
      : "";

    const next = handoff ? handoff.nextActions(job.status) : [];
    const nextHint = next.length
      ? `The other party can ${next.join(" or ")} from this snapshot.`
      : "Terminal snapshot — share to show the receipt.";

    els.detail.hidden = false;
    els.detail.innerHTML = `
      <h2>${escapeHtml(job.title)}</h2>
      ${stepsHtml(job.status)}
      <p><span class="status ${job.status}">${job.status}</span> · <code>${escapeHtml(job.id)}</code></p>
      <dl class="detail-meta">
        <dt>Amount</dt><dd>${job.amount} credits</dd>
        <dt>Release fee if released</dt><dd>${escapeHtml(feeScheduleLabel(job))}</dd>
        <dt>Success criteria</dt><dd></dd>
        <dt>Proof</dt><dd></dd>
        <dt>Created</dt><dd>${escapeHtml(formatWhen(job.createdAt))}</dd>
        <dt>Funded</dt><dd>${escapeHtml(formatWhen(job.fundedAt))}</dd>
        ${job.expiresAt ? `<dt>Hold expires</dt><dd>${escapeHtml(formatWhen(job.expiresAt))}</dd>` : ""}
        <dt>Submitted</dt><dd>${escapeHtml(formatWhen(job.submittedAt))}</dd>
        <dt>Resolved</dt><dd>${escapeHtml(formatWhen(job.resolvedAt))}</dd>
        ${(() => {
          const stored = findReceipt(job.id);
          const bits = [];
          if (job.clientRef || (stored && stored.client_ref)) {
            bits.push(`<dt>Client ref</dt><dd class="client-ref"></dd>`);
          }
          if (job.callbackUrl || (stored && stored.callback_url)) {
            bits.push(`<dt>Callback URL</dt><dd class="callback-url"></dd>`);
          }
          if (job.proofNote || (stored && stored.proof_note)) {
            bits.push(`<dt>Proof note</dt><dd class="proof-note"></dd>`);
          }
          if (job.status === "released" && (job.releaseNote || (stored && stored.release_note))) {
            bits.push(`<dt>Release note</dt><dd class="terminal-note"></dd>`);
          }
          if (job.status === "disputed" && (job.disputeReason || (stored && stored.dispute_reason))) {
            bits.push(`<dt>Dispute reason</dt><dd class="terminal-note"></dd>`);
          }
          return bits.join("");
        })()}
      </dl>
      ${actions.join("")}
      <div class="handoff-share">
        <h3>Share handoff</h3>
        <p class="hint">Copy a link or compact code for another browser. Encodes this job only — not credits, not the demo API key. Copy a fresh one after each action. Liberty does not store the job.</p>
        <p class="hint">${escapeHtml(nextHint)}</p>
        <label class="field">
          <span>Handoff link</span>
          <input id="handoff-link" class="apikey-value" type="text" readonly autocomplete="off" spellcheck="false" />
        </label>
        <div class="action-row">
          <button type="button" class="secondary" data-action="copy-handoff">Copy handoff link</button>
          <button type="button" class="ghost" data-action="copy-handoff-code">Copy compact code</button>
        </div>
      </div>
      ${receipt}
    `;

    const criteriaDd = els.detail.querySelectorAll(".detail-meta dd")[2];
    const proofDd = els.detail.querySelectorAll(".detail-meta dd")[3];
    if (criteriaDd) criteriaDd.textContent = job.criteria;
    if (proofDd) proofDd.textContent = job.proofUrl || "—";
    const clientRefDd = els.detail.querySelector(".detail-meta .client-ref");
    if (clientRefDd) {
      const stored = findReceipt(job.id);
      clientRefDd.textContent = job.clientRef || (stored && stored.client_ref) || "";
    }
    const callbackUrlDd = els.detail.querySelector(".detail-meta .callback-url");
    if (callbackUrlDd) {
      const stored = findReceipt(job.id);
      callbackUrlDd.textContent = job.callbackUrl || (stored && stored.callback_url) || "";
    }
    const proofNoteDd = els.detail.querySelector(".detail-meta .proof-note");
    if (proofNoteDd) {
      const stored = findReceipt(job.id);
      proofNoteDd.textContent = job.proofNote || (stored && stored.proof_note) || "";
    }
    const noteDd = els.detail.querySelector(".detail-meta .terminal-note");
    if (noteDd) {
      const stored = findReceipt(job.id);
      noteDd.textContent = job.status === "released"
        ? (job.releaseNote || (stored && stored.release_note) || "")
        : (job.disputeReason || (stored && stored.dispute_reason) || "");
    }

    const receiptPre = els.detail.querySelector("#receipt-md");
    if (receiptPre) receiptPre.textContent = receiptMarkdown(job);

    const linkInput = els.detail.querySelector("#handoff-link");
    if (linkInput) {
      const built = handoffHref(job);
      linkInput.value = built.ok ? built.href : "";
    }

    const receiptLinkInput = els.detail.querySelector("#receipt-link");
    if (receiptLinkInput) {
      const stored = findReceipt(job.id) || job;
      const built = receiptHref(stored, job.receiptKeyId ? { key_id: job.receiptKeyId } : undefined);
      receiptLinkInput.value = built.ok ? built.href : "";
    }

    const proofForm = els.detail.querySelector("#proof-form");
    if (proofForm) {
      proofForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("proof-url");
        const noteInput = document.getElementById("proof-note");
        submitProof(job.id, input ? input.value : "", noteInput ? noteInput.value.trim() : "");
      });
    }
  }

  function renderKey() {
    const key = loadDemoKey();
    const showFull = Boolean(key) && revealKeyThisVisit();
    if (els.keyEmpty) els.keyEmpty.hidden = Boolean(key);
    if (els.keyLive) els.keyLive.hidden = !key;
    if (els.keyOnce) els.keyOnce.hidden = !showFull;
    if (els.keyLabel) {
      els.keyLabel.textContent = showFull ? "Your demo key (copy now)" : "Your demo key (prefix only)";
    }
    if (els.keyValue) {
      els.keyValue.value = key ? (showFull ? key : maskKey(key)) : "";
    }
  }

  function renderReceipts() {
    if (!els.receiptList || !els.receiptsEmpty) return;
    els.receiptsEmpty.hidden = receipts.length > 0;
    if (els.receiptsActions) els.receiptsActions.hidden = receipts.length === 0;
    els.receiptList.replaceChildren();
    for (const receipt of receipts) {
      const item = document.createElement("li");
      item.className = "receipt-item";
      item.innerHTML = `
        <p class="receipt-item-title">
          <span class="status ${escapeHtml(receipt.status)}"></span>
          <code></code>
        </p>
        <p class="receipt-item-meta receipt-item-money"></p>
        <p class="receipt-item-meta receipt-item-when"></p>
        <div class="action-row">
          <button type="button" data-receipt-id="${escapeHtml(receipt.job_id)}" data-receipt-action="download-json">Download JSON</button>
          <button type="button" class="secondary" data-receipt-id="${escapeHtml(receipt.job_id)}" data-receipt-action="copy-json">Copy JSON</button>
          <button type="button" class="ghost" data-receipt-id="${escapeHtml(receipt.job_id)}" data-receipt-action="copy-link">Copy link</button>
          <button type="button" class="ghost" data-receipt-id="${escapeHtml(receipt.job_id)}" data-receipt-action="verify">Verify</button>
        </div>
      `;
      item.querySelector(".status").textContent = receipt.status;
      item.querySelector("code").textContent = receipt.job_id;
      item.querySelector(".receipt-item-money").textContent =
        `Fee ${receipt.release_fee} · Agent payout ${receipt.agent_payout} · Returned to payer ${receipt.returned_to_payer}`;
      const note = [receipt.proof_note, receipt.release_note || receipt.dispute_reason]
        .filter(Boolean)
        .join(" · ");
      const clientRef = receipt.client_ref ? ` · ${receipt.client_ref}` : "";
      const callbackUrl = receipt.callback_url ? ` · ${receipt.callback_url}` : "";
      item.querySelector(".receipt-item-when").textContent =
        `${receipt.job_id}${clientRef}${callbackUrl} · resolved ${formatWhen(receipt.resolved)} · created ${formatWhen(receipt.created)}${note ? ` · ${note}` : ""}`;
      els.receiptList.appendChild(item);
    }
    renderVerifyPick();
  }

  function renderVerifyPick() {
    if (!els.verifyPick) return;
    const current = els.verifyPick.value;
    els.verifyPick.replaceChildren();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = receipts.length ? "Paste JSON below, or pick one" : "Paste JSON below";
    els.verifyPick.appendChild(blank);
    for (const receipt of receipts) {
      const opt = document.createElement("option");
      opt.value = receipt.job_id;
      opt.textContent = `${receipt.job_id} · ${receipt.status} · ${receipt.amount} cr`;
      els.verifyPick.appendChild(opt);
    }
    if (current && receipts.some((item) => item.job_id === current)) {
      els.verifyPick.value = current;
    }
    if (els.verifyPickWrap) els.verifyPickWrap.hidden = receipts.length === 0;
  }

  function fillVerifyInput(receipt) {
    if (!els.verifyInput || !receiptsApi) return false;
    const exported = receiptsApi.exportOneJson(receipt);
    if (!exported.ok) return false;
    els.verifyInput.value = exported.text.trim();
    if (els.verifyPick && receipt.job_id) els.verifyPick.value = receipt.job_id;
    return true;
  }

  function renderVerifyResult(data) {
    if (!els.verifyResult) return;
    if (!data) {
      els.verifyResult.hidden = true;
      els.verifyResult.replaceChildren();
      els.verifyResult.className = "verify-result";
      return;
    }
    els.verifyResult.hidden = false;
    if (data.ok !== true) {
      els.verifyResult.className = "verify-result bad";
      els.verifyResult.innerHTML = `<p class="verify-kicker">Could not verify</p><p class="verify-impact"></p><p class="hint">Demo only — not real money. Liberty did not store this.</p>`;
      els.verifyResult.querySelector(".verify-impact").textContent = data.message || "Verify failed.";
      return;
    }
    const valid = data.valid === true;
    els.verifyResult.className = valid ? "verify-result ok" : "verify-result bad";
    const expected = data.expected || {};
    const received = data.received || {};
    const mismatches = Array.isArray(data.mismatches) ? data.mismatches : [];
    els.verifyResult.innerHTML = `
      <p class="verify-kicker">${valid ? "Valid" : "Mismatch"} — demo, not real money</p>
      <p class="verify-impact"></p>
      <dl class="detail-meta verify-meta">
        <dt>Expected</dt><dd class="verify-expected"></dd>
        <dt>Received</dt><dd class="verify-received"></dd>
      </dl>
      ${mismatches.length ? `<ul class="verify-mismatches"></ul>` : ""}
      <p class="hint">Same engine as quote/transition. Liberty did not store this receipt.</p>
    `;
    const moneyLine = (row) => {
      const fee = row.fee;
      const payout = row.agent_payout;
      const returned = row.returned_to_payer;
      const parts = [];
      if (fee !== undefined) parts.push(`fee ${fee}`);
      if (payout !== undefined) parts.push(`agent payout ${payout}`);
      if (returned !== undefined) parts.push(`returned to payer ${returned}`);
      return parts.length ? parts.join(" · ") : "—";
    };
    els.verifyResult.querySelector(".verify-impact").textContent = valid
      ? "Fee math matches Liberty’s engine."
      : "Claimed money fields do not match the engine.";
    els.verifyResult.querySelector(".verify-expected").textContent = moneyLine(expected);
    els.verifyResult.querySelector(".verify-received").textContent = moneyLine(received);
    const list = els.verifyResult.querySelector(".verify-mismatches");
    if (list) {
      for (const row of mismatches) {
        const item = document.createElement("li");
        item.textContent = row;
        list.appendChild(item);
      }
    }
  }

  async function runVerify(payload) {
    const data = await postVerify(payload);
    if (!data) return;
    renderVerifyResult(data);
    if (data.ok === true) {
      const receipt = payload && payload.receipt
        ? payload.receipt
        : (payload && (payload.job_id || payload.jobId) ? payload : (payload && payload.job));
      recordActivity("verify", {
        receipt,
        job: payload && payload.job,
        job_id: receipt && (receipt.job_id || receipt.jobId || receipt.id),
        client_ref: receipt && (receipt.client_ref || receipt.clientRef),
        detail: data.valid ? "valid" : "mismatch",
      });
      renderActivity();
      flash(data.valid
        ? "Receipt matches the fee engine. Demo only — not real money."
        : "Receipt does not match the fee engine. See mismatches below.");
    } else {
      flash(data.message || "Verify failed.", true);
    }
    if (els.verifyResult) els.verifyResult.scrollIntoView({ block: "nearest" });
  }

  function parseVerifyInput(raw) {
    const text = (raw || "").trim();
    if (!text) return { ok: false, message: "Paste a receipt JSON object first." };
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      if (receiptsApi && receiptsApi.decodeReceiptInput) {
        const decoded = receiptsApi.decodeReceiptInput(text);
        if (decoded.ok) return { ok: true, payload: { receipt: decoded.receipt } };
      }
      return { ok: false, message: "Receipt JSON is not valid JSON." };
    }
    if (Array.isArray(parsed)) {
      return { ok: false, message: "Paste a single receipt object, not an array." };
    }
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Paste a receipt JSON object." };
    }
    if (parsed.receipt || parsed.job || parsed.job_id || parsed.jobId) return { ok: true, payload: parsed };
    return { ok: true, payload: { receipt: parsed } };
  }

  function renderLedger() {
    if (!els.ledgerFacts || !ledgerApi) return;
    const totals = ledgerApi.summarizeLedger({
      receipts,
      jobs: state.jobs,
      payerCredits: state.credits,
      agentCredits,
    });
    els.ledgerFacts.replaceChildren();
    appendFact(els.ledgerFacts, "Fees paid", `${totals.feesPaid} credits`);
    appendFact(els.ledgerFacts, "Agent payouts", `${totals.agentPayouts} credits`);
    appendFact(els.ledgerFacts, "Disputed returns", `${totals.disputedReturns} credits`);
    appendFact(els.ledgerFacts, "Released receipts", totals.releasedCount);
    appendFact(els.ledgerFacts, "Disputed receipts", totals.disputedCount);
    appendFact(els.ledgerFacts, "Payer credits", totals.payerCredits);
    appendFact(els.ledgerFacts, "Agent wallet", totals.agentCredits);
    appendFact(els.ledgerFacts, "Jobs in this browser", totals.jobCount);
    appendFact(els.ledgerFacts, "Money", "false");
    if (els.ledgerEmpty) els.ledgerEmpty.hidden = totals.receiptCount > 0;
  }

  function activityLine(event) {
    const bits = [event.action];
    if (event.job_id) bits.push(event.job_id);
    if (event.client_ref) bits.push(event.client_ref);
    if (event.detail) {
      const already = bits.includes(event.detail)
        || (event.job_id && event.detail.includes(event.job_id) && (!event.client_ref || event.detail.includes(event.client_ref)));
      if (!already) bits.push(event.detail);
    }
    return bits.join(" · ");
  }

  function renderActivity() {
    if (!els.activityList) return;
    els.activityList.replaceChildren();
    for (const event of activity) {
      const item = document.createElement("li");
      item.className = "activity-item";
      const when = document.createElement("time");
      when.dateTime = event.at;
      when.textContent = formatWhen(event.at);
      const action = document.createElement("span");
      action.className = "activity-action";
      action.textContent = activityLine(event);
      item.append(when, action);
      els.activityList.append(item);
    }
    const shown = activity.length > 0;
    els.activityList.hidden = !shown;
    if (els.activityEmpty) els.activityEmpty.hidden = shown;
  }

  function render() {
    renderBalance();
    renderList();
    renderDetail();
    renderReceipts();
    renderLedger();
    renderActivity();
    renderKey();
  }

  els.topupForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = parseCredits(els.topupAmount.value);
    if (!amount) return flash("Top-up amount must be a whole number of credits.", true);
    topUp(amount);
  });

  document.querySelectorAll("[data-topup]").forEach((button) => {
    button.addEventListener("click", () => {
      const amount = parseCredits(button.getAttribute("data-topup"));
      if (amount) {
        if (els.topupAmount) els.topupAmount.value = String(amount);
        topUp(amount);
      }
    });
  });

  els.agentTopupForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = parseCredits(els.agentTopupAmount.value);
    if (!amount) return flash("Agent top-up amount must be a whole number of credits.", true);
    topUpAgent(amount);
  });

  document.querySelectorAll("[data-agent-topup]").forEach((button) => {
    button.addEventListener("click", () => {
      const amount = parseCredits(button.getAttribute("data-agent-topup"));
      if (amount) {
        if (els.agentTopupAmount) els.agentTopupAmount.value = String(amount);
        topUpAgent(amount);
      }
    });
  });

  els.simulateDemo?.addEventListener("click", () => runSimulate("release"));
  els.simulateDispute?.addEventListener("click", () => runSimulate("dispute"));

  function clearJobTemplatePressed() {
    document.querySelectorAll("[data-job-template]").forEach((button) => {
      button.setAttribute("aria-pressed", "false");
    });
  }

  document.querySelectorAll("[data-job-template]").forEach((button) => {
    button.addEventListener("click", () => {
      const title = button.getAttribute("data-title") || "";
      const amount = button.getAttribute("data-amount") || "";
      const criteria = button.getAttribute("data-criteria") || "";
      const titleEl = document.getElementById("job-title");
      const amountEl = document.getElementById("job-amount");
      const criteriaEl = document.getElementById("job-criteria");
      if (titleEl) titleEl.value = title;
      if (amountEl) amountEl.value = amount;
      if (criteriaEl) criteriaEl.value = criteria;
      document.querySelectorAll("[data-job-template]").forEach((other) => {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      flash("Template filled. Review and create when ready — this did not fund.");
      titleEl?.focus();
    });
  });

  els.createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.getElementById("job-title")?.value || "";
    const amount = parseCredits(document.getElementById("job-amount")?.value);
    const criteria = document.getElementById("job-criteria")?.value || "";
    const clientRef = (document.getElementById("job-client-ref")?.value || "").trim();
    const callbackUrl = (document.getElementById("job-callback-url")?.value || "").trim();
    if (!title.trim()) return flash("Add a job title.", true);
    if (!amount) return flash("Amount must be a whole number of credits.", true);
    if (!criteria.trim()) return flash("Add success criteria so proof can be judged.", true);
    const created = await createJob({
      title,
      amount,
      criteria,
      ...(clientRef ? { client_ref: clientRef } : {}),
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    });
    if (created) {
      els.createForm.reset();
      clearJobTemplatePressed();
    }
  });

  els.jobList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-job-id]");
    if (button) selectJob(button.dataset.jobId);
  });

  els.handoffForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = els.handoffInput ? els.handoffInput.value : "";
    const job = applyHandoffInput(raw);
    if (!job) return;
    if (els.handoffInput) els.handoffInput.value = "";
    selectJob(job.id);
  });

  els.receiptForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = els.receiptInput ? els.receiptInput.value : "";
    const receipt = applyReceiptInput(raw, {
      fromLink: /#receipt\/|\?receipt=|^https?:\/\//i.test(raw),
    });
    if (!receipt) return;
    if (els.receiptInput) els.receiptInput.value = "";
    fillVerifyInput(receipt);
    renderReceipts();
    if (els.verifyInput) els.verifyInput.scrollIntoView({ block: "nearest" });
  });

  els.simulateResult?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-simulate-action]");
    if (!button || button.dataset.simulateAction !== "copy-receipt-link") return;
    const job = findJob(selectedId());
    const stored = (job && findReceipt(job.id)) || receipts[0];
    if (!stored) return flash("Could not build a receipt for that walk.", true);
    await copyReceiptLink(stored);
  });

  els.detail?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const job = findJob(selectedId());
    if (!job) return;
    const action = button.dataset.action;
    if (action === "fund" || action === "release" || action === "dispute") {
      requestQuote(action, job.id);
      return;
    }
    if (action === "confirm-quote") {
      confirmQuotedAction();
      return;
    }
    if (action === "cancel-quote") {
      cancelQuote();
      return;
    }
    if (action === "copy-handoff" || action === "copy-handoff-code") {
      const built = handoffHref(job);
      if (!built.ok) return flash(built.message || "Could not encode this job.", true);
      const text = action === "copy-handoff" ? built.href : built.token;
      try {
        await navigator.clipboard.writeText(text);
        flash(action === "copy-handoff"
          ? "Handoff link copied. The other browser loads this job snapshot."
          : "Compact handoff code copied.");
      } catch {
        if (els.handoffInput) els.handoffInput.value = text;
        flash("Could not copy. The handoff is in Open a handoff — copy it from there.", true);
      }
      return;
    }
    if (action === "copy-receipt-link" || action === "copy-receipt-code") {
      const stored = findReceipt(job.id) || rememberReceipt(job, job.receiptKeyId ? { key_id: job.receiptKeyId } : undefined);
      const built = stored ? receiptHref(stored) : { ok: false, message: "Could not build a receipt for that job." };
      if (!built.ok) return flash(built.message || "Could not encode that receipt.", true);
      const text = action === "copy-receipt-link" ? built.href : built.token;
      try {
        await navigator.clipboard.writeText(text);
        flash(action === "copy-receipt-link"
          ? "Receipt link copied. Another device can open it to inspect or verify."
          : "Compact receipt code copied.");
      } catch {
        if (els.receiptInput) els.receiptInput.value = text;
        flash("Could not copy. The receipt link is in Open a receipt link — copy it from there.", true);
      }
      return;
    }
    if (action === "copy") {
      const text = receiptMarkdown(job);
      try {
        await navigator.clipboard.writeText(text);
        flash("Receipt copied.");
      } catch {
        flash("Could not copy. Select the receipt text instead.", true);
      }
    }
    if (action === "download") {
      downloadText(receiptMarkdown(job), `${job.id}.md`, "text/markdown");
      flash("Receipt markdown downloaded.");
    }
    if (action === "verify") {
      const stored = findReceipt(job.id) || rememberReceipt(job, job.receiptKeyId ? { key_id: job.receiptKeyId } : undefined);
      if (!stored) return flash("Could not build a receipt for that job.", true);
      fillVerifyInput(stored);
      runVerify({ receipt: stored });
      return;
    }
    if ((action === "download-json" || action === "copy-json") && receiptsApi) {
      const stored = findReceipt(job.id) || rememberReceipt(job, job.receiptKeyId ? { key_id: job.receiptKeyId } : undefined);
      const exported = stored ? receiptsApi.exportOneJson(stored) : { ok: false };
      if (!exported.ok) return flash(exported.message || "Could not export that receipt.", true);
      if (action === "download-json") {
        downloadText(exported.text, exported.filename, "application/json");
        flash("Receipt JSON downloaded. Demo only — not real money.");
        return;
      }
      try {
        await navigator.clipboard.writeText(exported.text);
        flash("Receipt JSON copied. Demo only — not real money.");
      } catch {
        flash("Could not copy. Use Download JSON instead.", true);
      }
    }
  });

  els.mintKey?.addEventListener("click", () => {
    const key = mintDemoKey();
    saveDemoKey(key);
    setRevealKeyThisVisit(true);
    flash("Demo key minted in this browser. Not production auth. Not real money.");
    renderKey();
  });

  els.copyKey?.addEventListener("click", async () => {
    const key = loadDemoKey();
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setRevealKeyThisVisit(false);
      flash("Demo key copied. Send Authorization: Bearer <key> or X-Liberty-Key.");
      renderKey();
    } catch {
      flash("Could not copy. Select the key field instead.", true);
    }
  });

  async function exportReceiptById(jobId, action) {
    if (!receiptsApi) return;
    const receipt = findReceipt(jobId);
    if (!receipt) return flash("That receipt is not in this browser.", true);
    const exported = receiptsApi.exportOneJson(receipt);
    if (!exported.ok) return flash(exported.message || "Could not export that receipt.", true);
    if (action === "download-json") {
      downloadText(exported.text, exported.filename, "application/json");
      flash("Receipt JSON downloaded. Demo only — not real money.");
      return;
    }
    try {
      await navigator.clipboard.writeText(exported.text);
      flash("Receipt JSON copied. Demo only — not real money.");
    } catch {
      flash("Could not copy. Use Download JSON instead.", true);
    }
  }

  els.receiptList?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-receipt-action]");
    if (!button) return;
    if (button.dataset.receiptAction === "verify") {
      const receipt = findReceipt(button.dataset.receiptId);
      if (!receipt) return flash("That receipt is not in this browser.", true);
      fillVerifyInput(receipt);
      runVerify({ receipt });
      return;
    }
    if (button.dataset.receiptAction === "copy-link") {
      const receipt = findReceipt(button.dataset.receiptId);
      if (!receipt) return flash("That receipt is not in this browser.", true);
      await copyReceiptLink(receipt);
      return;
    }
    exportReceiptById(button.dataset.receiptId, button.dataset.receiptAction);
  });

  els.verifyPick?.addEventListener("change", () => {
    const id = els.verifyPick.value;
    if (!id) return;
    const receipt = findReceipt(id);
    if (receipt) fillVerifyInput(receipt);
  });

  els.verifyForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const parsed = parseVerifyInput(els.verifyInput ? els.verifyInput.value : "");
    if (!parsed.ok) {
      renderVerifyResult({ ok: false, message: parsed.message });
      return flash(parsed.message, true);
    }
    runVerify(parsed.payload);
  });

  els.downloadReceipts?.addEventListener("click", () => {
    if (!receiptsApi || !receipts.length) return;
    const exported = receiptsApi.exportAllJson(receipts);
    downloadText(exported.text, exported.filename, "application/json");
    flash(`Downloaded ${receipts.length} receipts as JSON. Demo only — not real money.`);
  });

  els.downloadReceiptsNdjson?.addEventListener("click", () => {
    if (!receiptsApi || !receipts.length) return;
    const exported = receiptsApi.exportAllNdjson(receipts);
    downloadText(exported.text, exported.filename, "application/x-ndjson");
    flash(`Downloaded ${receipts.length} receipts as NDJSON. Demo only — not real money.`);
  });

  els.downloadLedgerCsv?.addEventListener("click", () => {
    if (!ledgerApi) return;
    const exported = ledgerApi.exportReceiptsCsv(receipts);
    downloadText(exported.text, exported.filename, "text/csv");
    if (exported.receiptCount) {
      flash(`Downloaded ${exported.receiptCount} receipts as CSV. This browser only. Demo only — not real money.`);
    } else {
      flash("Downloaded a header-only CSV. No stored receipts in this browser. Demo only — not real money.");
    }
  });

  els.copyReceipts?.addEventListener("click", async () => {
    if (!receiptsApi || !receipts.length) return;
    const exported = receiptsApi.exportAllJson(receipts);
    try {
      await navigator.clipboard.writeText(exported.text);
      flash("All receipt JSON copied. Demo only — not real money.");
    } catch {
      flash("Could not copy. Use Download all instead.", true);
    }
  });

  document.querySelectorAll(".adapter-examples").forEach((root) => {
    root.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-copy-example]");
      if (!button) return;
      const pre = button.closest(".adapter-example")?.querySelector("pre");
      if (!pre) return;
      try {
        await navigator.clipboard.writeText(pre.textContent);
        flash("Copied curl.");
      } catch {
        flash("Could not copy. Select the curl instead.", true);
      }
    });
  });

  els.revokeKey?.addEventListener("click", () => {
    if (!confirm("Revoke the demo key stored in this browser? Adapters using it will still work — this is not real auth.")) return;
    saveDemoKey("");
    flash("Demo key revoked in this browser.");
    renderKey();
  });

  els.exportPack?.addEventListener("click", () => {
    exportDemoPack();
  });

  els.importPackFile?.addEventListener("change", () => {
    const file = els.importPackFile.files && els.importPackFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      applyDemoPack(String(reader.result || ""));
    };
    reader.onerror = () => flash("Could not read that file.", true);
    reader.readAsText(file);
  });

  els.importPackForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const file = els.importPackFile && els.importPackFile.files && els.importPackFile.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => applyDemoPack(String(reader.result || ""));
      reader.onerror = () => flash("Could not read that file.", true);
      reader.readAsText(file);
      return;
    }
    applyDemoPack(els.importPackInput ? els.importPackInput.value : "");
  });

  els.resetPack?.addEventListener("click", resetDemo);
  els.reset?.addEventListener("click", resetDemo);
  els.clearActivity?.addEventListener("click", clearActivityLog);

  window.addEventListener("hashchange", () => {
    if (receiptsApi && receiptsApi.readLocationReceipt && receiptsApi.readLocationReceipt(location)) {
      consumeReceiptFromLocation();
      return;
    }
    if (handoff && handoff.readLocationHandoff(location)) {
      consumeHandoffFromLocation();
    }
    render();
  });

  async function loadWhatsNew() {
    if (!els.whatsNewList) return;
    try {
      const res = await fetch(CHANGELOG_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("changelog_unavailable");
      const doc = await res.json();
      if (!doc || doc.money !== false) throw new Error("changelog_invalid");
      const entries = Array.isArray(doc.entries) ? doc.entries.slice(0, CHANGELOG_LIMIT) : [];
      els.whatsNewList.replaceChildren();
      for (const entry of entries) {
        if (!entry || typeof entry.date !== "string" || typeof entry.title !== "string") continue;
        const item = document.createElement("li");
        const when = document.createElement("time");
        when.dateTime = entry.date;
        when.textContent = entry.date;
        const link = document.createElement("a");
        const href = typeof entry.href === "string" && entry.href.startsWith("/") ? entry.href : "/";
        link.href = href;
        link.textContent = entry.title;
        item.append(when, link);
        els.whatsNewList.append(item);
      }
      const shown = els.whatsNewList.children.length;
      els.whatsNewList.hidden = shown === 0;
      if (els.whatsNewEmpty) {
        els.whatsNewEmpty.hidden = shown > 0;
        if (!shown) els.whatsNewEmpty.textContent = "No shipped slices listed yet.";
      }
    } catch {
      if (els.whatsNewEmpty) {
        els.whatsNewEmpty.hidden = false;
        els.whatsNewEmpty.textContent = "Could not load What’s new. See /api/changelog.json.";
      }
      if (els.whatsNewList) els.whatsNewList.hidden = true;
    }
  }

  function appendFact(dl, term, value) {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    if (value instanceof Node) {
      dd.append(value);
    } else {
      dd.textContent = String(value);
    }
    row.append(dt, dd);
    dl.append(row);
  }

  function liveLink(href, label) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    return a;
  }

  async function loadScoreboard() {
    if (!els.scoreboardFacts) return;
    try {
      const res = await fetch(SCOREBOARD_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("scoreboard_unavailable");
      const doc = await res.json();
      if (!doc || doc.money !== false || doc.mode !== "demo") throw new Error("scoreboard_invalid");
      if (doc.external_users !== 0 || doc.paid_pilots !== 0 || doc.revenue_usd !== 0) {
        throw new Error("scoreboard_inflated");
      }
      els.scoreboardFacts.replaceChildren();
      appendFact(els.scoreboardFacts, "Mode", doc.mode);
      appendFact(els.scoreboardFacts, "Money", "false");
      appendFact(els.scoreboardFacts, "External users", doc.external_users);
      appendFact(els.scoreboardFacts, "Paid pilots", doc.paid_pilots);
      appendFact(els.scoreboardFacts, "Revenue (USD)", doc.revenue_usd);
      if (doc.live && typeof doc.live === "object") {
        if (typeof doc.live.ui === "string") {
          appendFact(els.scoreboardFacts, "Live", liveLink(doc.live.ui, doc.live.ui));
        }
        if (typeof doc.live.discovery === "string") {
          appendFact(els.scoreboardFacts, "Discovery", liveLink(doc.live.discovery, doc.live.discovery));
        }
        if (typeof doc.live.changelog === "string") {
          appendFact(els.scoreboardFacts, "Changelog", liveLink(doc.live.changelog, doc.live.changelog));
        }
      }
      els.scoreboardFacts.hidden = false;
      if (els.scoreboardEmpty) els.scoreboardEmpty.hidden = true;
      const listingEntries =
        doc.directory_listings && Array.isArray(doc.directory_listings.entries)
          ? doc.directory_listings.entries.filter(
              (entry) =>
                entry &&
                typeof entry.directory === "string" &&
                entry.directory &&
                typeof entry.url === "string" &&
                entry.url.startsWith("https://"),
            )
          : [];
      if (els.scoreboardListings) {
        els.scoreboardListings.replaceChildren();
        for (const entry of listingEntries) {
          const item = document.createElement("li");
          const link = liveLink(entry.url, entry.directory);
          item.append(link);
          if (typeof entry.note === "string" && entry.note) {
            const caveat = document.createElement("span");
            caveat.className = "listing-note";
            caveat.textContent = entry.note;
            item.append(caveat);
          }
          els.scoreboardListings.append(item);
        }
        els.scoreboardListings.hidden = listingEntries.length === 0;
      }
      if (els.scoreboardListingsLabel) {
        els.scoreboardListingsLabel.hidden = listingEntries.length === 0;
      }
      if (els.scoreboardNote) {
        const listingNote =
          doc.directory_listings && typeof doc.directory_listings.note === "string"
            ? doc.directory_listings.note
            : "";
        const parts = [typeof doc.note === "string" ? doc.note : "", listingNote].filter(Boolean);
        els.scoreboardNote.textContent = parts.join(" ");
        els.scoreboardNote.hidden = parts.length === 0;
      }
    } catch {
      if (els.scoreboardEmpty) {
        els.scoreboardEmpty.hidden = false;
        els.scoreboardEmpty.textContent = "Could not load the scoreboard. See /api/scoreboard.json.";
      }
      if (els.scoreboardFacts) els.scoreboardFacts.hidden = true;
      if (els.scoreboardListings) {
        els.scoreboardListings.replaceChildren();
        els.scoreboardListings.hidden = true;
      }
      if (els.scoreboardListingsLabel) els.scoreboardListingsLabel.hidden = true;
      if (els.scoreboardNote) els.scoreboardNote.hidden = true;
    }
  }

  function integrateHttpLine(row) {
    const method = typeof row.method === "string" ? row.method : "";
    const path = typeof row.path === "string" ? row.path : "";
    const bits = [method, path].filter(Boolean);
    if (row.optional === true) bits.push("optional");
    if (row.branch === true && typeof row.instead_of === "string" && row.instead_of) {
      bits.push(`instead of ${row.instead_of}`);
    }
    return bits.join(" ");
  }

  function renderIntegrateStep(row, extras) {
    const article = document.createElement("article");
    article.className = "adapter-example";
    const heading = document.createElement("h3");
    const n = Number.isInteger(row.n) ? `${row.n}. ` : "";
    const title = typeof row.title === "string" && row.title
      ? row.title
      : (typeof row.path === "string" ? row.path : "Step");
    heading.textContent = extras && extras.kicker ? `${extras.kicker}: ${title}` : `${n}${title}`;
    article.append(heading);
    const http = integrateHttpLine(row);
    if (http) {
      const meta = document.createElement("p");
      meta.className = "hint";
      meta.textContent = http;
      article.append(meta);
    }
    if (typeof row.purpose === "string" && row.purpose) {
      const purpose = document.createElement("p");
      purpose.className = "hint";
      purpose.textContent = row.purpose;
      article.append(purpose);
    }
    if (typeof row.curl === "string" && row.curl) {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = row.curl;
      pre.append(code);
      article.append(pre);
      const actions = document.createElement("div");
      actions.className = "action-row";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "ghost";
      copy.dataset.copyExample = "";
      copy.textContent = "Copy curl";
      actions.append(copy);
      article.append(actions);
    }
    return article;
  }

  async function loadIntegrate() {
    if (!els.integrateBody) return;
    try {
      const res = await fetch(QUICKSTART_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("quickstart_unavailable");
      const doc = await res.json();
      if (!doc || doc.money !== false || doc.mode !== "demo") throw new Error("quickstart_invalid");
      const steps = Array.isArray(doc.steps) ? doc.steps.filter((row) => row && typeof row === "object") : [];
      if (!steps.length) throw new Error("quickstart_empty");

      els.integrateBody.replaceChildren();

      const facts = document.createElement("dl");
      facts.className = "scoreboard-facts";
      appendFact(facts, "Mode", doc.mode);
      appendFact(facts, "Money", "false");
      appendFact(facts, "Persistence", doc.persistence === false ? "false" : String(doc.persistence));
      appendFact(facts, "Scoreboard", liveLink("#scoreboard", "/#scoreboard"));
      if (typeof doc.path === "string" && doc.path.startsWith("/")) {
        appendFact(facts, "Source", liveLink(doc.path, doc.path));
      }
      els.integrateBody.append(facts);

      if (typeof doc.description === "string" && doc.description) {
        const description = document.createElement("p");
        description.className = "hint";
        description.textContent = doc.description;
        els.integrateBody.append(description);
      }
      if (typeof doc.note === "string" && doc.note) {
        const note = document.createElement("p");
        note.className = "hint";
        note.textContent = doc.note;
        els.integrateBody.append(note);
      }
      if (doc.auth && typeof doc.auth.note === "string" && doc.auth.note) {
        const auth = document.createElement("p");
        auth.className = "hint";
        auth.textContent = doc.auth.note;
        els.integrateBody.append(auth);
      }

      const related = Array.isArray(doc.related)
        ? doc.related.filter((row) => row && typeof row.path === "string" && row.path.startsWith("/"))
        : [];
      if (related.length) {
        const label = document.createElement("p");
        label.className = "hint";
        label.textContent = "Related surfaces:";
        const list = document.createElement("ul");
        list.className = "integrate-related";
        for (const row of related) {
          const item = document.createElement("li");
          item.append(liveLink(row.path, row.path));
          if (typeof row.purpose === "string" && row.purpose) {
            const purpose = document.createElement("span");
            purpose.textContent = ` — ${row.purpose}`;
            item.append(purpose);
          }
          list.append(item);
        }
        els.integrateBody.append(label, list);
      }

      if (doc.shortcut && typeof doc.shortcut === "object" && doc.shortcut.curl) {
        els.integrateBody.append(renderIntegrateStep(doc.shortcut, { kicker: "Optional shortcut" }));
      }

      for (const step of steps) {
        els.integrateBody.append(renderIntegrateStep(step));
      }

      els.integrateBody.hidden = false;
      if (els.integrateEmpty) els.integrateEmpty.hidden = true;
    } catch {
      if (els.integrateEmpty) {
        els.integrateEmpty.hidden = false;
        els.integrateEmpty.textContent = "Could not load the integrate walk. See /api/quickstart.json.";
      }
      if (els.integrateBody) {
        els.integrateBody.replaceChildren();
        els.integrateBody.hidden = true;
      }
    }
  }

  if (!consumeReceiptFromLocation()) consumeHandoffFromLocation();
  syncReceiptsFromJobs();
  render();
  loadWhatsNew();
  loadScoreboard();
  loadIntegrate();
})();
