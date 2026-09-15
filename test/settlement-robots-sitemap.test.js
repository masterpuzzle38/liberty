"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { AGENT } = require("../api/_lib/settlement-protocol");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://liberty-amber.vercel.app";

const SITEMAP_PATHS = [
  "/",
  "/.well-known/agent.json",
  "/api/health.json",
  "/api/settlement.json",
  "/api/fees.json",
  "/api/tools.json",
  "/api/quickstart.json",
  "/api/schemas/transition.json",
  "/api/errors.json",
  "/api/scoreboard.json",
  "/api/changelog.json",
  "/api/examples.json",
  "/api/templates.json",
  "/SETTLEMENT.md",
  "/llms.txt",
  "/settlement.openapi.json",
  "/openapi.json",
  "/api/openapi.json",
];

test("robots.txt and sitemap.xml list the real discovery URLs", () => {
  const robots = fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8");
  assert.match(robots, /User-agent:\s*\*/);
  assert.match(robots, /Allow:\s*\//);
  assert.match(robots, new RegExp(`Sitemap:\\s*${ORIGIN}/sitemap\\.xml`));
  assert.doesNotMatch(robots, /Disallow:/);
  assert.doesNotMatch(robots, /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);

  const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  for (const route of SITEMAP_PATHS) {
    const loc = `${ORIGIN}${route}`;
    assert.ok(sitemap.includes(`<loc>${loc}</loc>`), `missing sitemap loc: ${loc}`);
  }
  assert.equal((sitemap.match(/<url>/g) || []).length, SITEMAP_PATHS.length);
  assert.doesNotMatch(sitemap, /#/);
  assert.doesNotMatch(sitemap, /\/api\/v0\//);
  assert.doesNotMatch(sitemap, /\b\d[\d,]*\s+(users?|customers?|pilots?)\b/i);

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(
    vercel.headers.some((row) => row.source === "/robots.txt"),
    "vercel.json should cache /robots.txt",
  );
  assert.ok(
    vercel.headers.some((row) => row.source === "/sitemap.xml"),
    "vercel.json should cache /sitemap.xml",
  );
});

test("discovery card and llms.txt point at robots.txt and sitemap.xml", () => {
  assert.equal(AGENT.surfaces.robots, "/robots.txt");
  assert.equal(AGENT.surfaces.sitemap, "/sitemap.xml");
  assert.match(AGENT.note, /robots\.txt/i);
  assert.match(AGENT.note, /sitemap\.xml/i);

  const staticCard = JSON.parse(fs.readFileSync(path.join(ROOT, ".well-known", "agent.json"), "utf8"));
  assert.deepEqual(staticCard, AGENT);

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/robots.txt"));
  assert.ok(llms.includes("/sitemap.xml"));

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('href="/sitemap.xml"'));
  assert.ok(homepage.includes('href="/robots.txt"'));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/robots.txt"));
  assert.ok(markdown.includes("/sitemap.xml"));

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.robots.const,
    "/robots.txt",
  );
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.sitemap.const,
    "/sitemap.xml",
  );
});
