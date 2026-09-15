"use strict";

const { EXAMPLES, serveProtocol } = require("./_lib/settlement-protocol");

module.exports = function handler(req, res) {
  return serveProtocol(EXAMPLES, req, res);
};
