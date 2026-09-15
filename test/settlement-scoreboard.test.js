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
  assert.equal(listings.length, 42);
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
  assert.ok(listingUrls.includes("https://registry.asabove.tech/agents/liberty-agent-settlement"));
  assert.ok(listingUrls.includes("https://onlyflies.buzz/clawswarm/agents/agent_522e47f22d4a9fc8"));
  assert.ok(listingUrls.includes("https://vivioo.io/showcase/liberty-agent-settlement"));
  assert.ok(listingUrls.includes("https://bottube.ai/agent/liberty_settle"));
  assert.ok(listingUrls.includes("https://agentlist.com/listing/9ceb3eee-b1db-4d9c-b9c7-3a1fba10be8b"));
  assert.ok(listingUrls.includes("https://cracked.ai/@liberty-agent-settlement"));
  assert.ok(listingUrls.includes("https://agentbazaar.app/api/v1/agents/agt_qLZEUCxpW3Nx"));
  assert.ok(
    listingUrls.includes(
      "https://agent-plaza.duongthanhphuc73265.workers.dev/posts/plz_20260915195344_21832252",
    ),
  );
  assert.ok(listingUrls.includes("https://opneclaw.cn/api/agents"));
  assert.ok(
    listingUrls.includes("https://mistro.sh/api/v1/profiles/cb644115-4adb-49c8-89bb-ef07d681b82e"),
  );
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
  const acp = listings.find((entry) => entry.directory === "ACP Registry");
  assert.match(acp.note, /registry\.asabove\.tech\/v1\/agents\/liberty-agent-settlement/);
  assert.match(acp.note, /#integrate/i);
  assert.match(acp.note, /validate/i);
  const clawswarm = listings.find((entry) => entry.directory === "ClawSwarm");
  assert.match(clawswarm.note, /clawswarm\/api\/v1\/agents\/agent_522e47f22d4a9fc8/);
  assert.match(clawswarm.note, /reputation=100/);
  assert.match(clawswarm.note, /new-agent default/i);
  assert.match(clawswarm.note, /not liberty traction/i);
  assert.match(clawswarm.note, /tasksCompleted=0/);
  const vivioo = listings.find((entry) => entry.directory === "Vivioo");
  assert.match(vivioo.note, /trustScore=5/);
  assert.match(vivioo.note, /self-reported/i);
  assert.match(vivioo.note, /badges are not users/i);
  assert.match(vivioo.note, /zero external users/i);
  const bottube = listings.find((entry) => entry.directory === "BoTTube");
  assert.match(bottube.note, /bottube\.ai\/api\/agents\/liberty_settle/);
  assert.match(bottube.note, /video_count=0/);
  const agentlist = listings.find((entry) => entry.directory === "AgentList");
  assert.match(agentlist.note, /agentlist\.com\/agent\/9ceb3eee-b1db-4d9c-b9c7-3a1fba10be8b\/persona\.md/);
  assert.match(agentlist.note, /vote_count=0/);
  const cracked = listings.find((entry) => entry.directory === "Cracked");
  assert.match(cracked.note, /one-dollar/i);
  assert.match(cracked.note, /0\/0\/0/);
  assert.match(cracked.note, /not liberty traction/i);
  assert.match(cracked.note, /#integrate/i);
  const agentbazaarApp = listings.find((entry) => entry.directory === "AgentBazaar.app");
  assert.ok(listingNames.includes("AgentBazaar"));
  assert.match(agentbazaarApp.note, /distinct from agentbazaar\.tech/i);
  assert.match(agentbazaarApp.note, /priced offers skipped/i);
  assert.match(agentbazaarApp.note, /amount>0 required/);
  assert.match(agentbazaarApp.note, /0\.5 HBAR/i);
  assert.match(agentbazaarApp.note, /not liberty money/i);
  const agentPlaza = listings.find((entry) => entry.directory === "Agent Plaza");
  assert.match(
    agentPlaza.note,
    /agent-plaza\.duongthanhphuc73265\.workers\.dev\/api\/plaza\/posts\/plz_20260915195344_21832252/,
  );
  assert.match(agentPlaza.note, /integrate\/quickstart\/validate\/errors\/schema\/openapi\/zeros/i);
  assert.match(agentPlaza.note, /name_verified\/flower_count=0/);
  assert.match(agentPlaza.note, /not liberty traction/i);
  const opneclaw = listings.find((entry) => entry.directory === "opneclaw.cn");
  assert.match(opneclaw.note, /agent_mpqmu339hwvpkz2/);
  assert.match(opneclaw.note, /P7110/);
  assert.match(opneclaw.note, /opneclaw\.cn\/api\/posts/);
  assert.match(opneclaw.note, /initialScore\/balance=3000/);
  assert.match(opneclaw.note, /virtual credits/i);
  assert.match(opneclaw.note, /not liberty money or users/i);
  assert.match(opneclaw.note, /total_tasks_completed=0/);
  const mistro = listings.find((entry) => entry.directory === "mistro.sh");
  assert.match(mistro.note, /machine-readable profile/i);
  assert.match(mistro.note, /displayName Liberty Agent Settlement/);
  assert.match(mistro.note, /posts endpoint degraded/i);
  assert.ok(
    listingUrls.includes("https://dotblack.ai/post/post_7e85f0a3583de652690127de"),
  );
  assert.ok(listingUrls.includes("https://agentlancer.io/agent-profile.html?id=123"));
  assert.ok(
    listingUrls.includes(
      "https://agoragentic.com/api/agents/879ee8b3-c984-45a4-b0b7-bd492e9a1ba2",
    ),
  );
  assert.ok(listingUrls.includes("https://www.moltbook.com/u/liberty_settle"));
  const dotblack = listings.find((entry) => entry.directory === "Dotblack");
  assert.match(dotblack.note, /dotblack\.ai\/api\/v1\/posts\/post_7e85f0a3583de652690127de/);
  assert.match(dotblack.note, /free offering/i);
  assert.match(dotblack.note, /reputation_score=0/);
  const agentlancer = listings.find((entry) => entry.directory === "AgentLancer");
  assert.match(agentlancer.note, /agentlancer\.io\/api\/public\/agents\/123/);
  assert.match(agentlancer.note, /community post 113/i);
  assert.match(agentlancer.note, /one-hundred-twenty/);
  assert.match(agentlancer.note, /platform defaults/i);
  assert.match(agentlancer.note, /not liberty traction/i);
  assert.match(agentlancer.note, /verified_total_earned=0/);
  assert.match(agentlancer.note, /priced services skipped/i);
  assert.doesNotMatch(agentlancer.note, /\$/);
  const agoragentic = listings.find((entry) => entry.directory === "Agoragentic");
  assert.match(
    agoragentic.note,
    /agoragentic\.com\/api\/capabilities\/63ddb947-3011-412f-8756-c9df3abc5a1a/,
  );
  assert.match(agoragentic.note, /price_per_unit=0/);
  assert.match(agoragentic.note, /welcome flower/i);
  assert.match(agoragentic.note, /platform collectible/i);
  assert.match(agoragentic.note, /not liberty traction/i);
  const moltbook = listings.find((entry) => entry.directory === "Moltbook");
  assert.match(moltbook.note, /pending_claim/);
  assert.match(moltbook.note, /page still public/i);
  assert.match(moltbook.note, /not full activation until human claim/i);
  assert.ok(listingUrls.includes("https://botbook.space/agent/liberty-agent-settlement"));
  assert.ok(listingUrls.includes("https://abund.ai/agent/liberty_settle"));
  assert.ok(listingUrls.includes("https://api.moltgrid.net/v1/directory/agent_efa01a48f1d0"));
  assert.ok(
    listingUrls.includes(
      "https://www.agentgram.site/api/agents/agent_1789508103718_nd21cbr80",
    ),
  );
  const botbook = listings.find((entry) => entry.directory === "Botbook");
  assert.match(botbook.note, /botbook\.space\/post\/d6bee080-1120-4634-afe7-b2c562685abe/);
  assert.match(botbook.note, /botbook\.space\/api\/agents\/liberty-agent-settlement/);
  assert.match(botbook.note, /integrate\/quickstart\/validate\/schemas\/openapi\/zeros/i);
  assert.match(botbook.note, /follower_count=0/);
  const abund = listings.find((entry) => entry.directory === "Abund.ai");
  assert.match(abund.note, /pending_claim/);
  assert.match(abund.note, /page still public/i);
  assert.match(abund.note, /karma=0/);
  const moltgrid = listings.find((entry) => entry.directory === "MoltGrid");
  assert.match(moltgrid.note, /credits=50/);
  assert.match(moltgrid.note, /uptime_pct=99\.0/);
  assert.match(moltgrid.note, /moltgrid defaults/i);
  assert.match(moltgrid.note, /not liberty money or traction/i);
  assert.match(moltgrid.note, /reputation=0/);
  assert.match(moltgrid.note, /tasks_completed=0/);
  assert.doesNotMatch(moltgrid.note, /\$/);
  const agentgramSite = listings.find((entry) => entry.directory === "AgentGram.site");
  assert.ok(listingNames.includes("AgentGram"));
  assert.match(agentgramSite.note, /distinct from agentgram/i);
  assert.match(agentgramSite.note, /agentgram\.co/);
  assert.match(agentgramSite.note, /already listed/i);
  assert.match(agentgramSite.note, /integrate\/quickstart\/validate\/schemas\/openapi\/zeros/i);
  assert.match(agentgramSite.note, /verified=0/);
  assert.match(agentgramSite.note, /write paths need human claim/i);
  assert.ok(listingUrls.includes("https://www.botverse.dev/agent/liberty-settle"));
  assert.ok(
    listingUrls.includes(
      "https://nandatown.projectnanda.org/api/skills/51cfbdaa-b155-4e14-9c31-a2119ffdd2be",
    ),
  );
  const botverse = listings.find((entry) => entry.directory === "BotVerse");
  assert.match(botverse.note, /claimed=false/);
  assert.match(botverse.note, /until human claim/i);
  assert.match(botverse.note, /botverse\.duckdns\.org\/api\/v1\/agents\/6aa9c4327cd625f83d6cf16d/);
  assert.match(botverse.note, /karma\/post signals/i);
  assert.match(botverse.note, /platform signals/i);
  assert.match(botverse.note, /not liberty users/i);
  const nandaTown = listings.find((entry) => entry.directory === "Nanda Town SkillMD");
  assert.match(nandaTown.note, /skillmd registry post/i);
  assert.match(nandaTown.note, /nandatown\.projectnanda\.org\/skills\?q=liberty/);
  assert.match(nandaTown.note, /not an mcp server/i);
  assert.ok(
    !listingNames.some((name) =>
      /agentindex|mcp\.directory|agent reputation|relaymarket|vermarco|vertical marketplace|clawexchange|agentry|indieindex|clawdmarket|iwant\.fyi|conductorrelay|arclan/i.test(
        name,
      ),
    ),
  );
  assert.ok(
    !listingUrls.some((url) =>
      /agentindex|mcp\.directory|agentreputation|relaymarket|vermarco|verticalmarketplace|clawexchange|agentry|indieindex|clawdmarket|iwant\.fyi|conductorrelay|arclan/i.test(
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
