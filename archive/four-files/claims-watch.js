// Claims watch — flag overclaim phrases the user already wrote.
// Browser: window.LibertyClaims. Node: `node claims-watch.js` runs the checks.

(function (root) {
  const COMPANY_KEYS = ["sells", "serves", "money", "believes", "different"];
  const OFFER_KEYS = ["packages", "deliverables", "pricing", "proof", "promises", "fit"];

  // Starter hype, plus a few cousins. We only report text that is already on the page.
  const PATTERNS = [
    { id: "used-by", re: /\bused by\s+[^.!?\n,]{1,48}/gi },
    { id: "number-one", re: /#\s*1\b|\bnumber[\s-]?one\b|\bno\.\s*1\b/gi },
    { id: "enterprise-grade", re: /\benterprise[\s-]?grade\b/gi },
    { id: "guaranteed", re: /\bguaranteed\b|\bwe guarantee\b/gi },
    { id: "ai-will", re: /\bai will\b/gi },
    { id: "military-grade", re: /\b(?:military|bank|nasa|hospital)[\s-]?grade\b/gi },
    { id: "no-risk", re: /\bno risk\b|\brisk[\s-]?free\b|\bzero risk\b/gi },
    { id: "forever", re: /\bforever\b/gi },
    { id: "instant-results", re: /\binstant results\b|\bovernight results\b/gi },
    { id: "class-approved", re: /\bclass[\s-]?approved\b/gi },
    { id: "fraser", re: /\bfraser replacement\b|\breplacement for fraser\b/gi },
    { id: "best-in-class", re: /\bbest[\s-]?in[\s-]?class\b/gi },
    { id: "industry-leading", re: /\bindustry[\s-]?leading\b/gi },
    { id: "worlds-leading", re: /\bworld'?s (?:leading|best|#\s*1)\b/gi },
    { id: "revolutionary", re: /\brevolutionary\b/gi },
    { id: "cutting-edge", re: /\bcutting[\s-]?edge\b/gi },
    { id: "game-changer", re: /\bgame[\s-]?chang(?:er|ing)\b/gi },
    { id: "never-fails", re: /\bnever fails?\b/gi },
    { id: "ten-x", re: /\b10x\b/gi }
  ];

  const FIELD_LABELS = {
    sells: "What do you sell?",
    serves: "Who is it for?",
    money: "How do you make money?",
    believes: "What do you believe?",
    different: "What makes you different?",
    packages: "What is the package?",
    deliverables: "What do they get?",
    pricing: "Price and why it is that price",
    proof: "What is actually true today?",
    promises: "Promises you will keep",
    fit: "Good fit / bad fit"
  };

  function normalizeSpace(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function sourcesFromState(state) {
    const company = (state && state.company) || {};
    const offer = (state && state.offer) || {};
    const out = [];
    for (const key of COMPANY_KEYS) {
      out.push({ file: "company", key, text: String(company[key] || "") });
    }
    for (const key of OFFER_KEYS) {
      out.push({ file: "offer", key, text: String(offer[key] || "") });
    }
    return out;
  }

  function excerptAround(text, index, length) {
    let start = index;
    let end = index + length;
    while (start > 0 && !/[\n.!?;]/.test(text[start - 1]) && index - start < 52) start -= 1;
    while (start < index && /\s/.test(text[start])) start += 1;
    while (end < text.length && !/[\n.!?;]/.test(text[end]) && end - (index + length) < 36) end += 1;
    return normalizeSpace(text.slice(start, end)).replace(/^[-–—,:;]+\s*/, "").replace(/\s*[-–—,:;]+$/, "");
  }

  function scanClaims(state) {
    const hits = [];
    const seen = new Set();
    for (const src of sourcesFromState(state)) {
      if (!src.text.trim()) continue;
      for (const pat of PATTERNS) {
        const re = new RegExp(pat.re.source, pat.re.flags);
        let m;
        while ((m = re.exec(src.text))) {
          const match = normalizeSpace(m[0]);
          if (!match) continue;
          const excerpt = excerptAround(src.text, m.index, m[0].length) || match;
          const dedupe = match.toLowerCase();
          if (seen.has(dedupe)) continue;
          seen.add(dedupe);
          hits.push({
            id: pat.id,
            match,
            excerpt,
            file: src.file,
            key: src.key,
            label: FIELD_LABELS[src.key] || src.key
          });
        }
      }
    }
    return hits;
  }

  function alreadyCovered(avoidText, hit) {
    const avoid = String(avoidText || "").toLowerCase();
    if (!avoid.trim()) return false;
    const match = String(hit && hit.match ? hit.match : hit || "").toLowerCase();
    if (match && avoid.includes(match)) return true;
    const excerpt = String((hit && hit.excerpt) || "").toLowerCase();
    return !!(excerpt && excerpt.length >= 8 && avoid.includes(excerpt));
  }

  function remainingHits(state) {
    const avoid = ((state && state.offer) || {}).avoid || "";
    return scanClaims(state).filter((hit) => !alreadyCovered(avoid, hit));
  }

  function claimLine(hit) {
    const phrase = normalizeSpace((hit && (hit.excerpt || hit.match)) || "");
    const trimmed = phrase.replace(/^["“„«]|["”»]$/g, "");
    return `Never claim “${trimmed}”.`;
  }

  function addClaimLine(avoidText, hit) {
    if (alreadyCovered(avoidText, hit)) return String(avoidText || "");
    const line = claimLine(hit);
    const current = String(avoidText || "").trim();
    return current ? current + "\n" + line : line;
  }

  function formatStillSays(hits, limit) {
    const n = limit || 3;
    const phrases = hits.slice(0, n).map((h) => `“${normalizeSpace(h.match)}”`);
    if (!phrases.length) return "";
    if (phrases.length === 1) return `Your pack still says ${phrases[0]}.`;
    if (hits.length > n) {
      return `Your pack still says ${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]} — and more.`;
    }
    return `Your pack still says ${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}.`;
  }

  const api = {
    scanClaims,
    remainingHits,
    alreadyCovered,
    addClaimLine,
    claimLine,
    formatStillSays,
    COMPANY_KEYS,
    OFFER_KEYS
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LibertyClaims = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const {
    scanClaims,
    remainingHits,
    alreadyCovered,
    addClaimLine,
    formatStillSays
  } = module.exports;
  let failed = 0;
  function eq(name, got, want) {
    if (got !== want) {
      failed += 1;
      console.error("FAIL", name, { got, want });
    }
  }
  function ok(name, cond) {
    if (!cond) {
      failed += 1;
      console.error("FAIL", name);
    }
  }

  const empty = scanClaims({});
  eq("empty pack has no hits", empty.length, 0);

  const harbor = {
    company: {
      sells: "Harbor Lamp makes small-batch brass table lamps and wall sconces. Each one is spun, soldered, and wired by one pair of hands in a garage workshop in Portland, Maine.",
      serves: "People who want one good lamp in a room they actually live in.",
      money: "Almost all of it is the shop: $240–$380 per lamp, shipped in the lower 48.",
      believes: "A lamp should outlive the person who bought it. Brass should be allowed to tarnish.",
      different: "One maker. No catalog of 400 SKUs. If something is wrong, you email the person who built it."
    },
    offer: {
      packages: "One lamp at a time. Table lamp or wall sconce.",
      deliverables: "The lamp, a spare bulb, a care card, and a handwritten note.",
      pricing: "$240 for the small table lamp. It is not cheap because cheap lamps already exist.",
      proof: "Fourteen lamps sold this year. Three rewires completed, no charge.",
      promises: "It will be heavy. Emails get a reply from me within two days.",
      avoid: "Never invent a waitlist. Never imply this is a studio with apprentices.",
      fit: "Good fit: you want one lamp. Bad fit: twenty matching fixtures by Friday."
    }
  };
  eq("Harbor Lamp stays clean", scanClaims(harbor).length, 0);

  const hype = {
    company: {
      sells: "We sell enterprise-grade coaching used by 400 schools. AI will write your briefs. Military-grade security. #1 in the category."
    },
    offer: {
      promises: "Guaranteed instant results. No risk. Fraser replacement. Forever.",
      avoid: ""
    }
  };
  const hits = scanClaims(hype);
  ok("finds used by", hits.some((h) => /used by 400 schools/i.test(h.match)));
  ok("finds enterprise-grade", hits.some((h) => /enterprise-grade/i.test(h.match)));
  ok("finds AI will", hits.some((h) => /ai will/i.test(h.match)));
  ok("finds military-grade", hits.some((h) => /military-grade/i.test(h.match)));
  ok("finds #1", hits.some((h) => /#\s*1/.test(h.match)));
  ok("finds guaranteed", hits.some((h) => /guaranteed/i.test(h.match)));
  ok("finds instant results", hits.some((h) => /instant results/i.test(h.match)));
  ok("finds no risk", hits.some((h) => /no risk/i.test(h.match)));
  ok("finds Fraser replacement", hits.some((h) => /fraser replacement/i.test(h.match)));
  ok("finds forever", hits.some((h) => /forever/i.test(h.match)));
  ok("does not invent a waitlist claim", !hits.some((h) => /waitlist|apprentice|heirloom/i.test(h.match + h.excerpt)));
  ok("does not scan customer copy", scanClaims({
    customer: { icp: "Guaranteed #1 enterprise-grade buyers. AI will." },
    company: {},
    offer: {}
  }).length === 0);

  const covered = {
    company: { sells: "enterprise-grade lamps" },
    offer: { avoid: "Never claim “enterprise-grade”.", promises: "Guaranteed replies." }
  };
  ok("enterprise-grade is covered", alreadyCovered(covered.offer.avoid, { match: "enterprise-grade", excerpt: "enterprise-grade lamps" }));
  const left = remainingHits(covered);
  eq("covered hit drops out", left.filter((h) => h.id === "enterprise-grade").length, 0);
  ok("uncovered guaranteed remains", left.some((h) => h.id === "guaranteed"));

  const added = addClaimLine("", { match: "guaranteed", excerpt: "Guaranteed instant results" });
  ok("add line quotes their words", /Never claim “Guaranteed instant results”/.test(added));
  eq("add is idempotent", addClaimLine(added, { match: "guaranteed", excerpt: "Guaranteed instant results" }), added);

  const warn = formatStillSays(remainingHits(hype));
  ok("finish warning names a hit", /still says/.test(warn) && /enterprise-grade|#1|guaranteed/i.test(warn));

  const avoidOnly = scanClaims({
    offer: { avoid: "Never say guaranteed, #1, enterprise-grade, AI will." }
  });
  eq("does not scan claims-to-avoid itself", avoidOnly.length, 0);

  if (failed) {
    console.error(failed + " checks failed");
    process.exit(1);
  }
  console.log("claims-watch checks passed");
}
