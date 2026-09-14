"use strict";

const { SETTLEMENT, serveProtocol } = require("./_lib/settlement-protocol");

module.exports = function handler(req, res) {
  return serveProtocol(SETTLEMENT, req, res);
};
