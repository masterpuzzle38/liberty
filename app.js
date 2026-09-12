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

const KEY = "liberty-four-files-v1";
const state = load();
let tab = "company";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function ensure(id) {
  if (!state[id]) state[id] = {};
  return state[id];
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

function draw() {
  renderTabs();
  renderEditor();
  preview();
}

document.getElementById("export").onclick = download;
document.getElementById("clear").onclick = () => {
  if (!confirm("Clear the four drafts saved in this browser?")) return;
  localStorage.removeItem(KEY);
  for (const k of Object.keys(state)) delete state[k];
  draw();
};
draw();
