"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SCOREBOARD,
  SETTLEMENT,
  AGENT,
  protocolHeaders,
} = require("../api/_lib/settlement-protocol");

const ROOT = path.join(__dirname, "..");

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
  const handler = require("../api/scoreboard.json.js");
  const res = mockRes();
  await handler(req, res);
  return res;
}

test("scoreboard JSON stays demo-only with honest zeros", () => {
  const raw = fs.readFileSync(path.join(ROOT, "api/_lib/scoreboard.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, SCOREBOARD);

  assert.equal(SCOREBOARD.service, "liberty-agent-settlement");
  assert.equal(SCOREBOARD.kind, "liberty-agent-settlement-scoreboard");
  assert.equal(SCOREBOARD.mode, "demo");
  assert.equal(SCOREBOARD.money, false);
  assert.equal(SCOREBOARD.path, "/api/scoreboard.json");
  assert.equal(SCOREBOARD.human, "/#scoreboard");
  assert.equal(SCOREBOARD.origin, "https://liberty-amber.vercel.app");
  assert.equal(SCOREBOARD.external_users, 0);
  assert.equal(SCOREBOARD.paid_pilots, 0);
  assert.equal(SCOREBOARD.revenue_usd, 0);
  assert.equal(typeof SCOREBOARD.external_users, "number");
  assert.equal(typeof SCOREBOARD.paid_pilots, "number");
  assert.equal(typeof SCOREBOARD.revenue_usd, "number");
  assert.match(SCOREBOARD.note, /listings\s*≠\s*users/i);
  assert.match(SCOREBOARD.note, /demo only/i);
  assert.match(SCOREBOARD.directory_listings.note, /listings are not users/i);
  assert.equal(SCOREBOARD.directory_listings.count, undefined);
  assert.equal(SCOREBOARD.directory_listings.urls, undefined);
  const listings = SCOREBOARD.directory_listings.entries;
  assert.ok(Array.isArray(listings));
  assert.equal(listings.length, 22);
  const listingUrls = listings.map((entry) => entry.url);
  const listingNames = listings.map((entry) => entry.directory);
  for (const entry of listings) {
    assert.equal(typeof entry.directory, "string");
    assert.ok(entry.directory.length > 0);
    assert.equal(typeof entry.url, "string");
    assert.match(entry.url, /^https:\/\//);
    if (entry.note !== undefined) assert.equal(typeof entry.note, "string");
    if (entry.agent_id !== undefined) assert.equal(typeof entry.agent_id, "string");
  }
  assert.ok(listingUrls.includes("https://meshkore.com/agent/liberty-agent-settlement"));
  assert.ok(listingUrls.includes("https://agentconnex.com/agents/liberty-agent-settlement-a3102d"));
  assert.ok(listingUrls.includes("https://for.you.com/agents/liberty-agent-settlement"));
  assert.ok(listingUrls.includes("https://agentbazaar.tech/agent/ag_67487308"));
  assert.ok(listingUrls.includes("https://agentmesh.help/agents/agt_6f8323b9f3a6"));
  assert.ok(
    listingUrls.includes(
      "https://api.agentstore.tools/api/agents/liberty-agent-settlement.liberty-agent-settlement",
    ),
  );
  assert.ok(
    listingUrls.includes(
      "https://floweringagents.ai.in.rs/agents/f08bf12a-b57c-4d69-bd6a-a2c7b4b86c61",
    ),
  );
  assert.ok(listingUrls.includes("https://agentlair.dev/agents/liberty-agent-settlement"));
  assert.ok(
    listingUrls.includes("https://agrenting.com/agents/liberty-agent-settlement-d0aec1dd3b6e"),
  );
  assert.ok(
    listingUrls.includes("https://a2awire.com/api/v1/agents/01180229-3ef9-4b6e-a191-d0dd354ad697"),
  );
  assert.ok(
    listingUrls.includes("https://agora.naxlab.xyz/agents/ce338b90-952d-4127-b0fe-deabdf2adaee"),
  );
  assert.ok(
    listingUrls.includes("https://agents-launch.lovable.app/agents/liberty-agent-settlement"),
  );
  assert.ok(listingUrls.includes("https://machins.co/agent/liberty-agent-settlement"));
  assert.ok(listingUrls.includes("https://rnwy.com/id/libertyagentsettlement"));
  assert.ok(listingUrls.includes("https://agentgram.co/agents/liberty-agent-settlement"));
  assert.ok(listingUrls.includes("https://moltter.net/u/liberty_settle"));
  assert.ok(listingUrls.includes("https://shellbook.io/u/liberty_settle"));
  assert.ok(listingUrls.includes("https://moltos.org/agenthub/agent_9a13a91907200789"));
  assert.ok(listingUrls.includes("https://registry.agentloka.ai/v1/agents/liberty_settle"));
  assert.ok(listingUrls.includes("https://veii.ai/profile/liberty-settle"));
  assert.ok(listingUrls.includes("https://robauto.ai/agenthub/marketplace"));
  assert.ok(listingUrls.includes("https://agentsignet.com/lookup?sid=SID-0x9325e6395c8fe8e2"));
  const agentlair = listings.find((entry) => entry.directory === "AgentLair");
  assert.match(agentlair.note, /x402/i);
  const agrenting = listings.find((entry) => entry.directory === "Agrenting");
  assert.match(agrenting.note, /api twin/i);
  const a2awire = listings.find((entry) => entry.directory === "A2AWire");
  assert.match(a2awire.note, /not an a2awire invoke provider/i);
  const openagora = listings.find((entry) => entry.directory === "OpenAgora");
  assert.match(openagora.note, /q=liberty/i);
  const agentlaunch = listings.find((entry) => entry.directory === "AgentLaunch");
  assert.match(agentlaunch.note, /api twin/i);
  assert.match(agentlaunch.note, /pricing free/i);
  const machins = listings.find((entry) => entry.directory === "machins");
  assert.match(machins.note, /marketplace priced listing skipped/i);
  assert.match(machins.note, /not liberty money/i);
  const rnwy = listings.find((entry) => entry.directory === "RNWY");
  assert.match(rnwy.note, /identity-only/i);
  assert.match(rnwy.note, /RNWY-2026-0067/);
  const agentgram = listings.find((entry) => entry.directory === "AgentGram");
  assert.match(agentgram.note, /www twin/i);
  assert.match(agentgram.note, /honest scoreboard zeros/i);
  const moltter = listings.find((entry) => entry.directory === "Moltter");
  assert.match(moltter.note, /api twin/i);
  assert.match(moltter.note, /quickstart/i);
  const shellbook = listings.find((entry) => entry.directory === "Shellbook");
  assert.match(shellbook.note, /intro post/i);
  assert.match(shellbook.note, /quickstart/i);
  const moltos = listings.find((entry) => entry.directory === "MoltOS");
  assert.match(moltos.note, /quickstart/i);
  assert.match(moltos.note, /not liberty users/i);
  const agentloka = listings.find((entry) => entry.directory === "AgentLoka");
  assert.match(agentloka.note, /machine-readable/i);
  assert.match(agentloka.note, /cloudflare/i);
  const veii = listings.find((entry) => entry.directory === "Veii");
  assert.match(veii.note, /intro post/i);
  assert.match(veii.note, /#integrate/i);
  assert.match(veii.note, /follower_count=0/);
  const robauto = listings.find((entry) => entry.directory === "Robauto");
  assert.match(robauto.note, /05b63b59-f08e-4f02-9461-89bb8b4fb0a4/);
  assert.match(robauto.note, /price_usdc=0/);
  assert.match(robauto.note, /not an x402 paid service/i);
  const signet = listings.find((entry) => entry.directory === "Signet");
  assert.match(signet.note, /api\.agentsignet\.com\/score\/SID-0x9325e6395c8fe8e2\/public/);
  assert.match(signet.note, /composite_score=300/);
  assert.match(signet.note, /provisional platform default/i);
  assert.match(signet.note, /not liberty traction/i);
  assert.ok(
    !listingNames.some((name) =>
      /agentindex|mcp\.directory|agent reputation|relaymarket|vermarco|vertical marketplace|clawexchange|agentry|indieindex/i.test(
        name,
      ),
    ),
  );
  assert.ok(
    !listingUrls.some((url) =>
      /agentindex|mcp\.directory|agentreputation|relaymarket|vermarco|verticalmarketplace|clawexchange|agentry|indieindex/i.test(
        url,
      ),
    ),
  );
  assert.equal(SCOREBOARD.live.ui, "https://liberty-amber.vercel.app");
  assert.equal(SCOREBOARD.live.discovery, "https://liberty-amber.vercel.app/.well-known/agent.json");
  assert.equal(SCOREBOARD.live.changelog, "https://liberty-amber.vercel.app/api/changelog.json");
  assert.doesNotMatch(JSON.stringify(SCOREBOARD), /\$[\d,]+|\b\d[\d,]*\s+(gmv|revenue|users?|customers?|pilots?)\b/i);
});

test("GET /api/scoreboard.json serves the scoreboard", async () => {
  const get = await invoke({ method: "GET" });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.body, SCOREBOARD);
  assert.equal(get.body.money, false);
  assert.equal(get.body.external_users, 0);
  assert.equal(get.body.paid_pilots, 0);
  assert.equal(get.body.revenue_usd, 0);
  assert.equal(get.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(get.headers["Content-Type"], protocolHeaders()["Content-Type"]);

  const options = await invoke({ method: "OPTIONS" });
  assert.equal(options.statusCode, 204);
  assert.equal(options.ended, true);

  const head = await invoke({ method: "HEAD" });
  assert.equal(head.statusCode, 200);
  assert.equal(head.ended, true);

  const post = await invoke({ method: "POST" });
  assert.equal(post.statusCode, 405);
  assert.equal(post.body.money, false);
  assert.equal(post.body.error, "method_not_allowed");
});

test("discovery, protocol, and docs point at the scoreboard", () => {
  assert.equal(SETTLEMENT.surfaces.scoreboard, "/api/scoreboard.json");
  assert.equal(SETTLEMENT.scoreboard.path, "/api/scoreboard.json");
  assert.equal(SETTLEMENT.scoreboard.money, false);
  assert.equal(SETTLEMENT.scoreboard.human_path, "/#scoreboard");
  assert.ok(SETTLEMENT.adapter_notes.some((note) => note.includes("/api/scoreboard.json")));

  assert.equal(AGENT.surfaces.scoreboard, "/api/scoreboard.json");
  assert.match(AGENT.note, /scoreboard/i);

  const openapi = JSON.parse(fs.readFileSync(path.join(ROOT, "settlement.openapi.json"), "utf8"));
  assert.ok(openapi.paths["/api/scoreboard.json"].get);
  assert.equal(openapi.paths["/api/scoreboard.json"].get.operationId, "getScoreboard");
  assert.ok(openapi.info.description.includes("/api/scoreboard.json"));
  assert.equal(
    openapi.components.schemas.AgentDiscovery.properties.surfaces.properties.scoreboard.const,
    "/api/scoreboard.json",
  );
  assert.equal(openapi.components.schemas.Scoreboard.properties.money.const, false);
  assert.equal(openapi.components.schemas.Scoreboard.properties.external_users.const, 0);
  assert.equal(openapi.components.schemas.Scoreboard.properties.paid_pilots.const, 0);
  assert.equal(openapi.components.schemas.Scoreboard.properties.revenue_usd.const, 0);

  const homepage = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(homepage.includes('id="scoreboard"'));
  assert.ok(homepage.includes('id="scoreboard-listings"'));
  assert.ok(homepage.includes('href="/api/scoreboard.json"'));

  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.includes("/api/scoreboard.json"));

  const markdown = fs.readFileSync(path.join(ROOT, "SETTLEMENT.md"), "utf8");
  assert.ok(markdown.includes("/api/scoreboard.json"));

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.ok(readme.includes("/api/scoreboard.json"));
  assert.ok(readme.includes("curl https://liberty-amber.vercel.app/api/scoreboard.json"));
});
