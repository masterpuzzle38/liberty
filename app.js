(() => {
  const STORAGE_KEY = "liberty.agent-settlement.v0";
  const TRANSITION_URL = "/api/v0/transition";
  const STATUSES = ["open", "funded", "submitted", "released", "disputed"];

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
  };

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

  let state = load();
  let inflight = false;

  function selectedId() {
    const match = location.hash.match(/^#job\/([a-z0-9_]+)/i);
    return match ? match[1] : null;
  }

  function selectJob(id) {
    if (id) location.hash = `#job/${id}`;
    else if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    render();
  }

  function findJob(id) {
    return state.jobs.find((job) => job.id === id) || null;
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
    return [
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
      "",
    ].join("\n");
  }

  function applyResult(data) {
    if (data.job) {
      const idx = state.jobs.findIndex((job) => job.id === data.job.id);
      if (idx === -1) state.jobs.unshift(data.job);
      else state.jobs[idx] = data.job;
    }
    if (Number.isFinite(data.payer_credits)) {
      state.credits = Math.max(0, Math.floor(data.payer_credits));
    }
    save(state);
  }

  async function postTransition(payload) {
    if (inflight) return null;
    inflight = true;
    document.body.classList.add("pending");
    try {
      const res = await fetch(TRANSITION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        flash((data && data.message) || "Transition failed.", true);
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

  function topUp(amount) {
    state.credits += amount;
    save(state);
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
    flash(`Released. Agent payout ${data.job.agentPayout} credits. Fee ${data.job.fee} credits. Demo only.`);
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
    flash(`Disputed. ${data.job.amount} credits returned to the payer. No release fee.`);
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
    if (job.status === "open") {
      const canFund = state.credits >= job.amount;
      actions.push(`<button type="button" data-action="fund" ${canFund ? "" : "disabled"}>${canFund ? `Fund ${job.amount} credits` : "Need more credits to fund"}</button>`);
    }
    if (job.status === "funded") {
      actions.push(`
        <form id="proof-form" class="stack-form">
          <label class="field">
            <span>Proof URL</span>
            <input id="proof-url" name="proof" type="text" inputmode="url" required placeholder="https://… or a note the payer can check" />
          </label>
          <button type="submit">Submit proof</button>
        </form>
      `);
    }
    if (job.status === "submitted") {
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
          <div class="action-row">
            <button type="button" data-action="copy">Copy receipt</button>
            <button type="button" class="secondary" data-action="download">Download .md</button>
          </div>
        </div>`
      : "";

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
      ${receipt}
    `;

    const criteriaDd = els.detail.querySelectorAll(".detail-meta dd")[2];
    const proofDd = els.detail.querySelectorAll(".detail-meta dd")[3];
    if (criteriaDd) criteriaDd.textContent = job.criteria;
    if (proofDd) proofDd.textContent = job.proofUrl || "—";

    const receiptPre = els.detail.querySelector("#receipt-md");
    if (receiptPre) receiptPre.textContent = receiptMarkdown(job);

    const proofForm = els.detail.querySelector("#proof-form");
    if (proofForm) {
      proofForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("proof-url");
        submitProof(job.id, input ? input.value : "");
      });
    }
  }

  function render() {
    renderBalance();
    renderList();
    renderDetail();
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

  els.detail?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const job = findJob(selectedId());
    if (!job) return;
    const action = button.dataset.action;
    if (action === "fund") fundJob(job.id);
    if (action === "release") releaseJob(job.id);
    if (action === "dispute") disputeJob(job.id);
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
      const blob = new Blob([receiptMarkdown(job)], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${job.id}.md`;
      link.click();
      URL.revokeObjectURL(url);
      flash("Receipt downloaded.");
    }
  });

  els.reset?.addEventListener("click", () => {
    if (!confirm("Clear all demo credits and jobs in this browser?")) return;
    state = emptyState();
    localStorage.removeItem(STORAGE_KEY);
    flash("Demo reset.");
    selectJob(null);
  });

  window.addEventListener("hashchange", render);
  render();
})();
