"use strict";

const { HEALTH, serveProtocol } = require("./_lib/settlement-protocol");

module.exports = function handler(req, res) {
  return serveProtocol(HEALTH, req, res);
};
