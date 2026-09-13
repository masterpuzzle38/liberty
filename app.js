const FILES = [
  {
    id: "company",
    title: "Company",
    name: "company.md",
    hint: "What you sell, who you serve, how you make money, what you believe, what makes you different.",
    fields: [
      ["sells", "What do you sell?"],
      ["serves", "Who is it for?"],
      ["money", "How do you make money?"],
      ["believes", "What do you believe?"],
      ["different", "What makes you different?"]
    ]
  },
  {
    id: "customer",
    title: "Customer",
    name: "customer.md",
    hint: "Use their words. If there are no quotes, this file is still a draft.",
    fields: [
      ["icp", "Who actually buys?"],
      ["pains", "What hurts?"],
      ["objections", "What do they say no to?"],
      ["triggers", "What makes them buy now?"],
      ["language", "Words they use"],
      ["fears", "What are they afraid of?"],
      ["criteria", "How do they decide?"],
      ["quotes", "Direct quotes (paste real lines)"]
    ]
  },
  {
    id: "offer",
    title: "Offer",
    name: "offer.md",
    hint: "Your judgment first. Then cut anything a skeptical buyer would not buy.",
    fields: [
      ["packages", "What is the package?"],
      ["deliverables", "What do they get?"],
      ["pricing", "Price and why it is that price"],
      ["proof", "What is actually true today?"],
      ["promises", "Promises you will keep"],
      ["avoid", "Claims to never make"],
      ["fit", "Good fit / bad fit"]
    ]
  },
  {
    id: "voice",
    title: "Voice",
    name: "voice.md",
    hint: "Examples beat adjectives. Show good lines and banned lines.",
    fields: [
      ["sounds", "How you talk (paste 3 good lines)"],
      ["never", "How you should never sound"],
      ["use", "Phrases you use"],
      ["skip", "Phrases you avoid"],
      ["good", "A good example"],
      ["bad", "A bad example"]
    ]
  }
];

const HARBOR_HINTS = {
  company: {
    sells: "Harbor Lamp: small-batch brass table lamps, made by one person in a Portland garage.",
    serves: "Harbor Lamp: people who want one good lamp in a room they actually live in.",
    money: "Harbor Lamp: $240–$380 a lamp. No wholesale. Repair is free — that’s the promise.",
    believes: "Harbor Lamp: a lamp should outlive the person who bought it. Brass should tarnish.",
    different: "Harbor Lamp: one maker. If something is wrong, you email the person who built it."
  },
  customer: {
    icp: "Harbor Lamp: adults who already buy objects on purpose — a used chair, a cast-iron pan.",
    pains: "Harbor Lamp: big-box lamps feel hollow; $1,200 designer ones still look like a hotel.",
    objections: "Harbor Lamp: “That’s a lot for a lamp.” “I rent — I shouldn’t buy something this heavy.”",
    triggers: "Harbor Lamp: a move, a winter cave of a living room, the last cheap lamp dying.",
    language: "Harbor Lamp: warm light, heavy, not plastic. “I don’t want it to scream new.”",
    fears: "Harbor Lamp: a lamp that photographs well and lives badly.",
    criteria: "Harbor Lamp: weight in the photos, a real person on email, a return if it arrives dented.",
    quotes: "Harbor Lamp: “I just want one lamp I don’t have to think about again.”"
  },
  offer: {
    packages: "Harbor Lamp: one lamp at a time. Table or sconce. No bundles, no starter kit.",
    deliverables: "Harbor Lamp: the lamp, a spare bulb, a care card, a note with the finish date.",
    pricing: "Harbor Lamp: $240 is two evenings and honest brass — cheap lamps already exist.",
    proof: "Harbor Lamp: fourteen lamps this year, three free rewires, no press, a garage workshop.",
    promises: "Harbor Lamp: it will be heavy. I reply within two days. Faulty brass, I make it right.",
    avoid: "Harbor Lamp: never invent a waitlist, never imply a studio of apprentices, never say “heirloom” first.",
    fit: "Harbor Lamp: good fit — one lamp, you can wait. Bad fit — twenty matching fixtures by Friday."
  }
};

const QUESTIONS = FILES.filter((file) => file.id !== "voice").flatMap((file) =>
  file.fields.map(([key, label]) => ({
    fileId: file.id,
    fileTitle: file.title,
    fileName: file.name,
    hint: file.hint,
    example: (HARBOR_HINTS[file.id] || {})[key] || "",
    key,
    label
  }))
);

// Highest-leverage fields: enough to hit solid on company (3/5) + offer (4/7)
// and solid on customer (4/8). Voice lab stays the last step on both paths.
const ESSENTIAL_KEYS = {
  company: ["sells", "serves", "different"],
  customer: ["icp", "pains", "language", "quotes"],
  offer: ["packages", "proof", "promises", "avoid"]
};

function isEssentialQuestion(q) {
  return (ESSENTIAL_KEYS[q.fileId] || []).includes(q.key);
}
function questionsForPath(path) {
  return path === "essentials" ? QUESTIONS.filter(isEssentialQuestion) : QUESTIONS;
}
function labStepFor(path) {
  return questionsForPath(path).length;
}
function interviewLenFor(path) {
  return labStepFor(path) + 1;
}
function activeQuestions() {
  return questionsForPath(ui.path);
}
function currentQuestion() {
  if (ui.holes) {
    const hole = peekHole();
    if (hole && hole.kind === "question") return hole;
    return null;
  }
  const qs = activeQuestions();
  if (ui.q >= qs.length) return null;
  return qs[ui.q];
}
function isEssentialsPath() {
  return ui.path === "essentials";
}
function inHolesWalk() {
  return !!(ui.holes && !ui.desk && !ui.done);
}

const KEY = "liberty-four-files-v1";
const UI_KEY = "liberty-four-files-ui-v1";
const state = load();
const ui = loadUi();
let tab = "company";
let holesWalk = null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function parseHoles(raw) {
  if (!raw || !raw.holes || typeof raw.holes !== "object") return null;
  const i = Number(raw.holes.i);
  const ids = Array.isArray(raw.holes.ids)
    ? raw.holes.ids.filter((id) => typeof id === "string" && id.length)
    : null;
  return {
    i: Number.isInteger(i) && i >= 0 ? i : 0,
    ids: ids && ids.length ? ids : null
  };
}

function loadUi() {
  const fallback = { desk: false, q: 0, done: false, path: "essentials", holes: null };
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY));
    if (!raw || typeof raw !== "object") return fallback;
    const q = Number(raw.q);
    const knownPath = raw.path === "full" || raw.path === "essentials";
    const hasProgress = !!raw.done || (Number.isInteger(q) && q > 0);
    // New visitors: Short pack. Returning drafts without a path key stay on
    // Full so a saved question index still maps to the same field.
    const path = knownPath
      ? raw.path
      : (hasProgress || hasAnswers() ? "full" : "essentials");
    const maxQ = labStepFor(path);
    return {
      desk: !!raw.desk,
      q: Number.isInteger(q) ? Math.min(Math.max(q, 0), maxQ) : 0,
      done: !!raw.done,
      path,
      holes: parseHoles(raw)
    };
  } catch {
    return fallback;
  }
}
function saveUi() {
  localStorage.setItem(UI_KEY, JSON.stringify(ui));
}
function ensure(id) {
  if (!state[id]) state[id] = {};
  return state[id];
}
function ensureLab() {
  if (!state.lab || typeof state.lab !== "object") state.lab = { proud: "", hate: "" };
  if (typeof state.lab.proud !== "string") state.lab.proud = "";
  if (typeof state.lab.hate !== "string") state.lab.hate = "";
  return state.lab;
}
function hasAnswers() {
  const lab = state.lab || {};
  if (String(lab.proud || "").trim() || String(lab.hate || "").trim()) return true;
  return FILES.some((file) => {
    const data = state[file.id] || {};
    return file.fields.some(([key]) => String(data[key] || "").trim());
  });
}

function markdown(file) {
  const data = ensure(file.id);
  const lines = [`# ${file.name}`, "", file.hint, ""];
  for (const [key, label] of file.fields) {
    lines.push(`## ${label}`, "", (data[key] || "").trim() || "(empty)", "");
  }
  return lines.join("\n").trim() + "\n";
}

function howToUseMarkdown() {
  return [
    "# How to use these four files",
    "",
    "You finished the pack. The AI still needs you to hand it over.",
    "",
    "## On a computer",
    "",
    "1. Unzip `four-files.zip`.",
    "2. You should see `company.md`, `customer.md`, `offer.md`, `voice.md`, and this note.",
    "3. Open ChatGPT, Claude, or Grok.",
    "4. Start a new chat. Attach the four `.md` files, or paste them.",
    "5. Ask for one job — not “help me with my brand.”",
    "",
    "## On a phone",
    "",
    "Zip files are awkward. On the Liberty finish screen, tap **Copy pack for ChatGPT**, then paste into the app.",
    "",
    "## Starter prompts",
    "",
    "- Draft an About page from these files. Stay inside the claims I said never to make.",
    "- Reply to this customer email in my voice. Use their words where they already said it.",
    "- Write an Instagram caption in my voice. If you do not have an example that matches, say so instead of inventing one.",
    "",
    "## Do not skip",
    "",
    "- **Claims to avoid** in `offer.md` — if you skip them, the model will praise you with words you forbade.",
    "- **Voice examples** in `voice.md` — the good and bad lines matter more than any adjective.",
    "",
    "One job at a time. These files stay yours.",
    ""
  ].join("\n");
}

function packClipboardMarkdown() {
  const header = [
    "These four files are the source of truth for my company, customer, offer, and voice.",
    "",
    "- Use them. Do not invent a brand.",
    "- Stay inside claims-to-avoid in offer.md.",
    "- Prefer the voice examples over adjectives. If a line is not in my voice, rewrite or say so.",
    "",
    "Ask me what to write, or start with: draft an About page / reply to a customer email / write an Instagram caption in my voice."
  ].join("\n");
  const bodies = FILES.map((file) => markdown(file).trim());
  return [header, ...bodies].join("\n\n---\n\n") + "\n";
}

function copyText(text, button) {
  const idle = button.dataset.copyIdle || button.textContent;
  button.dataset.copyIdle = idle;
  const reset = (label, ms) => {
    button.textContent = label;
    window.clearTimeout(Number(button.dataset.copyTimer || 0));
    button.dataset.copyTimer = String(window.setTimeout(() => {
      button.textContent = idle;
    }, ms));
  };
  const done = () => reset("Copied", 2000);
  const fail = () => reset("Copy failed", 2200);
  const viaExec = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try { ok = document.execCommand("copy"); } finally {
      document.body.removeChild(ta);
    }
    if (!ok) throw new Error("copy");
  };
  done();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      try { viaExec(); } catch { fail(); }
    });
    return;
  }
  try { viaExec(); } catch { fail(); }
}

function renderTabs() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  for (const file of FILES) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = file.title;
    b.className = file.id === tab ? "on" : "";
    b.onclick = () => { tab = file.id; draw(); };
    nav.appendChild(b);
  }
}

function renderEditor() {
  const file = FILES.find((f) => f.id === tab);
  const box = document.getElementById("editor");
  const data = ensure(file.id);
  box.innerHTML = "";
  if (file.id === "voice") {
    const mount = document.createElement("div");
    box.appendChild(mount);
    mountVoiceLab(mount, { headed: true, showFields: false });
  }
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = file.hint;
  box.appendChild(hint);
  for (const [key, label] of file.fields) {
    const lab = document.createElement("label");
    lab.textContent = label;
    const ta = document.createElement("textarea");
    ta.value = data[key] || "";
    ta.dataset.fileId = file.id;
    ta.dataset.fieldKey = key;
    if (file.id === "voice") ta.dataset.voiceKey = key;
    ta.oninput = () => {
      data[key] = ta.value;
      save();
      preview();
      if (file.id === "offer" || file.id === "company") refreshClaimsWatch();
    };
    box.appendChild(lab);
    box.appendChild(ta);
    if (file.id === "offer" && key === "avoid") {
      const mount = document.createElement("div");
      mount.id = "claims-watch-mount";
      box.appendChild(mount);
    }
  }
  if (file.id === "offer") refreshClaimsWatch();
}

function preview() {
  const file = FILES.find((f) => f.id === tab);
  document.getElementById("preview").textContent = markdown(file);
}

function pathSwitchLabel() {
  return isEssentialsPath() ? "Answer all questions" : "Use the short pack";
}

function bindPathSwitch(id) {
  const el = document.getElementById(id);
  if (el) el.onclick = () => switchPath(isEssentialsPath() ? "full" : "essentials");
}

function renderInterview() {
  const qs = activeQuestions();
  if (ui.q >= qs.length) {
    renderVoiceLabInterview();
    return;
  }
  const q = qs[ui.q];
  const data = ensure(q.fileId);
  const n = interviewLenFor(ui.path);
  const pct = ((ui.q + 1) / n) * 100;
  const root = document.getElementById("interview");
  root.innerHTML = `
    <div class="interview-chrome">
      <p class="progress" id="progress-label">Question ${ui.q + 1} of ${n} · ${q.fileTitle}</p>
      <div class="progress-track" aria-hidden="true"><span style="width:${pct}%"></span></div>
      <div class="path-chips">
        <p class="file-chip">${q.fileName}</p>
        <p class="file-chip">${isEssentialsPath() ? "Short pack" : "Full interview"}</p>
      </div>
    </div>
    <h2 class="question">${q.label}</h2>
    ${q.example ? `<p class="q-example">${escapeHtml(q.example)}</p>` : ""}
    <p class="hint">${q.hint}</p>
    <label class="sr-only" for="answer">${q.label}</label>
    <textarea id="answer" class="interview-answer" rows="8" placeholder="Write it in your words."></textarea>
    ${q.key === "avoid" ? `<div id="claims-watch-mount"></div>` : ""}
    <div class="interview-nav">
      <button class="btn" id="back" type="button"${ui.q === 0 ? " disabled" : ""}>Back</button>
      <button class="btn" id="skip" type="button">Skip</button>
      <button class="btn gold" id="next" type="button">Next</button>
    </div>
    <p class="quiet-tools">
      <button class="linkish" id="jump-lab" type="button">Voice lab</button>
      ·
      <button class="linkish" id="switch-path" type="button">${pathSwitchLabel()}</button>
      ·
      <button class="linkish" id="interview-clear" type="button">Clear this browser</button>
    </p>
  `;
  const ta = document.getElementById("answer");
  ta.value = data[q.key] || "";
  ta.oninput = () => {
    data[q.key] = ta.value;
    save();
    if (q.key === "avoid") refreshClaimsWatch();
  };
  if (q.key === "avoid") refreshClaimsWatch();
  document.getElementById("back").onclick = () => step(-1);
  document.getElementById("skip").onclick = () => step(1);
  document.getElementById("next").onclick = () => step(1);
  document.getElementById("jump-lab").onclick = openVoiceLab;
  bindPathSwitch("switch-path");
  document.getElementById("interview-clear").onclick = clearDrafts;
}

function renderVoiceLabInterview() {
  const root = document.getElementById("interview");
  root.innerHTML = `
    <div class="interview-chrome">
      <p class="progress">Voice lab · last step</p>
      <div class="progress-track" aria-hidden="true"><span style="width:100%"></span></div>
      <p class="file-chip">voice.md</p>
    </div>
    <h2 class="question">Voice from examples.</h2>
    <p class="q-example">Harbor Lamp: a Tuesday bench note vs. “elevate your sanctuary.”</p>
    <p class="hint">Adjectives lie. Paste writing you would put your name on, and writing you never want to sound like. We quote it. We do not invent a brand voice.</p>
    <div id="voice-lab-mount"></div>
    <div class="interview-nav">
      <button class="btn" id="back" type="button">Back</button>
      <button class="btn" id="skip" type="button">Skip and finish</button>
      <button class="btn gold" id="next" type="button">Finish</button>
    </div>
    <p class="quiet-tools">
      <button class="linkish" id="switch-path" type="button">${pathSwitchLabel()}</button>
      ·
      <button class="linkish" id="interview-clear" type="button">Clear this browser</button>
    </p>
  `;
  mountVoiceLab(document.getElementById("voice-lab-mount"), { headed: false, showFields: true });
  document.getElementById("back").onclick = () => step(-1);
  document.getElementById("skip").onclick = () => step(1);
  document.getElementById("next").onclick = () => step(1);
  bindPathSwitch("switch-path");
  document.getElementById("interview-clear").onclick = clearDrafts;
}

function renderHolesWalk() {
  holesWalk = ensureHolesWalk();
  if (!holesWalk.length) {
    exitHolesWalk();
    return;
  }
  if (!ui.holes) ui.holes = { i: 0 };
  if (ui.holes.i >= holesWalk.length) ui.holes.i = holesWalk.length - 1;
  if (ui.holes.i < 0) ui.holes.i = 0;
  const hole = holesWalk[ui.holes.i];
  const n = holesWalk.length;
  const i = ui.holes.i;
  const last = i >= n - 1;
  const pct = ((i + 1) / n) * 100;
  const root = document.getElementById("interview");
  const quiet = `
    <p class="quiet-tools">
      <button class="linkish" id="holes-pack" type="button">Back to pack</button>
      ·
      <button class="linkish" id="interview-clear" type="button">Clear this browser</button>
    </p>
  `;
  const nav = `
    <div class="interview-nav">
      <button class="btn" id="back" type="button"${i === 0 ? " disabled" : ""}>Back</button>
      <button class="btn" id="skip" type="button">Skip</button>
      <button class="btn gold" id="next" type="button">${last ? "Done" : "Next"}</button>
    </div>
  `;
  const chrome = `
    <div class="interview-chrome">
      <p class="progress" id="progress-label">Hole ${i + 1} of ${n} · ${escapeHtml(hole.fileTitle)}</p>
      <div class="progress-track" aria-hidden="true"><span style="width:${pct}%"></span></div>
      <div class="path-chips">
        <p class="file-chip">${escapeHtml(hole.fileName)}</p>
        <p class="file-chip">Fill the holes</p>
      </div>
    </div>
  `;

  if (hole.kind === "lab") {
    root.innerHTML = `
      ${chrome}
      <h2 class="question">Voice from examples.</h2>
      <p class="q-example">Harbor Lamp: a Tuesday bench note vs. “elevate your sanctuary.”</p>
      <p class="hint">Adjectives lie. Paste writing you would put your name on, and writing you never want to sound like. We quote it. We do not invent a brand voice.</p>
      <div id="voice-lab-mount"></div>
      ${nav}
      ${quiet}
    `;
    mountVoiceLab(document.getElementById("voice-lab-mount"), { headed: false, showFields: true });
  } else {
    const data = ensure(hole.fileId);
    root.innerHTML = `
      ${chrome}
      <h2 class="question">${escapeHtml(hole.label)}</h2>
      ${hole.example ? `<p class="q-example">${escapeHtml(hole.example)}</p>` : ""}
      <p class="hint">${escapeHtml(hole.hint)}</p>
      <label class="sr-only" for="answer">${escapeHtml(hole.label)}</label>
      <textarea id="answer" class="interview-answer" rows="8" placeholder="Write it in your words."></textarea>
      ${hole.key === "avoid" ? `<div id="claims-watch-mount"></div>` : ""}
      ${nav}
      ${quiet}
    `;
    const ta = document.getElementById("answer");
    ta.value = data[hole.key] || "";
    ta.oninput = () => {
      data[hole.key] = ta.value;
      save();
      if (hole.key === "avoid") refreshClaimsWatch();
    };
    if (hole.key === "avoid") refreshClaimsWatch();
  }

  document.getElementById("back").onclick = () => stepHoles(-1);
  document.getElementById("skip").onclick = () => stepHoles(1);
  document.getElementById("next").onclick = () => stepHoles(1);
  document.getElementById("holes-pack").onclick = () => exitHolesWalk();
  document.getElementById("interview-clear").onclick = clearDrafts;
}

function mountVoiceLab(host, { headed = false, showFields = false } = {}) {
  const lab = ensureLab();
  host.innerHTML = `
    <div class="voice-lab">
      ${headed ? `
        <h2 class="lab-heading">Voice from examples</h2>
        <p class="hint">Adjectives lie. Paste writing you would put your name on, and writing you never want to sound like. We quote it. We do not invent a brand voice.</p>
      ` : ""}
      <label for="lab-proud">Writing I’m proud of</label>
      <textarea id="lab-proud" class="lab-pile" rows="8" placeholder="A note you’d send. A product page you’d publish. Two or three sentences that already sound like you."></textarea>
      <label for="lab-hate">Writing I hate (mine or generic AI)</label>
      <textarea id="lab-hate" class="lab-pile" rows="8" placeholder="A line you regret, or a blob of “elevate your space” slop. We will ban the patterns, not invent new ones."></textarea>
      <p class="lab-status" id="lab-status" role="status" aria-live="polite" hidden></p>
      <div class="row lab-actions">
        <button class="btn gold" id="lab-draft" type="button">Draft voice.md from these piles</button>
      </div>
      ${showFields ? voiceFieldsMarkup() : ""}
    </div>
  `;
  const proud = host.querySelector("#lab-proud");
  const hate = host.querySelector("#lab-hate");
  proud.value = lab.proud;
  hate.value = lab.hate;
  proud.oninput = () => { lab.proud = proud.value; save(); };
  hate.oninput = () => { lab.hate = hate.value; save(); };
  host.querySelector("#lab-draft").onclick = () => runVoiceDraft(host);
  if (showFields) bindVoiceFields(host);
}

function voiceFieldsMarkup() {
  const file = FILES.find((f) => f.id === "voice");
  return `
    <div class="lab-fields">
      <p class="hint">The draft lands in these fields. Edit anything. Same zip as before.</p>
      ${file.fields.map(([key, label]) => `
        <label for="voice-field-${key}">${escapeHtml(label)}</label>
        <textarea id="voice-field-${key}" data-voice-key="${key}"></textarea>
      `).join("")}
    </div>
  `;
}

function bindVoiceFields(host) {
  const data = ensure("voice");
  for (const ta of host.querySelectorAll("[data-voice-key]")) {
    const key = ta.dataset.voiceKey;
    ta.value = data[key] || "";
    ta.oninput = () => { data[key] = ta.value; save(); };
  }
}

function setLabStatus(host, message, kind) {
  const el = host.querySelector("#lab-status");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.className = "lab-status";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = "lab-status" + (kind ? " " + kind : "");
}

function runVoiceDraft(host) {
  const lab = ensureLab();
  const api = window.LibertyVoice;
  if (!api) {
    setLabStatus(host, "Voice lab failed to load. Refresh the page.", "warn");
    return;
  }
  const result = api.deriveVoiceDraft(lab.proud, lab.hate);
  if (!result.ok) {
    setLabStatus(host, result.notes.join(" "), "warn");
    return;
  }
  const voice = ensure("voice");
  const keys = Object.keys(result.fields);
  const wouldOverwrite = keys.some((k) => String(voice[k] || "").trim());
  if (wouldOverwrite && !confirm("Replace the current voice.md draft with rules quoted from these piles?")) {
    return;
  }
  for (const k of keys) voice[k] = result.fields[k];
  save();
  for (const ta of document.querySelectorAll("[data-voice-key]")) {
    const key = ta.dataset.voiceKey;
    if (Object.prototype.hasOwnProperty.call(result.fields, key)) ta.value = result.fields[key];
  }
  const bits = [];
  if (result.notes.length) bits.push(result.notes.join(" "));
  if (result.missing.length) {
    bits.push("I left " + result.missing.join(", ") + " empty — not enough in the pile to fill them without inventing.");
  }
  bits.push("Drafted from your piles. Edit anything. Nothing left this browser.");
  setLabStatus(host, bits.join(" "), result.notes.length ? "warn" : "ok");
  if (ui.desk) preview();
}

function openVoiceLab() {
  clearHolesMode();
  if (ui.desk) {
    tab = "voice";
  } else {
    ui.done = false;
    ui.q = labStepFor(ui.path);
  }
  saveUi();
  draw();
  const el = document.querySelector(".voice-lab");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  const proud = document.getElementById("lab-proud");
  if (proud) proud.focus();
}

function claimsApi() {
  return window.LibertyClaims || null;
}

function refreshClaimsWatch() {
  const mount = document.getElementById("claims-watch-mount");
  if (!mount) return;
  const api = claimsApi();
  if (!api) {
    mount.innerHTML = "";
    return;
  }
  const hits = api.remainingHits(state);
  if (!hits.length) {
    mount.innerHTML = "";
    return;
  }
  mount.innerHTML = `
    <div class="claims-watch" role="region" aria-label="Claims watch">
      <p class="claims-kicker">Claims watch</p>
      <p class="claims-lead">Your own company and offer still say these. Tap to add one to claims you will never make. We only list words you already wrote.</p>
      <ul class="claims-list">
        ${hits.map((hit, i) => `
          <li>
            <div>
              <p class="claims-phrase">“${escapeHtml(hit.excerpt || hit.match)}”</p>
              <p class="claims-where">${escapeHtml(hit.label)}</p>
            </div>
            <button class="btn" type="button" data-claim-index="${i}">Add</button>
          </li>
        `).join("")}
      </ul>
    </div>
  `;
  for (const btn of mount.querySelectorAll("[data-claim-index]")) {
    btn.onclick = () => addClaimHit(hits[Number(btn.dataset.claimIndex)]);
  }
}

function addClaimHit(hit) {
  const api = claimsApi();
  if (!api || !hit) return;
  const data = ensure("offer");
  data.avoid = api.addClaimLine(data.avoid, hit);
  save();
  const interviewTa = document.getElementById("answer");
  const live = currentQuestion();
  if (interviewTa && live && live.key === "avoid") {
    interviewTa.value = data.avoid;
  }
  const deskTa = document.querySelector('textarea[data-file-id="offer"][data-field-key="avoid"]');
  if (deskTa) deskTa.value = data.avoid;
  if (ui.desk) preview();
  refreshClaimsWatch();
}

function openAvoidQuestion() {
  clearHolesMode();
  let qs = activeQuestions();
  let idx = qs.findIndex((q) => q.key === "avoid");
  if (idx < 0) {
    ui.path = "full";
    qs = QUESTIONS;
    idx = qs.findIndex((q) => q.key === "avoid");
  }
  ui.desk = false;
  ui.done = false;
  ui.q = idx >= 0 ? idx : 0;
  saveUi();
  draw();
  const ta = document.getElementById("answer");
  if (ta) ta.focus();
}

function finishWarning() {
  const api = claimsApi();
  if (!api) return "";
  const hits = api.remainingHits(state);
  if (!hits.length) return "";
  const line = api.formatStillSays(hits);
  return `
    <div class="claims-banner" role="status">
      <p>${escapeHtml(line)} You can add ${hits.length === 1 ? "it" : "them"} to claims to avoid, or download anyway.</p>
      <button class="linkish" id="finish-claims" type="button">Review claims to avoid</button>
    </div>
  `;
}

function fieldFilled(value) {
  return String(value || "").trim().length > 0;
}

function countFilledFields(file) {
  const data = state[file.id] || {};
  let filled = 0;
  for (const [key] of file.fields) {
    if (fieldFilled(data[key])) filled += 1;
  }
  return { filled, total: file.fields.length };
}

function labPilesFilled() {
  const lab = state.lab || {};
  return [lab.proud, lab.hate].filter(fieldFilled).length;
}

// Solid = at least half the file's fields have trimmed text (filled * 2 >= total).
// Empty = none filled. Thin = some, but under half.
// Voice: same field math; 0 voice fields + any lab pile counts as thin, not empty.
function fileHealth(file) {
  const { filled, total } = countFilledFields(file);
  let status = "empty";
  if (filled * 2 >= total) status = "solid";
  else if (filled > 0) status = "thin";
  if (file.id === "voice" && status === "empty" && labPilesFilled() > 0) {
    status = "thin";
  }
  return { id: file.id, name: file.name, filled, total, status };
}

function packHealth() {
  const rows = FILES.map(fileHealth);
  return { rows, anyThin: rows.some((row) => row.status !== "solid") };
}

function computeHoles() {
  const thin = new Set(packHealth().rows.filter((row) => row.status !== "solid").map((row) => row.id));
  const holes = [];
  for (const q of activeQuestions()) {
    if (!thin.has(q.fileId)) continue;
    if (!fieldFilled(fieldValue(q.fileId, q.key))) {
      holes.push({ kind: "question", ...q });
    }
  }
  if (thin.has("voice")) {
    holes.push({
      kind: "lab",
      fileId: "voice",
      fileTitle: "Voice",
      fileName: "voice.md"
    });
  }
  return holes;
}

function holeId(hole) {
  return hole.kind === "lab" ? "voice:lab" : hole.fileId + ":" + hole.key;
}

function hydrateHoles(ids) {
  const qs = QUESTIONS;
  const out = [];
  for (const id of ids) {
    if (id === "voice:lab") {
      out.push({
        kind: "lab",
        fileId: "voice",
        fileTitle: "Voice",
        fileName: "voice.md"
      });
      continue;
    }
    const sep = id.indexOf(":");
    if (sep < 0) continue;
    const fileId = id.slice(0, sep);
    const key = id.slice(sep + 1);
    const q = qs.find((item) => item.fileId === fileId && item.key === key);
    if (q) out.push({ kind: "question", ...q });
  }
  return out;
}

function ensureHolesWalk() {
  if (holesWalk && holesWalk.length) return holesWalk;
  if (ui.holes && ui.holes.ids && ui.holes.ids.length) {
    holesWalk = hydrateHoles(ui.holes.ids);
    if (holesWalk.length) return holesWalk;
  }
  holesWalk = computeHoles();
  if (ui.holes && holesWalk.length) {
    ui.holes = { i: ui.holes.i || 0, ids: holesWalk.map(holeId) };
  }
  return holesWalk;
}

function peekHole() {
  const list = ensureHolesWalk();
  if (!ui.holes || !list.length) return null;
  const i = Math.min(Math.max(ui.holes.i, 0), list.length - 1);
  return list[i];
}

function setHolesIndex(i) {
  const ids = (ui.holes && ui.holes.ids) || (holesWalk ? holesWalk.map(holeId) : null);
  ui.holes = { i, ids };
}

function clearHolesMode() {
  holesWalk = null;
  ui.holes = null;
}

function startHolesWalk(fromFileId) {
  holesWalk = computeHoles();
  if (!holesWalk.length) {
    clearHolesMode();
    ui.done = true;
    ui.desk = false;
    saveUi();
    draw();
    window.scrollTo(0, 0);
    return;
  }
  let i = 0;
  if (fromFileId) {
    const idx = holesWalk.findIndex((h) => h.fileId === fromFileId);
    if (idx >= 0) i = idx;
  }
  ui.holes = { i, ids: holesWalk.map(holeId) };
  ui.desk = false;
  ui.done = false;
  saveUi();
  draw();
  window.scrollTo(0, 0);
  const ta = document.getElementById("answer") || document.getElementById("lab-proud");
  if (ta) ta.focus();
}

function exitHolesWalk() {
  clearHolesMode();
  ui.done = true;
  ui.desk = false;
  saveUi();
  draw();
  window.scrollTo(0, 0);
}

function stepHoles(delta) {
  const list = ensureHolesWalk();
  if (!list.length) {
    exitHolesWalk();
    return;
  }
  const next = (ui.holes ? ui.holes.i : 0) + delta;
  if (delta > 0 && next >= list.length) {
    exitHolesWalk();
    return;
  }
  if (next < 0 || next >= list.length) return;
  setHolesIndex(next);
  saveUi();
  draw();
  const ta = document.getElementById("answer") || document.getElementById("lab-proud");
  if (ta) ta.focus();
}

function openFileHole(fileId) {
  startHolesWalk(fileId);
}

function packHealthMarkup(rows) {
  return `
    <div class="pack-health" role="region" aria-label="Pack health">
      <p class="claims-kicker">Pack health</p>
      <ul class="pack-health-list">
        ${rows.map((row) => {
          const hole = row.status !== "solid";
          const inner = `
            <span class="pack-health-name">${escapeHtml(row.name)}</span>
            <span class="pack-health-count">${row.filled} of ${row.total}</span>
            <span class="pack-health-status">${row.status}</span>
          `;
          if (hole) {
            return `<li>
              <button type="button" class="pack-health-row pack-health-${row.status}" data-pack-file="${row.id}" aria-label="${escapeHtml(row.name)}, ${row.filled} of ${row.total}, ${row.status}. Fill the holes starting here.">
                ${inner}
              </button>
            </li>`;
          }
          return `<li>
            <div class="pack-health-row pack-health-solid">
              ${inner}
            </div>
          </li>`;
        }).join("")}
      </ul>
    </div>
  `;
}

function renderFinish() {
  const root = document.getElementById("finish");
  const health = packHealth();
  const holeCount = health.anyThin ? computeHoles().length : 0;
  const headline = health.anyThin ? "Almost — a few holes." : "Your pack is ready.";
  const lead = health.anyThin
    ? "Skip is honest, but empty fields teach the next agent nothing. Fill the holes — only the unanswered ones. Copy and download still work."
    : "Read the four files. Copy the pack into ChatGPT, Claude, or Grok — or download the zip. Either way works.";
  const holesCta = holeCount
    ? `<button class="btn gold" id="finish-holes" type="button">Fill the holes (${holeCount})</button>`
    : "";
  const copyClass = holeCount ? "btn" : "btn gold";
  const blocks = FILES.map((file) => `
    <article class="finish-file">
      <div class="finish-file-head">
        <h3>${file.name}</h3>
        <button class="btn compact" type="button" data-copy-file="${file.id}">Copy</button>
      </div>
      <pre class="preview">${escapeHtml(markdown(file))}</pre>
    </article>
  `).join("");
  root.innerHTML = `
    <p class="progress">Four files · voice from examples</p>
    <h2 class="question">${headline}</h2>
    <p class="hint">${lead}</p>
    ${finishWarning()}
    ${packHealthMarkup(health.rows)}
    <div class="finish-toolbar">
      <div class="row finish-actions finish-primary">
        ${holesCta}
        <button class="${copyClass}" id="finish-copy-pack" type="button">Copy pack for ChatGPT</button>
        <button class="btn" id="finish-export" type="button">Download the zip</button>
      </div>
      <div class="row finish-actions finish-more">
        <button class="btn" id="finish-lab" type="button">Voice lab</button>
        <button class="btn" id="finish-back" type="button">Back to questions</button>
        <button class="btn" id="finish-clear" type="button">Clear this browser</button>
      </div>
    </div>
    ${blocks}
  `;
  const holesBtn = document.getElementById("finish-holes");
  if (holesBtn) holesBtn.onclick = () => startHolesWalk();
  document.getElementById("finish-copy-pack").onclick = () => {
    copyText(packClipboardMarkdown(), document.getElementById("finish-copy-pack"));
  };
  document.getElementById("finish-export").onclick = download;
  for (const btn of root.querySelectorAll("[data-copy-file]")) {
    btn.onclick = () => {
      const file = FILES.find((f) => f.id === btn.dataset.copyFile);
      if (file) copyText(markdown(file), btn);
    };
  }
  for (const btn of root.querySelectorAll("[data-pack-file]")) {
    btn.onclick = () => openFileHole(btn.dataset.packFile);
  }
  document.getElementById("finish-lab").onclick = openVoiceLab;
  document.getElementById("finish-back").onclick = () => {
    clearHolesMode();
    ui.done = false;
    ui.q = labStepFor(ui.path);
    saveUi();
    draw();
  };
  document.getElementById("finish-clear").onclick = clearDrafts;
  const review = document.getElementById("finish-claims");
  if (review) review.onclick = openAvoidQuestion;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function fieldValue(fileId, key) {
  return (state[fileId] || {})[key];
}

function firstUnansweredIndex(path, fromIndex) {
  const qs = questionsForPath(path);
  const start = Math.max(0, fromIndex || 0);
  for (let i = start; i < qs.length; i++) {
    if (!fieldFilled(fieldValue(qs[i].fileId, qs[i].key))) return i;
  }
  return qs.length;
}

function switchPath(nextPath) {
  if (nextPath !== "essentials" && nextPath !== "full") return;
  if (ui.path === nextPath) return;
  clearHolesMode();
  const fromQs = questionsForPath(ui.path);
  const onLab = ui.q >= fromQs.length;
  const current = onLab ? null : fromQs[ui.q];
  ui.path = nextPath;
  const toQs = questionsForPath(nextPath);

  if (onLab) {
    ui.done = false;
    ui.q = toQs.length;
  } else if (ui.done) {
    ui.done = false;
    ui.q = firstUnansweredIndex(nextPath, 0);
  } else if (current) {
    const exact = toQs.findIndex((q) => q.fileId === current.fileId && q.key === current.key);
    if (exact >= 0) {
      ui.q = fieldFilled(fieldValue(current.fileId, current.key))
        ? firstUnansweredIndex(nextPath, exact)
        : exact;
    } else {
      const fullIdx = QUESTIONS.findIndex((q) => q.fileId === current.fileId && q.key === current.key);
      let landed = -1;
      for (let i = 0; i < toQs.length; i++) {
        const fi = QUESTIONS.findIndex((q) => q.fileId === toQs[i].fileId && q.key === toQs[i].key);
        if (fi >= fullIdx && !fieldFilled(fieldValue(toQs[i].fileId, toQs[i].key))) {
          landed = i;
          break;
        }
      }
      ui.q = landed >= 0 ? landed : firstUnansweredIndex(nextPath, 0);
    }
    ui.done = false;
  } else {
    ui.q = firstUnansweredIndex(nextPath, 0);
    ui.done = false;
  }

  saveUi();
  draw();
  const ta = document.getElementById("answer") || document.getElementById("lab-proud");
  if (ta) ta.focus();
  window.scrollTo(0, 0);
}

function step(delta) {
  const lab = labStepFor(ui.path);
  const next = ui.q + delta;
  if (delta > 0 && ui.q >= lab) {
    ui.done = true;
    saveUi();
    draw();
    window.scrollTo(0, 0);
    return;
  }
  if (next < 0 || next > lab) return;
  ui.q = next;
  ui.done = false;
  saveUi();
  draw();
  const ta = document.getElementById("answer") || document.getElementById("lab-proud");
  if (ta) ta.focus();
}

function crc32(bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function zipStore(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  const out = [];
  const u16 = (n) => [n & 255, (n >>> 8) & 255];
  const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.body);
    const crc = crc32(data);
    const local = [0x50,0x4b,0x03,0x04, 20,0, 0,0, 0,0, 0,0,0,0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0,0];
    const central = [0x50,0x4b,0x01,0x02, 20,0, 20,0, 0,0, 0,0, 0,0,0,0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0,0, 0,0, 0,0, 0,0, 0,0,0,0, ...u32(offset)];
    locals.push(Uint8Array.from(local), name, data);
    centrals.push(Uint8Array.from(central), name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centrals.reduce((n, p) => n + p.length, 0);
  const end = Uint8Array.from([0x50,0x4b,0x05,0x06, 0,0,0,0, ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), 0,0]);
  const parts = [...locals, ...centrals, end];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return buf;
}

function download() {
  const files = [
    { name: "HOW_TO_USE.md", body: howToUseMarkdown() },
    ...FILES.map((f) => ({ name: f.name, body: markdown(f) }))
  ];
  const zip = zipStore(files);
  const blob = new Blob([zip], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "four-files.zip";
  a.click();
  URL.revokeObjectURL(a.href);
}

function wipeState() {
  localStorage.removeItem(KEY);
  for (const k of Object.keys(state)) delete state[k];
  ui.q = 0;
  ui.done = false;
  ui.path = "essentials";
  clearHolesMode();
  saveUi();
}

function clearDrafts() {
  if (!confirm("Clear the four drafts saved in this browser?")) return;
  wipeState();
  draw();
}

const HARBOR_LAMP = {
  company: {
    sells: "Harbor Lamp makes small-batch brass table lamps and wall sconces. Each one is spun, soldered, and wired by one pair of hands in a garage workshop in Portland, Maine. The product is the lamp — warm, heavy, meant to last — plus a written care card and a lifetime rewire if the socket ever fails.",
    serves: "People who want one good lamp in a room they actually live in. Renters with a dark corner. Homeowners tired of disposable fixtures. Gift-buyers looking for something that already feels like it had a life.",
    money: "Almost all of it is the shop: $240–$380 per lamp, shipped in the lower 48. A few Saturday-morning pickups at the garage. No wholesale. No subscription. Repair and rewire are free — they are the promise, not a line item.",
    believes: "A lamp should outlive the person who bought it. Light should be warm enough to read by. Brass should be allowed to tarnish. Fast, cheap, and replaceable is how rooms get ugly.",
    different: "One maker. No catalog of 400 SKUs. Every lamp ships with the date it was finished and a note in the same handwriting. If something is wrong, you email the person who built it."
  },
  customer: {
    icp: "Adults 32–60 who already care about objects. They have bought a used chair, a cast-iron pan, or a wool blanket on purpose. They live in apartments or older houses with bad overhead light. They will spend $300 once and then stop shopping for lamps.",
    pains: "The room goes dark after 4pm. Big-box lamps feel hollow and tip over. Designer lamps cost $1,200 and still look like a hotel lobby. They do not want another package they will throw away in three years.",
    objections: "“That’s a lot for a lamp.” “Will it look dated?” “I rent — I shouldn’t buy something this heavy.” “What if the finish goes green?”",
    triggers: "A move. A new desk. A winter that made the living room feel like a cave. A birthday for someone who already has too much stuff. The last cheap lamp died and they refuse to buy another one.",
    language: "Warm light. Heavy. Not plastic. Something that will patina. “I want it to look like it belongs in an old house.” “I don’t want it to scream new.”",
    fears: "Buying something precious that looks try-hard. Getting a lamp that photographs well and lives badly. Being stuck with a style they will hate in two years. Shipping damage on something they waited for.",
    criteria: "Weight in the photos. A real person answering email. Clear wattage and shade size. A return if it arrives dented. They decide after one evening of looking, not after a 20-tab research spiral.",
    quotes: "“I just want one lamp I don’t have to think about again.”\n“Everything at the store looks the same and none of it is heavy.”\n“If it tarnishes, that’s the point, right?”\n“Can I actually read under this, or is it just pretty?”"
  },
  offer: {
    packages: "One lamp at a time. Table lamp or wall sconce. You pick the shade cloth (linen or parchment) and the finish (living brass or darkened). That is the package. No bundles. No starter kit.",
    deliverables: "The lamp, a spare bulb of the right temperature, a one-page care card, and a handwritten note with the finish date. Wall sconces include the mounting hardware and a paper template. Lifetime socket rewire if you mail it back.",
    pricing: "$240 for the small table lamp. $320 for the desk lamp with a wider shade. $380 for the wall sconce — harder to hang, more brass. The price is the time: two evenings of work plus materials that are not plated pot metal. It is not cheap because cheap lamps already exist.",
    proof: "Fourteen lamps sold this year, all to people who found the shop from a photo a friend sent. Three rewires completed, no charge. No press. No awards. The workshop is a garage. Photos on the site are of lamps that have already shipped.",
    promises: "It will be heavy. The socket will be a real one you can replace. If brass spots in the first year from a manufacturing fault, I make it right. Emails get a reply from me within two days.",
    avoid: "Never say “heirloom” unless the customer does. Never claim the brass is maintenance-free. Never invent a waitlist. Never imply this is a studio with apprentices. Never use stock photos of rooms I did not light.",
    fit: "Good fit: you want one lamp, you like brass that changes, you can wait two to four weeks. Bad fit: you need twenty matching fixtures by Friday, you want chrome, you want a catalog, you want someone else to hang twelve sconces."
  },
  voice: {
    sounds: "“This one left the bench on a Tuesday. The brass will darken where you touch it.”\n“If you want it brighter, use a 60-watt-equivalent warm bulb. I ship a 40 because most rooms already have too much glare.”\n“I don’t do wholesale. I barely do shipping. That’s the honest version.”",
    never: "Lifestyle-brand voice. “Curated.” “Elevate your space.” Fake scarcity. Talking like a lighting conglomerate. Cheerful exclamation points on a $300 object.",
    use: "Bench. Socket. Shade. Living brass. Rewire. Two evenings. The room you actually sit in.",
    skip: "Elevate. Curate. Luxury. Artisanal — unless quoting a customer. Limited drop. Join the list. Unlock.",
    good: "The small table lamp is $240 because that’s two evenings and honest brass. It will spot. That’s the metal doing what metal does. If the socket ever fails, mail it back and I will put a new one in.",
    bad: "Introducing our heritage-inspired lighting collection — meticulously crafted to elevate everyday moments and bring luxury warmth into your sanctuary."
  },
  lab: {
    proud: "This one left the bench on a Tuesday. The brass will darken where you touch it.\n\nIf you want it brighter, use a 60-watt-equivalent warm bulb. I ship a 40 because most rooms already have too much glare.\n\nI don’t do wholesale. I barely do shipping. That’s the honest version.\n\nThe small table lamp is $240 because that’s two evenings and honest brass. It will spot. That’s the metal doing what metal does. If the socket ever fails, mail it back and I will put a new one in.",
    hate: "Introducing our heritage-inspired lighting collection — meticulously crafted to elevate everyday moments and bring luxury warmth into your sanctuary.\n\nUnlock a curated lighting experience that seamlessly elevates your space. Join the list for our limited drop of artisanal luxury fixtures!"
  }
};

function loadExample() {
  if (hasAnswers() && !confirm("Replace what you have written with the Harbor Lamp example?")) return;
  for (const file of FILES) {
    state[file.id] = { ...HARBOR_LAMP[file.id] };
  }
  state.lab = { proud: HARBOR_LAMP.lab.proud, hate: HARBOR_LAMP.lab.hate };
  save();
  ui.desk = false;
  ui.done = true;
  ui.q = labStepFor(ui.path);
  clearHolesMode();
  saveUi();
  draw();
  window.scrollTo(0, 0);
}

function syncPageMode() {
  const desk = !!ui.desk;
  const finish = !desk && !!ui.done;
  const interview = !desk && !finish;
  document.body.classList.toggle("mode-desk", desk);
  document.body.classList.toggle("mode-finish", finish);
  document.body.classList.toggle("mode-interview", interview);
  const label = document.getElementById("mode-label");
  if (!label) return;
  if (desk) {
    label.hidden = true;
    return;
  }
  label.hidden = false;
  if (finish) label.textContent = "Finish · four files";
  else if (inHolesWalk()) label.textContent = "Fill the holes";
  else if (ui.q >= labStepFor(ui.path)) label.textContent = "Voice lab · last step";
  else label.textContent = isEssentialsPath() ? "Short pack · one question" : "Interview · one question";
}

function draw() {
  if (inHolesWalk()) {
    if (!ensureHolesWalk().length) {
      clearHolesMode();
      ui.done = true;
      saveUi();
    }
  }
  syncPageMode();
  const interview = document.getElementById("interview");
  const desk = document.getElementById("desk");
  const finish = document.getElementById("finish");
  const toggle = document.getElementById("toggle-desk");
  const pathBtn = document.getElementById("toggle-path");
  const note = document.getElementById("example-note");

  if (pathBtn) {
    pathBtn.hidden = !!ui.desk;
    pathBtn.textContent = isEssentialsPath() ? "Answer all questions" : "Short pack";
    pathBtn.setAttribute("aria-pressed", isEssentialsPath() ? "false" : "true");
  }

  if (ui.desk) {
    interview.hidden = true;
    finish.hidden = true;
    desk.hidden = false;
    note.hidden = true;
    toggle.textContent = "One question at a time";
    toggle.setAttribute("aria-pressed", "true");
    renderTabs();
    renderEditor();
    preview();
    return;
  }

  note.hidden = false;
  toggle.textContent = "Show all fields";
  toggle.setAttribute("aria-pressed", "false");
  desk.hidden = true;

  if (inHolesWalk()) {
    finish.hidden = true;
    interview.hidden = false;
    renderHolesWalk();
    return;
  }

  if (ui.done) {
    interview.hidden = true;
    finish.hidden = false;
    renderFinish();
    return;
  }

  finish.hidden = true;
  interview.hidden = false;
  renderInterview();
}

document.getElementById("toggle-desk").onclick = () => {
  ui.desk = !ui.desk;
  saveUi();
  draw();
};
document.getElementById("toggle-path").onclick = () => {
  switchPath(isEssentialsPath() ? "full" : "essentials");
};
document.getElementById("example").onclick = loadExample;
document.getElementById("voice-lab").onclick = openVoiceLab;
document.getElementById("desk-export").onclick = download;
document.getElementById("desk-copy-pack").onclick = () => {
  copyText(packClipboardMarkdown(), document.getElementById("desk-copy-pack"));
};
document.getElementById("desk-clear").onclick = clearDrafts;
draw();
