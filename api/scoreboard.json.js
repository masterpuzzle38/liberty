"use strict";

const { SCOREBOARD, serveProtocol } = require("./_lib/settlement-protocol");

module.exports = function handler(req, res) {
  return serveProtocol(SCOREBOARD, req, res);
};
