"use strict";

const OPENAPI = require("../settlement.openapi.json");
const { AGENT, TOOLS, QUICKSTART, TRANSITION_SCHEMA, QUOTE_SCHEMA, RECEIPT_SCHEMA, HANDOFF_SCHEMA, SIMULATE_SCHEMA, ERRORS, serveProtocol } = require("./_lib/settlement-protocol");

// Hobby deployments allow 12 functions. /api/tools.json, /api/openapi.json,
// /api/quickstart.json, /api/schemas/transition.json, /api/schemas/quote.json,
// /api/schemas/receipt.json, /api/schemas/handoff.json, /api/schemas/simulate.json,
// and /api/errors.json rewrite here instead of adding more api/*.json.js files.
// /openapi.json rewrites to the static settlement.openapi.json file.
function documentFor(req) {
  const url = String(req.url || "");
  if (url.includes("doc=tools") || /(?:^|[/?])tools\.json(?:\?|$)/.test(url)) {
    return TOOLS;
  }
  if (url.includes("doc=openapi") || /(?:^|[/?])openapi\.json(?:\?|$)/.test(url)) {
    return OPENAPI;
  }
  if (url.includes("doc=quickstart") || /(?:^|[/?])quickstart\.json(?:\?|$)/.test(url)) {
    return QUICKSTART;
  }
  if (
    url.includes("doc=transition-schema")
    || /(?:^|[/?])schemas\/transition\.json(?:\?|$)/.test(url)
  ) {
    return TRANSITION_SCHEMA;
  }
  if (
    url.includes("doc=quote-schema")
    || /(?:^|[/?])schemas\/quote\.json(?:\?|$)/.test(url)
  ) {
    return QUOTE_SCHEMA;
  }
  if (
    url.includes("doc=receipt-schema")
    || /(?:^|[/?])schemas\/receipt\.json(?:\?|$)/.test(url)
  ) {
    return RECEIPT_SCHEMA;
  }
  if (
    url.includes("doc=handoff-schema")
    || /(?:^|[/?])schemas\/handoff\.json(?:\?|$)/.test(url)
  ) {
    return HANDOFF_SCHEMA;
  }
  if (
    url.includes("doc=simulate-schema")
    || /(?:^|[/?])schemas\/simulate\.json(?:\?|$)/.test(url)
  ) {
    return SIMULATE_SCHEMA;
  }
  if (url.includes("doc=errors") || /(?:^|[/?])errors\.json(?:\?|$)/.test(url)) {
    return ERRORS;
  }
  return AGENT;
}

module.exports = function handler(req, res) {
  return serveProtocol(documentFor(req), req, res);
};
