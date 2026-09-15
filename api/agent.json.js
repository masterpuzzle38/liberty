"use strict";

const { AGENT, TOOLS, serveProtocol } = require("./_lib/settlement-protocol");

// Hobby deployments allow 12 functions. /api/tools.json rewrites here (?doc=tools)
// instead of adding a 13th api/*.json.js file.
function documentFor(req) {
  const url = String(req.url || "");
  if (url.includes("doc=tools") || /(?:^|[/?])tools\.json(?:\?|$)/.test(url)) {
    return TOOLS;
  }
  return AGENT;
}

module.exports = function handler(req, res) {
  return serveProtocol(documentFor(req), req, res);
};
