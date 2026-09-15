"use strict";

const HEALTH = require("./health.json");
const SETTLEMENT = require("./settlement.json");
const EXAMPLES = require("./examples.json");

function protocolHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Liberty-Key",
    "Cache-Control": "public, max-age=300",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function serveProtocol(doc, req, res) {
  const headers = protocolHeaders();
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  const verb = (req.method || "GET").toUpperCase();
  if (verb === "OPTIONS") {
    return res.status(204).end();
  }
  if (verb === "HEAD") {
    return res.status(200).end();
  }
  if (verb !== "GET") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    return res.status(405).json({
      ok: false,
      mode: "demo",
      money: false,
      error: "method_not_allowed",
      message: "GET this path for the Settlement protocol document.",
    });
  }
  return res.status(200).json(doc);
}

module.exports = {
  HEALTH,
  SETTLEMENT,
  EXAMPLES,
  protocolHeaders,
  serveProtocol,
};
