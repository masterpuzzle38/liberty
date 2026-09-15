"use strict";

const { AGENT, serveProtocol } = require("./_lib/settlement-protocol");

module.exports = function handler(req, res) {
  return serveProtocol(AGENT, req, res);
};
