// Voice lab — draft voice.md fields from examples, never from adjectives.
// Browser: window.LibertyVoice. Node: `node voice-lab.js` runs the checks.

(function (root) {
  const STOP = new Set(`
    a an the and or but if in on at to for of as is are was were be been being
    it this that these those i you we they he she my your our their with from by
    not no so than then just into over after before about up out all any each
    do did does doing done have has had having will would could should can
    me him her us them myself yourself itself when what which who whom whose
    there here where why how too very really also more most some such only own same
    other another both few many much every either neither nor yet already still
    because while during without within against through between among under
    again further once twice always never ever something anything nothing
    i'm i've i'd you're you'll we've they're that's it's what's here's
    dont don't cant can't wont won't
  `.trim().split(/\s+/));

  const WEAK = new Set(`
    thing things stuff people person someone everybody anyone
    good bad great nice well way ways kind type types part parts
    time times day days year years today now new old first last
    get got getting make made making use used using
    want wanted like liked look looks looking
    one two three four five six
    introduce introducing collection collections experience experiences
    moments moment product products page email note
    version small left
  `.trim().split(/\s+/));

  const MIN_PROUD = { words: 20, sents: 2 };
  const MIN_HATE = { words: 10, sents: 1 };

  function normalize(text) {
    return String(text || "").replace(/\r\n/g, "\n").trim();
  }

  function words(text) {
    const raw = normalize(text).toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    return raw.match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) || [];
  }

  function splitSentences(text) {
    const blocks = normalize(text).split(/\n+/);
    const out = [];
    for (const block of blocks) {
      const cleaned = block.replace(/^[-*•]\s+/, "").trim();
      if (!cleaned) continue;
      const parts = cleaned.split(/(?<=[.!?])\s+(?=[A-Z“"‘'\d])/);
      for (const part of parts) {
        const s = part.trim();
        if (s.length >= 20) out.push(s);
      }
    }
    return unique(out);
  }

  function unique(list) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function quote(sentence) {
    const t = sentence.replace(/^["“„«]|["”»]$/g, "").trim();
    return `“${t}”`;
  }

  function firstExcerpt(text) {
    const paras = normalize(text).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    if (paras[0] && paras[0].length >= 40) return paras[0];
    return splitSentences(text).slice(0, 2).join(" ");
  }

  function assessPile(text, min) {
    const w = words(text).length;
    const sents = splitSentences(text);
    return {
      ok: w >= min.words && sents.length >= min.sents,
      words: w,
      sents: sents.length,
      sentences: sents
    };
  }

  function originalCasing(phrase, source) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const m = source.match(new RegExp(escaped, "i"));
    return m ? m[0].replace(/\s+/g, " ") : phrase;
  }

  function clauses(text) {
    const out = [];
    for (const sent of splitSentences(text)) {
      for (const bit of sent.split(/\s*[,;:–—]\s*|\s+--\s+/)) {
        const t = bit.trim();
        if (words(t).length) out.push(t);
      }
    }
    return out;
  }

  function contentCount(slice) {
    return slice.filter((w) => !STOP.has(w)).length;
  }

  function candidatesFromClause(clause) {
    const list = words(clause);
    const found = [];
    for (let n = 3; n >= 1; n--) {
      for (let i = 0; i <= list.length - n; i++) {
        const slice = list.slice(i, i + n);
        if (n >= 2) {
          if (STOP.has(slice[0]) || STOP.has(slice[n - 1])) continue;
          if (contentCount(slice) < 2) continue;
          if (n === 3 && /^(and|or|but)$/.test(slice[1])) continue;
        } else {
          const w = slice[0];
          if (STOP.has(w) || WEAK.has(w)) continue;
          if (w.length < 6 && !w.includes("-")) continue;
        }
        found.push({
          phrase: slice.join(" "),
          n,
          start: i,
          end: i + n,
          score: n * 2 + contentCount(slice) + (slice.some((w) => w.includes("-")) ? 2 : 0)
        });
      }
    }
    found.sort((a, b) => b.score - a.score || b.n - a.n);
    const picked = [];
    const used = new Set();
    for (const item of found) {
      let hit = false;
      for (let i = item.start; i < item.end; i++) {
        if (used.has(i)) hit = true;
      }
      if (hit) continue;
      picked.push(item);
      for (let i = item.start; i < item.end; i++) used.add(i);
    }
    return picked;
  }

  function topPhrases(text, { limit = 8, exclude = new Set() } = {}) {
    const counts = new Map();
    for (const clause of clauses(text)) {
      for (const item of candidatesFromClause(clause)) {
        if (item.phrase.split(" ").some((w) => exclude.has(w) && item.n === 1)) continue;
        if (exclude.has(item.phrase)) continue;
        const prev = counts.get(item.phrase) || { count: 0, n: item.n };
        prev.count += 1;
        counts.set(item.phrase, prev);
      }
    }
    const scored = [...counts.entries()].map(([phrase, info]) => ({
      phrase,
      n: info.n,
      score: info.count * (info.n + 0.5) + (phrase.length > 12 ? 0.3 : 0)
    }));
    scored.sort((a, b) => b.score - a.score || b.n - a.n);
    const picked = [];
    for (const item of scored) {
      if (picked.some((p) => p.includes(item.phrase) || item.phrase.includes(p))) continue;
      picked.push(item.phrase);
      if (picked.length >= limit) break;
    }
    return picked.map((p) => originalCasing(p, text));
  }

  function formatPhrases(phrases) {
    if (!phrases.length) return "";
    return phrases.map((p) => p.replace(/\.$/, "")).join(". ") + ".";
  }

  function assessPiles(proud, hate) {
    const good = assessPile(proud, MIN_PROUD);
    const bad = assessPile(hate, MIN_HATE);
    const notes = [];
    if (!good.ok) {
      notes.push("Need more writing you’re proud of. Paste at least two real sentences — a note, a product page, an email you’d send. I will not invent a voice from a fragment.");
    }
    if (!bad.ok) {
      notes.push("Need more writing you hate. Paste a line of yours you regret, or a blob of generic AI. I need something to ban.");
    }
    return {
      good,
      bad,
      enough: good.ok || bad.ok,
      full: good.ok && bad.ok,
      notes
    };
  }

  function deriveVoiceDraft(proud, hate) {
    const report = assessPiles(proud, hate);
    const fields = {};
    const missing = [];

    if (!report.enough) {
      return {
        ok: false,
        fields,
        notes: report.notes,
        missing: ["sounds", "never", "use", "skip", "good", "bad"]
      };
    }

    const goodWords = new Set(words(proud));
    const badWords = new Set(words(hate));
    const both = new Set([...goodWords].filter((w) => badWords.has(w)));

    if (report.good.ok) {
      const quoted = report.good.sentences.slice(0, 3).map(quote);
      fields.sounds = quoted.join("\n");
      fields.good = firstExcerpt(proud);
      const use = topPhrases(proud, {
        limit: 8,
        exclude: both
      });
      if (use.length) fields.use = formatPhrases(use);
      else missing.push("use");
    } else {
      missing.push("sounds", "use", "good");
    }

    if (report.bad.ok) {
      const quoted = report.bad.sentences.slice(0, 2).map(quote);
      fields.never = quoted.join("\n");
      fields.bad = firstExcerpt(hate);
      const skip = topPhrases(hate, {
        limit: 8,
        exclude: both
      });
      if (skip.length) fields.skip = formatPhrases(skip);
      else missing.push("skip");
    } else {
      missing.push("never", "skip", "bad");
    }

    return {
      ok: true,
      fields,
      notes: report.notes,
      missing
    };
  }

  const api = { deriveVoiceDraft, assessPiles, splitSentences, words };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LibertyVoice = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const { deriveVoiceDraft, splitSentences } = module.exports;
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

  const thin = deriveVoiceDraft("nice lamp", "bad");
  eq("thin is not enough", thin.ok, false);
  eq("thin invents nothing", Object.keys(thin.fields).length, 0);
  ok("thin asks for proud writing", /proud/i.test(thin.notes.join(" ")));
  ok("thin asks for hated writing", /hate/i.test(thin.notes.join(" ")));

  const proud = [
    "This one left the bench on a Tuesday. The brass will darken where you touch it.",
    "If you want it brighter, use a 60-watt-equivalent warm bulb.",
    "I don’t do wholesale. I barely do shipping. That’s the honest version."
  ].join("\n\n");
  const hate = [
    "Introducing our heritage-inspired lighting collection — meticulously crafted to elevate everyday moments and bring luxury warmth into your sanctuary.",
    "Unlock a curated lighting experience that seamlessly elevates your space. Join the list for our limited drop of artisanal luxury fixtures!"
  ].join("\n\n");

  const half = deriveVoiceDraft(proud, "meh");
  eq("proud-only is ok", half.ok, true);
  ok("proud-only quotes a bench sentence", /left the bench/.test(half.fields.sounds));
  ok("proud-only does not invent never", !half.fields.never);
  ok("proud-only notes missing hate", /hate/i.test(half.notes.join(" ")));

  const draft = deriveVoiceDraft(proud, hate);
  eq("full draft ok", draft.ok, true);
  eq("full draft no extra notes", draft.notes.length, 0);
  ok("sounds are quotes", /^“/.test(draft.fields.sounds) && draft.fields.sounds.includes("\n“"));
  ok("sounds come from the pile", proud.includes("left the bench on a Tuesday"));
  ok("sounds include first sentence", /left the bench on a Tuesday/.test(draft.fields.sounds));
  ok("never is quoted from hate", /heritage-inspired/.test(draft.fields.never) && /^“/.test(draft.fields.never));
  ok("skip bans elevate or curated or luxury", /elevate|curated|luxury/i.test(draft.fields.skip));
  ok("skip is not a sliding window", !/will darken where|tuesday the brass|to elevate everyday/i.test(draft.fields.skip + draft.fields.use));
  ok("use keeps a real proud phrase", /bench|brass|wholesale|warm bulb|honest/i.test(draft.fields.use));
  ok("does not invent corporate adjectives", !/friendly and confident|brand voice|conversational yet/i.test(JSON.stringify(draft.fields)));
  ok("good excerpt is from proud", /bench|brass|wholesale/.test(draft.fields.good));
  ok("bad excerpt is from hate", /heritage-inspired|Unlock a curated/.test(draft.fields.bad));
  ok("sentence split keeps Harbor lines", splitSentences(proud).length >= 2);

  if (failed) {
    console.error(failed + " checks failed");
    process.exit(1);
  }
  console.log("voice-lab checks passed");
}
