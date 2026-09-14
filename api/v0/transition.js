"use strict";

const { handleHttp } = require("../_lib/settlement-transition");

function parseBody(raw) {
  if (raw == null || raw === "") return {};
  if (Buffer.isBuffer(raw)) {
    const text = raw.toString("utf8").trim();
    if (!text) return {};
    return JSON.parse(text);
  }
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return {};
    return JSON.parse(text);
  }
  if (typeof raw === "object") return raw;
  const error = new Error("Body must be JSON.");
  error.code = "invalid_json";
  throw error;
}

module.exports = async function handler(req, res) {
  let body;
  try {
    body = parseBody(req.body);
  } catch {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(400).json({
      ok: false,
      mode: "demo",
      money: false,
      error: "invalid_json",
      message: "Body must be JSON.",
    });
  }

  const result = handleHttp({ method: req.method, body });
  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value);
  }
  if (result.body == null) return res.status(result.status).end();
  return res.status(result.status).json(result.body);
};
