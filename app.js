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

const QUESTIONS = FILES.flatMap((file) =>
  file.fields.map(([key, label]) => ({
    fileId: file.id,
    fileTitle: file.title,
    fileName: file.name,
    hint: file.hint,
    key,
    label
  }))
);

const KEY = "liberty-four-files-v1";
const UI_KEY = "liberty-four-files-ui-v1";
const state = load();
const ui = loadUi();
let tab = "company";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function loadUi() {
  const fallback = { desk: false, q: 0, done: false };
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY));
    if (!raw || typeof raw !== "object") return fallback;
    const q = Number(raw.q);
    return {
      desk: !!raw.desk,
      q: Number.isInteger(q) ? Math.min(Math.max(q, 0), QUESTIONS.length - 1) : 0,
      done: !!raw.done
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
function hasAnswers() {
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
  box.innerHTML = `<p class="hint">${file.hint}</p>`;
  for (const [key, label] of file.fields) {
    const lab = document.createElement("label");
    lab.textContent = label;
    const ta = document.createElement("textarea");
    ta.value = data[key] || "";
    ta.oninput = () => { data[key] = ta.value; save(); preview(); };
    box.appendChild(lab);
    box.appendChild(ta);
  }
}

function preview() {
  const file = FILES.find((f) => f.id === tab);
  document.getElementById("preview").textContent = markdown(file);
}

function renderInterview() {
  const q = QUESTIONS[ui.q];
  const data = ensure(q.fileId);
  const n = QUESTIONS.length;
  const pct = ((ui.q + 1) / n) * 100;
  const last = ui.q === n - 1;
  const root = document.getElementById("interview");
  root.innerHTML = `
    <p class="progress" id="progress-label">Question ${ui.q + 1} of ${n} · ${q.fileTitle}</p>
    <div class="progress-track" aria-hidden="true"><span style="width:${pct}%"></span></div>
    <p class="file-chip">${q.fileName}</p>
    <h2 class="question">${q.label}</h2>
    <p class="hint">${q.hint}</p>
    <label class="sr-only" for="answer">${q.label}</label>
    <textarea id="answer" class="interview-answer" rows="8" placeholder="Write it in your words."></textarea>
    <div class="interview-nav">
      <button class="btn" id="back" type="button"${ui.q === 0 ? " disabled" : ""}>Back</button>
      <button class="btn" id="skip" type="button">${last ? "Skip and finish" : "Skip"}</button>
      <button class="btn gold" id="next" type="button">${last ? "Finish" : "Next"}</button>
    </div>
    <p class="quiet-tools"><button class="linkish" id="interview-clear" type="button">Clear this browser</button></p>
  `;
  const ta = document.getElementById("answer");
  ta.value = data[q.key] || "";
  ta.oninput = () => { data[q.key] = ta.value; save(); };
  document.getElementById("back").onclick = () => step(-1);
  document.getElementById("skip").onclick = () => step(1);
  document.getElementById("next").onclick = () => step(1);
  document.getElementById("interview-clear").onclick = clearDrafts;
}

function renderFinish() {
  const root = document.getElementById("finish");
  const blocks = FILES.map((file) => `
    <article class="finish-file">
      <h3>${file.name}</h3>
      <pre class="preview">${escapeHtml(markdown(file))}</pre>
    </article>
  `).join("");
  root.innerHTML = `
    <p class="progress">All ${QUESTIONS.length} questions · four files</p>
    <h2 class="question">Your pack is ready.</h2>
    <p class="hint">Read the four files. Download the zip. Hand the folder to any model.</p>
    <div class="row finish-actions">
      <button class="btn gold" id="finish-export" type="button">Download the zip</button>
      <button class="btn" id="finish-back" type="button">Back to questions</button>
      <button class="btn" id="finish-clear" type="button">Clear this browser</button>
    </div>
    ${blocks}
  `;
  document.getElementById("finish-export").onclick = download;
  document.getElementById("finish-back").onclick = () => {
    ui.done = false;
    ui.q = QUESTIONS.length - 1;
    saveUi();
    draw();
  };
  document.getElementById("finish-clear").onclick = clearDrafts;
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

function step(delta) {
  const next = ui.q + delta;
  if (delta > 0 && ui.q >= QUESTIONS.length - 1) {
    ui.done = true;
    saveUi();
    draw();
    window.scrollTo(0, 0);
    return;
  }
  if (next < 0 || next >= QUESTIONS.length) return;
  ui.q = next;
  ui.done = false;
  saveUi();
  draw();
  const ta = document.getElementById("answer");
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
  const files = FILES.map((f) => ({ name: f.name, body: markdown(f) }));
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
  }
};

function loadExample() {
  if (hasAnswers() && !confirm("Replace what you have written with the Harbor Lamp example?")) return;
  for (const file of FILES) {
    state[file.id] = { ...HARBOR_LAMP[file.id] };
  }
  save();
  ui.desk = false;
  ui.done = true;
  ui.q = QUESTIONS.length - 1;
  saveUi();
  draw();
  window.scrollTo(0, 0);
}

function draw() {
  const interview = document.getElementById("interview");
  const desk = document.getElementById("desk");
  const finish = document.getElementById("finish");
  const toggle = document.getElementById("toggle-desk");
  const note = document.getElementById("example-note");

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
document.getElementById("example").onclick = loadExample;
document.getElementById("desk-export").onclick = download;
document.getElementById("desk-clear").onclick = clearDrafts;
draw();
