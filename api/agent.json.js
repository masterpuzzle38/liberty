"use strict";

const OPENAPI = require("../settlement.openapi.json");
const { AGENT, TOOLS, serveProtocol } = require("./_lib/settlement-protocol");

// Hobby deployments allow 12 functions. /api/tools.json and /api/openapi.json
// rewrite here (?doc=tools / ?doc=openapi) instead of adding more api/*.json.js files.
// /openapi.json rewrites to the static settlement.openapi.json file.
function documentFor(req) {
  const url = String(req.url || "");
  if (url.includes("doc=tools") || /(?:^|[/?])tools\.json(?:\?|$)/.test(url)) {
    return TOOLS;
  }
  if (url.includes("doc=openapi") || /(?:^|[/?])openapi\.json(?:\?|$)/.test(url)) {
    return OPENAPI;
  }
  return AGENT;
}

module.exports = function handler(req, res) {
  return serveProtocol(documentFor(req), req, res);
};
