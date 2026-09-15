"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  TEMPLATES,
  SETTLEMENT,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");
const { quote, transition } = require("../api/_lib/settlement-transition");

const ROOT = path.join(__dirname, "..");
const NOW = "2026-09-15T00:00:00.000Z";
const OPTIONS = { now: () => NOW, makeId: () => "as_0123456789" };

function mockRes() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    ended: false,
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

async function invoke(req) {
  const handler = require("../api/templates.json.js");
  const res = mockRes();
  await handler(req, res);
  return res;
}

function homepageButtons(html) {
  const buttons = [];
  const re =
    /<button[^>]*data-job-template="([^"]+)"[^>]*data-title="([^"]+)"[^>]*data-amount="([^"]+)"[^>]*data-criteria="([^"]+)"[^>]*>([^<]*)<\/button>/g;
  let match;
  while ((match = re.exec(html))) {
    buttons.push({
      id: match[1],
      title: match[2],
      amount: Number(match[3]),
      criteria: match[4],
      label: match[5].trim(),
    });
  }
  return buttons;
}

test("templates.json stays demo-only and lists fill-only create presets", () => {
  assert.equal(TEMPLATES.service, "liberty-agent-settlement");
  assert.equal(TEMPLATES.mode, "demo");
  assert.equal(TEMPLATES.money, false);
  assert.equal(TEMPLATES.origin, "https://liberty-amber.vercel.app");
  assert.equal(TEMPLATES.human_path, "/#create");
  assert.equal(TEMPLATES.fills, "create_form");
  assert.equal(TEMPLATES.auto_create, false);
  assert.equal(TEMPLATES.auto_fund, false);
  assert.ok(TEMPLATES.templates.length >= 3);
  assert.ok(TEMPLATES.templates.length <= 6);
  assert.deepEqual(
    TEMPLATES.templates.map((row) => row.id),
    ["research-brief", "code-review", "data-extract", "content-draft", "filing-summary"],
  );

  for (const row of TEMPLATES.templates) {
    assert.equal(typeof row.id, "string");
    assert.ok(row.id);
    assert.equal(typeof row.label, "string");
    assert.ok(row.label);
    assert.equal(typeof row.title, "string");
    assert.ok(row.title.length > 0);
    assert.ok(row.title.length <= 80);
    assert.equal(typeof row.amount, "number");
    assert.ok(Number.isInteger(row.amount));
    assert.ok(row.amount >= 1);
    assert.equal(typeof row.criteria, "string");
    assert.ok(row.criteria.trim());
  }
});

test("template fields are valid create input against the shared fee engine", () => {
  for (const row of TEMPLATES.templates) {
    const body = {
      action: "create",
      title: row.title,
      amount: row.amount,
      criteria: row.criteria,
    };
    const quoted = quote(body, OPTIONS);
    assert.equal(quoted.status, 200, row.id);
    assert.equal(quoted.body.quoted, true);
    assert.equal(quoted.body.money, false);
    assert.equal(quoted.body.job.status, "open");
    assert.equal(quoted.body.job.id, undefined);
    assert.equal(quoted.body.job.title, row.title);
    assert.equal(quoted.body.job.amount, row.amount);
    assert.equal(quoted.body.job.criteria, row.criteria);

    const created = transition(body, OPTIONS);
    assert.equal(created.status, 200, row.id);
    assert.equal(created.body.job.status, "open");
    assert.equal(created.body.job.id, "as_0123456789");
    assert.equal(created.body.money, false);
  }
});

test("GET /api/templates.json serves the templates document", async () => {
  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.body, TEMPLATES);
  assert.equal(get.body.money, false);
  assert.equal(get.body.auto_create, false);
  assert.equal(get.body.auto_fund, false);
  assert.equal(get.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(get.headers["Content-Type"], protocolHeaders()["Content-Type"]);

  const options = await invoke({ method: "OPTIONS" });
  assert.equal(options.statusCode, 204);
  assert.equal(options.ended, true);

  const post = await invoke({ method: "POST" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.body.money, false);
  assert.equal(post.body.error, "method_not_allowed");
});

test("homepage create buttons match templates.json and do not auto-fund", () => {
  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('id="create"'));
  assert.ok(homepage.includes('id="job-templates"'));
  assert.ok(homepage.includes("Does not create or fund"));
  assert.ok(homepage.includes("/api/templates.json"));

  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  assert.ok(app.includes("[data-job-template]"));
  assert.ok(app.includes("this did not fund"));
  const fillHandler = app.match(
    /document\.querySelectorAll\("\[data-job-template\]"\)[\s\S]*?titleEl\?\.focus\(\);\s*\}\);/,
  );
  assert.ok(fillHandler, "template click handler should fill the form");
  assert.ok(!fillHandler[0].includes("createJob"));
  assert.ok(!fillHandler[0].includes("fundJob"));

  const buttons = homepageButtons(homepage);
  assert.deepEqual(
    buttons.map((row) => row.id),
    TEMPLATES.templates.map((row) => row.id),
  );
  for (const row of TEMPLATES.templates) {
    const button = buttons.find((item) => item.id === row.id);
    assert.ok(button, row.id);
    assert.equal(button.title, row.title);
    assert.equal(button.amount, row.amount);
    assert.equal(button.criteria, row.criteria);
    assert.equal(button.label, row.label);
  }
});

test("discovery docs point at templates.json and the create form", () => {
  assert.equal(SETTLEMENT.surfaces.templates, "/api/templates.json");
  assert.equal(SETTLEMENT.templates.path, "/api/templates.json");
  assert.equal(SETTLEMENT.templates.money, false);
  assert.equal(SETTLEMENT.templates.human_path, "/#create");
  assert.equal(SETTLEMENT.templates.auto_create, false);
  assert.equal(SETTLEMENT.templates.auto_fund, false);
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/templates.json")));
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("#create")));

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/api/templates.json"].get);
  assert.equal(openapi.paths["/api/templates.json"].get.operationId, "getJobTemplates");
  assert.ok(openapi.info.description.includes("/api/templates.json"));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/api/templates.json"));
  assert.ok(markdown.includes("/#create"));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/api/templates.json"));
  assert.ok(llms.includes("/#create"));
});
