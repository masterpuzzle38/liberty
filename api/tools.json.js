"use strict";

const { TOOLS, serveProtocol } = require("./_lib/settlement-protocol");

module.exports = function handler(req, res) {
  return serveProtocol(TOOLS, req, res);
};
