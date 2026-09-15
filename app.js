(() => {
  const STORAGE_KEY = "liberty.agent-settlement.v0";
  const KEY_STORAGE = "liberty.agent-settlement.demo-key.v0";
  const KEY_REVEAL = "liberty.agent-settlement.demo-key.reveal";
  const TRANSITION_URL = "/api/v0/transition";
  const QUOTE_URL = "/api/v0/quote";
  const SIMULATE_URL = "/api/v0/simulate";
  const VERIFY_URL = "/api/v0/verify";
  const SIMULATE_DEFAULTS = {
    title: "Summarize filings",
    amount: 100,
    criteria: "Three-bullet brief matching the last three filings.",
    proof_url: "https://example.com/proof",
  };
  const STATUSES = ["open", "funded", "submitted", "released", "disputed"];
  const QUOTE_ACTIONS = ["fund", "release", "dispute"];

  const els = {
    balance: document.getElementById("credit-balance"),
    flash: document.getElementById("flash"),
    topupForm: document.getElementById("topup-form"),
    topupAmount: document.getElementById("topup-amount"),
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
    simulateResult: document.getElementById("simulate-result"),
  };

  const handoff = window.LibertyJobHandoff;
  const receiptsApi = window.LibertyReceiptExport;

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

  function loadDemoKey() {
    try {
      const raw = localStorage.getItem(KEY_STORAGE);
      if (!raw) return "";
      const data = JSON.parse(raw);
      if (data && typeof data.key === "string" && data.key.trim()) return data.key.trim();
      return "";
    } catch {
      return "";
    }
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
    const lines = [
      "# Agent Settlement receipt",
      "",
      "Demo — not real money. Credits were simulated in a browser.",
      "",
      `- Job ID: ${job.id}`,
      `- Title: ${job.title}`,
      `- Status: ${job.status}`,
      `- Amount: ${job.amount} credits`,
      `- Release fee (5%): ${fee} credits`,
      `- Agent payout: ${payout} credits`,
      `- Returned to payer: ${refund} credits`,
      `- Success criteria: ${job.criteria}`,
      `- Proof: ${job.proofUrl || "—"}`,
      `- Created: ${job.createdAt}`,
      `- Funded: ${job.fundedAt || "—"}`,
      `- Submitted: ${job.submittedAt || "—"}`,
      `- Resolved: ${job.resolvedAt || "—"}`,
    ];
    if (job.receiptKeyId) lines.push(`- Demo key_id: ${job.receiptKeyId}`);
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
      return `Disputed ${job.id}. Returned to payer ${receipt.returned_to_payer}. Fee 0. Payer credits: ${data.payer_credits}.`;
    }
    return `Released ${job.id}. Fee ${receipt.release_fee}. Agent payout ${receipt.agent_payout}. Payer credits: ${data.payer_credits}.`;
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
    const data = await postSimulate({
      title: SIMULATE_DEFAULTS.title,
      amount,
      criteria: SIMULATE_DEFAULTS.criteria,
      payer_credits: starting,
      proof_url: SIMULATE_DEFAULTS.proof_url,
      terminal,
    });
    if (!data) {
      renderSimulateResult(null);
      return;
    }
    applyResult(data);
    renderSimulateResult(data);
    flash(
      data.job && data.job.status === "disputed"
        ? `Full demo walk disputed. ${data.returned_to_payer} credits returned. Fee 0. Receipt saved. Demo — not real money.`
        : `Full demo walk released. Agent payout ${data.agent_payout} credits. Fee ${data.fee} credits. Receipt saved. Demo — not real money.`,
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

  function moneyActionPayload(action, job) {
    if (action === "fund") return { action, job, payer_credits: state.credits };
    if (action === "submit") return { action, job };
    if (action === "release") return { action, job };
    if (action === "dispute") return { action, job, payer_credits: state.credits };
    return { action, job };
  }

  function quoteImpactLine(action, data) {
    if (action === "fund") {
      return `Hold ${data.job.amount} credits. Fee 0. Payer credits after: ${data.payer_credits_after}.`;
    }
    if (action === "release") {
      return `Fee ${data.fee}. Agent payout ${data.agent_payout}. Payer credits stay ${state.credits}.`;
    }
    if (action === "dispute") {
      const after = Number.isFinite(data.payer_credits_after)
        ? ` Payer credits after: ${data.payer_credits_after}.`
        : "";
      return `Returned to payer: ${data.returned_to_payer}. Fee 0.${after}`;
    }
    return `Next status: ${data.job.status}.`;
  }

  function quotePreviewHtml(quote) {
    const data = quote.data;
    const next = data.job && data.job.status ? data.job.status : quote.action;
    return `
      <aside class="quote-preview" aria-live="polite">
        <p class="quote-kicker">Demo quote — not real money</p>
        <p class="quote-impact">${escapeHtml(quoteImpactLine(quote.action, data))}</p>
        <p class="hint">Next status: ${escapeHtml(next)}. Nothing is committed until you confirm.</p>
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
    pendingQuote = null;
    if (action === "fund") return fundJob(jobId);
    if (action === "release") return releaseJob(jobId);
    if (action === "dispute") return disputeJob(jobId);
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
    flash(`Added ${amount} demo credits. Not real money.`);
    render();
  }

  async function createJob({ title, amount, criteria }) {
    const data = await postTransition({ action: "create", title, amount, criteria });
    if (!data) return false;
    applyResult(data);
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
    flash(`${data.job.amount} credits held in escrow for ${data.job.id}.`);
    render();
  }

  async function submitProof(id, proofUrl) {
    const job = findJob(id);
    if (!job) return;
    const data = await postTransition({
      action: "submit",
      job,
      proof_url: proofUrl,
    });
    if (!data) return;
    applyResult(data);
    flash("Proof submitted. Payer can release or dispute.");
    render();
  }

  async function releaseJob(id) {
    const job = findJob(id);
    if (!job) return;
    const data = await postTransition({ action: "release", job });
    if (!data) return;
    applyResult(data);
    flash(`Released. Agent payout ${data.job.agentPayout} credits. Fee ${data.job.fee} credits. Receipt saved in this browser. Demo only.`);
    render();
  }

  async function disputeJob(id) {
    const job = findJob(id);
    if (!job) return;
    const data = await postTransition({
      action: "dispute",
      job,
      payer_credits: state.credits,
    });
    if (!data) return;
    applyResult(data);
    flash(`Disputed. ${data.job.amount} credits returned to the payer. No release fee. Receipt saved in this browser.`);
    render();
  }

  function renderBalance() {
    if (els.balance) els.balance.textContent = String(state.credits);
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
    } else if (job.status === "funded") {
      actions.push(`
        <form id="proof-form" class="stack-form">
          <label class="field">
            <span>Proof URL</span>
            <input id="proof-url" name="proof" type="text" inputmode="url" required placeholder="https://… or a note the payer can check" />
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
        <dt>Submitted</dt><dd>${escapeHtml(formatWhen(job.submittedAt))}</dd>
        <dt>Resolved</dt><dd>${escapeHtml(formatWhen(job.resolvedAt))}</dd>
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
        submitProof(job.id, input ? input.value : "");
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
      item.querySelector(".receipt-item-when").textContent =
        `${receipt.job_id} · resolved ${formatWhen(receipt.resolved)} · created ${formatWhen(receipt.created)}`;
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

  function render() {
    renderBalance();
    renderList();
    renderDetail();
    renderReceipts();
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

  els.simulateDemo?.addEventListener("click", () => runSimulate("release"));
  els.simulateDispute?.addEventListener("click", () => runSimulate("dispute"));

  els.createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.getElementById("job-title")?.value || "";
    const amount = parseCredits(document.getElementById("job-amount")?.value);
    const criteria = document.getElementById("job-criteria")?.value || "";
    if (!title.trim()) return flash("Add a job title.", true);
    if (!amount) return flash("Amount must be a whole number of credits.", true);
    if (!criteria.trim()) return flash("Add success criteria so proof can be judged.", true);
    const created = await createJob({ title, amount, criteria });
    if (created) els.createForm.reset();
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

  els.revokeKey?.addEventListener("click", () => {
    if (!confirm("Revoke the demo key stored in this browser? Adapters using it will still work — this is not real auth.")) return;
    saveDemoKey("");
    flash("Demo key revoked in this browser.");
    renderKey();
  });

  els.reset?.addEventListener("click", () => {
    if (!confirm("Clear all demo credits, jobs, and receipts in this browser?")) return;
    state = emptyState();
    receipts = [];
    pendingQuote = null;
    localStorage.removeItem(STORAGE_KEY);
    if (receiptsApi) localStorage.removeItem(receiptsApi.STORAGE_KEY);
    flash("Demo reset. The demo API key was left in place — revoke it separately if you want.");
    selectJob(null);
  });

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

  if (!consumeReceiptFromLocation()) consumeHandoffFromLocation();
  syncReceiptsFromJobs();
  render();
})();
